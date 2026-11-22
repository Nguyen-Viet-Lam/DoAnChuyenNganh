import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, BookOpen, ChevronRight, FilePlus2, Library, LoaderCircle, Pencil, Plus, Search, Trash2,
} from 'lucide-react';
import { chapterApi, novelApi } from '../services/api';

const EMPTY_NOVEL = {
  title: '', originalTitle: '', author: '', description: '', sourceLanguage: 'zh', targetLanguage: 'vi', status: 'DRAFT',
};
const EMPTY_CHAPTER = { chapterNumber: '', title: '', originalContent: '' };
const STATUS_LABELS = { DRAFT: 'Bản nháp', ONGOING: 'Đang thực hiện', COMPLETED: 'Hoàn thành' };
const CHAPTER_LABELS = {
  DRAFT: 'Bản nháp', TRANSLATING: 'Đang dịch', PARTIAL: 'Dịch một phần', TRANSLATED: 'Đã dịch', REVIEWED: 'Đã duyệt', FAILED: 'Lỗi', PUBLISHED: 'Đã xuất bản',
};

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Đóng</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block text-sm font-semibold text-slate-700 space-y-1.5"><span>{label}</span>{children}</label>;
}

const inputClass = 'w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

export default function NovelLibrary({ onOpenEditor, onNotify }) {
  const [novels, setNovels] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedNovel, setSelectedNovel] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [novelForm, setNovelForm] = useState(null);
  const [chapterForm, setChapterForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadNovels = useCallback(async () => {
    setLoading(true);
    try {
      const response = await novelApi.getMyNovels();
      setNovels(response.data.data || []);
    } catch (error) {
      onNotify(error.response?.data?.message || 'Không thể tải danh sách truyện', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    // Initial remote collection load.
    // oxlint-disable-next-line react/set-state-in-effect
    loadNovels();
  }, [loadNovels]);

  const loadChapters = async (novel) => {
    setSelectedNovel(novel);
    setChapterLoading(true);
    try {
      const response = await chapterApi.getChapters(novel.id);
      setChapters(response.data.data || []);
    } catch (error) {
      onNotify(error.response?.data?.message || 'Không thể tải danh sách chương', 'error');
    } finally {
      setChapterLoading(false);
    }
  };

  const filteredNovels = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    if (!query) return novels;
    return novels.filter((novel) => [novel.title, novel.originalTitle, novel.author].some((value) => value?.toLocaleLowerCase('vi').includes(query)));
  }, [novels, search]);

  const saveNovel = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...novelForm };
      const response = novelForm.id
        ? await novelApi.updateNovel(novelForm.id, payload)
        : await novelApi.createNovel(payload);
      onNotify(novelForm.id ? 'Đã cập nhật tiểu thuyết' : 'Đã tạo tiểu thuyết');
      setNovelForm(null);
      await loadNovels();
      if (selectedNovel?.id === response.data.data?.id) setSelectedNovel(response.data.data);
    } catch (error) {
      onNotify(error.response?.data?.message || 'Không thể lưu tiểu thuyết', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeNovel = async (novel) => {
    if (!window.confirm(`Xóa “${novel.title}” và toàn bộ chương liên quan?`)) return;
    try {
      await novelApi.deleteNovel(novel.id);
      if (selectedNovel?.id === novel.id) { setSelectedNovel(null); setChapters([]); }
      await loadNovels();
      onNotify('Đã xóa tiểu thuyết');
    } catch (error) {
      onNotify(error.response?.data?.message || 'Không thể xóa tiểu thuyết', 'error');
    }
  };

  const saveChapter = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...chapterForm,
        chapterNumber: chapterForm.chapterNumber ? Number(chapterForm.chapterNumber) : undefined,
      };
      if (chapterForm.id) await chapterApi.updateChapter(chapterForm.id, payload);
      else await chapterApi.createChapter(selectedNovel.id, payload);
      setChapterForm(null);
      await loadChapters(selectedNovel);
      onNotify(chapterForm.id ? 'Đã cập nhật chương' : 'Đã tạo chương');
    } catch (error) {
      onNotify(error.response?.data?.message || 'Không thể lưu chương', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeChapter = async (chapter) => {
    if (!window.confirm(`Xóa chương ${chapter.chapterNumber}: ${chapter.title}?`)) return;
    try {
      await chapterApi.deleteChapter(chapter.id);
      await loadChapters(selectedNovel);
      onNotify('Đã xóa chương');
    } catch (error) {
      onNotify(error.response?.data?.message || 'Không thể xóa chương', 'error');
    }
  };

  const editChapter = async (chapter) => {
    try {
      const response = await chapterApi.getChapter(chapter.id);
      setChapterForm(response.data.data);
    } catch (error) {
      onNotify(error.response?.data?.message || 'Không thể tải nội dung chương', 'error');
    }
  };

  if (selectedNovel) {
    return (
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <button type="button" onClick={() => { setSelectedNovel(null); setChapters([]); }} className="min-h-11 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-800">
          <ArrowLeft className="w-4 h-4" /> Trở lại thư viện
        </button>
        <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm text-blue-700 font-semibold">Quản lý chương</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 mt-1">{selectedNovel.title}</h1>
            <p className="text-sm text-slate-500 mt-2">{selectedNovel.author || 'Chưa cập nhật tác giả'} · {chapters.length} chương</p>
          </div>
          <button type="button" onClick={() => setChapterForm({ ...EMPTY_CHAPTER })} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 active:translate-y-px">
            <FilePlus2 className="w-4 h-4" /> Tạo chương
          </button>
        </div>

        {chapterLoading ? (
          <div className="py-24 flex justify-center"><LoaderCircle className="w-7 h-7 animate-spin text-blue-700" /></div>
        ) : chapters.length === 0 ? (
          <div className="py-24 text-center border-b border-slate-200">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h2 className="text-lg font-semibold text-slate-800 mt-4">Truyện chưa có chương</h2>
            <p className="text-sm text-slate-500 mt-1">Tạo chương đầu tiên để bắt đầu dịch.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border-b border-slate-200">
            {chapters.map((chapter) => (
              <article key={chapter.id} className="group py-5 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/80 px-2 -mx-2 transition-colors">
                <button type="button" onClick={() => onOpenEditor(chapter.id)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 shrink-0 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-bold">{chapter.chapterNumber}</span>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-900 truncate group-hover:text-blue-800">{chapter.title}</h2>
                      <p className="text-xs text-slate-500 mt-1">{CHAPTER_LABELS[chapter.status] || chapter.status} · {chapter.wordCount} từ</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                  </div>
                </button>
                <div className="flex items-center gap-2 ml-14 md:ml-0">
                  <button type="button" onClick={() => editChapter(chapter)} className="min-h-10 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:bg-white border border-slate-200 rounded-lg"><Pencil className="w-3.5 h-3.5" /> Sửa</button>
                  <button type="button" onClick={() => removeChapter(chapter)} className="min-h-10 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {chapterForm && (
          <Modal title={chapterForm.id ? 'Chỉnh sửa chương' : 'Tạo chương mới'} onClose={() => setChapterForm(null)}>
            <form onSubmit={saveChapter} className="p-6 space-y-5">
              <div className="grid sm:grid-cols-[140px_1fr] gap-4">
                <Field label="Số chương"><input className={inputClass} type="number" min="1" value={chapterForm.chapterNumber} onChange={(e) => setChapterForm({ ...chapterForm, chapterNumber: e.target.value })} placeholder="Tự động" /></Field>
                <Field label="Tiêu đề"><input className={inputClass} required maxLength="200" value={chapterForm.title} onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })} /></Field>
              </div>
              <Field label="Nội dung gốc"><textarea className={`${inputClass} min-h-64 py-3 leading-6`} required value={chapterForm.originalContent} onChange={(e) => setChapterForm({ ...chapterForm, originalContent: e.target.value })} /></Field>
              <button disabled={saving} className="min-h-11 w-full rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-60">{saving ? 'Đang lưu' : 'Lưu chương'}</button>
            </form>
          </Modal>
        )}
      </main>
    );
  }

  return (
    <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-7">
        <div className="max-w-2xl">
          <p className="text-sm text-blue-700 font-semibold">Không gian dịch thuật</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-950 mt-2">Thư viện tiểu thuyết</h1>
          <p className="text-base text-slate-600 mt-3">Quản lý bản thảo, mở chương đang dịch và theo dõi trạng thái biên tập tại một nơi.</p>
        </div>
        <button type="button" onClick={() => setNovelForm({ ...EMPTY_NOVEL })} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 active:translate-y-px">
          <Plus className="w-4 h-4" /> Tạo tiểu thuyết
        </button>
      </div>

      <div className="mt-6 relative max-w-xl">
        <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
        <label className="sr-only" htmlFor="novel-search">Tìm tiểu thuyết</label>
        <input id="novel-search" className={`${inputClass} pl-10`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên truyện hoặc tác giả" />
      </div>

      {loading ? (
        <div className="py-24 flex justify-center"><LoaderCircle className="w-7 h-7 animate-spin text-blue-700" /></div>
      ) : filteredNovels.length === 0 ? (
        <div className="py-24 text-center">
          <Library className="w-11 h-11 text-slate-300 mx-auto" />
          <h2 className="text-lg font-semibold text-slate-800 mt-4">Chưa có tiểu thuyết phù hợp</h2>
          <p className="text-sm text-slate-500 mt-1">Tạo một bản thảo mới hoặc thử từ khóa khác.</p>
        </div>
      ) : (
        <div className="mt-8 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredNovels.map((novel) => (
            <article key={novel.id} className="group rounded-xl border border-slate-200 bg-white p-5 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-slate-200/60 transition-all">
              <button type="button" onClick={() => loadChapters(novel)} className="w-full text-left min-h-32">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-md px-2 py-1">{STATUS_LABELS[novel.status] || novel.status}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-700" />
                </div>
                <h2 className="text-xl font-semibold text-slate-950 mt-5 line-clamp-2">{novel.title}</h2>
                <p className="text-sm text-slate-500 mt-2">{novel.author || 'Chưa cập nhật tác giả'}</p>
                <p className="text-xs text-slate-500 mt-4">{novel.totalChapters} chương · {novel.totalGlossaryTerms} thuật ngữ</p>
              </button>
              <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                <button type="button" onClick={() => setNovelForm({ ...novel })} className="min-h-10 flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg"><Pencil className="w-3.5 h-3.5" /> Sửa</button>
                <button type="button" onClick={() => removeNovel(novel)} className="min-h-10 flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {novelForm && (
        <Modal title={novelForm.id ? 'Chỉnh sửa tiểu thuyết' : 'Tạo tiểu thuyết mới'} onClose={() => setNovelForm(null)}>
          <form onSubmit={saveNovel} className="p-6 space-y-5">
            <Field label="Tên tiểu thuyết"><input className={inputClass} required maxLength="200" value={novelForm.title} onChange={(e) => setNovelForm({ ...novelForm, title: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Tên nguyên tác"><input className={inputClass} value={novelForm.originalTitle || ''} onChange={(e) => setNovelForm({ ...novelForm, originalTitle: e.target.value })} /></Field>
              <Field label="Tác giả"><input className={inputClass} value={novelForm.author || ''} onChange={(e) => setNovelForm({ ...novelForm, author: e.target.value })} /></Field>
            </div>
            <Field label="Mô tả"><textarea className={`${inputClass} min-h-28 py-3`} value={novelForm.description || ''} onChange={(e) => setNovelForm({ ...novelForm, description: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Ngôn ngữ gốc"><select className={inputClass} value={novelForm.sourceLanguage} onChange={(e) => setNovelForm({ ...novelForm, sourceLanguage: e.target.value })}><option value="zh">Tiếng Trung</option><option value="en">Tiếng Anh</option></select></Field>
              <Field label="Ngôn ngữ đích"><select className={inputClass} value={novelForm.targetLanguage} onChange={(e) => setNovelForm({ ...novelForm, targetLanguage: e.target.value })}><option value="vi">Tiếng Việt</option></select></Field>
              <Field label="Trạng thái"><select className={inputClass} value={novelForm.status} onChange={(e) => setNovelForm({ ...novelForm, status: e.target.value })}><option value="DRAFT">Bản nháp</option><option value="ONGOING">Đang thực hiện</option><option value="COMPLETED">Hoàn thành</option></select></Field>
            </div>
            <button disabled={saving} className="min-h-11 w-full rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-60">{saving ? 'Đang lưu' : 'Lưu tiểu thuyết'}</button>
          </form>
        </Modal>
      )}
    </main>
  );
}
