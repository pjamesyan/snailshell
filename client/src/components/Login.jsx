import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { IoLockClosed, IoMail, IoEye, IoEyeOff, IoShield } from 'react-icons/io5';

export default function Login({ onLogin, onSwitchToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('请填写用户名和密码');
      return;
    }
    if (needs2FA && (!totpCode || totpCode.length !== 6)) {
      toast.error('请输入6位验证码');
      return;
    }
    setLoading(true);
    try {
      const result = await onLogin({ username, password, totpCode: needs2FA ? totpCode : undefined });
      if (result && result.requires2FA) {
        setNeeds2FA(true);
        toast('请输入 2FA 验证码', { icon: '🔐' });
      } else {
        toast.success('登录成功');
      }
    } catch (err) {
      toast.error(err.message || '登录失败');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-gray-100">🐌 SnailShell</h1>
          <p className="text-gray-400 mt-2">安全管理你的所有账号</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">登录</h2>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">用户名</label>
            <div className="relative">
              <IoMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-accent/50"
                placeholder="输入用户名"
                disabled={needs2FA}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">密码</label>
            <div className="relative">
              <IoLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-accent/50"
                placeholder="输入密码"
                disabled={needs2FA}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPassword ? <IoEyeOff /> : <IoEye />}
              </button>
            </div>
          </div>

          {needs2FA && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                <span className="flex items-center gap-1"><IoShield className="text-accent" /> 2FA 验证码</span>
              </label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-2.5 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-accent/50 text-center text-lg tracking-widest"
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? '登录中...' : needs2FA ? '验证并登录' : '登录'}
          </button>

          {needs2FA && (
            <button
              type="button"
              onClick={() => { setNeeds2FA(false); setTotpCode(''); }}
              className="w-full text-sm text-gray-400 hover:text-gray-300"
            >
              返回
            </button>
          )}

          <p className="text-center text-sm text-gray-400">
            没有账号？{' '}
            <button type="button" onClick={onSwitchToRegister} className="text-accent hover:underline">
              注册
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
