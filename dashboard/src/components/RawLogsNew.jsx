import { useState, useMemo, useEffect } from 'react';

export default function RawLogsNew({ events, stats, loading }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Отладка только при изменении данных
  useEffect(() => {
    console.log('RawLogsNew - events:', events);
    console.log('RawLogsNew - events.length:', events?.length);
    console.log('RawLogsNew - stats:', stats);
    console.log('RawLogsNew - loading:', loading);
  }, [events, stats, loading]);

  // Фильтрация по поиску
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    
    const query = searchQuery.toLowerCase();
    return events.filter(event => 
      event.operator?.toLowerCase().includes(query) ||
      event.client?.toLowerCase().includes(query) ||
      event.city?.toLowerCase().includes(query) ||
      event.box?.toLowerCase().includes(query) ||
      event.code?.toLowerCase().includes(query) ||
      event.type?.toLowerCase().includes(query)
    );
  }, [events, searchQuery]);

  // Пагинация
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEvents.slice(start, start + itemsPerPage);
  }, [filteredEvents, currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getTypeBadgeClass = (type) => {
    const typeMap = {
      'ITEM': 'blue',
      'BOX': 'green',
      'CLOSE': 'success',
      'CITY': 'purple',
      'CITY_CLOSE': 'purple',
      'ERROR': 'error',
      'REMOVE': 'remove',
      'BULK_REMOVE': 'bulk_remove',
      'AUTO_CLOSE': 'info',
      'BOX_NOT_CLOSED': 'warning',
      'NO_CITY': 'error',
      'NO_BOX': 'error',
      'CYRILLIC_ERROR': 'warning'
    };
    return typeMap[type] || 'info';
  };

  if (loading && events.length === 0) {
    return <div className="loading">⏳ Загрузка данных...</div>;
  }

  return (
    <div className="raw-logs-new">
      <div className="raw-logs-header">
        <h2>📝 Сырые логи</h2>
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск по оператору, клиенту, городу, коробу, коду..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="logs-info">
        Показано {paginatedEvents.length} из {filteredEvents.length} записей
        {searchQuery && ` (найдено по запросу "${searchQuery}")`}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Дата/Время</th>
              <th>Оператор</th>
              <th>Тип</th>
              <th>Клиент</th>
              <th>Город</th>
              <th>Короб</th>
              <th>Код</th>
              <th>Источник</th>
              <th>Детали</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEvents.map((event, idx) => (
              <tr key={idx}>
                <td className="timestamp-cell">{event.ts}</td>
                <td>{event.operator || '-'}</td>
                <td>
                  <span className={`type-badge ${getTypeBadgeClass(event.type)}`}>
                    {event.type}
                  </span>
                </td>
                <td>{event.client || '-'}</td>
                <td>{event.city || '-'}</td>
                <td className="code-cell">{event.box || '-'}</td>
                <td className="code-cell">{event.code || '-'}</td>
                <td>
                  <span className="source-badge">{event.source || 'pwa'}</span>
                </td>
                <td className="details-cell">{event.details || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            ⏮️ Первая
          </button>
          <button 
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            ◀️ Назад
          </button>
          <span className="page-info">
            Страница {currentPage} из {totalPages}
          </span>
          <button 
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Вперёд ▶️
          </button>
          <button 
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            Последняя ⏭️
          </button>
        </div>
      )}

      {paginatedEvents.length === 0 && !loading && (
        <div className="empty-state">
          {searchQuery 
            ? 'Ничего не найдено по вашему запросу' 
            : 'Нет данных за выбранный период. Попробуйте изменить фильтры (дату, оператора, клиента).'
          }
        </div>
      )}
    </div>
  );
}

