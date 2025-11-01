"""
SQLAlchemy модель для таблицы events
"""
from sqlalchemy import Column, String, Text, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid

from app.database import Base


class Event(Base):
    """
    Модель события сканирования
    
    Соответствует структуре из Google Sheets:
    - uuid: уникальный идентификатор (первичный ключ)
    - ts: время события (timestamp)
    - type: тип события (ITEM, BOX, CLOSE, CITY, ERROR и т.д.)
    - operator: имя сотрудника
    - client: клиент
    - city: город
    - box: короб (формат: client/number)
    - code: штрихкод или код события
    - details: дополнительная информация
    - received_at: время получения сервером
    - source: источник (pwa, dashboard)
    """
    
    __tablename__ = "events"
    
    # Columns
    uuid = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Уникальный идентификатор события"
    )
    
    ts = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="Время события (от клиента)"
    )
    
    type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Тип события: ITEM, BOX, CLOSE, CITY, ERROR и т.д."
    )
    
    operator = Column(
        String(100),
        nullable=False,
        index=True,
        comment="Имя сотрудника"
    )
    
    client = Column(
        String(100),
        nullable=True,
        index=True,
        comment="Клиент"
    )
    
    city = Column(
        String(100),
        nullable=True,
        comment="Город"
    )
    
    box = Column(
        String(100),
        nullable=True,
        index=True,
        comment="Короб (формат: client/number)"
    )
    
    code = Column(
        String(500),
        nullable=True,
        comment="Штрихкод товара или код события"
    )
    
    details = Column(
        Text,
        nullable=True,
        comment="Дополнительные детали"
    )
    
    received_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
        comment="Время получения сервером"
    )
    
    source = Column(
        String(50),
        nullable=False,
        default="pwa",
        comment="Источник события (pwa, dashboard)"
    )
    
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="Время создания записи в БД"
    )
    
    # Индексы (определены через Index для более гибкой настройки)
    __table_args__ = (
        # Составной индекс для dashboard запросов
        Index(
            'idx_dashboard',
            'operator', 'client', 'ts',
            postgresql_where=(ts > datetime.now(timezone.utc)),  # Partial index для последних 24ч
        ),
        # Индекс по дате для быстрых выборок за день
        Index('idx_events_date', 'ts', 'operator'),
        # Индекс для сортировки по received_at
        Index('idx_received_at_desc', received_at.desc()),
    )
    
    def __repr__(self):
        return (
            f"<Event(uuid={self.uuid}, type={self.type}, "
            f"operator={self.operator}, ts={self.ts})>"
        )
    
    def to_dict(self):
        """Сериализация в dict для JSON ответов"""
        return {
            "uuid": str(self.uuid),
            "ts": self.ts.isoformat() if self.ts else None,
            "type": self.type,
            "operator": self.operator,
            "client": self.client,
            "city": self.city,
            "box": self.box,
            "code": self.code,
            "details": self.details,
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

