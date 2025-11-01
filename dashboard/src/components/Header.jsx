export default function Header({ autoRefresh, onToggleAutoRefresh, onRefresh, loading, filters, operators, clients, cities, onFilterChange }) {
  return (
    <header className="header">
      <div className="header-filters">
        <div className="filter-group-inline">
          <label>
            📅 От:
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onFilterChange({ startDate: e.target.value })}
            />
          </label>
          
          <label>
            📅 До:
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => onFilterChange({ endDate: e.target.value })}
            />
          </label>

          <label>
            👤 Оператор:
            <select
              value={filters.operator}
              onChange={(e) => onFilterChange({ operator: e.target.value })}
            >
              <option value="">Все</option>
              {operators.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </label>

          <label>
            🏢 Клиент:
            <select
              value={filters.client}
              onChange={(e) => onFilterChange({ client: e.target.value })}
            >
              <option value="">Все</option>
              {clients.map(cl => (
                <option key={cl} value={cl}>{cl}</option>
              ))}
            </select>
          </label>

          <label>
            🏙️ Город:
            <select
              value={filters.city}
              onChange={(e) => onFilterChange({ city: e.target.value })}
            >
              <option value="">Все</option>
              {cities.map(ct => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
          </label>

          <label>
            📋 Тип:
            <select
              value={filters.eventType}
              onChange={(e) => onFilterChange({ eventType: e.target.value })}
            >
              <option value="">Все</option>
              <option value="ITEM">Товар</option>
              <option value="BOX">Короб</option>
              <option value="CLOSE">Закрытие</option>
              <option value="CITY">Город</option>
              <option value="ERROR">Ошибка</option>
            </select>
          </label>
        </div>
      </div>
      
      <div className="header-actions">
        <label className="auto-refresh">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={onToggleAutoRefresh}
          />
          <span>Автообновление (30с)</span>
        </label>
        
        <button 
          className="refresh-btn"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? '⏳' : '🔄'} Обновить
        </button>
      </div>
    </header>
  );
}

