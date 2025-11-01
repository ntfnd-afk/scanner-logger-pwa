"""
Pydantic схемы для валидации данных событий
"""
from pydantic import BaseModel, Field, UUID4, validator
from typing import Optional, List
from datetime import datetime


class EventBase(BaseModel):
    """Базовая схема события"""
    uuid: Optional[UUID4] = Field(None, description="UUID события (генерируется если не указан)")
    ts: int = Field(..., description="Unix timestamp в миллисекундах", ge=0)
    type: str = Field(..., description="Тип события: ITEM, BOX, CLOSE, CITY, ERROR и т.д.", max_length=50)
    operator: str = Field(..., description="Имя сотрудника", max_length=100)
    client: Optional[str] = Field(None, description="Клиент", max_length=100)
    city: Optional[str] = Field(None, description="Город", max_length=100)
    box: Optional[str] = Field(None, description="Короб (формат: client/number)", max_length=100)
    code: Optional[str] = Field(None, description="Штрихкод товара или код события", max_length=500)
    details: Optional[str] = Field(None, description="Дополнительная информация")
    source: str = Field(default="pwa", description="Источник события", max_length=50)
    
    @validator('ts')
    def validate_timestamp(cls, v):
        """Проверка что timestamp не в будущем"""
        current_ms = int(datetime.now().timestamp() * 1000)
        if v > current_ms + 60000:  # допускаем небольшую погрешность (1 минута)
            raise ValueError("Timestamp cannot be in the future")
        return v
    
    # Валидация типов отключена - PWA использует динамические типы событий
    # @validator('type')
    # def validate_type(cls, v):
    #     """Проверка допустимых типов событий"""
    #     allowed_types = [
    #         'ITEM', 'BOX', 'CLOSE', 'CITY', 'CITY_CLOSE',
    #         'ERROR', 'REMOVE', 'BULK_REMOVE', 'AUTO_CLOSE',
    #         'BOX_NOT_CLOSED', 'CITY_NOT_CLOSED', 'NO_CITY', 'NO_BOX', 'CYRILLIC_ERROR'
    #     ]
    #     if v not in allowed_types:
    #         raise ValueError(f"Type must be one of: {', '.join(allowed_types)}")
    #     return v


class EventCreate(EventBase):
    """Схема для создания события"""
    pass


class EventResponse(EventBase):
    """Схема ответа с событием"""
    uuid: UUID4
    received_at: datetime = Field(..., description="Время получения сервером")
    created_at: datetime = Field(..., description="Время создания записи в БД")
    
    class Config:
        from_attributes = True  # для совместимости с SQLAlchemy моделями


class EventBatchRequest(BaseModel):
    """Запрос на батч-вставку событий"""
    events: List[EventCreate] = Field(..., description="Массив событий", max_items=100)
    
    @validator('events')
    def validate_batch_size(cls, v):
        """Проверка размера батча"""
        if len(v) == 0:
            raise ValueError("Batch must contain at least one event")
        if len(v) > 100:
            raise ValueError("Batch size cannot exceed 100 events")
        return v


class EventBatchResponse(BaseModel):
    """Ответ на батч-вставку"""
    ok: bool = Field(..., description="Успешность операции")
    inserted: int = Field(..., description="Количество вставленных записей")
    skipped: int = Field(..., description="Количество пропущенных записей (дубликаты)")
    duplicates: List[str] = Field(default=[], description="UUID дубликатов")
    errors: List[str] = Field(default=[], description="Ошибки валидации")


class VerifyUUIDRequest(BaseModel):
    """Запрос на проверку существующих UUID"""
    uuids: List[str] = Field(..., description="Массив UUID для проверки", max_items=1000)
    
    @validator('uuids')
    def validate_uuids(cls, v):
        """Проверка что список не пустой"""
        if len(v) == 0:
            raise ValueError("UUID list cannot be empty")
        return v


class VerifyUUIDResponse(BaseModel):
    """Ответ на проверку UUID"""
    ok: bool = True
    present: List[str] = Field(..., description="UUID которые уже существуют в БД")


class RemoveItemRequest(BaseModel):
    """Запрос на удаление товара"""
    operator: str = Field(..., description="Имя оператора", max_length=100)
    box: str = Field(..., description="Короб", max_length=100)
    code: str = Field(..., description="Штрихкод товара", max_length=500)
    reason: Optional[str] = Field(None, description="Причина удаления")


class BulkRemoveRequest(BaseModel):
    """Запрос на массовое удаление"""
    operator: str = Field(..., description="Имя оператора", max_length=100)
    uuids: List[str] = Field(..., description="Массив UUID для удаления", max_items=1000)
    reason: Optional[str] = Field(None, description="Причина удаления")


class RemoveResponse(BaseModel):
    """Ответ на удаление"""
    ok: bool
    message: str
    removed_count: Optional[int] = None

