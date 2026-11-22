import React, { useState } from 'react';
import { X, Lock, Mail, User, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { authApi } from '../services/api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      if (!formData.email || !formData.password) {
        setError('Vui lòng nhập đầy đủ email và mật khẩu');
        return;
      }
      setLoading(true);
      try {
        const res = await authApi.login(formData.email, formData.password);
        const { token } = res.data;
        localStorage.setItem('token', token);

        // Lấy thông tin user hiện tại
        const meRes = await authApi.getMe();
        onAuthSuccess(meRes.data);
        onClose();
      } catch (err) {
        setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại');
      } finally {
        setLoading(false);
      }
    } else {
      // Đăng ký
      if (!formData.displayName || !formData.email || !formData.password) {
        setError('Vui lòng điền đầy đủ các trường thông tin');
        return;
      }
      if (formData.password.length < 8) {
        setError('Mật khẩu phải chứa ít nhất 8 ký tự');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Mật khẩu xác nhận không khớp');
        return;
      }

      setLoading(true);
      try {
        await authApi.register(formData.email, formData.password, formData.displayName);
        // Tự động đăng nhập sau khi đăng ký thành công
        const loginRes = await authApi.login(formData.email, formData.password);
        localStorage.setItem('token', loginRes.data.token);

        const meRes = await authApi.getMe();
        onAuthSuccess(meRes.data);
        onClose();
      } catch (err) {
        setError(err.response?.data?.message || 'Đăng ký thất bại. Email có thể đã tồn tại');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* Header decoration */}
        <div className="relative bg-slate-950 p-6 text-center text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 mx-auto mb-2 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
            <Sparkles className="w-6 h-6 text-blue-300" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">NovelVerse AI</h2>
          <p className="mt-1 text-xs text-slate-300">
            {isLogin ? 'Đăng nhập để dịch và quản lý các dự án tiểu thuyết' : 'Tạo tài khoản dịch giả mới'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 text-sm font-semibold bg-slate-50/50">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              isLogin ? 'border-blue-700 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Đăng Nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError('');
            }}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              !isLogin ? 'border-blue-700 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Đăng Ký
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tên hiển thị / Bút danh</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  placeholder="Ví dụ: Nguyễn Viết Lãm"
                  className="min-h-11 w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@example.com"
                className="min-h-11 w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="min-h-11 w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="min-h-11 w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-800 active:translate-y-px disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang xử lý...
              </span>
            ) : (
              <>
                <span>{isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

