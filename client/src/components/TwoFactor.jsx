import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import { IoShield, IoCheckmarkCircle, IoCloseCircle } from 'react-icons/io5';

export default function TwoFactor({ user, onUpdate }) {
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [disableToken, setDisableToken] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const data = await api.setup2FA();
      setQrCode(data.qrCode || data.qr);
      setSecret(data.secret || '');
      toast.success('请扫描二维码');
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!token || token.length !== 6) {
      toast.error('请输入6位验证码');
      return;
    }
    setLoading(true);
    try {
      await api.verify2FA({ code: token });
      toast.success('2FA 已启用');
      setQrCode(null);
      setSecret('');
      setToken('');
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleDisable = async () => {
    if (!disableToken || disableToken.length !== 6) {
      toast.error('请输入6位验证码');
      return;
    }
    setLoading(true);
    try {
      await api.disable2FA({ code: disableToken, password: disablePassword });
      toast.success('2FA 已禁用');
      setDisableToken('');
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const is2FAEnabled = user?.twoFactorEnabled || user?.two_factor_enabled || user?.totp_enabled || user?.totpEnabled;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <IoShield className="text-accent" size={24} />
        <h3 className="text-lg font-semibold text-gray-100">两步验证 (2FA)</h3>
        {is2FAEnabled ? (
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <IoCheckmarkCircle /> 已启用
          </span>
        ) : (
          <span className="flex items-center gap-1 text-gray-400 text-sm">
            <IoCloseCircle /> 未启用
          </span>
        )}
      </div>

      {!is2FAEnabled && !qrCode && (
        <button
          onClick={handleSetup}
          disabled={loading}
          className="px-4 py-2 bg-accent hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {loading ? '设置中...' : '设置 2FA'}
        </button>
      )}

      {qrCode && (
        <div className="space-y-4 bg-dark-700/50 p-4 rounded-lg">
          <p className="text-sm text-gray-300">使用 Google Authenticator 或类似应用扫描二维码：</p>
          <div className="flex justify-center">
            <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-lg bg-white p-2" />
          </div>
          {secret && (
            <div>
              <p className="text-sm text-gray-400 mb-1">手动输入密钥：</p>
              <code className="block bg-dark-900 p-2 rounded text-sm text-accent break-all">{secret}</code>
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">输入验证码确认</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="flex-1 px-4 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-accent/50"
                placeholder="6位验证码"
                maxLength={6}
              />
              <button
                onClick={handleVerify}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {is2FAEnabled && (
        <div className="space-y-3 bg-dark-700/50 p-4 rounded-lg">
          <p className="text-sm text-gray-300">输入密码和验证码以禁用 2FA：</p>
          <div className="space-y-2">
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-accent/50"
              placeholder="当前密码"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={disableToken}
                onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="flex-1 px-4 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-accent/50"
                placeholder="6位验证码"
                maxLength={6}
              />
              <button
                onClick={handleDisable}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                禁用 2FA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
