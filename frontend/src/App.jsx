import React, { useState, useEffect } from 'react';
import BilingualEditor from './components/BilingualEditor';
import AuthModal from './components/AuthModal';
import { authApi } from './services/api';
import { Sparkles, BookOpen, User, LogOut, LogIn, Layers, ShieldCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('editor');
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Kiểm tra phiên đăng nhập khi khởi động
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authApi
        .getMe()
        .then((res) => {
          setUser(res.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setUser(null);
        })
        .finally(() => {
          setCheckingAuth(false);
        });
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(userData) => setUser(userData)}
      />

      {/* Top Navigation */}
      <nav className="bg-slate-900 text-white px-6 py-3 border-b border-slate-800 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
              NovelVerse AI
            </span>
            <span className="text-[10px] text-indigo-300 ml-2 px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-800">
              v1.0
            </span>
          </div>
        </div>

        {/* Center Tabs */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/50 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all font-medium ${
              activeTab === 'editor'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Trình Biên Tập Song Ngữ</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('novels')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all font-medium ${
              activeTab === 'novels'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Thư Viện Truyện</span>
          </button>
        </div>

        {/* User Info / Auth Controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs font-semibold text-slate-200">{user.displayName}</span>
                  {user.role === 'ADMIN' && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded font-bold">
                      <ShieldCheck className="w-2.5 h-2.5" /> ADMIN
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400">{user.email}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white border border-indigo-300/30 shadow-xs">
                {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Đăng xuất"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng Nhập / Đăng Ký</span>
            </button>
          )}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1">
        {activeTab === 'editor' ? (
          <BilingualEditor chapterId="demo" />
        ) : (
          <div className="p-8 max-w-4xl mx-auto text-center text-slate-500 text-sm">
            <BookOpen className="w-12 h-12 mx-auto text-slate-400 mb-3" />
            <h2 className="text-lg font-bold text-slate-700">Quản Lý Thư Viện Truyện</h2>
            <p className="mt-1">Chức năng xem và duyệt danh mục tiểu thuyết đang kết nối trực tiếp với Backend API.</p>
          </div>
        )}
      </div>
    </div>
  );
}
