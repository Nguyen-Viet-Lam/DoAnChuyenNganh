import React, { useState } from 'react';
import { X, Search, Tag, User, MapPin, Zap, Shield, Sparkles } from 'lucide-react';

const CATEGORY_MAP = {
  CHARACTER: { label: 'Nhân vật', icon: User, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  LOCATION: { label: 'Địa danh', icon: MapPin, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  SKILL: { label: 'Chiêu thức', icon: Zap, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  ITEM: { label: 'Pháp bảo/Vật phẩm', icon: Shield, color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
  REALM: { label: 'Cảnh giới', icon: Sparkles, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  OTHER: { label: 'Khác', icon: Tag, color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

export default function GlossarySidebar({ glossary = [], onClose, onInsertTerm }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const filtered = glossary.filter((term) => {
    const matchCat = selectedCategory === 'ALL' || term.category === selectedCategory;
    const matchText =
      term.originalTerm?.toLowerCase().includes(search.toLowerCase()) ||
      term.vietnameseTerm?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchText;
  });

  return (
    <aside className="sticky top-[153px] z-20 flex h-[calc(100vh-153px)] w-80 flex-col border-l border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Bảng Thuật Ngữ</h2>
          <p className="text-xs text-slate-500">{glossary.length} từ vựng chuẩn của truyện</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng bảng thuật ngữ"
          className="min-h-11 min-w-11 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Categories */}
      <div className="p-3 border-b border-slate-100 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Tìm từ gốc hoặc từ dịch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${
              selectedCategory === 'ALL'
                ? 'bg-blue-700 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả
          </button>
          {Object.entries(CATEGORY_MAP).map(([key, item]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedCategory(key)}
              className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${
                selectedCategory === key
                  ? 'bg-blue-700 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Terms list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">Không tìm thấy thuật ngữ phù hợp</div>
        ) : (
          filtered.map((term) => {
            const cat = CATEGORY_MAP[term.category] || CATEGORY_MAP.OTHER;
            const CatIcon = cat.icon;
            return (
              <div
                key={term.id || term.originalTerm}
                className="rounded-lg border border-slate-200 p-2.5 text-xs transition-all hover:border-blue-300 hover:bg-blue-50/30"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${cat.color}`}>
                    <CatIcon className="w-2.5 h-2.5" />
                    {cat.label}
                  </span>
                  {onInsertTerm && (
                    <button
                      type="button"
                      onClick={() => onInsertTerm(term.vietnameseTerm)}
                      className="min-h-11 text-[10px] text-blue-700 hover:underline"
                    >
                      Dán vào bản dịch
                    </button>
                  )}
                </div>
                <div className="font-semibold text-slate-800">{term.originalTerm}</div>
                <div className="font-medium text-blue-700">→ {term.vietnameseTerm}</div>
                {term.notes && <div className="text-[11px] text-slate-400 mt-1 italic">{term.notes}</div>}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

