import React, { useState, useEffect, useRef } from 'react';
import { Flag, Sparkles, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export default function SegmentRow({
  segment,
  sourceLang = 'zh',
  targetLang = 'vi',
  onTextChange,
  onToggleReview,
  onRetranslate,
  isRetranslating,
}) {
  const [text, setText] = useState(segment.translatedText || '');
  const debounceTimer = useRef(null);

  // Sync state if segment prop updates externally
  useEffect(() => {
    setText(segment.translatedText || '');
  }, [segment.translatedText]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);

    // Debounce auto-save (1.2 giây sau khi ngừng gõ)
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onTextChange(segment.id, val);
    }, 1200);
  };

  const handleBlur = () => {
    // Lưu ngay khi người dùng bấm ra ngoài ô nhập
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (text !== segment.translatedText) {
      onTextChange(segment.id, text);
    }
  };

  const wordCount = (text || '').trim().split(/\s+/).filter(Boolean).length;

  return (
    <div
      id={`segment-${segment.id}`}
      className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border transition-all ${
        segment.needsReview
          ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200'
          : segment.status === 'FAILED'
          ? 'bg-rose-50/40 border-rose-300'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* CỘT TRÁI: VĂN BẢN GỐC */}
      <div className="flex flex-col justify-between pr-0 md:pr-2">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
              #{segment.orderIndex + 1}
              <span className="text-[10px] font-normal uppercase text-slate-400">({sourceLang})</span>
            </span>

            {segment.status === 'PROCESSING' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                <Clock className="w-3 h-3 animate-spin" /> Đang dịch...
              </span>
            )}
            {segment.status === 'FAILED' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                <AlertCircle className="w-3 h-3" /> Lỗi dịch
              </span>
            )}
          </div>

          <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-serif select-text">
            {segment.originalText}
          </p>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>{segment.originalText?.length || 0} ký tự</span>
        </div>
      </div>

      {/* CỘT PHẢI: BẢN DỊCH CHỈNH SỬA ĐƯỢC */}
      <div className="flex flex-col justify-between pl-0 md:pl-2 md:border-l md:border-slate-100">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-indigo-600 uppercase">
              Bản dịch tiếng Việt
            </span>

            <div className="flex items-center gap-1">
              {/* Nút đánh dấu cần xem lại */}
              <button
                type="button"
                onClick={() => onToggleReview(segment.id)}
                title={segment.needsReview ? 'Bỏ đánh dấu xem lại' : 'Đánh dấu cần xem lại'}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                  segment.needsReview
                    ? 'bg-amber-100 text-amber-700 font-semibold'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                <span className="text-[11px]">{segment.needsReview ? 'Cần xem lại' : ''}</span>
              </button>

              {/* Nút dịch lại đoạn lẻ bằng Gemini AI */}
              <button
                type="button"
                disabled={isRetranslating}
                onClick={() => onRetranslate(segment.id)}
                title="Dịch lại riêng đoạn này bằng AI"
                className="p-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isRetranslating ? 'animate-spin' : ''}`} />
                <span className="text-[11px]">{isRetranslating ? 'Đang dịch...' : 'Dịch lại'}</span>
              </button>
            </div>
          </div>

          <textarea
            rows={Math.max(3, Math.ceil((segment.originalText?.length || 50) / 70))}
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Nhập hoặc chờ AI tạo bản dịch..."
            className="w-full text-sm leading-relaxed p-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all resize-y text-slate-900 bg-white"
          />

          {segment.errorMessage && (
            <div className="mt-1 text-xs text-rose-600 bg-rose-50 p-2 rounded flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{segment.errorMessage}</span>
            </div>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>{wordCount} từ</span>
          {segment.status === 'COMPLETED' && (
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Đã hoàn thành
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
