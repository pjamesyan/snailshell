import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import {
  IoAdd, IoCheckmark, IoClose, IoTrash, IoCreate,
  IoChevronDown, IoChevronForward, IoSparkles,
  IoCalendar, IoPricetag,
} from 'react-icons/io5';

const priorityConfig = {
  1: { label: '紧急', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  2: { label: '高', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  3: { label: '中', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  4: { label: '低', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

const statusLabels = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

const emptyForm = { title: '', description: '', priority: 3, due_date: '', tags: '' };

export default function TodoList({ onNavigate }) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedIds, setExpandedIds] = useState({});
  const [subtasks, setSubtasks] = useState({});
  const [decomposingId, setDecomposingId] = useState(null);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const data = await api.listTodos(params);
      setTodos(Array.isArray(data) ? data : data.todos || data.data || []);
    } catch {
      toast.error('加载任务列表失败');
    }
    setLoading(false);
  }, [statusFilter, priorityFilter]);

  useEffect(() => { loadTodos(); }, [loadTodos]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (todo) => {
    setEditingId(todo.id);
    setForm({
      title: todo.title || '',
      description: todo.description || '',
      priority: todo.priority || 3,
      due_date: todo.due_date ? todo.due_date.slice(0, 10) : '',
      tags: todo.tags || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('标题不能为空'); return; }
    setSaving(true);
    try {
      const payload = { ...form, priority: Number(form.priority) };
      if (!payload.due_date) delete payload.due_date;
      if (editingId) {
        await api.updateTodo(editingId, payload);
        toast.success('任务已更新');
      } else {
        await api.createTodo(payload);
        toast.success('任务已创建');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      loadTodos();
    } catch (err) {
      toast.error(err.message || '保存失败');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除此任务？')) return;
    try {
      await api.deleteTodo(id);
      toast.success('已删除');
      loadTodos();
    } catch (err) {
      toast.error(err.message || '删除失败');
    }
  };

  const toggleComplete = async (todo) => {
    const newStatus = todo.status === 'completed' ? 'pending' : 'completed';
    try {
      await api.updateTodo(todo.id, { status: newStatus });
      toast.success(newStatus === 'completed' ? '已完成' : '已恢复为待处理');
      loadTodos();
    } catch (err) {
      toast.error(err.message || '更新失败');
    }
  };

  const handleDecompose = async (id) => {
    setDecomposingId(id);
    try {
      await api.decomposeTodo(id);
      toast.success('AI分解完成');
      loadTodos();
    } catch (err) {
      toast.error(err.message || 'AI分解失败');
    }
    setDecomposingId(null);
  };

  const toggleExpand = async (todoId) => {
    const isExpanded = expandedIds[todoId];
    setExpandedIds(prev => ({ ...prev, [todoId]: !isExpanded }));
    if (!isExpanded && !subtasks[todoId]) {
      try {
        const data = await api.getTodo(todoId);
        setSubtasks(prev => ({ ...prev, [todoId]: data.subtasks || [] }));
      } catch {
        toast.error('加载子任务失败');
      }
    }
  };

  // Statistics
  const stats = {
    total: todos.length,
    pending: todos.filter(t => t.status === 'pending').length,
    in_progress: todos.filter(t => t.status === 'in_progress').length,
    completed: todos.filter(t => t.status === 'completed').length,
  };

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
        <h2 className="text-2xl font-bold text-gray-100">📋 待办任务</h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          <IoAdd size={18} /> 添加任务
        </button>
      </div>

      {/* Statistics Bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '全部', value: stats.total, cls: 'text-gray-100' },
          { label: '待处理', value: stats.pending, cls: 'text-yellow-400' },
          { label: '进行中', value: stats.in_progress, cls: 'text-blue-400' },
          { label: '已完成', value: stats.completed, cls: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-dark-700 rounded-lg p-3 text-center">
            <div className={`text-xl font-bold ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-accent/50"
        >
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-accent/50"
        >
          <option value="">全部优先级</option>
          <option value="1">🔴 紧急</option>
          <option value="2">🟠 高</option>
          <option value="3">🔵 中</option>
          <option value="4">⚪ 低</option>
        </select>
      </div>

      {/* Task List */}
      {todos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {statusFilter || priorityFilter ? '没有匹配的任务' : '暂无任务，点击上方按钮添加'}
        </div>
      ) : (
        <div className="space-y-2">
          {todos.map(todo => {
            const pc = priorityConfig[todo.priority] || priorityConfig[3];
            const isCompleted = todo.status === 'completed';
            const isExpanded = expandedIds[todo.id];
            const hasSubtasks = (todo.subtasks && todo.subtasks.length > 0);
            const isDecomposing = decomposingId === todo.id;

            return (
              <div key={todo.id} className="bg-dark-700 rounded-lg border border-dark-700 hover:border-accent/30 transition-colors">
                <div className="flex items-start gap-3 p-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleComplete(todo)}
                    className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-500 hover:border-accent'
                    }`}
                  >
                    {isCompleted && <IoCheckmark size={14} />}
                  </button>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${pc.color}`}>
                        {pc.label}
                      </span>
                      <span className={`font-medium ${isCompleted ? 'line-through text-gray-500' : 'text-gray-100'}`}>
                        {todo.title}
                      </span>
                      {todo.status && todo.status !== 'completed' && (
                        <span className="text-xs text-gray-500">
                          {statusLabels[todo.status] || todo.status}
                        </span>
                      )}
                    </div>

                    {todo.description && (
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">{todo.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {todo.due_date && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <IoCalendar size={12} />
                          {todo.due_date.slice(0, 10)}
                        </span>
                      )}
                      {todo.tags && todo.tags.split(',').map((tag, i) => (
                        <span key={i} className="flex items-center gap-1 text-xs px-1.5 py-0.5 bg-dark-700 border border-gray-600/30 text-gray-400 rounded">
                          <IoPricetag size={10} />
                          {tag.trim()}
                        </span>
                      ))}
                      {hasSubtasks && (
                        <button
                          onClick={() => toggleExpand(todo.id)}
                          className="flex items-center gap-1 text-xs text-accent hover:text-blue-400 transition-colors"
                        >
                          {isExpanded ? <IoChevronDown size={12} /> : <IoChevronForward size={12} />}
                          {todo.subtasks.length} 个子任务
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDecompose(todo.id)}
                      disabled={isDecomposing}
                      title="AI分解"
                      className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-purple-400 transition-colors disabled:opacity-50"
                    >
                      {isDecomposing
                        ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                        : <IoSparkles size={16} />}
                    </button>
                    <button
                      onClick={() => openEdit(todo)}
                      title="编辑"
                      className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-accent transition-colors"
                    >
                      <IoCreate size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(todo.id)}
                      title="删除"
                      className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <IoTrash size={16} />
                    </button>
                  </div>
                </div>

                {/* Subtasks */}
                {isExpanded && (
                  <div className="border-t border-dark-700 px-4 py-2 ml-8 space-y-1">
                    {subtasks[todo.id] && subtasks[todo.id].length > 0 ? (
                      subtasks[todo.id].map(sub => {
                        const spc = priorityConfig[sub.priority] || priorityConfig[3];
                        return (
                          <div key={sub.id} className="flex items-center gap-2 py-1 text-sm">
                            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              sub.status === 'completed'
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-600'
                            }`}>
                              {sub.status === 'completed' && <IoCheckmark size={10} />}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${spc.color}`}>
                              {spc.label}
                            </span>
                            <span className={sub.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-300'}>
                              {sub.title}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-gray-500 py-1">暂无子任务</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-[#1e293b] rounded-xl w-full max-w-lg border border-dark-700 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <h3 className="text-lg font-semibold text-gray-100">
                {editingId ? '编辑任务' : '添加任务'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors">
                <IoClose size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">标题 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="输入任务标题"
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-accent/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">描述</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="输入任务描述"
                  rows={3}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-accent/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">优先级</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-accent/50"
                  >
                    <option value={1}>🔴 紧急</option>
                    <option value={2}>🟠 高</option>
                    <option value={3}>🔵 中</option>
                    <option value={4}>⚪ 低</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">截止日期</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">标签（逗号分隔）</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="如：工作,重要"
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-dark-700">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-dark-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : editingId ? '更新' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
