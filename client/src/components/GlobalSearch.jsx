import React, { useState, useRef, useEffect } from 'react';
import { api } from '../utils/api';
import { IoSearch, IoPerson, IoFolder, IoSwapHorizontal, IoClose } from 'react-icons/io5';

const typeIcons = {
  profile: <IoPerson size={14} className="text-blue-400" />,
  project: <IoFolder size={14} className="text-green-400" />,
  exchange: <IoSwapHorizontal size={14} className="text-yellow-400" />,
};
const typeLabels = { profile: '身份', project: '项目', exchange: '交易所' };

export default function GlobalSearch({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') { setOpen(false); setQuery(''); setResults([]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search(query);
        setResults(data.results || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  }, [query]);

  const handleSelect = (r) => {
    setOpen(false); setQuery(''); setResults([]);
    if (r.type === 'profile') onNavigate('profile-detail', r.id);
    else if (r.type === 'project') onNavigate('project-detail', r.id);
    else if (r.type === 'exchange') onNavigate('exchanges'); // Navigate to exchanges page
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-gray-400 text-sm transition-colors" title="Ctrl+K">
        <IoSearch size={14} />
        <span className="hidden sm:inline">搜索...</span>
        <kbd className="hidden sm:inline text-xs bg-dark-800 px-1.5 py-0.5 rounded text-gray-500">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div className="fixed inset-0 bg-black/60" onClick={() => { setOpen(false); setQuery(''); setResults([]); }} />
          <div className="relative w-full max-w-lg bg-dark-800 border border-dark-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-700">
              <IoSearch size={18} className="text-gray-400" />
              <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-gray-200 placeholder-gray-500 outline-none text-sm" placeholder="搜索身份、项目、交易所..." />
              {query && <button onClick={() => { setQuery(''); setResults([]); }} className="text-gray-500 hover:text-gray-300"><IoClose size={16} /></button>}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading && <div className="px-4 py-3 text-sm text-gray-500">搜索中...</div>}
              {!loading && query && results.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-500">没有找到结果</div>}
              {results.map((r, i) => (
                <button key={`${r.type}-${r.id}-${i}`} onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-dark-700 transition-colors text-left">
                  {typeIcons[r.type]}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 truncate">{r.title}</div>
                    {r.subtitle && <div className="text-xs text-gray-500 truncate">{r.subtitle}</div>}
                  </div>
                  <span className="text-xs text-gray-600">{typeLabels[r.type]}</span>
                </button>
              ))}
            </div>
            {!query && (
              <div className="px-4 py-3 border-t border-dark-700 text-xs text-gray-600">
                输入关键词搜索 · <kbd className="bg-dark-700 px-1 rounded">ESC</kbd> 关闭
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
