import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor de request: adiciona o token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Uma renovação por vez: várias respostas 401 juntas esperam a mesma chamada
let refreshing: Promise<string> | null = null;

/**
 * Renova o token de acesso na API (em produção ela fica em outro domínio, não na Vercel).
 * Guarda também o refresh novo, que o backend gira a cada renovação.
 */
function refreshAccessToken(refreshToken: string) {
  refreshing ??= axios
    .post(`${API_URL}/auth/refresh/`, { refresh: refreshToken })
    .then(({ data }) => {
      if (typeof data?.access !== 'string') throw new Error('Resposta de renovação sem token');
      localStorage.setItem('access_token', data.access);
      if (typeof data.refresh === 'string') localStorage.setItem('refresh_token', data.refresh);
      return data.access as string;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// Interceptor de response: trata 401 e renova token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login/')) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const access = await refreshAccessToken(refreshToken);
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
