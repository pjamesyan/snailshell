import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { IoArrowBack, IoPerson, IoFolder, IoSwapHorizontal } from 'react-icons/io5';

function StatCard({ label, value, color = 'text-gray-100', sub }) {
  return (
    <div className="bg-dark-700/50 rounded-xl p-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function BarChart({ data, colorClass = 'bg-accent' }) {
  const max = Math.max(...Object.values(data), 1);
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([label, count]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-sm text-gray-400 w-24 truncate text-right">{label}</span>
          <div className="flex-1 bg-dark-700 rounded-full h-5 overflow-hidden">
            <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="text-sm text-gray-300 w-8">{count}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsPage({ onNavigate }) {
  const [tab, setTab] = useState('profiles');
  const [profileStats, setProfileStats] = useState(null);
  const [projectStats, setProjectStats] = useState(null);
  const [exchangeStats, setExchangeStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [ps, pjs, es] = await Promise.all([
        api.getProfileStats().catch(() => null),
        api.getProjectStats().catch(() => null),
        api.getExchangeStats().catch(() => null),
      ]);
      setProfileStats(ps);
      setProjectStats(pjs);
      setExchangeStats(es);
    } catch { toast.error('加载统计失败'); }
    setLoading(false);
  };

  const tabs = [
    { key: 'profiles', label: '身份统计', icon: <IoPerson size={16} /> },
    { key: 'projects', label: '项目统计', icon: <IoFolder size={16} /> },
    { key: 'exchanges', label: '交易所统计', icon: <IoSwapHorizontal size={16} /> },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div></div>;

  const kycLabels = { none: '未KYC', pending: '待验证', verified: '已验证' };
  const phaseLabels = { testnet: '测试网', mainnet: '主网', tge: 'TGE', ended: '已结束' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors"><IoArrowBack size={20} /></button>
        <h2 className="text-2xl font-bold text-gray-100">📊 数据统计</h2>
      </div>

      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${tab === t.key ? 'bg-accent text-white' : 'bg-dark-700 text-gray-400 hover:text-gray-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'profiles' && profileStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="总身份数" value={profileStats.total} color="text-blue-400" />
            <StatCard label="平均完整度" value={`${profileStats.avgCompleteness}%`} color={profileStats.avgCompleteness >= 80 ? 'text-green-400' : 'text-yellow-400'} />
            <StatCard label="已KYC" value={profileStats.kycDistribution?.verified || 0} color="text-green-400" />
            <StatCard label="未KYC" value={profileStats.kycDistribution?.none || 0} color="text-gray-400" />
          </div>
          {profileStats.kycDistribution && (
            <div className="bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">KYC 分布</h3>
              <BarChart data={Object.fromEntries(Object.entries(profileStats.kycDistribution).map(([k, v]) => [kycLabels[k] || k, v]))} colorClass="bg-green-500" />
            </div>
          )}
          {profileStats.tagCounts && Object.keys(profileStats.tagCounts).length > 0 && (
            <div className="bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">标签分布</h3>
              <BarChart data={profileStats.tagCounts} colorClass="bg-blue-500" />
            </div>
          )}
        </div>
      )}

      {tab === 'projects' && projectStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="总项目数" value={projectStats.total} color="text-green-400" />
            <StatCard label="平均身份数" value={projectStats.avgProfilesPerProject} />
            <StatCard label="测试网" value={projectStats.phaseDistribution?.testnet || 0} color="text-yellow-400" />
            <StatCard label="主网" value={projectStats.phaseDistribution?.mainnet || 0} color="text-green-400" />
          </div>
          {projectStats.phaseDistribution && (
            <div className="bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">阶段分布</h3>
              <BarChart data={Object.fromEntries(Object.entries(projectStats.phaseDistribution).map(([k, v]) => [phaseLabels[k] || k, v]))} colorClass="bg-yellow-500" />
            </div>
          )}
          {projectStats.typeCounts && Object.keys(projectStats.typeCounts).length > 0 && (
            <div className="bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">类型分布</h3>
              <BarChart data={projectStats.typeCounts} colorClass="bg-purple-500" />
            </div>
          )}
          {projectStats.ecosystemCounts && Object.keys(projectStats.ecosystemCounts).length > 0 && (
            <div className="bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">生态分布</h3>
              <BarChart data={projectStats.ecosystemCounts} colorClass="bg-green-500" />
            </div>
          )}
        </div>
      )}

      {tab === 'exchanges' && exchangeStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="总交易所数" value={exchangeStats.total || 0} color="text-yellow-400" />
            <StatCard label="总资产" value={`$${(exchangeStats.totalValue || 0).toLocaleString()}`} color="text-green-400" />
            <StatCard label="已KYC" value={exchangeStats.kycVerified || 0} color="text-green-400" />
            <StatCard label="交易所种类" value={exchangeStats.uniqueExchanges || 0} />
          </div>
          {exchangeStats.exchangeDistribution && Object.keys(exchangeStats.exchangeDistribution).length > 0 && (
            <div className="bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">交易所分布</h3>
              <BarChart data={exchangeStats.exchangeDistribution} colorClass="bg-orange-500" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
