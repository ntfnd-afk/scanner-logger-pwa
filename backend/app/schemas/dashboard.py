"""
Pydantic схемы для dashboard API
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime


class OperatorStats(BaseModel):
    """Статистика оператора"""
    operator: str = Field(..., description="Имя оператора")
    online: bool = Field(..., description="Онлайн статус (активность < 5 мин)")
    onlineAgeSec: int = Field(..., description="Секунд с последней активности")
    lastSeenMs: int = Field(..., description="Timestamp последней активности (ms)")
    lastClient: str = Field(..., description="Последний клиент")
    lastCity: str = Field(..., description="Последний город")
    lastBox: str = Field(..., description="Последний короб")
    itemsToday: int = Field(..., description="Количество отсканированных товаров за день")
    errorsToday: int = Field(..., description="Количество ошибок за день")
    lastSeenAt: str = Field(..., description="Время последней активности (dd.MM.yyyy HH:mm:ss)")


class ClientStats(BaseModel):
    """Статистика клиента"""
    client: str = Field(..., description="Клиент")
    items: int = Field(0, description="Количество ITEM событий")
    boxesOpen: int = Field(0, description="Количество открытых коробов (BOX)")
    boxesClose: int = Field(0, description="Количество закрытых коробов (CLOSE)")
    errors: int = Field(0, description="Количество ошибок")


class FeedEvent(BaseModel):
    """Событие в ленте"""
    ts: str = Field(..., description="Время события (dd.MM.yyyy HH:mm:ss)")
    operator: str
    type: str
    client: str
    city: str
    box: str
    code: str


class Summary(BaseModel):
    """Сводка за день"""
    items: int = Field(..., description="Уникальные ITEM события (по UUID)")
    opens: int = Field(..., description="Количество BOX событий")
    closes: int = Field(..., description="Количество CLOSE событий")
    errors: int = Field(..., description="Количество ERROR событий")


class DashboardStateResponse(BaseModel):
    """Ответ dashboard/state"""
    generatedAt: str = Field(..., description="Время генерации ответа (ISO)")
    operators: List[OperatorStats]
    clients: List[ClientStats]
    feed: List[FeedEvent] = Field(..., description="Последние 100 событий")
    summary: Summary
    filters: Optional[Dict] = Field(default=None, description="Примененные фильтры")
    operatorsList: List[str] = Field(..., description="Список всех операторов за день")
    clientsList: List[str] = Field(..., description="Список всех клиентов за день")
    citiesList: List[str] = Field(..., description="Список всех городов за день")


class BoxItem(BaseModel):
    """Товар в коробе"""
    ts: str = Field(..., description="Время скана (dd.MM.yyyy HH:mm:ss)")
    code: str = Field(..., description="Штрихкод")
    operator: str
    uuid: str


class BoxDetails(BaseModel):
    """Детали короба"""
    client: str
    city: str
    boxNo: str = Field(..., description="Номер короба (после /)")
    itemsCount: int = Field(..., description="Количество товаров")
    firstAt: str = Field(..., description="Первый скан (dd.MM.yyyy HH:mm:ss)")
    lastAt: str = Field(..., description="Последний скан (dd.MM.yyyy HH:mm:ss)")
    operators: List[str] = Field(..., description="Список операторов работавших с коробом")
    items: List[BoxItem] = Field(..., description="Список товаров")


class CityBoxes(BaseModel):
    """Короба в городе"""
    city: str
    boxes: List[BoxDetails]
    totalItems: int
    totalBoxes: int


class ClientBoxes(BaseModel):
    """Короба клиента"""
    client: str
    cities: List[CityBoxes]
    totalItems: int
    totalBoxes: int


class BoxesStateResponse(BaseModel):
    """Ответ dashboard/boxes"""
    generatedAt: str
    filters: Optional[Dict] = None
    clients: List[ClientBoxes]


class RawLogEvent(BaseModel):
    """Сырое событие лога"""
    uuid: str
    ts: str = Field(..., description="dd.MM.yyyy HH:mm:ss")
    type: str
    operator: str
    client: str
    city: str
    box: str
    code: str
    details: Optional[str] = None
    receivedAt: str = Field(..., description="dd.MM.yyyy HH:mm:ss")
    source: str
    tsMs: int = Field(..., description="Unix timestamp в ms для сортировки")
    receivedAtMs: int


class RawLogsResponse(BaseModel):
    """Ответ logs/raw"""
    logs: List[RawLogEvent]
    total: int

