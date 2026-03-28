import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Card from './common/Card';
import Badge from './common/Badge';
import { IoPeople, IoFolder, IoBusinessOutline, IoTrendingUp, IoTrendingDown, IoTime, IoAlert } from 'react-icons/io5';

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ov, up, re] = await Promise.all([
        api.getDashboard().catch(() => null),
        api.getUpcoming().catch(() => []),
        api.getRecent().catch(() => []),
      ]);
      setOverview(ov);
      setUpcoming(Array.isArray(up) ? up : up?.upcoming || up?.items || []);
      setRecent(Array.isArray(re) ? re : re?.recent || re?.items || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
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

  const stats = [
    { label: '总身份数', value: overview?.totalProfiles || overview?.profiles || 0, icon: IoPeople, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: '总项目数', value: overview?.totalProjects || overview?.projects || 0, icon: IoFolder, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: '总交易所', value: overview?.totalExchanges || overview?.exchanges || 0, icon: IoBusinessOutline, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: '总投入', value: `$${(overview?.totalInvestment || overview?.totalCost || 0).toLocaleString()}`, icon: IoTrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: '总收益', value: `$${(overview?.totalRevenue || overview?.totalEarnings || 0).toLocaleString()}`, icon: IoTrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: '交易所总值', value: `$${(overview?.totalExchangeValue || 0).toLocaleString()}`, icon: IoBusinessOutline, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">📊 仪表盘</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                <stat.icon className={stat.color} size={22} />
              </div>
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-xl font-bold text-gray-100">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <IoTime className="text-yellow-400" size={20} />
            <h3 className="text-lg font-semibold text-gray-100">即将到来</h3>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无即将到来的事件</p>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 8).map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-dark-700/30">
                  <div>
                    <p className="text-sm text-gray-200">{item.projectName || item.project_name || item.name || item.label || '未命名'}</p>
                    <p className="text-xs text-gray-400">{item.label || item.event || ''}</p>
                  </div>
                  <Badge color="yellow">
                    {item.date ? new Date(item.date).toLocaleDateString('zh-CN') : '未知'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <IoAlert className="text-accent" size={20} />
            <h3 className="text-lg font-semibold text-gray-100">最近活动</h3>
          </div>
          {recent.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无最近活动</p>
          ) : (
            <div className="space-y-3">
              {recent.slice(0, 8).map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-dark-700/30">
                  <div>
                    <p className="text-sm text-gray-200">{item.description || item.action || item.name || '活动'}</p>
                    <p className="text-xs text-gray-400">{item.type || ''}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {item.createdAt || item.created_at || item.date
                      ? new Date(item.createdAt || item.created_at || item.date).toLocaleDateString('zh-CN')
                      : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Low completeness profiles */}
      {overview?.lowCompleteness && overview.lowCompleteness.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <IoAlert className="text-yellow-400" size={20} />
            <h3 className="text-lg font-semibold text-gray-100">低完整度身份</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview.lowCompleteness.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-dark-700/30">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold overflow-hidden">
                  {p.avatar
                    ? <img src={`/api/files/avatars/${p.avatar}`} className="w-full h-full object-cover" />
                    : (p.nickname || p.name || '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{p.nickname || p.name}</p>
                  <div className="w-full bg-dark-700 rounded-full h-1.5 mt-1">
                    <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: `${p.completeness || 0}%` }} />
                  </div>
                </div>
                <span className="text-xs text-gray-400">{p.completeness || 0}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
