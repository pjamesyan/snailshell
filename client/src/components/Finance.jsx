import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Card from './common/Card';
import Badge from './common/Badge';
import toast from 'react-hot-toast';
import { IoTrendingUp, IoTrendingDown, IoSwapHorizontal } from 'react-icons/io5';

export default function Finance() {
  const [data, setData] = useState({ byProject: [], byProfile: [], totals: { investment: 0, revenue: 0 } });
  const [view, setView] = useState('project'); // 'project' | 'profile'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profiles, projects] = await Promise.all([
        api.listProfiles().then(d => Array.isArray(d) ? d : d.profiles || d.data || []),
        api.listProjects().then(d => Array.isArray(d) ? d : d.projects || d.data || []),
      ]);

      // Load all registrations
      const allRegs = [];
      for (const profile of profiles) {
        try {
          const regs = await api.getByProfile(profile._id || profile.id);
          const regList = Array.isArray(regs) ? regs : regs.registrations || regs.data || [];
          regList.forEach(r => {
            allRegs.push({
              ...r,
              profileName: profile.nickname || profile.name,
              profileId: profile._id || profile.id,
            });
          });
        } catch {}
      }

      // Aggregate by project
      const projectMap = {};
      const profileMap = {};
      let totalInvestment = 0;
      let totalRevenue = 0;

      allRegs.forEach(reg => {
        const inv = Number(reg.investment || reg.cost || 0);
        const rev = Number(reg.revenue || reg.earnings || 0);
        totalInvestment += inv;
        totalRevenue += rev;

        const projName = reg.projectName || reg.project_name || reg.project?.name || '未知项目';
        const projId = reg.projectId || reg.project_id || reg.project?._id || 'unknown';
        if (!projectMap[projId]) projectMap[projId] = { name: projName, investment: 0, revenue: 0, count: 0 };
        projectMap[projId].investment += inv;
        projectMap[projId].revenue += rev;
        projectMap[projId].count++;

        const profName = reg.profileName || '未知身份';
        const profId = reg.profileId || 'unknown';
        if (!profileMap[profId]) profileMap[profId] = { name: profName, investment: 0, revenue: 0, count: 0 };
        profileMap[profId].investment += inv;
        profileMap[profId].revenue += rev;
        profileMap[profId].count++;
      });

      setData({
        byProject: Object.values(projectMap).sort((a, b) => (b.revenue - b.investment) - (a.revenue - a.investment)),
        byProfile: Object.values(profileMap).sort((a, b) => (b.revenue - b.investment) - (a.revenue - a.investment)),
        totals: { investment: totalInvestment, revenue: totalRevenue },
      });
    } catch (err) {
      toast.error('加载财务数据失败');
    }
    setLoading(false);
  };

  const roi = data.totals.investment > 0
    ? ((data.totals.revenue - data.totals.investment) / data.totals.investment * 100).toFixed(1)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  const currentData = view === 'project' ? data.byProject : data.byProfile;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">💰 投入收益</h2>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-500/10">
              <IoTrendingDown className="text-red-400" size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-400">总投入</p>
              <p className="text-xl font-bold text-red-400">${data.totals.investment.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-500/10">
              <IoTrendingUp className="text-green-400" size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-400">总收益</p>
              <p className="text-xl font-bold text-green-400">${data.totals.revenue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10">
              <IoSwapHorizontal className="text-blue-400" size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-400">总 ROI</p>
              <p className={`text-xl font-bold ${Number(roi) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {roi}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('project')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'project' ? 'bg-accent text-white' : 'bg-dark-700 text-gray-400 hover:text-gray-200'
          }`}
        >
          按项目
        </button>
        <button
          onClick={() => setView('profile')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'profile' ? 'bg-accent text-white' : 'bg-dark-700 text-gray-400 hover:text-gray-200'
          }`}
        >
          按身份
        </button>
      </div>

      {/* Data Table */}
      {currentData.length === 0 ? (
        <div className="text-center py-12 text-gray-500">暂无数据</div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">{view === 'project' ? '项目' : '身份'}</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">注册数</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">投入</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">收益</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">净利润</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">ROI</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((item, i) => {
                  const profit = item.revenue - item.investment;
                  const itemRoi = item.investment > 0 ? ((profit / item.investment) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={i} className="border-b border-dark-700/50">
                      <td className="py-2 px-3 text-gray-200 font-medium">{item.name}</td>
                      <td className="py-2 px-3 text-right text-gray-300">{item.count}</td>
                      <td className="py-2 px-3 text-right text-red-400">${item.investment.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-green-400">${item.revenue.toLocaleString()}</td>
                      <td className={`py-2 px-3 text-right ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${profit.toLocaleString()}
                      </td>
                      <td className={`py-2 px-3 text-right ${Number(itemRoi) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {itemRoi}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
