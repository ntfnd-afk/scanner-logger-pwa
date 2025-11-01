"""
API endpoints для dashboard
GET /state - состояние операторов и сводка
GET /boxes - группировка по коробам
GET /raw - сырые логи
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional
from datetime import datetime, time, timezone, timedelta
from collections import defaultdict
import logging

from app.database import get_db
from app.config import settings
from app.models.event import Event
from app.schemas.dashboard import (
    DashboardStateResponse, OperatorStats, ClientStats,
    FeedEvent, Summary, BoxesStateResponse, ClientBoxes,
    CityBoxes, BoxDetails, BoxItem, RawLogsResponse, RawLogEvent
)
from app.api.events import verify_api_key

router = APIRouter()
logger = logging.getLogger(__name__)


def parse_date(date_str: Optional[str]) -> tuple[datetime, datetime]:
    """
    Парсинг даты и возврат границ дня (start, end)
    Если date_str не указан - используется сегодня
    """
    if not date_str:
        today = datetime.now(timezone.utc).date()
    else:
        try:
            today = datetime.fromisoformat(date_str).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    start = datetime.combine(today, time.min).replace(tzinfo=timezone.utc)
    end = datetime.combine(today, time.max).replace(tzinfo=timezone.utc)
    
    return start, end


def parse_date_range(date_start: Optional[str], date_end: Optional[str]) -> tuple[datetime, datetime]:
    """
    Парсинг диапазона дат
    Если date_end не указан - используется date_start
    Если оба не указаны - используется сегодня
    """
    if not date_start:
        today = datetime.now(timezone.utc).date()
        start_date = today
        end_date = today
    else:
        try:
            start_date = datetime.fromisoformat(date_start).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_start format. Use YYYY-MM-DD")
        
        if date_end:
            try:
                end_date = datetime.fromisoformat(date_end).date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_end format. Use YYYY-MM-DD")
        else:
            end_date = start_date
    
    # Если start_date > end_date, меняем местами
    if start_date > end_date:
        logger.warning(f"⚠️ start_date ({start_date}) > end_date ({end_date}), swapping")
        start_date, end_date = end_date, start_date
    
    start = datetime.combine(start_date, time.min).replace(tzinfo=timezone.utc)
    end = datetime.combine(end_date, time.max).replace(tzinfo=timezone.utc)
    
    logger.info(f"📅 Date range: {start} - {end}")
    
    return start, end


def format_datetime(dt: datetime) -> str:
    """Форматирование datetime в формат dd.MM.yyyy HH:mm:ss"""
    return dt.strftime("%d.%M.%Y %H:%M:%S")


def extract_box_number(box: str) -> str:
    """Извлечь номер короба после '/'"""
    if not box:
        return "—"
    parts = box.split('/')
    return parts[1] if len(parts) > 1 else box


@router.get("/state", response_model=DashboardStateResponse)
async def get_dashboard_state(
    date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_end: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    operator: Optional[str] = Query(None, description="Фильтр по оператору"),
    client: Optional[str] = Query(None, description="Фильтр по клиенту"),
    city: Optional[str] = Query(None, description="Фильтр по городу"),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Получить состояние dashboard за период:
    - Список операторов с онлайн-статусом
    - Статистика по клиентам
    - Лента последних 100 событий
    - Сводка за период (items, opens, closes, errors)
    """
    try:
        # Парсинг диапазона дат
        start_date, end_date = parse_date_range(date, date_end)
        
        logger.info(f"🔍 get_dashboard_state: date={date}, date_end={date_end}, operator={operator}, client={client}, city={city}")
        
        # Базовый запрос
        stmt = select(Event).where(
            and_(
                Event.ts >= start_date,
                Event.ts <= end_date
            )
        )
        
        # Фильтры
        if operator:
            stmt = stmt.where(Event.operator == operator)
        if client:
            stmt = stmt.where(Event.client == client)
        if city:
            stmt = stmt.where(Event.city == city)
        
        # Выполнить запрос
        result = await db.execute(stmt)
        events = result.scalars().all()
        
        # Текущее время для расчета онлайн-статуса
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        online_threshold = settings.ONLINE_THRESHOLD_SECONDS
        
        # === ОПЕРАТОРЫ ===
        operator_data = defaultdict(lambda: {
            'last_event': None,
            'items': set(),  # уникальные UUID
            'errors': 0
        })
        
        for event in events:
            op = event.operator or '—'
            op_data = operator_data[op]
            
            # Обновить последнее событие
            if op_data['last_event'] is None or event.received_at > op_data['last_event'].received_at:
                op_data['last_event'] = event
            
            # Подсчет ITEM (по уникальным UUID)
            if event.type == 'ITEM':
                op_data['items'].add(str(event.uuid))
            
            # Подсчет ошибок
            if event.type == 'ERROR':
                op_data['errors'] += 1
        
        # Формирование списка операторов
        operators = []
        for op, data in operator_data.items():
            last_event = data['last_event']
            if not last_event:
                continue
            
            last_seen_ms = int(last_event.received_at.timestamp() * 1000)
            age_sec = (now_ms - last_seen_ms) // 1000
            online = age_sec <= online_threshold
            
            operators.append(OperatorStats(
                operator=op,
                online=online,
                onlineAgeSec=age_sec,
                lastSeenMs=last_seen_ms,
                lastClient=last_event.client or '—',
                lastCity=last_event.city or '—',
                lastBox=extract_box_number(last_event.box or ''),
                itemsToday=len(data['items']),
                errorsToday=data['errors'],
                lastSeenAt=format_datetime(last_event.received_at)
            ))
        
        # Сортировка: онлайн операторы первыми, затем по itemsToday
        operators.sort(key=lambda x: (-x.online, -x.itemsToday))
        
        # === КЛИЕНТЫ ===
        client_data = defaultdict(lambda: {
            'items': 0,
            'boxesOpen': 0,
            'boxesClose': 0,
            'errors': 0
        })
        
        for event in events:
            c = event.client or '—'
            if event.type == 'ITEM':
                client_data[c]['items'] += 1
            elif event.type == 'BOX':
                client_data[c]['boxesOpen'] += 1
            elif event.type == 'CLOSE':
                client_data[c]['boxesClose'] += 1
            elif event.type == 'ERROR':
                client_data[c]['errors'] += 1
        
        clients = [
            ClientStats(
                client=c,
                items=data['items'],
                boxesOpen=data['boxesOpen'],
                boxesClose=data['boxesClose'],
                errors=data['errors']
            )
            for c, data in client_data.items()
        ]
        clients.sort(key=lambda x: -x.items)
        
        # === ЛЕНТА (последние 100 событий) ===
        feed_events = sorted(events, key=lambda e: e.received_at, reverse=True)[:100]
        feed = [
            FeedEvent(
                ts=format_datetime(e.ts),
                operator=e.operator or '—',
                type=e.type,
                client=e.client or '—',
                city=e.city or '—',
                box=extract_box_number(e.box or ''),
                code=e.code or ''
            )
            for e in feed_events
        ]
        
        # === СВОДКА ===
        unique_item_uuids = set(str(e.uuid) for e in events if e.type == 'ITEM')
        summary = Summary(
            items=len(unique_item_uuids),
            opens=sum(1 for e in events if e.type == 'BOX'),
            closes=sum(1 for e in events if e.type == 'CLOSE'),
            errors=sum(1 for e in events if e.type == 'ERROR')
        )
        
        # === СПИСКИ ДЛЯ ФИЛЬТРОВ ===
        operators_list = sorted(set(e.operator for e in events if e.operator))
        clients_list = sorted(set(e.client for e in events if e.client))
        cities_list = sorted(set(e.city for e in events if e.city))
        
        return DashboardStateResponse(
            generatedAt=datetime.now(timezone.utc).isoformat(),
            operators=operators,
            clients=clients,
            feed=feed,
            summary=summary,
            filters={'date': date, 'operator': operator, 'client': client, 'city': city},
            operatorsList=operators_list,
            clientsList=clients_list,
            citiesList=cities_list
        )
    
    except Exception as e:
        logger.error(f"❌ Error in get_dashboard_state: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/boxes", response_model=BoxesStateResponse)
async def get_boxes_state(
    date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_end: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    operator: Optional[str] = Query(None),
    client: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Группировка событий по клиентам → городам → коробам → товарам
    """
    try:
        start_date, end_date = parse_date_range(date, date_end)
        
        logger.info(f"🔍 get_boxes_state: date={date}, date_end={date_end}, operator={operator}, client={client}, city={city}")
        
        stmt = select(Event).where(
            and_(
                Event.ts >= start_date,
                Event.ts <= end_date
            )
        )
        
        if operator:
            stmt = stmt.where(Event.operator == operator)
        if client:
            stmt = stmt.where(Event.client == client)
        if city:
            stmt = stmt.where(Event.city == city)
        
        result = await db.execute(stmt)
        events = result.scalars().all()
        
        # Группировка: client → city → box
        by_client = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {
            'items': {},  # uuid → BoxItem
            'first_ts': None,
            'last_ts': None,
            'operators': set()
        })))
        
        for event in events:
            c = event.client or '—'
            city = event.city or '—'
            box_no = extract_box_number(event.box or '')
            
            box_data = by_client[c][city][box_no]
            
            # Добавить ITEM
            if event.type == 'ITEM':
                uuid_str = str(event.uuid)
                if uuid_str not in box_data['items']:
                    box_data['items'][uuid_str] = BoxItem(
                        ts=format_datetime(event.ts),
                        code=event.code or '',
                        operator=event.operator or '',
                        uuid=uuid_str
                    )
            
            # Обновить временные границы
            if box_data['first_ts'] is None or event.ts < box_data['first_ts']:
                box_data['first_ts'] = event.ts
            if box_data['last_ts'] is None or event.ts > box_data['last_ts']:
                box_data['last_ts'] = event.ts
            
            # Операторы
            if event.operator:
                box_data['operators'].add(event.operator)
        
        # Формирование ответа
        clients_list = []
        for c, cities_dict in by_client.items():
            cities_list = []
            for city, boxes_dict in cities_dict.items():
                boxes_list = []
                for box_no, box_data in boxes_dict.items():
                    items = sorted(box_data['items'].values(), key=lambda x: x.ts)
                    boxes_list.append(BoxDetails(
                        client=c,
                        city=city,
                        boxNo=box_no,
                        itemsCount=len(items),
                        firstAt=format_datetime(box_data['first_ts']) if box_data['first_ts'] else '',
                        lastAt=format_datetime(box_data['last_ts']) if box_data['last_ts'] else '',
                        operators=sorted(box_data['operators']),
                        items=items
                    ))
                
                boxes_list.sort(key=lambda b: (-b.itemsCount, b.boxNo))
                cities_list.append(CityBoxes(
                    city=city,
                    boxes=boxes_list,
                    totalItems=sum(b.itemsCount for b in boxes_list),
                    totalBoxes=len(boxes_list)
                ))
            
            cities_list.sort(key=lambda c: (-c.totalItems, c.city))
            clients_list.append(ClientBoxes(
                client=c,
                cities=cities_list,
                totalItems=sum(c.totalItems for c in cities_list),
                totalBoxes=sum(c.totalBoxes for c in cities_list)
            ))
        
        clients_list.sort(key=lambda c: (-c.totalItems, c.client))
        
        return BoxesStateResponse(
            generatedAt=datetime.now(timezone.utc).isoformat(),
            filters={'date': date, 'operator': operator, 'client': client},
            clients=clients_list
        )
    
    except Exception as e:
        logger.error(f"❌ Error in get_boxes_state: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/raw", response_model=RawLogsResponse)
async def get_raw_logs(
    date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_end: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    operator: Optional[str] = Query(None),
    client: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    type: Optional[str] = Query(None, description="Event type filter"),
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Получить сырые логи за период (без агрегации)
    Сортировка: по received_at DESC
    Поддерживает фильтрацию по дате, оператору, клиенту, городу, типу события
    """
    try:
        start_date, end_date = parse_date_range(date, date_end)
        
        logger.info(f"🔍 get_raw_logs: date={date}, date_end={date_end}, operator={operator}, client={client}, city={city}, type={type}")
        
        # Базовый запрос
        stmt = select(Event).where(
            and_(
                Event.ts >= start_date,
                Event.ts <= end_date
            )
        ).order_by(Event.received_at.desc()).limit(limit)
        
        # Фильтры
        if operator:
            stmt = stmt.where(Event.operator == operator)
        
        if client:
            stmt = stmt.where(Event.client == client)
        
        if city:
            stmt = stmt.where(Event.city == city)
        
        if type:
            stmt = stmt.where(Event.type == type)
        
        result = await db.execute(stmt)
        events = result.scalars().all()
        
        logger.info(f"✅ get_raw_logs: found {len(events)} events")
        
        logs = [
            RawLogEvent(
                uuid=str(e.uuid),
                ts=format_datetime(e.ts),
                type=e.type,
                operator=e.operator or '',
                client=e.client or '',
                city=e.city or '',
                box=e.box or '',
                code=e.code or '',
                details=e.details,
                receivedAt=format_datetime(e.received_at),
                source=e.source,
                tsMs=int(e.ts.timestamp() * 1000),
                receivedAtMs=int(e.received_at.timestamp() * 1000)
            )
            for e in events
        ]
        
        return RawLogsResponse(
            logs=logs,
            total=len(logs)
        )
    
    except Exception as e:
        logger.error(f"❌ Error in get_raw_logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

