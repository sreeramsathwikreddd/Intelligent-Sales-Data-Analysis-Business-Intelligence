import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 30000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('isdabi_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('isdabi_token');
      localStorage.removeItem('isdabi_user');

      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export const auth = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  register: (name, email, password, role) =>
    api.post('/auth/register', { name, email, password, role }),

  google: (credential, role) =>
    api.post('/auth/google', {
      credential,
      ...(role ? { role } : {})
    }),

  me: () =>
    api.get('/auth/me'),

  deleteAccount: () =>
    api.delete('/auth/account')
};

export const calls = {
  list: (params) =>
    api.get('/calls', { params }),

  get: (id) =>
    api.get(`/calls/${id}`),

  delete: (id) =>
    api.delete(`/calls/${id}`),

  upload: (file, onUploadProgress) => {
    const form = new FormData();
    form.append('audio', file);

    return api.post('/calls', form, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 600000,
      onUploadProgress
    });
  },

  analyze: (id) =>
    api.post(`/calls/${encodeURIComponent(id)}/analyze`)
};

export const analytics = {
  get: () =>
    api.get('/analytics')
};

export const reports = {
  list: (params) =>
    api.get('/reports', { params }),

  roleBased: (params) =>
    api.get('/reports/role-based', { params }),

  get: (id) =>
    api.get(`/reports/${id}`)
};

export const userManagement = {
  list: (role) =>
    api.get(`/user-management/${role}`),

  setStatus: (id, isActive) =>
    api.patch(`/user-management/${id}/status`, { isActive }),

  delete: (id) =>
    api.delete(`/user-management/${id}`)
};

export const health = () =>
  api.get('/health');

export default api;