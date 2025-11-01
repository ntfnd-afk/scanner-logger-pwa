"""
Конфигурация приложения через переменные окружения
"""
from pydantic_settings import BaseSettings
from typing import List, Union
from pydantic import field_validator


class Settings(BaseSettings):
    """Настройки приложения из .env файла"""
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://scanner:changeme@localhost:5432/scanner_logger"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # API Security
    API_KEY: str = "your_secret_api_key"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8080,https://your-pwa-domain.com"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Возвращает CORS_ORIGINS как список"""
        if isinstance(self.CORS_ORIGINS, str):
            if ',' in self.CORS_ORIGINS:
                return [origin.strip() for origin in self.CORS_ORIGINS.split(',')]
            return [self.CORS_ORIGINS.strip()] if self.CORS_ORIGINS.strip() else []
        return self.CORS_ORIGINS if isinstance(self.CORS_ORIGINS, list) else []
    
    # Redis (опционально)
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL: int = 10  # секунды
    
    # Application
    APP_NAME: str = "Scanner Logger API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    
    # Timezone
    TIMEZONE: str = "Europe/Moscow"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # Batch Settings
    MAX_BATCH_SIZE: int = 100
    
    # Dashboard
    ONLINE_THRESHOLD_SECONDS: int = 300  # 5 минут
    DASHBOARD_CACHE_TTL: int = 10  # секунды
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Singleton instance
settings = Settings()

