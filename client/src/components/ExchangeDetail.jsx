import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Card from './common/Card';
import Badge from './common/Badge';
import CopyText from './common/CopyText';
import toast from 'react-hot-toast';
import { IoArrowBack, IoCreate, IoTrash, IoPhonePortrait, IoLaptop, IoPhoneLandscape } from 'react-icons/io5';
import { FaApple, FaWindows, FaAndroid } from 'react-icons/fa';

const getDeviceIcon = (deviceName) => {
  const name = (deviceName || '').toLowerCase();
  if (name.includes('mac') || name.includes('iphone') || name.includes('ipad')) return <FaApple className="text-gray-400" size={14} />;
  if (name.includes('windows')) return <FaWindows className="text-gray-400" size={14} />;
  if (name.includes('android')) return <FaAndroid className="text-gray-400" size={14} />;
  return <IoLaptop className="text-gray-400" size={14} />;
};

export default function ExchangeDetail({ exchangeId, onNavigate }) {
  const [exchange, setExchange] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (exchangeId) loadExchange();
  }, [exchangeId]);

  const loadExchange = async () => {
    setLoading(true);
    try {
      const data = await api.getExchange(exchangeId);
      setExchange(data.exchange || data);
    } catch (err) {
      toast.error('加载交易所详情失败');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm('确定删除此交易所记录？')) return;
    try {
      await api.deleteExchange(exchangeId);
      toast.success('已删除');
      onNavigate('exchanges');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!exchange) {
    return <div className="text-center py-12 text-gray-500">交易所记录不存在</div>;
  }

  const assets = exchange.assets || exchange.asset_details || [];
  const totalValue = assets.reduce((sum, a) => sum + (Number(a.value_usd || a.valueUsd) || 0), 0);
  const depositAddresses = exchange.deposit_addresses || [];
  const loginDevices = exchange.login_devices || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('exchanges')} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors">
            <IoArrowBack size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-100">{exchange.exchange_name || exchange.exchangeName || exchange.name}</h2>
            <p className="text-sm text-gray-400">
              身份: {exchange.profileName || exchange.profile_name || exchange.profile?.nickname || '未知'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate('exchange-form', exchangeId)} className="flex items-center gap-1 px-3 py-2 bg-accent hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
            <IoCreate size={16} /> 编辑
          </button>
          <button onClick={handleDelete} className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors">
            <IoTrash size={16} /> 删除
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-400">KYC 状态</p>
          <div className="mt-1">
            <Badge color={exchange.kyc_status === 'verified' ? 'green' : exchange.kyc_status === 'pending' ? 'yellow' : 'gray'}>
              {exchange.kyc_status === 'verified' ? '已验证' : exchange.kyc_status === 'pending' ? '待验证' : '未KYC'}
            </Badge>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">资产种类</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{assets.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">总估值</p>
          <p className="text-2xl font-bold text-green-400 mt-1">${totalValue.toLocaleString()}</p>
        </Card>
      </div>

      {/* Account Info */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-100 mb-3">账户信息</h3>
        <div className="space-y-2 text-sm">
          {(exchange.account_email || exchange.accountEmail) && (
            <CopyText label="📧 账户邮箱:" text={exchange.account_email || exchange.accountEmail} />
          )}
          {exchange.exchange_uid && (
            <CopyText label="🆔 UID:" text={exchange.exchange_uid} />
          )}
          {(exchange.password_hint || exchange.passwordHint) && (
            <div>
              <span className="text-gray-400">🔑 密码提示: </span>
              <span className="text-yellow-500/80">{exchange.password_hint || exchange.passwordHint}</span>
            </div>
          )}
          {(exchange.api_key_note || exchange.apiKeyNote) && (
            <div>
              <span className="text-gray-400">🔐 API Key 备注: </span>
              <span className="text-gray-200">{exchange.api_key_note || exchange.apiKeyNote}</span>
            </div>
          )}
          {!exchange.account_email && !exchange.accountEmail && !exchange.exchange_uid && !exchange.password_hint && !exchange.passwordHint && !exchange.api_key_note && !exchange.apiKeyNote && (
            <p className="text-gray-500">暂无账户信息</p>
          )}
        </div>
      </Card>

      {/* Deposit Addresses */}
      {depositAddresses.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-3">💳 充值地址</h3>
          <div className="space-y-2">
            {depositAddresses.map((d, i) => (
              <div key={i}>
                <p className="text-xs text-gray-500 mb-0.5">{d.customChain || d.chain}</p>
                <CopyText text={d.address} className="pl-2" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Login Devices */}
      {loginDevices.length > 0 && loginDevices.some(d => d) && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
            <IoPhonePortrait size={18} /> 主要登录设备
          </h3>
          <div className="flex flex-wrap gap-2">
            {loginDevices.filter(d => d).map((device, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-dark-700/50 rounded text-sm text-gray-300">
                {getDeviceIcon(device)}
                <span>{device}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Assets Table */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-100 mb-4">资产明细</h3>
        {assets.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无资产记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">币种</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">数量</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">估值 (USD)</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a, i) => (
                  <tr key={i} className="border-b border-dark-700/50">
                    <td className="py-2 px-3 text-gray-200 font-medium">{a.currency || a.coin}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{Number(a.amount || a.quantity || 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-green-400">${Number(a.value_usd || a.valueUsd || 0).toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-2 px-3 text-gray-200" colSpan={2}>合计</td>
                  <td className="py-2 px-3 text-right text-green-400">${totalValue.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {exchange.notes && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-3">备注</h3>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{exchange.notes}</p>
        </Card>
      )}
    </div>
  );
}
