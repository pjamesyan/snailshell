import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { IoLockClosed, IoMail, IoEye, IoEyeOff } from 'react-icons/io5';

export default function Register({ onRegister, onSwitchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('请填写用户名和密码');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('两次密码不一致');
      return;
    }
    // Password strength validation
    if (password.length < 8) {
      toast.error('密码至少需要8位');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error('密码需要包含至少一个大写字母');
      return;
    }
    if (!/[a-z]/.test(password)) {
      toast.error('密码需要包含至少一个小写字母');
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast.error('密码需要包含至少一个数字');
      return;
    }
    setLoading(true);
    try {
      await onRegister({ username, password });
      toast.success('注册成功');
    } catch (err) {
      toast.error(err.message || '注册失败');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-gray-100">🐌 SnailShell</h1>
          <p className="text-gray-400 mt-2">创建你的账号</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">注册</h2>
          
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
                placeholder="输入密码（至少8位，含大小写+数字）"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPassword ? <IoEyeOff /> : <IoEye />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">确认密码</label>
            <div className="relative">
              <IoLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-accent/50"
                placeholder="再次输入密码"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-sm text-gray-400">
            已有账号？{' '}
            <button type="button" onClick={onSwitchToLogin} className="text-accent hover:underline">
              登录
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
