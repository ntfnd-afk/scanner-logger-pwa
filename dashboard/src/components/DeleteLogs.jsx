import { useMemo } from 'react';

export default function DeleteLogs({ events, loading }) {
  // Фильтруем только события удаления
  const deleteEvents = useMemo(() => {
    return events
      .filter(event => event.type === 'REMOVE' || event.type === 'BULK_REMOVE')
      .sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }, [events]);

  const formatDateTime = (ts) => {
    const date = new Date(ts);
    return date.toLocaleString('ru-RU');
  };

  if (loading && deleteEvents.length === 0) {
    return <div className="loading">⏳ Загрузка данных...</div>;
  }

  return (
    <div className="delete-logs">
      <div className="panel">
        <h2>🗑️ Логи удалений</h2>
        
        <div className="delete-stats">
          <div className="stat-card">
            <span className="stat-value">{deleteEvents.length}</span>
            <span className="stat-label">Всего удалений</span>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Дата и время</th>
                <th>Оператор</th>
                <th>Тип</th>
                <th>Клиент</th>
                <th>Город</th>
                <th>Короб</th>
                <th>Код</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {deleteEvents.map((event, idx) => (
                <tr key={event.uuid || idx}>
                  <td>{formatDateTime(event.ts)}</td>
                  <td>{event.operator || '-'}</td>
                  <td>
                    <span className={`type-badge ${event.type.toLowerCase()}`}>
                      {event.type === 'BULK_REMOVE' ? '🗑️ Массовое' : '🗑️ Одиночное'}
                    </span>
                  </td>
                  <td>{event.client || '-'}</td>
                  <td>{event.city || '-'}</td>
                  <td>{event.box || '-'}</td>
                  <td className="code-cell">{event.code || '-'}</td>
                  <td className="details-cell">{event.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {deleteEvents.length === 0 && (
            <div className="empty-state">
              ✅ Удалений не найдено
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

