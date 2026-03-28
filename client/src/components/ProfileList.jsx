import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Card from './common/Card';
import Badge from './common/Badge';
import SearchBar from './common/SearchBar';
import toast from 'react-hot-toast';
import { IoAdd, IoTrash, IoCreate, IoEye, IoLogoDiscord, IoLogoTwitter, IoLaptop, IoPhonePortrait } from 'react-icons/io5';
import { FaTelegram, FaApple, FaWindows, FaAndroid } from 'react-icons/fa';
import { useCardSize, CardSizeControl } from './common/CardSizeControl';
import { useDragSort } from '../hooks/useDragSort';

const getDeviceIcon = (deviceName) => {
  const name = (deviceName || '').toLowerCase();
  if (name.includes('mac') || name.includes('iphone') || name.includes('ipad')) return <FaApple className="text-gray-400" size={12} />;
  if (name.includes('windows')) return <FaWindows className="text-gray-400" size={12} />;
  if (name.includes('android')) return <FaAndroid className="text-gray-400" size={12} />;
  return <IoLaptop className="text-gray-400" size={12} />;
};

export default function ProfileList({ onNavigate }) {
  const [profiles, setProfiles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const cardSize = useCardSize('profileCardSize');

  const handleReorder = async (newItems) => {
    setProfiles(newItems);
    const orders = newItems.map((p, i) => ({ id: p.id || p._id, sort_order: i }));
    try { await api.updateProfileSort(orders); } catch { toast.error('排序保存失败'); }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await api.listProfiles();
      setProfiles(Array.isArray(data) ? data : data.profiles || data.data || []);
    } catch (err) {
      toast.error('加载身份列表失败');
    }
    setLoading(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('确定删除此身份？')) return;
    try {
      await api.deleteProfile(id);
      toast.success('已删除');
      loadProfiles();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase();
    return !q || 
      (p.nickname || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q);
  });

  const { getDragProps } = useDragSort(filtered, handleReorder);

  const getKYCBadge = (p) => {
    const kyc = p.kyc_status || p.kycStatus;
    if (kyc === 'verified' || kyc === '已验证') return <Badge color="green">已KYC</Badge>;
    if (kyc === 'pending' || kyc === '待验证') return <Badge color="yellow">待KYC</Badge>;
    return <Badge color="gray">未KYC</Badge>;
  };

  const getCompleteness = (p) => {
    let score = 0;
    let total = 5;
    if (p.nickname || p.name) score++;
    if (p.email) score++;
    if (p.social_accounts || p.socialAccounts || p.discord || p.twitter || p.telegram) score++;
    if (p.wallets || p.wallet_addresses) score++;
    if (p.kyc_status || p.kycStatus) score++;
    return Math.round((score / total) * 100);
  };

  const getSocialIcons = (p) => {
    const socials = p.social_accounts || p.socialAccounts || { discord: p.discord, twitter: p.twitter, telegram: p.telegram };
    const icons = [];
    if (socials.discord) icons.push(<IoLogoDiscord key="d" className="text-indigo-400" size={14} />);
    if (socials.twitter || socials.x) icons.push(<IoLogoTwitter key="t" className="text-blue-400" size={14} />);
    if (socials.telegram) icons.push(<FaTelegram key="tg" className="text-blue-300" size={14} />);
    return icons;
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-100">👤 身份管理</h2>
        <button
          onClick={() => onNavigate('profile-form')}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          <IoAdd size={18} />
          添加身份
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索身份..." />
        </div>
        <CardSizeControl cardSize={cardSize} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {search ? '没有匹配的身份' : '暂无身份，点击上方按钮添加'}
        </div>
      ) : (
        <div className={`grid ${cardSize.gridClass} gap-4`}>
          {filtered.map((p, idx) => {
            const completeness = getCompleteness(p);
            const dragProps = getDragProps(idx);
            return (
              <div key={p._id || p.id} {...dragProps} className={`cursor-grab active:cursor-grabbing ${dragProps.className}`}>
              <Card onClick={() => onNavigate('profile-detail', p._id || p.id)}>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent text-lg font-bold flex-shrink-0 overflow-hidden">
                    {p.avatar 
                      ? <img src={`/api/files/avatars/${p.avatar}`} className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.parentElement.textContent = (p.nickname || p.name || '?')[0].toUpperCase(); }} />
                      : (p.nickname || p.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-100 truncate">{p.nickname || p.name || '未命名'}</h3>
                      <div className="flex gap-1">{getSocialIcons(p)}</div>
                    </div>
                    {p.email && <p className="text-xs text-gray-400 truncate">{p.email}</p>}
                    {/* Show devices */}
                    {p.login_devices && p.login_devices.length > 0 && p.login_devices.some(d => d) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.login_devices.filter(d => d).slice(0, 2).map((device, i) => (
                          <div key={i} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-dark-700/50 rounded text-xs text-gray-400">
                            {getDeviceIcon(device)}
                            <span className="truncate max-w-[80px]">{device}</span>
                          </div>
                        ))}
                        {p.login_devices.filter(d => d).length > 2 && (
                          <span className="text-xs text-gray-500">+{p.login_devices.filter(d => d).length - 2}</span>
                        )}
                      </div>
                    )}
                    {/* Show counts */}
                    {(p.registration_count > 0 || p.exchange_count > 0) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.registration_count > 0 && `${p.registration_count}个项目`}
                        {p.registration_count > 0 && p.exchange_count > 0 && ' · '}
                        {p.exchange_count > 0 && `${p.exchange_count}个交易所`}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {getKYCBadge(p)}
                    </div>
                    {/* Completeness bar */}
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>完整度</span>
                        <span>{completeness}%</span>
                      </div>
                      <div className="w-full bg-dark-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${completeness >= 80 ? 'bg-green-500' : completeness >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${completeness}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-dark-700">
                  <button onClick={(e) => { e.stopPropagation(); onNavigate('profile-detail', p._id || p.id); }} className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-accent transition-colors">
                    <IoEye size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onNavigate('profile-form', p._id || p.id); }} className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-accent transition-colors">
                    <IoCreate size={16} />
                  </button>
                  <button onClick={(e) => handleDelete(p._id || p.id, e)} className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-red-400 transition-colors">
                    <IoTrash size={16} />
                  </button>
                </div>
              </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
