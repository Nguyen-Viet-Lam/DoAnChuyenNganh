import React from 'react';
import { ArrowLeft, CheckCircle2, BookOpen, BookMarked, Save, ScanSearch, Sparkles } from 'lucide-react';

const STATUS_LABELS = {
  DRAFT: { text: 'Bản nháp', bg: 'bg-gray-100 text-gray-700 border-gray-300' },
  TRANSLATING: { text: 'Đang dịch...', bg: 'bg-blue-100 text-blue-700 border-blue-300' },
  PARTIAL: { text: 'Dịch một phần', bg: 'bg-amber-100 text-amber-700 border-amber-300' },
  TRANSLATED: { text: 'Đã dịch xong', bg: 'bg-blue-100 text-blue-700 border-blue-300' },
  REVIEWED: { text: 'Đã duyệt', bg: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  FAILED: { text: 'Lỗi dịch', bg: 'bg-rose-100 text-rose-700 border-rose-300' },
  PUBLISHED: { text: 'Đã xuất bản', bg: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
};

export default function EditorHeader({
  chapter,
  novel,
  summary,
  qaSummary,
  saveStatus,
  showGlossary,
  setShowGlossary,
  showQa,
  setShowQa,
  onCompleteReview,
  isCompleting,
  onTranslateChapter,
  isTranslating,
  onBack,
}) {
  const statusInfo = STATUS_LABELS[chapter?.status] || STATUS_LABELS.DRAFT;

  return (
    <header className="sticky top-[73px] z-30 bg-white border-b border-slate-200 shadow-sm px-4 md:px-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Info */}
        <div className="flex items-start gap-3 min-w-0">
          <button type="button" onClick={onBack} aria-label="Trở lại danh sách chương" className="w-11 h-11 shrink-0 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl hidden sm:block">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-slate-200 text-slate-600 bg-slate-50">
                {novel?.title || 'Tiểu thuyết'}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusInfo.bg}`}>
                {statusInfo.text}
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-0.5 truncate">
              Chương {chapter?.chapterNumber || 1}: {chapter?.title || 'Chưa đặt tên'}
            </h1>
          </div>
        </div>

        {/* Stats & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Auto-save status */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-2">
            <Save className={`w-3.5 h-3.5 ${saveStatus === 'saving' ? 'animate-spin text-amber-500' : 'text-emerald-500'}`} />
            <span>
              {saveStatus === 'saving' && 'Đang lưu nháp...'}
              {saveStatus === 'saved' && 'Đã lưu mọi thay đổi'}
              {saveStatus === 'idle' && 'Bản nháp đã đồng bộ'}
              {saveStatus === 'error' && 'Lỗi lưu dữ liệu!'}
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-600 font-medium">Tiến độ:</span>
            <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-700 h-2 rounded-full transition-all duration-300"
                style={{ width: `${summary?.percent || 0}%` }}
              />
            </div>
            <span className="font-bold text-slate-700">{summary?.percent || 0}%</span>
            <span className="text-slate-400">({summary?.completed || 0}/{summary?.total || 0})</span>
          </div>

          {/* Glossary toggle */}
          <button
            type="button"
            onClick={() => setShowGlossary(!showGlossary)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              showGlossary
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <BookMarked className="w-4 h-4 text-blue-700" />
            <span>Thuật ngữ</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQa(!showQa)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              showQa
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ScanSearch className="w-4 h-4" />
            <span>QA</span>
            {(qaSummary?.errors || qaSummary?.warnings) > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-rose-700 text-white text-[10px] flex items-center justify-center">
                {(qaSummary?.errors || 0) + (qaSummary?.warnings || 0)}
              </span>
            )}
          </button>

          {/* Complete review button */}
          <button
            type="button"
            disabled={isTranslating}
            onClick={onTranslateChapter}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60"
          >
            <Sparkles className={`h-4 w-4 ${isTranslating ? 'animate-spin' : ''}`} />
            <span>{isTranslating ? 'Đang dịch' : 'Dịch tiếp'}</span>
          </button>

          {/* Complete review button */}
          <button
            type="button"
            disabled={isCompleting || chapter?.status === 'REVIEWED'}
            onClick={onCompleteReview}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-sm ${
              chapter?.status === 'REVIEWED'
                ? 'bg-emerald-600 opacity-90 cursor-default'
                : 'bg-blue-700 hover:bg-blue-800 active:translate-y-px'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{chapter?.status === 'REVIEWED' ? 'Đã duyệt chương' : 'Xác nhận hoàn tất'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

