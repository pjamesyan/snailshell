const BASE_URL = '/api';

function getToken() { return localStorage.getItem('token'); }

function getEncryptionKey() { return localStorage.getItem('encryptionKey'); }

async function request(path, options = {}) {
  const token = getToken();
  const encKey = getEncryptionKey();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (encKey) headers['x-encryption-key'] = encKey;
  
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

async function uploadFile(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}/files/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  return res.json();
}

export const api = {
  // Auth
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  setup2FA: () => request('/auth/2fa/setup', { method: 'POST' }),
  verify2FA: (data) => request('/auth/2fa/verify', { method: 'POST', body: JSON.stringify(data) }),
  disable2FA: (data) => request('/auth/2fa/disable', { method: 'POST', body: JSON.stringify(data) }),
  changePassword: (data) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  
  // Profiles
  listProfiles: (params) => request(`/profiles?${new URLSearchParams(params || {})}`),
  getProfile: (id) => request(`/profiles/${id}`),
  createProfile: (data) => request('/profiles', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (id, data) => request(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProfile: (id) => request(`/profiles/${id}`, { method: 'DELETE' }),
  getProfileReferrals: (id) => request(`/profiles/${id}/referrals`),
  getProfileStats: () => request('/profiles/stats'),
  updateProfileSort: (orders) => request('/profiles/sort-order', { method: 'PUT', body: JSON.stringify({ orders }) }),
  
  // Projects
  listProjects: (params) => request(`/projects?${new URLSearchParams(params || {})}`),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  getProjectStats: () => request('/projects/stats'),
  updateProjectSort: (orders) => request('/projects/sort-order', { method: 'PUT', body: JSON.stringify({ orders }) }),
  
  // Registrations
  getByProfile: (profileId) => request(`/registrations/by-profile/${profileId}`),
  getByProject: (projectId) => request(`/registrations/by-project/${projectId}`),
  createRegistration: (data) => request('/registrations', { method: 'POST', body: JSON.stringify(data) }),
  updateRegistration: (id, data) => request(`/registrations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRegistration: (id) => request(`/registrations/${id}`, { method: 'DELETE' }),
  addTimeline: (id, data) => request(`/registrations/${id}/timeline`, { method: 'POST', body: JSON.stringify(data) }),
  batchRegistration: (data) => request('/registrations/batch', { method: 'POST', body: JSON.stringify(data) }),
  
  // Exchanges
  listExchanges: (params) => request(`/exchanges?${new URLSearchParams(params || {})}`),
  getExchange: (id) => request(`/exchanges/${id}`),
  createExchange: (data) => request('/exchanges', { method: 'POST', body: JSON.stringify(data) }),
  updateExchange: (id, data) => request(`/exchanges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExchange: (id) => request(`/exchanges/${id}`, { method: 'DELETE' }),
  getExchangeStats: () => request('/exchanges/stats/summary'),
  updateExchangeSort: (orders) => request('/exchanges/sort-order', { method: 'PUT', body: JSON.stringify({ orders }) }),
  
  // Files
  uploadFile,
  uploadAvatar: async (file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/files/avatars/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    return res.json();
  },
  listAvatars: () => request('/files/avatars'),
  getFileUrl: (file) => {
    const name = typeof file === 'object' ? (file.filename || file.name || file.path) : file;
    if (!name) return '';
    // If already a full path like /api/files/xxx, use as-is
    if (name.startsWith('/api/')) return name;
    return `${BASE_URL}/files/${name}`;
  },
  getAvatarUrl: (filename) => `${BASE_URL}/files/avatars/${filename}`,
  deleteFile: (filename) => request(`/files/${filename}`, { method: 'DELETE' }),
  
  // Dashboard
  getDashboard: () => request('/dashboard/overview'),
  getUpcoming: () => request('/dashboard/upcoming'),
  getRecent: () => request('/dashboard/recent'),
  search: (q) => request(`/dashboard/search?q=${encodeURIComponent(q)}`),
  
  // Todos
  listTodos: (params) => request(`/todos?${new URLSearchParams(params || {})}`),
  getTodo: (id) => request(`/todos/${id}`),
  createTodo: (data) => request('/todos', { method: 'POST', body: JSON.stringify(data) }),
  updateTodo: (id, data) => request(`/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTodo: (id) => request(`/todos/${id}`, { method: 'DELETE' }),
  updateTodoSort: (orders) => request('/todos/sort-order', { method: 'PUT', body: JSON.stringify({ orders }) }),
  decomposeTodo: (id) => request(`/todos/${id}/decompose`, { method: 'POST' }),

  // Notes
  listNotes: (params) => request(`/notes?${new URLSearchParams(params || {})}`),
  getNote: (id) => request(`/notes/${id}`),
  createNote: (data) => request('/notes', { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (id, data) => request(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
  toggleNotePin: (id) => request(`/notes/${id}/pin`, { method: 'PUT' }),

  // Chat
  listConversations: () => request('/chat/conversations'),
  createConversation: (data) => request('/chat/conversations', { method: 'POST', body: JSON.stringify(data || {}) }),
  deleteConversation: (id) => request(`/chat/conversations/${id}`, { method: 'DELETE' }),
  updateConversation: (id, data) => request(`/chat/conversations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getMessages: (convId, params) => request(`/chat/conversations/${convId}/messages?${new URLSearchParams(params || {})}`),
  sendMessage: (convId, content) => request(`/chat/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  getLLMConfig: () => request('/chat/config'),
  updateLLMConfig: (data) => request('/chat/config', { method: 'PUT', body: JSON.stringify(data) }),

  // Backup
  createBackup: () => request('/backup/create', { method: 'POST' }),
  listBackups: () => request('/backup/list'),
  restoreBackup: (name) => request(`/backup/restore/${name}`, { method: 'POST' }),
  deleteBackup: (name) => request(`/backup/${name}`, { method: 'DELETE' }),
  exportJSON: () => request('/backup/export/json'),
  exportCSV: async (queryString = '') => {
    const token = getToken();
    const encKey = getEncryptionKey();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (encKey) headers['x-encryption-key'] = encKey;
    const url = queryString ? `${BASE_URL}/backup/export/csv?${queryString}` : `${BASE_URL}/backup/export/csv`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('导出CSV失败');
    const text = await res.text();
    return text;
  },
  importJSON: (data) => request('/backup/import/json', { method: 'POST', body: JSON.stringify(data) }),
};
