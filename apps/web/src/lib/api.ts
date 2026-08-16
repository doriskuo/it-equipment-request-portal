import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const currentUser = useAuthStore.getState().currentUser;
  
  if (currentUser?.email) {
    config.headers['x-user-email'] = currentUser.email;
  }
  
  return config;
});

export default api;
