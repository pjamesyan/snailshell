import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import Card from './common/Card';
import Badge from './common/Badge';
import Modal from './common/Modal';
import toast from 'react-hot-toast';
import {
  IoAdd,
  IoSearch,
  IoBookmark,
  IoBookmarkOutline,
  IoCreate,
  IoTrash,
  IoClose,
  IoDocumentText,
  IoTime,
  IoPricetag,
} from 'react-icons/io5';

const CATEGORIES = [
  { key: '', label: '全部', color: 'gray' },
  { key: 'general', label: '通用', color: 'blue' },
  { key: 'idea', label: '想法', color: 'purple' },
  { key: 'account', label: '账号信息', color: 'green' },
  { key: 'diary', label: '日记', color: 'pink' },
  { key: 'reference', label: '参考', color: 'yellow' },
];

const CATEGORY_COLOR_MAP = {
  general: 'blue',
  idea: 'purple',
  account: 'green',
  diary: 'pink',
  reference: 'yellow',
};

const CATEGORY_LABEL_MAP = {
  general: '通用',
  idea: '想法',
  account: '账号信息',
  diary: '日记',
  reference: '参考',
};

const EMPTY_FORM = {
  title: '',
  content: '',
  category: 'general',
  tags: '',
};

export default function NoteList({ onNavigate }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailNote, setDetailNote] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState(null);

  // Pin animation tracking
  const [pinAnimating, setPinAnimating] = useState(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (search) params.search = search;
      const data = await api.listNotes(params);
      setNotes(Array.isArray(data) ? data : data.notes || data.data || []);
    } catch (err) {
      toast.error('加载笔记失败');
    }
    setLoading(false);
  }, [categoryFilter, search]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // --- Filtering ---
  const filtered = notes.filter((note) => {
    if (categoryFilter && note.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = (note.title || '').toLowerCase().includes(q);
      const matchContent = (note.content || '').toLowerCase().includes(q);
      const matchTags = (note.tags || []).some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchTags) return false;
    }
    return true;
  });

  // Pinned notes first
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
  });

  // --- Handlers ---
  const handleOpenCreate = () => {
    setEditingNote(null);
    setForm(EMPTY_FORM);
    setLastSaved(null);
    setEditOpen(true);
  };

  const handleOpenEdit = (note, e) => {
    e?.stopPropagation();
    setEditingNote(note);
    setForm({
      title: note.title || '',
      content: note.content || '',
      category: note.category || 'general',
      tags: Array.isArray(note.tags) ? note.tags.join(', ') : note.tags || '',
    });
    setLastSaved(null);
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setEditingNote(null);
    setForm(EMPTY_FORM);
    setLastSaved(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('请输入笔记标题');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content,
        category: form.category,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      if (editingNote) {
        await api.updateNote(editingNote.id || editingNote._id, payload);
        toast.success('笔记已更新');
      } else {
        await api.createNote(payload);
        toast.success('笔记已创建');
      }
      setLastSaved(new Date());
      handleCloseEdit();
      loadNotes();
    } catch (err) {
      toast.error(err.message || '保存失败');
    }
    setSaving(false);
  };

  const handleTogglePin = async (note, e) => {
    e?.stopPropagation();
    const noteId = note.id || note._id;
    setPinAnimating(noteId);
    try {
      await api.toggleNotePin(noteId);
      setNotes((prev) =>
        prev.map((n) =>
          (n.id || n._id) === noteId ? { ...n, pinned: !n.pinned } : n
        )
      );
      toast.success(note.pinned ? '已取消置顶' : '已置顶');
    } catch (err) {
      toast.error(err.message || '操作失败');
    }
    setTimeout(() => setPinAnimating(null), 300);
  };

  const handleDeleteConfirm = (id, e) => {
    e?.stopPropagation();
    setDeleteId(id);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteNote(deleteId);
      toast.success('笔记已删除');
      setNotes((prev) => prev.filter((n) => (n.id || n._id) !== deleteId));
    } catch (err) {
      toast.error(err.message || '删除失败');
    }
    setDeleteId(null);
  };

  const handleViewDetail = async (note) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const data = await api.getNote(note.id || note._id);
      setDetailNote(data.note || data);
    } catch {
      setDetailNote(note);
    }
    setDetailLoading(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-100">📝 笔记本</h2>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          <IoAdd size={18} />
          新建笔记
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <IoSearch
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索笔记..."
          className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <IoClose size={16} />
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => {
          const isActive = categoryFilter === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                isActive
                  ? 'bg-accent text-white border-accent'
                  : 'bg-dark-700 text-gray-400 border-dark-700 hover:text-gray-200 hover:border-gray-500'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Notes grid */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <IoDocumentText size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg">
            {search || categoryFilter ? '没有匹配的笔记' : '暂无笔记，点击上方按钮新建'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((note) => {
            const noteId = note.id || note._id;
            const isAnimating = pinAnimating === noteId;
            return (
              <Card
                key={noteId}
                onClick={() => handleViewDetail(note)}
                className={`flex flex-col transition-transform ${isAnimating ? 'scale-[1.02]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {note.pinned && <span className="text-sm flex-shrink-0">📌</span>}
                    <h3 className="font-semibold text-gray-100 truncate">
                      {note.title}
                    </h3>
                  </div>
                  <Badge color={CATEGORY_COLOR_MAP[note.category] || 'gray'}>
                    {CATEGORY_LABEL_MAP[note.category] || note.category}
                  </Badge>
                </div>

                {/* Content preview */}
                <p className="text-sm text-gray-400 mb-3 line-clamp-3 flex-1">
                  {(note.content || '').slice(0, 150)}
                  {(note.content || '').length > 150 ? '...' : ''}
                </p>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <IoPricetag size={12} className="text-gray-500 flex-shrink-0" />
                    {note.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-xs bg-dark-700 text-gray-400 px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Date */}
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                  <IoTime size={12} />
                  <span>
                    {note.updated_at && note.updated_at !== note.created_at
                      ? `更新于 ${formatDate(note.updated_at)}`
                      : formatDate(note.created_at)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-1 pt-3 border-t border-dark-700">
                  <button
                    onClick={(e) => handleTogglePin(note, e)}
                    className={`p-1.5 rounded hover:bg-dark-700 transition-colors ${
                      note.pinned
                        ? 'text-yellow-400 hover:text-yellow-300'
                        : 'text-gray-400 hover:text-yellow-400'
                    }`}
                    title={note.pinned ? '取消置顶' : '置顶'}
                  >
                    {note.pinned ? (
                      <IoBookmark size={16} />
                    ) : (
                      <IoBookmarkOutline size={16} />
                    )}
                  </button>
                  <button
                    onClick={(e) => handleOpenEdit(note, e)}
                    className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-accent transition-colors"
                    title="编辑"
                  >
                    <IoCreate size={16} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteConfirm(noteId, e)}
                    className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-red-400 transition-colors"
                    title="删除"
                  >
                    <IoTrash size={16} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit / Create Modal */}
      <Modal
        isOpen={editOpen}
        onClose={handleCloseEdit}
        title={editingNote ? '编辑笔记' : '新建笔记'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              标题 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="输入笔记标题..."
              className="w-full px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">分类</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-accent/50 transition-colors"
            >
              {CATEGORIES.filter((c) => c.key).map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">内容</label>
            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              placeholder="输入笔记内容..."
              rows={12}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-colors resize-y"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              标签 <span className="text-gray-500 font-normal">（多个标签用逗号分隔）</span>
            </label>
            <input
              type="text"
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="例如: 工作, 学习, 重要"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>

          {/* Auto-save hint */}
          {lastSaved && (
            <p className="text-xs text-gray-500">
              上次保存: {formatDate(lastSaved)}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleCloseEdit}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-700/80 text-gray-300 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-accent hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailNote(null);
        }}
        title={detailNote?.title || '笔记详情'}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
          </div>
        ) : detailNote ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {detailNote.pinned && <span>📌</span>}
              <Badge
                color={CATEGORY_COLOR_MAP[detailNote.category] || 'gray'}
              >
                {CATEGORY_LABEL_MAP[detailNote.category] || detailNote.category}
              </Badge>
              {detailNote.tags &&
                detailNote.tags.length > 0 &&
                detailNote.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs bg-dark-700 text-gray-400 px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
            </div>

            <div className="whitespace-pre-wrap text-gray-200 leading-relaxed text-sm bg-dark-700/50 rounded-lg p-4 min-h-[200px]">
              {detailNote.content || '（无内容）'}
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-dark-700">
              <span className="flex items-center gap-1">
                <IoTime size={12} />
                创建: {formatDate(detailNote.created_at)}
              </span>
              {detailNote.updated_at &&
                detailNote.updated_at !== detailNote.created_at && (
                  <span className="flex items-center gap-1">
                    <IoTime size={12} />
                    更新: {formatDate(detailNote.updated_at)}
                  </span>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setDetailOpen(false);
                  handleOpenEdit(detailNote);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
              >
                <IoCreate size={14} />
                编辑
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="确认删除"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">确定要删除这条笔记吗？此操作无法撤销。</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-700/80 text-gray-300 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
