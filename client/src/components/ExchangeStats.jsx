import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Card from './common/Card';
import toast from 'react-hot-toast';
import { IoArrowBack } from 'react-icons/io5';

export default function ExchangeStats({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.getExchangeStats();
      setStats(data);
    } catch (err) {
      toast.error('加载统计失败');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  const summary = stats?.summary || stats || {};
  const byExchange = stats?.byExchange || stats?.by_exchange || [];
  const byProfile = stats?.byProfile || stats?.by_profile || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('exchanges')} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors">
          <IoArrowBack size={20} />
        </button>
        <h2 className="text-2xl font-bold text-gray-100">📊 交易所统计</h2>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-400">总交易所数</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{summary.totalExchanges || summary.total || 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">总资产估值</p>
          <p className="text-2xl font-bold text-green-400 mt-1">${(summary.totalValue || summary.total_value || 0).toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">已KYC数量</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{summary.kycVerified || summary.kyc_verified || 0}</p>
        </Card>
      </div>

      {/* By Exchange */}
      {Array.isArray(byExchange) && byExchange.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-4">按交易所分组</h3>
          <div className="space-y-3">
            {byExchange.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-dark-700/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-200">{item.name || item.exchange_name || item._id}</p>
                  <p className="text-xs text-gray-400">{item.count || 0} 个账户</p>
                </div>
                <span className="text-green-400 font-semibold">${(item.totalValue || item.total_value || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* By Profile */}
      {Array.isArray(byProfile) && byProfile.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-4">按身份分组</h3>
          <div className="space-y-3">
            {byProfile.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-dark-700/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold overflow-hidden">
                    {item.avatar
                      ? <img src={`/api/files/avatars/${item.avatar}`} className="w-full h-full object-cover" />
                      : (item.name || item.profileName || item._id || '?')[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-200">{item.name || item.profileName || item._id}</p>
                    <p className="text-xs text-gray-400">{item.count || 0} 个交易所</p>
                  </div>
                </div>
                <span className="text-green-400 font-semibold">${(item.totalValue || item.total_value || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
