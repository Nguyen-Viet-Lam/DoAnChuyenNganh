import React, { useState } from 'react';
import { X, Search, Tag, User, MapPin, Zap, Shield, Sparkles } from 'lucide-react';

const CATEGORY_MAP = {
  CHARACTER: { label: 'Nhân vật', icon: User, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  LOCATION: { label: 'Địa danh', icon: MapPin, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  SKILL: { label: 'Chiêu thức', icon: Zap, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  ITEM: { label: 'Pháp bảo/Vật phẩm', icon: Shield, color: 'text-purple-600 bg-purple-50 border-purple-200' },
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
    <aside className="w-80 bg-white border-l border-slate-200 flex flex-col h-[calc(100vh-73px)] sticky top-[73px] shadow-sm z-20">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Bảng Thuật Ngữ</h2>
          <p className="text-xs text-slate-500">{glossary.length} từ vựng chuẩn của truyện</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
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
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${
              selectedCategory === 'ALL'
                ? 'bg-indigo-600 text-white font-medium'
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
                  ? 'bg-indigo-600 text-white font-medium'
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
                className="p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-xs"
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
                      className="text-[10px] text-indigo-600 hover:underline"
                    >
                      Dán vào bản dịch
                    </button>
                  )}
                </div>
                <div className="font-semibold text-slate-800">{term.originalTerm}</div>
                <div className="text-indigo-600 font-medium">➔ {term.vietnameseTerm}</div>
                {term.notes && <div className="text-[11px] text-slate-400 mt-1 italic">{term.notes}</div>}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
