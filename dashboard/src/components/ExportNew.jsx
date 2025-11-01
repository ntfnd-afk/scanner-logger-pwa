import { useState, useMemo } from 'react';

export default function ExportNew({ events, stats, loading }) {
  const [exportFormat, setExportFormat] = useState('xlsx');

  // Подготовка данных для экспорта
  const exportData = useMemo(() => {
    return events.map(event => ({
      'Дата/Время': event.ts,
      'Оператор': event.operator || '',
      'Тип': event.type,
      'Клиент': event.client || '',
      'Город': event.city || '',
      'Короб': event.box || '',
      'Код': event.code || '',
      'Источник': event.source || 'pwa',
      'Детали': event.details || ''
    }));
  }, [events]);

  const handleExport = () => {
    if (exportData.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }

    if (exportFormat === 'xlsx') {
      exportToXLSX();
    } else {
      exportToCSV();
    }
  };

  const exportToXLSX = () => {
    // Для XLSX нужна библиотека xlsx
    // Пока делаем заглушку
    alert('Экспорт в XLSX будет реализован в следующем шаге.\nПока используйте CSV.');
    exportToCSV();
  };

  const exportToCSV = () => {
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(';'),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header];
          // Экранируем значения с точкой с запятой или кавычками
          if (value && (value.includes(';') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(';')
      )
    ].join('\n');

    // Добавляем BOM для правильной кодировки в Excel
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `scanner_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Статистика по данным
  const stats_summary = useMemo(() => {
    const clients = new Set();
    const cities = new Set();
    const boxes = new Set();
    const operators = new Set();
    let items = 0;

    events.forEach(event => {
      if (event.client) clients.add(event.client);
      if (event.city) cities.add(event.city);
      if (event.box) boxes.add(event.box);
      if (event.operator) operators.add(event.operator);
      if (event.type === 'ITEM') items++;
    });

    return {
      clients: clients.size,
      cities: cities.size,
      boxes: boxes.size,
      operators: operators.size,
      items: items,
      total: events.length
    };
  }, [events]);

  if (loading && events.length === 0) {
    return <div className="loading">⏳ Загрузка данных...</div>;
  }

  return (
    <div className="export-new">
      <h2>💾 Экспорт данных</h2>

      <div className="export-info">
        <div className="info-card">
          <div className="info-label">Всего записей</div>
          <div className="info-value">{stats_summary.total}</div>
        </div>
        <div className="info-card">
          <div className="info-label">Товаров</div>
          <div className="info-value">{stats_summary.items}</div>
        </div>
        <div className="info-card">
          <div className="info-label">Коробов</div>
          <div className="info-value">{stats_summary.boxes}</div>
        </div>
        <div className="info-card">
          <div className="info-label">Клиентов</div>
          <div className="info-value">{stats_summary.clients}</div>
        </div>
        <div className="info-card">
          <div className="info-label">Городов</div>
          <div className="info-value">{stats_summary.cities}</div>
        </div>
        <div className="info-card">
          <div className="info-label">Операторов</div>
          <div className="info-value">{stats_summary.operators}</div>
        </div>
      </div>

      <div className="export-section">
        <h3>Формат экспорта</h3>
        <div className="format-selector">
          <label className="radio-option">
            <input
              type="radio"
              value="csv"
              checked={exportFormat === 'csv'}
              onChange={(e) => setExportFormat(e.target.value)}
            />
            <span>CSV (Excel)</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              value="xlsx"
              checked={exportFormat === 'xlsx'}
              onChange={(e) => setExportFormat(e.target.value)}
            />
            <span>XLSX (Excel, требует библиотеку)</span>
          </label>
        </div>
      </div>

      <div className="export-actions">
        <button 
          className="export-btn"
          onClick={handleExport}
          disabled={exportData.length === 0}
        >
          📥 Экспортировать {exportFormat.toUpperCase()}
        </button>
        
        {exportData.length === 0 && (
          <div className="warning-message">
            Нет данных для экспорта. Измените фильтры.
          </div>
        )}
      </div>

      <div className="export-preview">
        <h3>Предпросмотр данных (первые 10 записей)</h3>
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
              </tr>
            </thead>
            <tbody>
              {exportData.slice(0, 10).map((row, idx) => (
                <tr key={idx}>
                  <td>{row['Дата/Время']}</td>
                  <td>{row['Оператор']}</td>
                  <td>{row['Тип']}</td>
                  <td>{row['Клиент']}</td>
                  <td>{row['Город']}</td>
                  <td>{row['Короб']}</td>
                  <td>{row['Код']}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {exportData.length > 10 && (
          <div className="preview-note">
            ... и ещё {exportData.length - 10} записей
          </div>
        )}
      </div>
    </div>
  );
}

