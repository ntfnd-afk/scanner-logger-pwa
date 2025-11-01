"""
Скрипт миграции данных из Google Sheets в PostgreSQL
Использование:
    python scripts/migrate_from_sheets.py \
        --spreadsheet-id "1MOvQCiWBY4FE8K8NOWU7x2nMm-4H0NMoTqUuBOnVye4" \
        --credentials credentials.json \
        --database-url "postgresql+asyncpg://scanner:password@localhost:5432/scanner_logger"
"""
import asyncio
import argparse
import sys
import os
from datetime import datetime
from typing import List, Dict
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import uuid as uuid_lib

# Добавить путь к app модулю
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.models.event import Event
from app.database import Base


# Формат даты в Google Sheets: dd.MM.yyyy HH:mm:ss
SHEETS_DATE_FORMAT = "%d.%m.%Y %H:%M:%S"


def parse_sheets_datetime(date_str: str) -> datetime:
    """
    Парсинг даты из Google Sheets формата: dd.MM.yyyy HH:mm:ss
    """
    if not date_str or date_str.strip() == '':
        return datetime.now()
    
    try:
        # Попытка парсинга как datetime объект (если Sheets вернул Date)
        if isinstance(date_str, datetime):
            return date_str
        
        # Парсинг строки
        return datetime.strptime(date_str.strip(), SHEETS_DATE_FORMAT)
    except Exception as e:
        print(f"⚠️  Warning: Cannot parse date '{date_str}': {e}")
        return datetime.now()


def parse_uuid(uuid_str: str) -> uuid_lib.UUID:
    """Парсинг UUID с валидацией"""
    try:
        return uuid_lib.UUID(uuid_str)
    except (ValueError, AttributeError):
        # Генерация нового UUID если не валидный
        return uuid_lib.uuid4()


async def migrate_sheet_to_db(
    worksheet,
    session: AsyncSession,
    dry_run: bool = False
) -> Dict:
    """
    Миграция одного листа (месяца) в PostgreSQL
    
    Returns:
        dict: Статистика миграции
    """
    stats = {
        'total': 0,
        'inserted': 0,
        'skipped': 0,
        'errors': 0,
        'sheet_name': worksheet.title
    }
    
    print(f"\n📋 Обработка листа: {worksheet.title}")
    
    # Получить все данные листа
    all_values = worksheet.get_all_values()
    
    if not all_values or len(all_values) < 2:
        print(f"⚠️  Лист {worksheet.title} пуст или нет данных")
        return stats
    
    # Первая строка - заголовки
    headers = all_values[0]
    rows = all_values[1:]
    
    # Маппинг колонок
    col_map = {h: i for i, h in enumerate(headers)}
    
    print(f"📊 Найдено строк: {len(rows)}")
    print(f"📌 Колонки: {', '.join(headers)}")
    
    # Проверка существующих UUID для дедупликации
    existing_uuids = set()
    
    # Обработка строк
    events_to_insert = []
    
    for row_idx, row in enumerate(rows, start=2):  # +2 из-за заголовка и 1-based индекса
        stats['total'] += 1
        
        try:
            # Извлечение полей из строки
            uuid_str = row[col_map['uuid']] if 'uuid' in col_map else ''
            ts_str = row[col_map['ts']] if 'ts' in col_map else ''
            type_str = row[col_map['type']] if 'type' in col_map else ''
            operator = row[col_map['operator']] if 'operator' in col_map else ''
            client = row[col_map['client']] if 'client' in col_map else ''
            city = row[col_map['city']] if 'city' in col_map else ''
            box = row[col_map['box']] if 'box' in col_map else ''
            code = row[col_map['code']] if 'code' in col_map else ''
            details = row[col_map.get('details', -1)] if 'details' in col_map else ''
            received_at_str = row[col_map.get('receivedAt', -1)] if 'receivedAt' in col_map else ts_str
            source = row[col_map.get('source', -1)] if 'source' in col_map else 'pwa'
            
            # Валидация обязательных полей
            if not uuid_str or not ts_str or not type_str or not operator:
                print(f"⚠️  Строка {row_idx}: пропущена (нет обязательных полей)")
                stats['skipped'] += 1
                continue
            
            # Парсинг UUID
            event_uuid = parse_uuid(uuid_str)
            uuid_str_normalized = str(event_uuid)
            
            # Проверка дубликата
            if uuid_str_normalized in existing_uuids:
                stats['skipped'] += 1
                continue
            
            existing_uuids.add(uuid_str_normalized)
            
            # Парсинг дат
            ts_dt = parse_sheets_datetime(ts_str)
            received_at_dt = parse_sheets_datetime(received_at_str) if received_at_str else ts_dt
            
            # Создание модели Event
            event = Event(
                uuid=event_uuid,
                ts=ts_dt,
                type=type_str,
                operator=operator,
                client=client or None,
                city=city or None,
                box=box or None,
                code=code or None,
                details=details or None,
                received_at=received_at_dt,
                source=source or 'pwa'
            )
            
            events_to_insert.append(event)
            stats['inserted'] += 1
            
            # Batch insert каждые 1000 записей
            if len(events_to_insert) >= 1000 and not dry_run:
                session.add_all(events_to_insert)
                await session.commit()
                print(f"  ✅ Вставлено {len(events_to_insert)} записей...")
                events_to_insert = []
        
        except Exception as e:
            print(f"❌ Ошибка в строке {row_idx}: {e}")
            stats['errors'] += 1
            continue
    
    # Финальная вставка оставшихся записей
    if events_to_insert and not dry_run:
        session.add_all(events_to_insert)
        await session.commit()
        print(f"  ✅ Вставлено {len(events_to_insert)} записей (финал)")
    
    print(f"✅ Лист {worksheet.title} обработан:")
    print(f"   Всего строк: {stats['total']}")
    print(f"   Вставлено: {stats['inserted']}")
    print(f"   Пропущено: {stats['skipped']}")
    print(f"   Ошибок: {stats['errors']}")
    
    return stats


async def main():
    parser = argparse.ArgumentParser(description="Миграция данных из Google Sheets в PostgreSQL")
    parser.add_argument('--spreadsheet-id', required=True, help='ID таблицы Google Sheets')
    parser.add_argument('--credentials', required=True, help='Путь к credentials.json')
    parser.add_argument('--database-url', required=False, 
                        default='postgresql+asyncpg://scanner:changeme@localhost:5432/scanner_logger',
                        help='Database URL')
    parser.add_argument('--sheet-prefix', default='raw_log_', help='Префикс листов (raw_log_)')
    parser.add_argument('--dry-run', action='store_true', help='Не сохранять в БД (тест)')
    
    args = parser.parse_args()
    
    print("🚀 Начало миграции данных из Google Sheets в PostgreSQL")
    print(f"📊 Spreadsheet ID: {args.spreadsheet_id}")
    print(f"🗄️  Database: {args.database_url.split('@')[-1]}")
    print(f"🧪 Dry run: {args.dry_run}")
    
    # === Подключение к Google Sheets ===
    print("\n📝 Подключение к Google Sheets...")
    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]
    
    try:
        creds = ServiceAccountCredentials.from_json_keyfile_name(args.credentials, scope)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(args.spreadsheet_id)
        print(f"✅ Подключено к таблице: {spreadsheet.title}")
    except Exception as e:
        print(f"❌ Ошибка подключения к Google Sheets: {e}")
        return
    
    # === Подключение к PostgreSQL ===
    print("\n🗄️  Подключение к PostgreSQL...")
    try:
        engine = create_async_engine(args.database_url, echo=False)
        
        # Создать таблицы если их нет
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        AsyncSessionLocal = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        
        print("✅ Подключено к PostgreSQL")
    except Exception as e:
        print(f"❌ Ошибка подключения к PostgreSQL: {e}")
        return
    
    # === Миграция листов ===
    worksheets = spreadsheet.worksheets()
    sheets_to_migrate = [ws for ws in worksheets if ws.title.startswith(args.sheet_prefix)]
    
    print(f"\n📋 Найдено листов для миграции: {len(sheets_to_migrate)}")
    print(f"   Листы: {', '.join([ws.title for ws in sheets_to_migrate])}")
    
    if not sheets_to_migrate:
        print("⚠️  Нет листов с префиксом", args.sheet_prefix)
        return
    
    total_stats = {
        'total': 0,
        'inserted': 0,
        'skipped': 0,
        'errors': 0
    }
    
    # Обработка каждого листа
    for worksheet in sheets_to_migrate:
        async with AsyncSessionLocal() as session:
            stats = await migrate_sheet_to_db(worksheet, session, dry_run=args.dry_run)
            
            total_stats['total'] += stats['total']
            total_stats['inserted'] += stats['inserted']
            total_stats['skipped'] += stats['skipped']
            total_stats['errors'] += stats['errors']
    
    # === Итоги ===
    print("\n" + "="*60)
    print("🎉 МИГРАЦИЯ ЗАВЕРШЕНА!")
    print("="*60)
    print(f"📊 Итоговая статистика:")
    print(f"   Всего строк: {total_stats['total']}")
    print(f"   ✅ Вставлено: {total_stats['inserted']}")
    print(f"   ⏭️  Пропущено (дубликаты): {total_stats['skipped']}")
    print(f"   ❌ Ошибок: {total_stats['errors']}")
    
    if args.dry_run:
        print("\n⚠️  DRY RUN режим - данные НЕ были сохранены в БД")
    
    # Закрыть соединение
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

