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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      window.dispatchEvent(new CustomEvent('novelverse:session-expired'));
    }
    return Promise.reject(error);
  }
);

export const editorApi = {
  // Lấy dữ liệu chương & các đoạn phục vụ editor
  getChapterEditor: (chapterId) => api.get(`/editor/chapters/${chapterId}/editor`),

  // Cập nhật bản dịch của đoạn (Auto-save)
  updateSegment: (segmentId, data) => api.put(`/editor/segments/${segmentId}`, data),

  // Bật/tắt đánh dấu cần xem lại
  toggleReview: (segmentId) => api.put(`/editor/segments/${segmentId}/toggle-review`),

  // Dịch lại riêng đoạn đang chọn
  retranslateSegment: (segmentId, style) => api.post(`/segments/${segmentId}/retranslate`, { style }),

  // Hoàn tất biên tập toàn chương
  completeReview: (chapterId, force = false) => api.post(`/editor/chapters/${chapterId}/complete-review`, { force }),

  runQa: (chapterId) => api.post(`/editor/chapters/${chapterId}/qa/run`),
  getQa: (chapterId) => api.get(`/editor/chapters/${chapterId}/qa`),
  ignoreQaIssue: (issueId) => api.put(`/editor/qa-issues/${issueId}/ignore`),
  restoreQaIssue: (issueId) => api.put(`/editor/qa-issues/${issueId}/restore`),
  translateChapter: (chapterId, style = 'natural', resegment = false) => (
    api.post(`/chapters/${chapterId}/translate`, { style, resegment })
  ),
};

export const novelApi = {
  getNovels: (params) => api.get('/novels', { params }),
  getMyNovels: () => api.get('/novels/mine'),
  getNovel: (id) => api.get(`/novels/${id}`),
  createNovel: (data) => api.post('/novels', data),
  updateNovel: (id, data) => api.put(`/novels/${id}`, data),
  deleteNovel: (id) => api.delete(`/novels/${id}`),
};

export const chapterApi = {
  getChapters: (novelId) => api.get(`/novels/${novelId}/chapters`),
  getChapter: (id) => api.get(`/chapters/${id}`),
  createChapter: (novelId, data) => api.post(`/novels/${novelId}/chapters`, data),
  updateChapter: (id, data) => api.put(`/chapters/${id}`, data),
  deleteChapter: (id) => api.delete(`/chapters/${id}`),
};

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, displayName) => api.post('/auth/register', { email, password, displayName }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (displayName) => api.put('/auth/profile', { displayName }),
  changePassword: (oldPassword, newPassword) => api.put('/auth/change-password', { oldPassword, newPassword }),
  logout: () => api.post('/auth/logout'),
};

export default api;
