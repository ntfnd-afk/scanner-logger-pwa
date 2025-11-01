import { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardNew from './components/DashboardNew';
import BoxesNew from './components/BoxesNew';
import DeleteLogs from './components/DeleteLogs';
import RawLogsNew from './components/RawLogsNew';
import ExportNew from './components/ExportNew';
import { getDashboardState, getRawLogs, getBoxes, getOperators, getClients, getCities } from './api/client';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Фильтры
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0], // Сегодня
    endDate: new Date().toISOString().split('T')[0],
    operator: '',
    client: '',
    city: '',
    eventType: ''
  });
  
  // Списки для фильтров
  const [operators, setOperators] = useState([]);
  const [clients, setClients] = useState([]);
  const [cities, setCities] = useState([]);

  // Загрузка данных
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    console.log('🔍 Loading data with filters:', filters);
    
    try {
      // Загружаем данные в зависимости от активной вкладки
      if (activeTab === 'dashboard') {
        const data = await getDashboardState(filters);
        console.log('Dashboard data:', data);
        setEvents(data.feed || []);
        setStats({
          operators: data.operators || [],
          clients: data.clients || [],
          summary: data.summary || {}
        });
      } else if (activeTab === 'boxes') {
        // Для коробов используем feed из getDashboardState
        const data = await getDashboardState(filters);
        console.log('Boxes data (from feed):', data);
        setEvents(data.feed || []);
        setStats({
          operators: data.operators || [],
          clients: data.clients || [],
          summary: data.summary || {}
        });
      } else if (activeTab === 'raw' || activeTab === 'deletes' || activeTab === 'export') {
        const data = await getRawLogs(filters);
        console.log('📊 Raw logs data:', data);
        console.log('📊 Raw logs count:', data.logs?.length || 0, 'Total:', data.total);
        // API возвращает "logs", а не "events"
        setEvents(data.logs || data.events || []);
        setStats({ total: data.total || 0 });
      }
    } catch (err) {
      setError(err.message);
      console.error('Ошибка загрузки данных:', err);
      // Не сбрасываем данные при ошибке
    } finally {
      setLoading(false);
    }
  };

  // Загрузка списков для фильтров
  const loadFilterOptions = async () => {
    try {
      const [ops, cls, cts] = await Promise.all([
        getOperators(),
        getClients(),
        getCities()
      ]);
      
      setOperators(ops);
      setClients(cls);
      setCities(cts);
    } catch (err) {
      console.error('Ошибка загрузки фильтров:', err);
    }
  };

  // Первоначальная загрузка
  useEffect(() => {
    loadData();
    loadFilterOptions();
  }, []);

  // Автообновление каждые 30 секунд
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, filters]);

  // Обновление при изменении фильтров или вкладки
  useEffect(() => {
    loadData();
  }, [filters, activeTab]);

  const handleFilterChange = (newFilters) => {
    const updatedFilters = { ...filters, ...newFilters };
    
    // Валидация диапазона дат: если startDate > endDate, корректируем endDate
    if (updatedFilters.startDate && updatedFilters.endDate) {
      const start = new Date(updatedFilters.startDate);
      const end = new Date(updatedFilters.endDate);
      
      if (start > end) {
        console.warn('⚠️ startDate > endDate, корректируем endDate:', {
          startDate: updatedFilters.startDate,
          endDate: updatedFilters.endDate
        });
        updatedFilters.endDate = updatedFilters.startDate;
      }
    }
    
    console.log('📅 Filters updated:', updatedFilters);
    setFilters(updatedFilters);
  };

  const tabs = [
    { id: 'dashboard', component: DashboardNew },
    { id: 'boxes', component: BoxesNew },
    { id: 'deletes', component: DeleteLogs },
    { id: 'raw', component: RawLogsNew },
    { id: 'export', component: ExportNew }
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component;

  return (
    <div className="app-container">
      <Sidebar 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      <div className="app-main">
        <Header 
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
          onRefresh={loadData}
          loading={loading}
          filters={filters}
          operators={operators}
          clients={clients}
          cities={cities}
          onFilterChange={handleFilterChange}
        />

        <div className="content">
          {error && (
            <div className="error-banner">
              ❌ Ошибка: {error}
            </div>
          )}
          
          {ActiveComponent && (
            <ActiveComponent
              events={events}
              stats={stats}
              loading={loading}
              filters={filters}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

