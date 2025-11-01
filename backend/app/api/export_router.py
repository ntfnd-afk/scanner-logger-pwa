"""
API endpoints для экспорта данных в CSV
GET /csv - экспорт в CSV
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from datetime import datetime, timezone
from io import StringIO
import csv
import logging

from app.database import get_db
from app.models.event import Event
from app.api.events import verify_api_key
from app.api.dashboard import parse_date, format_datetime, extract_box_number

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/csv")
async def export_csv(
    date: Optional[str] = Query(None, description="Дата в формате YYYY-MM-DD"),
    operator: Optional[str] = Query(None),
    client: Optional[str] = Query(None),
    type_filter: Optional[str] = Query(None, alias="type"),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Экспорт данных в CSV формат
    
    CSV поля:
    - uuid
    - ts (dd.MM.yyyy HH:mm:ss)
    - type
    - operator
    - client
    - city
    - box
    - code
    - details
    - received_at (dd.MM.yyyy HH:mm:ss)
    - source
    """
    try:
        # Парсинг даты
        start_date, end_date = parse_date(date)
        
        # Базовый запрос
        stmt = select(Event).where(
            and_(
                Event.ts >= start_date,
                Event.ts <= end_date
            )
        ).order_by(Event.ts.asc())
        
        # Фильтры
        if operator:
            stmt = stmt.where(Event.operator == operator)
        if client:
            stmt = stmt.where(Event.client == client)
        if type_filter:
            stmt = stmt.where(Event.type == type_filter)
        
        # Выполнить запрос
        result = await db.execute(stmt)
        events = result.scalars().all()
        
        # Создание CSV в памяти
        output = StringIO()
        # BOM для корректного отображения UTF-8 в Excel
        output.write('\ufeff')
        
        writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
        
        # Header
        writer.writerow([
            'uuid', 'ts', 'type', 'operator', 'client',
            'city', 'box', 'code', 'details', 'received_at', 'source'
        ])
        
        # Rows
        for event in events:
            writer.writerow([
                str(event.uuid),
                format_datetime(event.ts),
                event.type,
                event.operator or '',
                event.client or '',
                event.city or '',
                event.box or '',
                # Защита от научной записи в Excel: ="код"
                f'="{event.code}"' if event.code else '',
                event.details or '',
                format_datetime(event.received_at),
                event.source
            ])
        
        # Получить CSV строку
        csv_content = output.getvalue()
        output.close()
        
        # Формирование имени файла
        date_part = date or datetime.now(timezone.utc).date().isoformat()
        filename = f"scanner_logs_{date_part}.csv"
        
        logger.info(f"✅ CSV export: {len(events)} events, date={date_part}")
        
        # Возврат CSV файла
        return Response(
            content=csv_content,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    
    except Exception as e:
        logger.error(f"❌ Error in export_csv: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/boxes-csv")
async def export_boxes_csv(
    date: Optional[str] = Query(None),
    client: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Экспорт по коробам (плоская таблица):
    Клиент | Город | Короб | ШК | Время скана | Оператор
    """
    try:
        start_date, end_date = parse_date(date)
        
        stmt = select(Event).where(
            and_(
                Event.ts >= start_date,
                Event.ts <= end_date,
                Event.type == 'ITEM'
            )
        ).order_by(Event.client, Event.city, Event.box, Event.ts)
        
        if client:
            stmt = stmt.where(Event.client == client)
        
        result = await db.execute(stmt)
        events = result.scalars().all()
        
        # Создание CSV
        output = StringIO()
        output.write('\ufeff')  # BOM
        
        writer = csv.writer(output, delimiter=';')
        writer.writerow(['Клиент', 'Город', 'Короб', 'ШК', 'Время скана', 'Оператор'])
        
        # Дедупликация по UUID
        seen_uuids = set()
        for event in events:
            uuid_str = str(event.uuid)
            if uuid_str in seen_uuids:
                continue
            seen_uuids.add(uuid_str)
            
            writer.writerow([
                event.client or '—',
                event.city or '—',
                extract_box_number(event.box or ''),
                f'="{event.code}"' if event.code else '',
                format_datetime(event.ts),
                event.operator or ''
            ])
        
        csv_content = output.getvalue()
        output.close()
        
        date_part = date or datetime.now(timezone.utc).date().isoformat()
        filename = f"boxes_{date_part}.csv"
        
        logger.info(f"✅ Boxes CSV export: {len(seen_uuids)} items")
        
        return Response(
            content=csv_content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    
    except Exception as e:
        logger.error(f"❌ Error in export_boxes_csv: {e}")
        raise HTTPException(status_code=500, detail=str(e))

