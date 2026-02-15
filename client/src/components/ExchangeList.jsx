import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Card from './common/Card';
import Badge from './common/Badge';
import SearchBar from './common/SearchBar';
import toast from 'react-hot-toast';
import { IoAdd, IoTrash, IoCreate, IoEye, IoList, IoGrid, IoLaptop } from 'react-icons/io5';
import { FaApple, FaWindows, FaAndroid } from 'react-icons/fa';

const getDeviceIcon = (deviceName) => {
  const name = (deviceName || '').toLowerCase();
  if (name.includes('mac') || name.includes('iphone') || name.includes('ipad')) return <FaApple className="text-gray-400" size={12} />;
  if (name.includes('windows')) return <FaWindows className="text-gray-400" size={12} />;
  if (name.includes('android')) return <FaAndroid className="text-gray-400" size={12} />;
  return <IoLaptop className="text-gray-400" size={12} />;
};

export default function ExchangeList({ onNavigate }) {
  const [exchanges, setExchanges] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grouped'); // 'flat' or 'grouped'

  useEffect(() => { loadExchanges(); }, []);

  const loadExchanges = async () => {
    setLoading(true);
    try {
      const data = await api.listExchanges();
      setExchanges(Array.isArray(data) ? data : data.exchanges || data.data || []);
    } catch (err) { toast.error('加载交易所列表失败'); }
    setLoading(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('确定删除此交易所记录？')) return;
    try { await api.deleteExchange(id); toast.success('已删除'); loadExchanges(); } catch (err) { toast.error(err.message); }
  };

  const filtered = exchanges.filter(ex => {
    const q = search.toLowerCase();
    return !q ||
      (ex.exchange_name || '').toLowerCase().includes(q) ||
      (ex.profile_nickname || '').toLowerCase().includes(q);
  });

  const getTotalValue = (ex) => {
    return Number(ex.total_value_usd) || (ex.assets || []).reduce((sum, a) => sum + (Number(a.value_usd) || 0), 0);
  };

  // Group by profile
  const grouped = {};
  filtered.forEach(ex => {
    const key = ex.profile_id || 'unknown';
    if (!grouped[key]) grouped[key] = { nickname: ex.profile_nickname || '未知身份', avatar: ex.profile_avatar, exchanges: [] };
    grouped[key].exchanges.push(ex);
  });

  const renderCard = (ex) => {
    const totalValue = getTotalValue(ex);
    return (
      <Card key={ex.id} onClick={() => onNavigate('exchange-detail', ex.id)}>
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-gray-100">{ex.exchange_name || '未命名'}</h3>
            <Badge color={ex.kyc_status === 'verified' ? 'green' : ex.kyc_status === 'pending' ? 'yellow' : 'gray'}>
              {ex.kyc_status === 'verified' ? '已KYC' : ex.kyc_status === 'pending' ? '待KYC' : '未KYC'}
            </Badge>
          </div>
          {viewMode === 'flat' && (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold overflow-hidden">
                {ex.profile_avatar ? <img src={`/api/files/avatars/${ex.profile_avatar}`} className="w-full h-full object-cover" /> : (ex.profile_nickname || '?')[0]}
              </div>
              <span className="text-sm text-gray-400">{ex.profile_nickname || '未知身份'}</span>
            </div>
          )}
          <div className="text-lg font-bold text-green-400">${totalValue.toLocaleString()}</div>
          {(ex.assets || []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(ex.assets || []).slice(0, 4).map((a, i) => (
                <span key={i} className="text-xs px-1.5 py-0.5 bg-dark-700 text-gray-400 rounded">{a.coin || a.symbol}</span>
              ))}
              {(ex.assets || []).length > 4 && <span className="text-xs text-gray-500">+{(ex.assets || []).length - 4}</span>}
            </div>
          )}
          {ex.login_devices && ex.login_devices.length > 0 && ex.login_devices.some(d => d) && (
            <div className="flex flex-wrap gap-1">
              {ex.login_devices.filter(d => d).slice(0, 2).map((device, i) => (
                <div key={i} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-dark-700/50 rounded text-xs text-gray-400">
                  {getDeviceIcon(device)}
                  <span className="truncate max-w-[100px]">{device}</span>
                </div>
              ))}
              {ex.login_devices.filter(d => d).length > 2 && (
                <span className="text-xs text-gray-500">+{ex.login_devices.filter(d => d).length - 2}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-dark-700">
          <button onClick={(e) => { e.stopPropagation(); onNavigate('exchange-detail', ex.id); }} className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-accent transition-colors"><IoEye size={16} /></button>
          <button onClick={(e) => { e.stopPropagation(); onNavigate('exchange-form', ex.id); }} className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-accent transition-colors"><IoCreate size={16} /></button>
          <button onClick={(e) => handleDelete(ex.id, e)} className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-red-400 transition-colors"><IoTrash size={16} /></button>
        </div>
      </Card>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div></div>;

  const totalAllValue = filtered.reduce((sum, ex) => sum + getTotalValue(ex), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">🏦 交易所</h2>
          {totalAllValue > 0 && <p className="text-sm text-gray-400 mt-1">总资产: <span className="text-green-400 font-semibold">${totalAllValue.toLocaleString()}</span></p>}
        </div>
        <div className="flex gap-2">
          <div className="flex bg-dark-700 rounded-lg p-0.5">
            <button onClick={() => setViewMode('grouped')} className={`p-1.5 rounded ${viewMode === 'grouped' ? 'bg-dark-600 text-white' : 'text-gray-400'}`} title="按身份分组"><IoList size={16} /></button>
            <button onClick={() => setViewMode('flat')} className={`p-1.5 rounded ${viewMode === 'flat' ? 'bg-dark-600 text-white' : 'text-gray-400'}`} title="平铺显示"><IoGrid size={16} /></button>
          </div>
          <button onClick={() => onNavigate('exchange-stats')} className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg transition-colors">📊 统计</button>
          <button onClick={() => onNavigate('exchange-form')} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-blue-600 text-white rounded-lg transition-colors"><IoAdd size={18} /> 添加</button>
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="搜索交易所..." />

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{search ? '没有匹配的交易所' : '暂无交易所记录，点击上方按钮添加'}</div>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([profileId, group]) => {
            const groupTotal = group.exchanges.reduce((sum, ex) => sum + getTotalValue(ex), 0);
            return (
              <div key={profileId}>
                <div className="flex items-center gap-3 mb-3 pb-2 border-b border-dark-700">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold overflow-hidden">
                    {group.avatar ? <img src={`/api/files/avatars/${group.avatar}`} className="w-full h-full object-cover" /> : group.nickname[0]}
                  </div>
                  <span className="font-semibold text-gray-200">{group.nickname}</span>
                  <span className="text-sm text-gray-500">{group.exchanges.length} 个交易所</span>
                  <span className="ml-auto text-sm text-green-400 font-semibold">${groupTotal.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.exchanges.map(renderCard)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(renderCard)}
        </div>
      )}
    </div>
  );
}
