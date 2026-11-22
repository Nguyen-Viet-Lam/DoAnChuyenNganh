import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Library, LogIn, LogOut, ShieldCheck, Sparkles } from 'lucide-react';
import AuthModal from './components/AuthModal';
import BilingualEditor from './components/BilingualEditor';
import NovelLibrary from './components/NovelLibrary';
import { authApi } from './services/api';

export default function App() {
  const [view, setView] = useState('library');
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(() => Boolean(localStorage.getItem('token')));
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    authApi.getMe()
      .then((response) => setUser(response.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setCheckingAuth(false));
    return undefined;
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setSelectedChapterId(null);
      setView('library');
      notify('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
    };
    window.addEventListener('novelverse:session-expired', handleExpired);
    return () => window.removeEventListener('novelverse:session-expired', handleExpired);
  }, [notify]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* JWT logout is client-side. */ }
    localStorage.removeItem('token');
    setUser(null);
    setSelectedChapterId(null);
    setView('library');
  };

  const openEditor = (chapterId) => {
    setSelectedChapterId(chapterId);
    setView('editor');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const goToLibrary = () => {
    setView('library');
    setSelectedChapterId(null);
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Chuyển đến nội dung chính</a>
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(userData) => { setUser(userData); setView('library'); }}
      />

      {toast && (
        <div role="status" className={`fixed bottom-5 right-5 z-[70] max-w-sm rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-xl ${toast.type === 'error' ? 'bg-rose-700' : 'bg-emerald-700'}`}>
          {toast.message}
        </div>
      )}

      <header className="fixed inset-x-0 top-0 z-40 h-[73px] border-b border-slate-800 bg-slate-950 text-white">
        <nav className="wrap flex h-full items-center justify-between" aria-label="Điều hướng chính">
          <button type="button" onClick={goToLibrary} className="flex min-h-11 items-center gap-3 rounded-lg text-left focus-visible:ring-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600"><Sparkles className="h-4 w-4" /></span>
            <strong className="text-sm tracking-tight">NovelVerse AI</strong>
          </button>

          {user && (
            <div className="hidden items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs sm:flex">
              <button type="button" onClick={goToLibrary} className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 ${view === 'library' ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'}`}>
                <Library className="h-3.5 w-3.5" /> Thư viện
              </button>
              <button type="button" disabled={!selectedChapterId} onClick={() => selectedChapterId && setView('editor')} className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 disabled:opacity-40 ${view === 'editor' ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'}`}>
                <BookOpen className="h-3.5 w-3.5" /> Biên tập
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden text-right md:block">
                  <div className="flex items-center justify-end gap-1.5 text-xs font-semibold">
                    {user.displayName}
                    {user.role === 'ADMIN' && <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400">{user.email}</div>
                </div>
                <button type="button" onClick={handleLogout} aria-label="Đăng xuất" className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-900 hover:text-white focus-visible:ring-white"><LogOut className="h-4 w-4" /></button>
              </>
            ) : (
              <button type="button" onClick={() => setIsAuthOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold hover:bg-blue-700 focus-visible:ring-white">
                <LogIn className="h-4 w-4" /> Đăng nhập
              </button>
            )}
          </div>
        </nav>
      </header>

      {checkingAuth ? (
        <main id="main-content" className="flex min-h-svh items-center justify-center pt-[73px] text-sm text-slate-500">Đang kiểm tra phiên đăng nhập...</main>
      ) : !user ? (
        <main id="main-content">
          <section className="flex h-svh items-center bg-[#f7f8fa] pt-[73px]">
            <div className="wrap grid items-start gap-12 py-12 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="hero-text">
                <p className="text-sm font-semibold text-blue-700">Công cụ dịch và biên tập tiểu thuyết</p>
                <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">Quản lý bản dịch theo từng chương.</h1>
                <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Đối chiếu bản gốc, tự động lưu bản dịch và xử lý 3 lớp QA: đoạn rỗng, bản dịch quá ngắn và sai thuật ngữ.</p>
                <button type="button" onClick={() => setIsAuthOpen(true)} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 active:translate-y-px">
                  <LogIn className="h-4 w-4" /> Mở không gian dịch
                </button>
              </div>

              <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-300/50" aria-label="Minh họa trình biên tập song ngữ">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-700">Chương 12</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">Cuộc gặp trong mưa</p>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Đã lưu</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="min-h-48 rounded-xl bg-slate-50 p-4">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Bản gốc · ZH</span>
                    <p className="mt-4 font-serif text-sm leading-7 text-slate-700">少年站在长街尽头，雨水沿着屋檐落下。他抬头看见熟悉的身影。</p>
                  </div>
                  <div className="min-h-48 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                    <span className="text-[11px] font-bold uppercase text-blue-700">Bản dịch · VI</span>
                    <p className="mt-4 text-sm leading-7 text-slate-800">Thiếu niên đứng cuối con phố dài, nước mưa rơi dọc theo mái hiên...</p>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span><strong>Cảnh báo thuật ngữ:</strong> kiểm tra lại cách dịch tên nhân vật ở đoạn này.</span>
                </div>
              </div>
            </div>
          </section>
        </main>
      ) : view === 'editor' && selectedChapterId ? (
        <div className="pt-[73px]"><BilingualEditor chapterId={selectedChapterId} onBack={goToLibrary} /></div>
      ) : (
        <div className="pt-[73px]"><NovelLibrary onOpenEditor={openEditor} onNotify={notify} /></div>
      )}
    </>
  );
}
