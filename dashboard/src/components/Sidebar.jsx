export default function Sidebar({ activeTab, onTabChange }) {
  const menuItems = [
    { id: 'dashboard', icon: '📊', label: 'Рабочий стол' },
    { id: 'boxes', icon: '📦', label: 'Короба' },
    { id: 'deletes', icon: '🗑️', label: 'Удаления' },
    { id: 'raw', icon: '📝', label: 'Сырые логи' },
    { id: 'export', icon: '💾', label: 'Экспорт' }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-icon">📱</span>
          <div className="logo-text">
            <div className="logo-title">Scanner</div>
            <div className="logo-subtitle">Dashboard</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">A</div>
          <div className="user-info">
            <div className="user-name">Admin</div>
            <div className="user-role">Администратор</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

