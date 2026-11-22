import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Flag, Sparkles } from 'lucide-react';

export default function SegmentRow({
  segment,
  sourceLang = 'zh',
  targetLang = 'vi',
  onTextChange,
  onToggleReview,
  onRetranslate,
  isRetranslating,
  issues = [],
  highlighted = false,
}) {
  const [text, setText] = useState(segment.translatedText || '');
  const debounceTimer = useRef(null);

  useEffect(() => {
    // Prop changes here come from AI retranslation or a server refresh.
    // oxlint-disable-next-line react/set-state-in-effect
    setText(segment.translatedText || '');
  }, [segment.translatedText]);

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  const saveNow = async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
    if (text !== (segment.translatedText || '')) {
      await onTextChange(segment.id, text);
    }
  };

  const handleChange = (event) => {
    const value = event.target.value;
    setText(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => onTextChange(segment.id, value), 1200);
  };

  const handleRetranslate = async () => {
    await saveNow();
    await onRetranslate(segment.id);
  };

  const wordCount = (text || '').trim().split(/\s+/).filter(Boolean).length;
  const activeIssues = issues.filter((issue) => !issue.ignored);

  return (
    <div
      id={`segment-${segment.id}`}
      className={`grid grid-cols-1 gap-4 rounded-xl border p-4 transition-all md:grid-cols-2 ${
        highlighted
          ? 'border-blue-500 ring-2 ring-blue-200'
          : segment.needsReview
            ? 'border-amber-300 bg-amber-50/50 ring-1 ring-amber-200'
            : segment.status === 'FAILED'
              ? 'border-rose-300 bg-rose-50/40'
              : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col justify-between pr-0 md:pr-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
              #{segment.orderIndex + 1}
              <span className="text-[10px] font-normal uppercase text-slate-400">({sourceLang})</span>
            </span>
            {segment.status === 'PROCESSING' && (
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-600">
                <Clock className="h-3 w-3 animate-spin" /> Đang dịch...
              </span>
            )}
            {segment.status === 'FAILED' && (
              <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-1 text-[11px] text-rose-600">
                <AlertCircle className="h-3 w-3" /> Lỗi dịch
              </span>
            )}
          </div>
          <p className="select-text whitespace-pre-wrap font-serif text-sm leading-relaxed text-slate-800">
            {segment.originalText}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
          <span>{segment.originalText?.length || 0} ký tự</span>
        </div>
      </div>

      <div className="flex flex-col justify-between pl-0 md:border-l md:border-slate-100 md:pl-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase text-blue-700">Bản dịch ({targetLang})</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onToggleReview(segment.id)}
                title={segment.needsReview ? 'Bỏ đánh dấu xem lại' : 'Đánh dấu cần xem lại'}
                aria-label={segment.needsReview ? 'Bỏ đánh dấu xem lại' : 'Đánh dấu cần xem lại'}
                className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs transition-colors ${
                  segment.needsReview
                    ? 'bg-amber-100 font-semibold text-amber-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <Flag className="h-3.5 w-3.5" />
                {segment.needsReview && <span className="text-[11px]">Cần xem lại</span>}
              </button>
              <button
                type="button"
                disabled={isRetranslating}
                onClick={handleRetranslate}
                title="Lưu bản nháp rồi dịch lại đoạn này bằng AI"
                className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-blue-700 transition-colors hover:bg-blue-50 hover:text-blue-900 disabled:opacity-50"
              >
                <Sparkles className={`h-3.5 w-3.5 ${isRetranslating ? 'animate-spin' : ''}`} />
                <span className="text-[11px]">{isRetranslating ? 'Đang dịch...' : 'Dịch lại'}</span>
              </button>
            </div>
          </div>

          <textarea
            rows={Math.max(3, Math.ceil((segment.originalText?.length || 50) / 70))}
            value={text}
            onChange={handleChange}
            onBlur={saveNow}
            placeholder="Nhập hoặc chờ AI tạo bản dịch..."
            aria-label={`Bản dịch đoạn ${segment.orderIndex + 1}`}
            className="w-full resize-y rounded-lg border border-slate-200 bg-white p-2.5 text-sm leading-relaxed text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {activeIssues.map((issue) => (
            <div
              key={issue.id}
              className={`mt-2 flex items-start gap-1.5 rounded-lg border p-2 text-xs ${
                issue.severity === 'ERROR'
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {issue.severity === 'ERROR'
                ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <span>{issue.message}</span>
            </div>
          ))}

          {segment.errorMessage && (
            <div className="mt-2 flex items-center gap-1.5 rounded bg-rose-50 p-2 text-xs text-rose-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{segment.errorMessage}</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
          <span>{wordCount} từ</span>
          {segment.status === 'COMPLETED' && (
            <span className="flex items-center gap-1 font-medium text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Đã hoàn thành
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
