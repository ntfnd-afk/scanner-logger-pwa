import React, { useMemo, useState, useEffect } from 'react';

export default function BoxesNew({ events, stats, loading }) {
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [expandedCities, setExpandedCities] = useState(new Set());
  const [expandedBoxes, setExpandedBoxes] = useState(new Set());

  // Отладка только при изменении данных
  useEffect(() => {
    console.log('BoxesNew - events:', events);
    console.log('BoxesNew - events.length:', events?.length);
    console.log('BoxesNew - stats:', stats);
    console.log('BoxesNew - loading:', loading);
  }, [events, stats, loading]);

  // Парсинг даты
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

  // Структура: Клиент → Города → Короба → Штрихкоды
  const clientsData = useMemo(() => {
    const clients = {};

    events.forEach(event => {
      const client = event.client || 'Без клиента';
      const city = event.city || 'Без города';
      const box = event.box || null;

      if (!clients[client]) {
        clients[client] = {
          name: client,
          cities: {},
          totalItems: 0,
          totalBoxes: 0
        };
      }

      if (!clients[client].cities[city]) {
        clients[client].cities[city] = {
          name: city,
          boxes: {},
          totalItems: 0,
          totalBoxes: 0
        };
      }

      if (event.type === 'ITEM' && box) {
        clients[client].totalItems++;
        clients[client].cities[city].totalItems++;

        if (!clients[client].cities[city].boxes[box]) {
          clients[client].cities[city].boxes[box] = {
            box: box,
            items: [],
            opened: null,
            closed: null,
            operators: new Set()
          };
          clients[client].totalBoxes++;
          clients[client].cities[city].totalBoxes++;
        }

        clients[client].cities[city].boxes[box].items.push({
          code: event.code,
          ts: event.ts,
          operator: event.operator,
          uuid: event.uuid
        });

        if (event.operator) {
          clients[client].cities[city].boxes[box].operators.add(event.operator);
        }
      }

      if (event.type === 'BOX' && box) {
        if (!clients[client].cities[city].boxes[box]) {
          clients[client].cities[city].boxes[box] = {
            box: box,
            items: [],
            opened: event.ts,
            closed: null,
            operators: new Set()
          };
          clients[client].totalBoxes++;
          clients[client].cities[city].totalBoxes++;
        } else {
          clients[client].cities[city].boxes[box].opened = event.ts;
        }
      }

      if (event.type === 'CLOSE' && box) {
        if (clients[client].cities[city].boxes[box]) {
          clients[client].cities[city].boxes[box].closed = event.ts;
        }
      }
    });

    // Преобразуем в массивы
    return Object.values(clients).map(client => ({
      ...client,
      cities: Object.values(client.cities).map(city => ({
        ...city,
        boxes: Object.values(city.boxes).map(box => ({
          ...box,
          operators: Array.from(box.operators)
        }))
      }))
    })).sort((a, b) => b.totalItems - a.totalItems);
  }, [events]);

  const toggleClient = (clientName) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientName)) {
      newExpanded.delete(clientName);
    } else {
      newExpanded.add(clientName);
    }
    setExpandedClients(newExpanded);
  };

  const toggleCity = (cityId) => {
    const newExpanded = new Set(expandedCities);
    if (newExpanded.has(cityId)) {
      newExpanded.delete(cityId);
    } else {
      newExpanded.add(cityId);
    }
    setExpandedCities(newExpanded);
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

  const handleDeleteItem = async (itemUuid, boxCode, clientName, cityName) => {
    if (!confirm('Удалить этот штрихкод из короба?')) return;

    try {
      // TODO: API запрос на удаление
      console.log('Delete item:', itemUuid, boxCode, clientName, cityName);
      alert('Удаление будет реализовано в следующем шаге');
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Ошибка при удалении');
    }
  };

  if (loading && clientsData.length === 0) {
    return <div className="loading">⏳ Загрузка данных...</div>;
  }

  return (
    <div className="boxes-new">
      <h2>📦 Короба (структура матрёшки)</h2>
      
      {events.length === 0 && !loading && (
        <div className="empty-state" style={{padding: '2rem', textAlign: 'center', color: '#999'}}>
          Нет данных за выбранный период. Попробуйте изменить фильтры (дату, оператора, клиента).
        </div>
      )}
      
      <div className="boxes-tree">
        {clientsData.map((client) => (
          <div key={client.name} className="client-node">
            <div 
              className="client-header node-header"
              onClick={() => toggleClient(client.name)}
            >
              <span className={`expand-icon ${expandedClients.has(client.name) ? 'expanded' : ''}`}>
                ▶
              </span>
              <span className="node-title">🏢 {client.name}</span>
              <span className="node-stats">
                {client.totalBoxes} коробов · {client.totalItems} товаров
              </span>
            </div>

            {expandedClients.has(client.name) && (
              <div className="client-content">
                {client.cities.map((city) => {
                  const cityId = `${client.name}-${city.name}`;
                  return (
                    <div key={cityId} className="city-node">
                      <div 
                        className="city-header node-header"
                        onClick={() => toggleCity(cityId)}
                      >
                        <span className={`expand-icon ${expandedCities.has(cityId) ? 'expanded' : ''}`}>
                          ▶
                        </span>
                        <span className="node-title">🏙️ {city.name}</span>
                        <span className="node-stats">
                          {city.totalBoxes} коробов · {city.totalItems} товаров
                        </span>
                      </div>

                      {expandedCities.has(cityId) && (
                        <div className="city-content">
                          {city.boxes.map((box) => {
                            const boxId = `${cityId}-${box.box}`;
                            return (
                              <div key={boxId} className="box-node">
                                <div 
                                  className="box-header node-header"
                                  onClick={() => toggleBox(boxId)}
                                >
                                  <span className={`expand-icon ${expandedBoxes.has(boxId) ? 'expanded' : ''}`}>
                                    ▶
                                  </span>
                                  <span className="node-title">📦 {box.box}</span>
                                  <span className="node-stats">
                                    {box.items.length} товаров · 
                                    {box.operators.join(', ')}
                                    {box.closed ? (
                                      <span className="status-badge success">✅ Закрыт</span>
                                    ) : (
                                      <span className="status-badge warning">⚠️ Открыт</span>
                                    )}
                                  </span>
                                </div>

                                {expandedBoxes.has(boxId) && (
                                  <div className="box-content">
                                    <div className="items-list">
                                      {box.items.map((item, idx) => (
                                        <div key={idx} className="item-card">
                                          <div className="item-info">
                                            <span className="item-code">{item.code}</span>
                                            <span className="item-meta">
                                              {item.operator} · {item.ts}
                                            </span>
                                          </div>
                                          <button 
                                            className="delete-btn"
                                            onClick={() => handleDeleteItem(item.uuid, box.box, client.name, city.name)}
                                          >
                                            🗑️ Удалить
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {clientsData.length === 0 && !loading && (
          <div className="empty-state">Нет данных о коробах за выбранный период.</div>
        )}
      </div>
    </div>
  );
}

