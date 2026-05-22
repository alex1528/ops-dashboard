import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    if (status === 401) {
      // Don't redirect on login endpoint — let the Login page handle errors
      const url = err.config?.url || '';
      if (!url.includes('/auth/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } else if (
      status === 403 &&
      data?.code === 'MUST_CHANGE_PASSWORD' &&
      window.location.pathname !== '/force-change-password'
    ) {
      // 命中后端 ForceChangePasswordGuard，跳转到强制改密页（避免在该页自身循环跳转）
      window.location.href = '/force-change-password';
    }
    return Promise.reject(err);
  },
);

export default api;
