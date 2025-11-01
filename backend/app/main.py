"""
Scanner Logger Backend - FastAPI Application
Основной файл приложения с инициализацией и роутингом
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app
import time
import logging

from app.config import settings
from app.database import engine, create_tables
from app.api import events, dashboard, export_router

# Настройка логирования
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events: startup и shutdown"""
    # Startup
    logger.info("🚀 Starting Scanner Logger API...")
    logger.info(f"📊 Database: {settings.DATABASE_URL.split('@')[1]}")
    logger.info(f"🌍 CORS Origins: {settings.cors_origins_list}")
    
    # Создать таблицы если их нет
    await create_tables()
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down Scanner Logger API...")
    await engine.dispose()


# Инициализация приложения
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API для PWA системы сканирования штрихкодов",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware для логирования запросов
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Логирование всех запросов"""
    start_time = time.time()
    
    # Обработка запроса
    response = await call_next(request)
    
    # Логирование
    process_time = (time.time() - start_time) * 1000
    logger.info(
        f"{request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Time: {process_time:.2f}ms"
    )
    
    # Добавить header с временем обработки
    response.headers["X-Process-Time"] = f"{process_time:.2f}ms"
    
    return response


# Обработчик ошибок
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Глобальный обработчик ошибок"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "ok": False,
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else None
        }
    )


# Health check
@app.get("/health", tags=["System"])
async def health_check():
    """Проверка здоровья сервиса"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "database": "connected"
    }


# Ping endpoint
@app.get("/ping", tags=["System"])
async def ping():
    """Простая проверка доступности"""
    return {"ok": True, "message": "pong"}


# Подключение роутеров
app.include_router(
    events.router,
    prefix="/api/v1/events",
    tags=["Events"]
)

app.include_router(
    dashboard.router,
    prefix="/api/v1/dashboard",
    tags=["Dashboard"]
)

app.include_router(
    export_router.router,
    prefix="/api/v1/export",
    tags=["Export"]
)

# Prometheus метрики
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# Root endpoint
@app.get("/", tags=["System"])
async def root():
    """Корневой endpoint с информацией об API"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
        "metrics": "/metrics"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )

