import React, { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, EyeOff, RotateCcw, ScanSearch, X } from 'lucide-react';

const TYPE_LABELS = {
  EMPTY_TRANSLATION: 'Bản dịch rỗng',
  TOO_SHORT: 'Bản dịch quá ngắn',
  GLOSSARY_MISMATCH: 'Sai thuật ngữ',
};

export default function QaPanel({ qa, running, onRun, onJump, onIgnore, onRestore, onClose }) {
  const [filter, setFilter] = useState('ACTIVE');
  const issues = useMemo(() => qa?.issues || [], [qa?.issues]);
  const summary = qa?.summary || { total: 0, errors: 0, warnings: 0, ignored: 0 };
  const visibleIssues = useMemo(
    () => issues.filter((issue) => (filter === 'IGNORED' ? issue.ignored : !issue.ignored)),
    [filter, issues]
  );

  return (
    <aside className="z-20 flex w-full flex-col border-l border-slate-200 bg-white shadow-sm xl:sticky xl:top-[153px] xl:h-[calc(100vh-153px)] xl:w-96">
      <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Kiểm tra chất lượng</h2>
          <p className="text-xs text-slate-500 mt-1">Sửa lỗi bắt buộc trước khi duyệt chương.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng bảng QA" className="min-h-11 min-w-11 rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-2">
            <strong className="block text-lg text-rose-700">{summary.errors}</strong>
            <span className="text-[11px] text-rose-700">Lỗi</span>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
            <strong className="block text-lg text-amber-700">{summary.warnings}</strong>
            <span className="text-[11px] text-amber-700">Cảnh báo</span>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
            <strong className="block text-lg text-slate-700">{summary.ignored}</strong>
            <span className="text-[11px] text-slate-600">Đã bỏ qua</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 active:translate-y-px disabled:opacity-60"
        >
          <ScanSearch className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Đang kiểm tra' : 'Kiểm tra lại chương'}
        </button>

        <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-xs font-medium">
          <button type="button" onClick={() => setFilter('ACTIVE')} className={`min-h-9 rounded-md ${filter === 'ACTIVE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
            Đang xử lý
          </button>
          <button type="button" onClick={() => setFilter('IGNORED')} className={`min-h-9 rounded-md ${filter === 'IGNORED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
            Đã bỏ qua
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {visibleIssues.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-800 mt-3">
              {filter === 'ACTIVE' ? 'Không còn cảnh báo đang xử lý' : 'Chưa có cảnh báo bị bỏ qua'}
            </p>
          </div>
        ) : visibleIssues.map((issue) => {
          const isError = issue.severity === 'ERROR';
          const Icon = isError ? AlertCircle : AlertTriangle;
          return (
            <article key={issue.id} className={`rounded-xl border p-3 ${isError ? 'border-rose-200 bg-rose-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
              <button type="button" onClick={() => onJump(issue)} className="w-full text-left group">
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isError ? 'text-rose-700' : 'text-amber-700'}`} />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Đoạn #{(issue.segment?.orderIndex ?? 0) + 1} · {TYPE_LABELS[issue.type] || issue.type}
                    </div>
                    <p className="text-xs leading-5 text-slate-700 mt-1 group-hover:text-blue-800">{issue.message}</p>
                  </div>
                </div>
              </button>
              {!isError && (
                <button
                  type="button"
                  onClick={() => issue.ignored ? onRestore(issue.id) : onIgnore(issue.id)}
                  className="mt-3 min-h-9 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-800"
                >
                  {issue.ignored ? <RotateCcw className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {issue.ignored ? 'Khôi phục cảnh báo' : 'Bỏ qua cảnh báo'}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
