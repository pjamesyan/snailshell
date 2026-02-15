import React, { useState, useEffect } from 'react';
import { IoShield, IoKey, IoInformationCircle, IoLockClosed } from 'react-icons/io5';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import TwoFactor from './TwoFactor';

export default function Settings({ user, onLogout, checkAuth }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Auto-lock settings
  const [autoLock, setAutoLock] = useState(() => {
    const saved = localStorage.getItem('autoLock');
    return saved ? JSON.parse(saved) : { enabled: false, timeout: 5 };
  });

  useEffect(() => {
    localStorage.setItem('autoLock', JSON.stringify(autoLock));
  }, [autoLock]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('两次密码不一致'); return; }
    // Password strength validation
    if (newPassword.length < 8) {
      toast.error('新密码至少需要8位');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error('新密码需要包含至少一个大写字母');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      toast.error('新密码需要包含至少一个小写字母');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error('新密码需要包含至少一个数字');
      return;
    }
    setLoading(true);
    try {
      const res = await api.changePassword({ currentPassword, newPassword });
      if (res.token) localStorage.setItem('token', res.token);
      if (res.encryptionKey) localStorage.setItem('encryptionKey', res.encryptionKey);
      toast.success('密码修改成功');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-100 mb-6">⚙️ 设置</h2>

      <div className="space-y-6">
        {/* Account info */}
        <div className="bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <IoInformationCircle /> 账户信息
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-[#334155]">
              <span className="text-gray-400">用户名</span>
              <span className="text-gray-200">{user?.username}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#334155]">
              <span className="text-gray-400">两步验证</span>
              <span className={user?.totpEnabled ? 'text-green-400' : 'text-red-400'}>
                {user?.totpEnabled ? '已启用 ✓' : '未启用'}
              </span>
            </div>
          </div>
        </div>

        {/* 2FA */}
        <TwoFactor user={user} onUpdate={checkAuth} />

        {/* Change password */}
        <div className="bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <IoKey /> 修改密码
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm text-gray-400 mb-1">当前密码</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2.5 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">新密码（至少8位，含大小写+数字）</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2.5 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" required minLength={8} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">确认新密码</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2.5 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" required />
            </div>
            <button type="submit" disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {loading ? '修改中...' : '修改密码'}
            </button>
          </form>
        </div>

        {/* Auto-lock */}
        <div className="bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <IoLockClosed /> 自动锁定
          </h3>
          <div className="space-y-4 max-w-md">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={autoLock.enabled}
                onChange={(e) => setAutoLock(a => ({ ...a, enabled: e.target.checked }))}
                className="w-5 h-5 rounded border-[#334155] bg-[#0f172a] text-blue-500 focus:ring-blue-500" />
              <span className="text-gray-200">启用自动锁定</span>
            </label>
            {autoLock.enabled && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">无操作超时时间（分钟）</label>
                <select value={autoLock.timeout}
                  onChange={(e) => setAutoLock(a => ({ ...a, timeout: parseInt(e.target.value) }))}
                  className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2.5 text-gray-100 focus:border-blue-500 outline-none">
                  <option value={1}>1 分钟</option>
                  <option value={3}>3 分钟</option>
                  <option value={5}>5 分钟</option>
                  <option value={10}>10 分钟</option>
                  <option value={15}>15 分钟</option>
                  <option value={30}>30 分钟</option>
                  <option value={60}>1 小时</option>
                </select>
              </div>
            )}
            <p className="text-xs text-gray-500">启用后，超过设定时间无操作将自动退出登录</p>
          </div>
        </div>

        {/* Logout */}
        <div className="bg-[#1e293b] rounded-xl p-6 border border-red-500/30">
          <h3 className="text-lg font-semibold text-red-400 mb-4">危险操作</h3>
          <button onClick={onLogout}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-6 py-2.5 rounded-lg transition-colors">
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
