import { useMemo, useState } from 'react';

export default function DashboardNew({ events, stats, loading, filters }) {
  const [expandedOperators, setExpandedOperators] = useState(new Set());
  const [expandedBoxes, setExpandedBoxes] = useState(new Set());

  // Парсинг даты из формата API
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const [datePart, timePart] = dateStr.split(' ');
      const [month, day, year] = datePart.split('.');
      return new Date(`${year}-${month}-${day}T${timePart}`);
    } catch (e) {
      return null;
    }
  };

  // Данные для графика (последние 14 дней)
  const chartData = useMemo(() => {
    const days = [];
    const today = new Date();
    
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        items: 0
      });
    }

    // Подсчитываем товары по дням
    events.forEach(event => {
      const eventDate = parseDate(event.ts);
      if (eventDate && event.type === 'ITEM') {
        const dateStr = eventDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        const dayData = days.find(d => d.date === dateStr);
        if (dayData) {
          dayData.items++;
        }
      }
    });

    return days;
  }, [events]);

  // Данные операторов с детализацией
  const operatorsData = useMemo(() => {
    const operators = {};

    events.forEach(event => {
      const op = event.operator || 'Неизвестно';
      
      if (!operators[op]) {
        operators[op] = {
          name: op,
          clicks: 0,
          boxes: new Map(),
          items: 0,
          errors: 0
        };
      }

      operators[op].clicks++;

      if (event.type === 'ITEM') {
        operators[op].items++;
        
        // Добавляем товар в короб
        if (event.box) {
          if (!operators[op].boxes.has(event.box)) {
            operators[op].boxes.set(event.box, {
              box: event.box,
              client: event.client,
              city: event.city,
              items: [],
              opened: null,
              closed: null
            });
          }
          operators[op].boxes.get(event.box).items.push({
            code: event.code,
            ts: event.ts
          });
        }
      }

      if (event.type === 'BOX') {
        if (!operators[op].boxes.has(event.box)) {
          operators[op].boxes.set(event.box, {
            box: event.box,
            client: event.client,
            city: event.city,
            items: [],
            opened: event.ts,
            closed: null
          });
        } else {
          operators[op].boxes.get(event.box).opened = event.ts;
        }
      }

      if (event.type === 'CLOSE' && event.box) {
        if (operators[op].boxes.has(event.box)) {
          operators[op].boxes.get(event.box).closed = event.ts;
        }
      }

      if (event.type.includes('ERROR')) {
        operators[op].errors++;
      }
    });

    return Object.values(operators)
      .map(op => ({
        ...op,
        boxes: Array.from(op.boxes.values()),
        boxesCount: op.boxes.size
      }))
      .sort((a, b) => b.clicks - a.clicks);
  }, [events]);

  const toggleOperator = (operatorName) => {
    const newExpanded = new Set(expandedOperators);
    if (newExpanded.has(operatorName)) {
      newExpanded.delete(operatorName);
    } else {
      newExpanded.add(operatorName);
    }
    setExpandedOperators(newExpanded);
  };

  const toggleBox = (boxId) => {
    const newExpanded = new Set(expandedBoxes);
    if (newExpanded.has(boxId)) {
      newExpanded.delete(boxId);
    } else {
      newExpanded.add(boxId);
    }
    setExpandedBoxes(newExpanded);
  };

  const maxValue = Math.max(...chartData.map(d => d.items), 1);

  if (loading && events.length === 0) {
    return <div className="loading">⏳ Загрузка данных...</div>;
  }

  return (
    <div className="dashboard-new">
      <div className="dashboard-main">
        <div className="dashboard-top">
          {/* График динамики */}
          <div className="chart-section">
          <h2>Динамика сканирования (последние 14 дней)</h2>
          <div className="chart-container">
            <svg className="chart-svg" viewBox="0 0 700 220" preserveAspectRatio="none">
              <defs>
                {/* Градиент для синей линии */}
                <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{stopColor: '#2196F3', stopOpacity: 0.3}} />
                  <stop offset="100%" style={{stopColor: '#2196F3', stopOpacity: 0}} />
                </linearGradient>
              </defs>
              
              {/* Сетка */}
              <line x1="0" y1="0" x2="700" y2="0" stroke="#f0f0f0" strokeWidth="1" />
              <line x1="0" y1="55" x2="700" y2="55" stroke="#f0f0f0" strokeWidth="1" />
              <line x1="0" y1="110" x2="700" y2="110" stroke="#f0f0f0" strokeWidth="1" />
              <line x1="0" y1="165" x2="700" y2="165" stroke="#f0f0f0" strokeWidth="1" />
              <line x1="0" y1="220" x2="700" y2="220" stroke="#f0f0f0" strokeWidth="1" />
              
              {/* Заливка под линией */}
              <path
                d={`M 0,220 ${chartData.map((day, idx) => {
                  const x = (idx / (chartData.length - 1)) * 700;
                  const y = 220 - ((day.items / maxValue) * 200);
                  return `L ${x},${y}`;
                }).join(' ')} L 700,220 Z`}
                fill="url(#blueGradient)"
              />
              
              {/* Линия товаров (синяя) */}
              <polyline
                points={chartData.map((day, idx) => {
                  const x = (idx / (chartData.length - 1)) * 700;
                  const y = 220 - ((day.items / maxValue) * 200);
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke="#2196F3"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Точки */}
              {chartData.map((day, idx) => {
                const x = (idx / (chartData.length - 1)) * 700;
                const y = 220 - ((day.items / maxValue) * 200);
                return (
                  <g key={`items-${idx}`}>
                    <circle cx={x} cy={y} r="5" fill="white" stroke="#2196F3" strokeWidth="2" />
                  </g>
                );
              })}
            </svg>
            
            {/* Подписи дат */}
            <div className="chart-x-axis">
              {chartData.map((day, idx) => {
                // Показываем каждую вторую дату для читаемости
                if (idx % 2 === 0) {
                  return (
                    <div key={idx} className="chart-x-label" style={{left: `${(idx / (chartData.length - 1)) * 100}%`}}>
                      {day.date}
                    </div>
                  );
                }
                return null;
              })}
            </div>
            
            {/* Легенда */}
            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-line" style={{background: '#2196F3'}}></span>
                <span className="legend-label">Товаров отсканировано</span>
              </div>
            </div>
          </div>
        </div>

          {/* Метрики справа */}
          <div className="dashboard-metrics">
            <div className="metric-card">
              <div className="metric-icon">📦</div>
              <div className="metric-content">
                <div className="metric-value">{stats?.summary?.items || 0}</div>
                <div className="metric-label">Товаров отсканировано</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon">📦</div>
              <div className="metric-content">
                <div className="metric-value">{stats?.summary?.opens || 0}</div>
                <div className="metric-label">Коробов открыто</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon">✅</div>
              <div className="metric-content">
                <div className="metric-value">{stats?.summary?.closes || 0}</div>
                <div className="metric-label">Закрыто</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon">❌</div>
              <div className="metric-content">
                <div className="metric-value">{stats?.summary?.errors || 0}</div>
                <div className="metric-label">Ошибок</div>
              </div>
            </div>
          </div>
        </div>

        {/* Таблица операторов */}
        <div className="operators-section">
          <h2>Детализация по операторам</h2>
          <div className="operators-table">
            <table>
              <thead>
                <tr>
                  <th style={{width: '40px'}}></th>
                  <th>Оператор</th>
                  <th>Кликов</th>
                  <th>Коробов</th>
                  <th>Товаров</th>
                  <th>Ошибок</th>
                </tr>
              </thead>
              <tbody>
                {operatorsData.map((operator) => (
                  <>
                    <tr 
                      key={operator.name}
                      className="operator-row"
                      onClick={() => toggleOperator(operator.name)}
                    >
                      <td className="expand-cell">
                        <span className={`expand-icon ${expandedOperators.has(operator.name) ? 'expanded' : ''}`}>
                          ▶
                        </span>
                      </td>
                      <td className="operator-name">{operator.name}</td>
                      <td>{operator.clicks}</td>
                      <td>{operator.boxesCount}</td>
                      <td>{operator.items}</td>
                      <td className={operator.errors > 0 ? 'error-cell' : ''}>{operator.errors}</td>
                    </tr>
                    
                    {expandedOperators.has(operator.name) && (
                      <tr className="expanded-content">
                        <td colSpan="6">
                          <div className="boxes-detail">
                            <h4>Короба оператора {operator.name}</h4>
                            <table className="boxes-table-nested">
                              <thead>
                                <tr>
                                  <th style={{width: '40px'}}></th>
                                  <th>Короб</th>
                                  <th>Клиент</th>
                                  <th>Город</th>
                                  <th>Товаров</th>
                                  <th>Статус</th>
                                </tr>
                              </thead>
                              <tbody>
                                {operator.boxes.map((box, idx) => (
                                  <>
                                    <tr 
                                      key={idx}
                                      className="box-row"
                                      onClick={(e) => { e.stopPropagation(); toggleBox(`${operator.name}-${box.box}`); }}
                                    >
                                      <td className="expand-cell">
                                        <span className={`expand-icon ${expandedBoxes.has(`${operator.name}-${box.box}`) ? 'expanded' : ''}`}>
                                          ▶
                                        </span>
                                      </td>
                                      <td className="box-code">{box.box}</td>
                                      <td>{box.client || '-'}</td>
                                      <td>{box.city || '-'}</td>
                                      <td>{box.items.length}</td>
                                      <td>
                                        {box.closed ? (
                                          <span className="status-badge success">✅ Закрыт</span>
                                        ) : (
                                          <span className="status-badge warning">⚠️ Открыт</span>
                                        )}
                                      </td>
                                    </tr>
                                    
                                    {expandedBoxes.has(`${operator.name}-${box.box}`) && (
                                      <tr className="expanded-content">
                                        <td colSpan="6">
                                          <div className="items-detail">
                                            <h5>Отсканированные штрихкоды</h5>
                                            <div className="items-list">
                                              {box.items.map((item, itemIdx) => (
                                                <div key={itemIdx} className="item-row">
                                                  <span className="item-code">{item.code}</span>
                                                  <span className="item-time">{item.ts}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {operatorsData.length === 0 && (
              <div className="empty-state">Нет данных</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

