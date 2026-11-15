import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Gắn JWT token vào request header nếu có
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const editorApi = {
  // Lấy dữ liệu chương & các đoạn phục vụ editor
  getChapterEditor: (chapterId) => api.get(`/editor/chapters/${chapterId}/editor`),

  // Cập nhật bản dịch của đoạn (Auto-save)
  updateSegment: (segmentId, data) => api.put(`/editor/segments/${segmentId}`, data),

  // Bật/tắt đánh dấu cần xem lại
  toggleReview: (segmentId) => api.put(`/editor/segments/${segmentId}/toggle-review`),

  // Dịch lại riêng đoạn đang chọn
  retranslateSegment: (segmentId, style) => api.post(`/editor/segments/${segmentId}/retranslate`, { style }),

  // Hoàn tất biên tập toàn chương
  completeReview: (chapterId, force = false) => api.post(`/editor/chapters/${chapterId}/complete-review`, { force }),
};

export const novelApi = {
  getNovels: (params) => api.get('/novels', { params }),
  getNovel: (id) => api.get(`/novels/${id}`),
};

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, displayName) => api.post('/auth/register', { email, password, displayName }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (displayName) => api.put('/auth/profile', { displayName }),
  changePassword: (oldPassword, newPassword) => api.put('/auth/change-password', { oldPassword, newPassword }),
};

export default api;

