/**
 * 后端接口封装
 * 开发时由 vite 代理 /api → http://127.0.0.1:3000
 * 生产时由 Express 同源提供
 */

const BASE = '/api';

class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('连不上后端，请确认 npm start 已运行', 0);
  }

  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `请求失败（${res.status}）`, res.status, data?.field);
  }
  return data;
}

/** 把 Date 变成 YYYY-MM-DD（本地时区） */
export function ymd(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 今天 YYYY-MM-DD */
export function today() {
  return ymd(new Date());
}

/** 金额显示 */
export function money(n) {
  return '¥' + Number(n).toFixed(2);
}

/** 时间显示：只到分钟 */
export function prettyTime(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const api = {
  health: () => request('/health'),
  summary: () => request('/summary'),

  todos: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.done !== undefined && params.done !== '') q.set('done', params.done);
      if (params.q) q.set('q', params.q);
      const s = q.toString();
      return request('/todos' + (s ? '?' + s : ''));
    },
    create: (data) => request('/todos', { method: 'POST', body: data }),
    update: (id, data) => request(`/todos/${id}`, { method: 'PATCH', body: data }),
    remove: (id) => request(`/todos/${id}`, { method: 'DELETE' }),
  },

  expenses: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.from) q.set('from', params.from);
      if (params.to) q.set('to', params.to);
      if (params.category) q.set('category', params.category);
      const s = q.toString();
      return request('/expenses' + (s ? '?' + s : ''));
    },
    summary: (params = {}) => {
      const q = new URLSearchParams();
      if (params.from) q.set('from', params.from);
      if (params.to) q.set('to', params.to);
      const s = q.toString();
      return request('/expenses/summary' + (s ? '?' + s : ''));
    },
    create: (data) => request('/expenses', { method: 'POST', body: data }),
    remove: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
  },

  events: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.from) q.set('from', params.from);
      if (params.to) q.set('to', params.to);
      if (params.upcoming) q.set('upcoming', '1');
      const s = q.toString();
      return request('/events' + (s ? '?' + s : ''));
    },
    create: (data) => request('/events', { method: 'POST', body: data }),
    update: (id, data) => request(`/events/${id}`, { method: 'PATCH', body: data }),
    remove: (id) => request(`/events/${id}`, { method: 'DELETE' }),
  },

  journal: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.q) q.set('q', params.q);
      if (params.limit) q.set('limit', params.limit);
      if (params.from) q.set('from', params.from);
      if (params.to) q.set('to', params.to);
      const s = q.toString();
      return request('/journal' + (s ? '?' + s : ''));
    },
    get: (id) => request(`/journal/${id}`),
    create: (data) => request('/journal', { method: 'POST', body: data }),
    update: (id, data) => request(`/journal/${id}`, { method: 'PATCH', body: data }),
    remove: (id) => request(`/journal/${id}`, { method: 'DELETE' }),
  },
  notes: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.q) q.set('q', params.q);
      if (params.tag) q.set('tag', params.tag);
      if (params.pinned) q.set('pinned', '1');
      const s = q.toString();
      return request('/notes' + (s ? '?' + s : ''));
    },
    create: (data) => request('/notes', { method: 'POST', body: data }),
    update: (id, data) => request(`/notes/${id}`, { method: 'PATCH', body: data }),
    remove: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
  },

  exams: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.upcoming) q.set('upcoming', '1');
      if (params.status) q.set('status', params.status);
      if (params.from) q.set('from', params.from);
      if (params.to) q.set('to', params.to);
      const s = q.toString();
      return request('/exams' + (s ? '?' + s : ''));
    },
    create: (data) => request('/exams', { method: 'POST', body: data }),
    update: (id, data) => request(`/exams/${id}`, { method: 'PATCH', body: data }),
    remove: (id) => request(`/exams/${id}`, { method: 'DELETE' }),
  },

  meals: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.type) q.set('type', params.type);
      if (params.from) q.set('from', params.from);
      if (params.to) q.set('to', params.to);
      const s = q.toString();
      return request('/meals' + (s ? '?' + s : ''));
    },
    summary: () => request('/meals/summary'),
    create: (data) => request('/meals', { method: 'POST', body: data }),
    remove: (id) => request(`/meals/${id}`, { method: 'DELETE' }),
  },

  workouts: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.kind) q.set('kind', params.kind);
      if (params.from) q.set('from', params.from);
      if (params.to) q.set('to', params.to);
      const s = q.toString();
      return request('/workouts' + (s ? '?' + s : ''));
    },
    summary: () => request('/workouts/summary'),
    create: (data) => request('/workouts', { method: 'POST', body: data }),
    remove: (id) => request(`/workouts/${id}`, { method: 'DELETE' }),
  },
};

export { ApiError };
