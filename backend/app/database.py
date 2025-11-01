"""
Подключение к PostgreSQL через SQLAlchemy (асинхронный режим)
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Создание асинхронного engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,  # Проверка соединения перед использованием
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Base класс для моделей
Base = declarative_base()


async def get_db() -> AsyncSession:
    """
    Dependency для получения database session в FastAPI endpoints
    
    Usage:
        @app.get("/")
        async def endpoint(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    """Создать все таблицы (для dev окружения)"""
    async with engine.begin() as conn:
        # В продакшене используй Alembic миграции!
        # await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables created/verified")


async def check_connection():
    """Проверка подключения к БД"""
    try:
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
        logger.info("✅ Database connection successful")
        return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False

