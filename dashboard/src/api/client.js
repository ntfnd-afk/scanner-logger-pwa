// API клиент для работы с backend
const API_BASE = import.meta.env.PROD 
  ? 'https://scanner-api.fulfilment-one.ru/api/v1'
  : '/api/v1';

const API_KEY = 'ihkLCIfVDynpEcr14NxuO8ZBWKHzMU60';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Получить состояние дашборда (операторы, события, статистика)
export async function getDashboardState(filters = {}) {
  const params = new URLSearchParams();
  
  // Используем startDate как основную дату (API ожидает 'date')
  if (filters.startDate) params.append('date', filters.startDate);
  if (filters.endDate) params.append('date_end', filters.endDate);
  if (filters.operator) params.append('operator', filters.operator);
  if (filters.client) params.append('client', filters.client);
  if (filters.city) params.append('city', filters.city);
  
  const query = params.toString();
  console.log('📡 API request: /dashboard/state?' + query, {
    filters,
    parsedParams: Object.fromEntries(params)
  });
  return fetchAPI(`/dashboard/state${query ? '?' + query : ''}`);
}

// Получить сырые логи
export async function getRawLogs(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.startDate) params.append('date', filters.startDate);
  if (filters.endDate) params.append('date_end', filters.endDate);
  if (filters.operator) params.append('operator', filters.operator);
  if (filters.client) params.append('client', filters.client);
  if (filters.city) params.append('city', filters.city);
  if (filters.eventType) params.append('type', filters.eventType);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);
  
  const query = params.toString();
  console.log('📡 API request: /dashboard/raw?' + query, {
    filters,
    parsedParams: Object.fromEntries(params)
  });
  return fetchAPI(`/dashboard/raw${query ? '?' + query : ''}`);
}

// Получить группировку по коробам
export async function getBoxes(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.startDate) params.append('date', filters.startDate);
  if (filters.endDate) params.append('date_end', filters.endDate);
  if (filters.operator) params.append('operator', filters.operator);
  if (filters.client) params.append('client', filters.client);
  if (filters.city) params.append('city', filters.city);
  
  const query = params.toString();
  console.log('📡 API request: /dashboard/boxes?' + query, {
    filters,
    parsedParams: Object.fromEntries(params)
  });
  return fetchAPI(`/dashboard/boxes${query ? '?' + query : ''}`);
}

// Получить список операторов
export async function getOperators() {
  try {
    const data = await getDashboardState({});
    const operators = new Set();
    
    data.operators?.forEach(op => {
      if (op.operator) operators.add(op.operator);
    });
    
    return Array.from(operators).sort();
  } catch (error) {
    console.error('Error loading operators:', error);
    return [];
  }
}

// Получить список клиентов
export async function getClients() {
  try {
    const data = await getDashboardState({});
    const clients = new Set();
    
    data.clients?.forEach(client => {
      if (client.client) clients.add(client.client);
    });
    
    return Array.from(clients).sort();
  } catch (error) {
    console.error('Error loading clients:', error);
    return [];
  }
}

// Получить список городов
export async function getCities() {
  try {
    const data = await getDashboardState({});
    const cities = new Set();
    
    data.feed?.forEach(event => {
      if (event.city) cities.add(event.city);
    });
    
    return Array.from(cities).sort();
  } catch (error) {
    console.error('Error loading cities:', error);
    return [];
  }
}

// Экспорт в CSV
export function exportToCSV(events) {
  const headers = ['Дата', 'Время', 'Оператор', 'Тип', 'Клиент', 'Город', 'Короб', 'Код', 'Детали'];
  const rows = events.map(event => {
    const date = new Date(event.ts);
    return [
      date.toLocaleDateString('ru-RU'),
      date.toLocaleTimeString('ru-RU'),
      event.operator || '',
      event.type || '',
      event.client || '',
      event.city || '',
      event.box || '',
      event.code || '',
      event.details || ''
    ];
  });
  
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `scanner_export_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

