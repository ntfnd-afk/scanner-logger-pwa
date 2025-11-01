"""
API endpoints для работы с событиями сканирования
POST /batch - прием батча событий
POST /verify - проверка существующих UUID
POST /remove - удаление товара
POST /bulk-remove - массовое удаление
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import Optional
import logging
from datetime import datetime, timezone
import uuid as uuid_lib

from app.database import get_db
from app.config import settings
from app.models.event import Event
from app.schemas.event import (
    EventBatchRequest, EventBatchResponse,
    VerifyUUIDRequest, VerifyUUIDResponse,
    RemoveItemRequest, BulkRemoveRequest, RemoveResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)


def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Проверка API ключа"""
    if not x_api_key or x_api_key != settings.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return x_api_key


@router.post("/batch", response_model=EventBatchResponse)
async def batch_insert_events(
    request: EventBatchRequest,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Батч-вставка событий сканирования
    
    - Проверяет дубликаты по UUID
    - Вставляет только уникальные события
    - Возвращает статистику: inserted, skipped, duplicates
    """
    try:
        # Извлечь UUID из запроса
        uuids_to_check = [str(e.uuid) for e in request.events if e.uuid]
        
        # Найти существующие UUID в БД
        if uuids_to_check:
            stmt = select(Event.uuid).where(Event.uuid.in_(uuids_to_check))
            result = await db.execute(stmt)
            existing_uuids = set(str(row[0]) for row in result.fetchall())
        else:
            existing_uuids = set()
        
        # Подготовка событий для вставки
        events_to_insert = []
        skipped_count = 0
        duplicates = []
        
        for event_data in request.events:
            # Генерация UUID если не указан
            event_uuid = event_data.uuid or uuid_lib.uuid4()
            event_uuid_str = str(event_uuid)
            
            # Проверка дубликата
            if event_uuid_str in existing_uuids:
                skipped_count += 1
                duplicates.append(event_uuid_str)
                continue
            
            # Конвертация timestamp (ms → datetime)
            ts_dt = datetime.fromtimestamp(event_data.ts / 1000, tz=timezone.utc)
            
            # Создание модели Event
            event = Event(
                uuid=event_uuid,
                ts=ts_dt,
                type=event_data.type,
                operator=event_data.operator,
                client=event_data.client,
                city=event_data.city,
                box=event_data.box,
                code=event_data.code,
                details=event_data.details,
                source=event_data.source or "pwa",
                received_at=datetime.now(timezone.utc)
            )
            
            events_to_insert.append(event)
            existing_uuids.add(event_uuid_str)  # Предотвратить дубликаты внутри батча
        
        # Bulk insert
        if events_to_insert:
            db.add_all(events_to_insert)
            await db.commit()
            logger.info(f"✅ Inserted {len(events_to_insert)} events, skipped {skipped_count}")
        
        return EventBatchResponse(
            ok=True,
            inserted=len(events_to_insert),
            skipped=skipped_count,
            duplicates=duplicates,
            errors=[]
        )
    
    except Exception as e:
        logger.error(f"❌ Error in batch_insert: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Batch insert failed: {str(e)}")


@router.post("/verify", response_model=VerifyUUIDResponse)
async def verify_uuids(
    request: VerifyUUIDRequest,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Проверить какие UUID уже существуют в БД
    
    Используется PWA для verify-ACK механизма перед отправкой батча
    """
    try:
        # Найти существующие UUID
        stmt = select(Event.uuid).where(Event.uuid.in_(request.uuids))
        result = await db.execute(stmt)
        existing_uuids = [str(row[0]) for row in result.fetchall()]
        
        return VerifyUUIDResponse(
            ok=True,
            present=existing_uuids
        )
    
    except Exception as e:
        logger.error(f"❌ Error in verify_uuids: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/remove", response_model=RemoveResponse)
async def remove_item(
    request: RemoveItemRequest,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Удалить товар из короба
    
    Создает событие REMOVE для аудита
    """
    try:
        # Создать событие удаления
        remove_event = Event(
            uuid=uuid_lib.uuid4(),
            ts=datetime.now(timezone.utc),
            type="REMOVE",
            operator=request.operator,
            client=request.box.split('/')[0] if '/' in request.box else '',
            city='',
            box=request.box,
            code=request.code,
            details=request.reason or "Удалено через dashboard",
            source="dashboard",
            received_at=datetime.now(timezone.utc)
        )
        
        db.add(remove_event)
        await db.commit()
        
        logger.info(f"✅ Item removed: box={request.box}, code={request.code}")
        
        return RemoveResponse(
            ok=True,
            message=f"Товар {request.code} удален из короба {request.box}",
            removed_count=1
        )
    
    except Exception as e:
        logger.error(f"❌ Error in remove_item: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-remove", response_model=RemoveResponse)
async def bulk_remove_items(
    request: BulkRemoveRequest,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Массовое удаление товаров по UUID
    
    Создает событие BULK_REMOVE для аудита
    """
    try:
        # Найти события для удаления
        stmt = select(Event).where(Event.uuid.in_(request.uuids))
        result = await db.execute(stmt)
        events_to_remove = result.scalars().all()
        
        if not events_to_remove:
            return RemoveResponse(
                ok=False,
                message="Не найдены события с указанными UUID",
                removed_count=0
            )
        
        # Удалить события (ВАЖНО: это физическое удаление из БД!)
        # Альтернатива: добавить поле deleted_at и делать soft delete
        delete_stmt = delete(Event).where(Event.uuid.in_(request.uuids))
        await db.execute(delete_stmt)
        
        # Создать аудит событие
        audit_event = Event(
            uuid=uuid_lib.uuid4(),
            ts=datetime.now(timezone.utc),
            type="BULK_REMOVE",
            operator=request.operator,
            client='',
            city='',
            box='',
            code=f"Удалено {len(events_to_remove)} товаров",
            details=request.reason or "Массовое удаление через dashboard",
            source="dashboard",
            received_at=datetime.now(timezone.utc)
        )
        
        db.add(audit_event)
        await db.commit()
        
        logger.info(f"✅ Bulk removed {len(events_to_remove)} events")
        
        return RemoveResponse(
            ok=True,
            message=f"Удалено {len(events_to_remove)} товаров",
            removed_count=len(events_to_remove)
        )
    
    except Exception as e:
        logger.error(f"❌ Error in bulk_remove: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

