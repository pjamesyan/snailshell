import React from 'react';
import { IoGrid, IoPerson, IoFolder, IoBusinessOutline, IoNotifications, IoWallet, IoKey, IoDownload, IoSettings, IoLogOut, IoStatsChart, IoCheckboxOutline, IoDocumentText, IoChatbubble } from 'react-icons/io5';

const navItems = [
  { id: 'dashboard', label: '仪表盘', icon: IoGrid, emoji: '📊' },
  { id: 'todos', label: '待办任务', icon: IoCheckboxOutline, emoji: '📋' },
  { id: 'notes', label: '笔记本', icon: IoDocumentText, emoji: '📝' },
  { id: 'chat', label: 'AI助手', icon: IoChatbubble, emoji: '🤖' },
  { id: 'profiles', label: '身份管理', icon: IoPerson, emoji: '👤' },
  { id: 'projects', label: '项目库', icon: IoFolder, emoji: '📁' },
  { id: 'exchanges', label: '交易所', icon: IoBusinessOutline, emoji: '🏦' },
  { id: 'stats', label: '数据统计', icon: IoStatsChart, emoji: '📈' },
  { id: 'reminders', label: '提醒中心', icon: IoNotifications, emoji: '🔔' },
  { id: 'finance', label: '投入收益', icon: IoWallet, emoji: '💰' },
  { id: 'password', label: '密码生成器', icon: IoKey, emoji: '🔑' },
  { id: 'import-export', label: '导入导出', icon: IoDownload, emoji: '📥' },
  { id: 'settings', label: '设置', icon: IoSettings, emoji: '⚙️' },
];

export default function Sidebar({ currentPage, onNavigate, onLogout, user }) {
  return (
    <div className="w-64 h-full bg-dark-800 border-r border-dark-700 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-dark-700">
        <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
          <span>🐌</span>
          <span>SnailShell</span>
        </h1>
        {user && (
          <p className="text-sm text-gray-400 mt-1 truncate">
            {user.username}
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
              currentPage === item.id
                ? 'bg-accent/10 text-accent border-r-2 border-accent'
                : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700/50'
            }`}
          >
            <span className="text-base">{item.emoji}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-dark-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <IoLogOut size={18} />
          <span className="text-sm font-medium">退出登录</span>
        </button>
      </div>
    </div>
  );
}
