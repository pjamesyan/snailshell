import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../utils/api';
import Modal from './common/Modal';
import toast from 'react-hot-toast';
import {
  IoAdd,
  IoSend,
  IoTrash,
  IoChatbubble,
  IoSettings,
  IoClose,
  IoEye,
  IoEyeOff,
  IoCreate,
  IoMenu,
} from 'react-icons/io5';

// --- Helpers ---

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
  return new Date(dateStr).toLocaleDateString();
}

function formatMessageContent(text) {
  if (!text) return null;
  const parts = [];
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', lang: match[1], content: match[2].replace(/\n$/, '') });
    lastIndex = codeBlockRe.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts.map((part, i) => {
    if (part.type === 'code') {
      return (
        <pre
          key={i}
          className="my-2 p-3 rounded-lg bg-[#0f172a] border border-[#334155] text-sm overflow-x-auto font-mono text-gray-300"
        >
          {part.lang && (
            <span className="block text-xs text-gray-500 mb-1">{part.lang}</span>
          )}
          <code>{part.content}</code>
        </pre>
      );
    }
    // Inline code and line breaks
    const inlineParts = part.content.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((seg, j) => {
          if (seg.startsWith('`') && seg.endsWith('`')) {
            return (
              <code
                key={j}
                className="px-1.5 py-0.5 rounded bg-[#0f172a] border border-[#334155] text-sm font-mono text-blue-300"
              >
                {seg.slice(1, -1)}
              </code>
            );
          }
          return seg.split('\n').map((line, k, arr) => (
            <React.Fragment key={`${j}-${k}`}>
              {line}
              {k < arr.length - 1 && <br />}
            </React.Fragment>
          ));
        })}
      </span>
    );
  });
}

// --- Sub-components ---

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-2">
      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
        🤖
      </div>
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-start gap-3 px-4 py-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
          isUser
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-purple-500/20 text-purple-400'
        }`}
      >
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="max-w-[75%] min-w-0">
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-[#1e293b] border border-[#334155] text-gray-200 rounded-tl-sm'
          }`}
        >
          {formatMessageContent(message.content)}
        </div>
        <p className={`text-[11px] text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {relativeTime(message.created_at || message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function ConversationItem({ conv, isActive, onSelect, onDelete }) {
  return (
    <button
      onClick={() => onSelect(conv)}
      className={`w-full text-left px-3 py-2.5 rounded-lg group transition-colors ${
        isActive
          ? 'bg-blue-500/15 border border-blue-500/30'
          : 'hover:bg-[#334155]/50 border border-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-300' : 'text-gray-200'}`}>
            {conv.title || '新对话'}
          </p>
          {conv.lastMessage && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {conv.lastMessage}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conv);
          }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all shrink-0"
          title="删除"
        >
          <IoTrash size={14} />
        </button>
      </div>
      <p className="text-[11px] text-gray-600 mt-1">
        {relativeTime(conv.updated_at || conv.updatedAt || conv.created_at || conv.createdAt)}
      </p>
    </button>
  );
}

function LLMConfigModal({ isOpen, onClose, config, onSaved }) {
  const [form, setForm] = useState({
    provider: 'openai',
    api_key: '',
    api_url: '',
    model: '',
  });
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && config) {
      setForm({
        provider: config.provider || 'openai',
        api_key: config.api_key || '',
        api_url: config.api_url || '',
        model: config.model || '',
      });
    }
  }, [isOpen, config]);

  const providerDefaults = {
    openai: { url: 'https://api.openai.com/v1', model: 'gpt-4o / gpt-3.5-turbo' },
    claude: { url: 'https://api.anthropic.com', model: 'claude-3-5-sonnet-20241022' },
    custom: { url: 'https://your-api-url.com/v1', model: '输入模型名称' },
  };

  const handleSave = async () => {
    if (!form.api_key.trim()) {
      toast.error('请输入 API Key');
      return;
    }
    setSaving(true);
    try {
      await api.updateLLMConfig(form);
      toast.success('配置已保存');
      onSaved(form);
      onClose();
    } catch (err) {
      toast.error(err.message || '保存失败');
    }
    setSaving(false);
  };

  const defaults = providerDefaults[form.provider] || providerDefaults.custom;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚙️ LLM 配置" size="sm">
      <div className="space-y-4">
        {/* Provider */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">服务提供商</label>
          <select
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value, api_url: '' })}
            className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="openai">OpenAI</option>
            <option value="claude">Claude (Anthropic)</option>
            <option value="custom">自定义 (Custom)</option>
          </select>
        </div>

        {/* API URL */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">API URL</label>
          <input
            type="text"
            value={form.api_url}
            onChange={(e) => setForm({ ...form, api_url: e.target.value })}
            placeholder={defaults.url}
            className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">API Key</label>
          <div className="flex gap-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder="sk-..."
              className="flex-1 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-[#334155] transition-colors"
            >
              {showKey ? <IoEyeOff size={16} /> : <IoEye size={16} />}
            </button>
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">模型</label>
          <input
            type="text"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder={defaults.model}
            className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#334155] hover:bg-[#475569] text-gray-200 text-sm rounded-lg transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </Modal>
  );
}

// --- Main Component ---

export default function Chat({ onNavigate }) {
  // State
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [llmConfig, setLlmConfig] = useState(undefined); // undefined = loading, null = not set
  const [showConfig, setShowConfig] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const titleInputRef = useRef(null);

  // --- Data Loading ---

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.listConversations();
      const convs = Array.isArray(data) ? data : data.conversations || data.data || [];
      convs.sort((a, b) => {
        const ta = new Date(a.updated_at || a.updatedAt || a.created_at || a.createdAt || 0);
        const tb = new Date(b.updated_at || b.updatedAt || b.created_at || b.createdAt || 0);
        return tb - ta;
      });
      setConversations(convs);
      return convs;
    } catch (err) {
      toast.error('加载对话列表失败');
      return [];
    }
  }, []);

  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    setLoadingMsgs(true);
    try {
      const data = await api.getMessages(convId, { limit: 100, offset: 0 });
      const msgs = Array.isArray(data) ? data : data.messages || data.data || [];
      setMessages(msgs);
    } catch (err) {
      toast.error('加载消息失败');
    }
    setLoadingMsgs(false);
  }, []);

  const loadLLMConfig = useCallback(async () => {
    try {
      const data = await api.getLLMConfig();
      setLlmConfig(data || null);
    } catch {
      setLlmConfig(null);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoadingConvs(true);
      const [convs] = await Promise.all([loadConversations(), loadLLMConfig()]);
      setLoadingConvs(false);
      if (convs.length > 0) {
        setActiveConv(convs[0]);
      }
    };
    init();
  }, [loadConversations, loadLLMConfig]);

  // Load messages when active conversation changes
  useEffect(() => {
    const id = activeConv?._id || activeConv?.id;
    if (id) {
      loadMessages(id);
    } else {
      setMessages([]);
    }
  }, [activeConv, loadMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Focus title input when editing
  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  // --- Actions ---

  const handleCreateConversation = async () => {
    try {
      const data = await api.createConversation({ title: '新对话' });
      const newConv = data.conversation || data;
      setConversations((prev) => [newConv, ...prev]);
      setActiveConv(newConv);
      setMessages([]);
      setSidebarOpen(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      toast.error(err.message || '创建对话失败');
    }
  };

  const handleDeleteConversation = async (conv) => {
    if (!confirm('确定删除此对话？')) return;
    const id = conv._id || conv.id;
    try {
      await api.deleteConversation(id);
      toast.success('已删除');
      setConversations((prev) => prev.filter((c) => (c._id || c.id) !== id));
      if ((activeConv?._id || activeConv?.id) === id) {
        setActiveConv(null);
        setMessages([]);
      }
    } catch (err) {
      toast.error(err.message || '删除失败');
    }
  };

  const handleSelectConversation = (conv) => {
    setActiveConv(conv);
    setSidebarOpen(false);
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    const convId = activeConv?._id || activeConv?.id;
    if (!convId) {
      toast.error('请先选择或创建对话');
      return;
    }

    setInputText('');
    setSending(true);

    // Optimistic user message
    const tempUserMsg = {
      _id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const data = await api.sendMessage(convId, text);
      const userMsg = data.userMessage || tempUserMsg;
      const assistantMsg = data.assistantMessage;

      setMessages((prev) => {
        const filtered = prev.filter((m) => m._id !== tempUserMsg._id);
        const next = [...filtered, userMsg];
        if (assistantMsg) next.push(assistantMsg);
        return next;
      });

      // Update conversation in list with new timestamp
      setConversations((prev) =>
        prev
          .map((c) =>
            (c._id || c.id) === convId
              ? { ...c, updated_at: new Date().toISOString(), lastMessage: text }
              : c
          )
          .sort((a, b) => {
            const ta = new Date(a.updated_at || a.updatedAt || 0);
            const tb = new Date(b.updated_at || b.updatedAt || 0);
            return tb - ta;
          })
      );
    } catch (err) {
      toast.error(err.message || '发送失败');
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m._id !== tempUserMsg._id));
      setInputText(text);
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTitleSave = async () => {
    const id = activeConv?._id || activeConv?.id;
    if (!id || !titleDraft.trim()) {
      setEditingTitle(false);
      return;
    }
    try {
      await api.updateConversation(id, { title: titleDraft.trim() });
      setActiveConv((prev) => ({ ...prev, title: titleDraft.trim() }));
      setConversations((prev) =>
        prev.map((c) =>
          (c._id || c.id) === id ? { ...c, title: titleDraft.trim() } : c
        )
      );
    } catch (err) {
      toast.error('更新标题失败');
    }
    setEditingTitle(false);
  };

  const handleInputResize = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  };

  // --- Render helpers ---

  const configNotReady = llmConfig === null;
  const isLoading = llmConfig === undefined || loadingConvs;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Setup prompt when no LLM config
  if (configNotReady) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="text-6xl mb-6">🤖</div>
        <h2 className="text-2xl font-bold text-gray-100 mb-3">AI 助手</h2>
        <p className="text-gray-400 mb-6 max-w-md">
          在开始对话之前，需要先配置 LLM 服务。请设置 API Key 和模型参数。
        </p>
        <button
          onClick={() => setShowConfig(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <IoSettings size={18} />
          配置 LLM
        </button>
        <LLMConfigModal
          isOpen={showConfig}
          onClose={() => setShowConfig(false)}
          config={llmConfig}
          onSaved={(cfg) => setLlmConfig(cfg)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] lg:h-[calc(100vh-8rem)] bg-[#0f172a] rounded-xl border border-[#334155] overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-30 w-72 bg-[#1e293b] border-r border-[#334155] flex flex-col transition-transform duration-200`}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-[#334155] flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            🤖 AI助手
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCreateConversation}
              className="p-2 rounded-lg hover:bg-[#334155] text-gray-400 hover:text-blue-400 transition-colors"
              title="新建对话"
            >
              <IoAdd size={20} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-[#334155] text-gray-400 hover:text-gray-200 transition-colors lg:hidden"
            >
              <IoClose size={20} />
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              暂无对话
              <br />
              <span className="text-xs">点击 + 开始新对话</span>
            </div>
          ) : (
            conversations.map((conv) => (
              <ConversationItem
                key={conv._id || conv.id}
                conv={conv}
                isActive={(activeConv?._id || activeConv?.id) === (conv._id || conv.id)}
                onSelect={handleSelectConversation}
                onDelete={handleDeleteConversation}
              />
            ))
          )}
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-[#334155]">
          <button
            onClick={() => setShowConfig(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-[#334155] transition-colors"
          >
            <IoSettings size={16} />
            ⚙️ 配置
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="px-4 py-3 border-b border-[#334155] bg-[#1e293b] flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-[#334155] text-gray-400 lg:hidden"
          >
            <IoMenu size={20} />
          </button>

          {activeConv ? (
            editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                className="flex-1 bg-[#0f172a] border border-blue-500 rounded-lg px-3 py-1 text-sm text-gray-100 focus:outline-none"
              />
            ) : (
              <button
                onClick={() => {
                  setTitleDraft(activeConv.title || '新对话');
                  setEditingTitle(true);
                }}
                className="flex items-center gap-2 text-gray-100 hover:text-blue-300 transition-colors group"
              >
                <span className="font-medium truncate max-w-xs">
                  {activeConv.title || '新对话'}
                </span>
                <IoCreate
                  size={14}
                  className="text-gray-500 group-hover:text-blue-400 transition-colors"
                />
              </button>
            )
          ) : (
            <span className="text-gray-500 text-sm">选择或创建一个对话</span>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto py-4">
          {!activeConv ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <IoChatbubble size={48} className="mb-4 text-gray-600" />
              <p className="text-sm">选择一个对话或创建新对话</p>
            </div>
          ) : loadingMsgs ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <span className="text-4xl mb-3">💬</span>
              <p className="text-sm">发送一条消息开始对话</p>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((msg) => (
                <MessageBubble key={msg._id || msg.id || `${msg.role}-${msg.created_at}`} message={msg} />
              ))}
              {sending && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        {activeConv && (
          <div className="px-4 py-3 border-t border-[#334155] bg-[#1e293b]">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  handleInputResize(e);
                }}
                onKeyDown={handleKeyDown}
                placeholder="输入消息... (Shift+Enter 换行)"
                disabled={sending}
                rows={1}
                className="flex-1 bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none disabled:opacity-50 transition-colors"
                style={{ maxHeight: '150px' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !inputText.trim()}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0"
                title="发送"
              >
                <IoSend size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Config modal */}
      <LLMConfigModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        config={llmConfig}
        onSaved={(cfg) => setLlmConfig(cfg)}
      />
    </div>
  );
}
