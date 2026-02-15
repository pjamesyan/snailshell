import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Card from './common/Card';
import Badge from './common/Badge';
import toast from 'react-hot-toast';
import { IoNotifications, IoCalendar } from 'react-icons/io5';

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const data = await api.listProjects();
      const projects = Array.isArray(data) ? data : data.projects || data.data || [];
      
      const allReminders = [];
      projects.forEach(project => {
        const dates = project.important_dates || project.importantDates || [];
        dates.forEach(d => {
          if (d.remind) {
            allReminders.push({
              projectName: project.name,
              projectId: project._id || project.id,
              label: d.label,
              date: d.date,
            });
          }
        });
      });

      // Sort by date
      allReminders.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date) - new Date(b.date);
      });

      setReminders(allReminders);
    } catch (err) {
      toast.error('加载提醒失败');
    }
    setLoading(false);
  };

  const getStatus = (dateStr) => {
    if (!dateStr) return { label: '未设置', color: 'gray' };
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { label: `已过期 ${Math.abs(days)} 天`, color: 'red' };
    if (days === 0) return { label: '今天', color: 'red' };
    if (days <= 3) return { label: `${days} 天后`, color: 'yellow' };
    if (days <= 7) return { label: `${days} 天后`, color: 'yellow' };
    return { label: `${days} 天后`, color: 'gray' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-100">🔔 提醒中心</h2>

      {reminders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <IoNotifications size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无提醒</p>
          <p className="text-sm mt-1">在项目的重要日期中开启提醒</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((r, i) => {
            const status = getStatus(r.date);
            return (
              <Card key={i}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      status.color === 'red' ? 'bg-red-500/10' : 
                      status.color === 'yellow' ? 'bg-yellow-500/10' : 'bg-gray-500/10'
                    }`}>
                      <IoCalendar className={
                        status.color === 'red' ? 'text-red-400' : 
                        status.color === 'yellow' ? 'text-yellow-400' : 'text-gray-400'
                      } size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{r.label || '未命名事件'}</p>
                      <p className="text-xs text-gray-400">项目: {r.projectName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      status.color === 'red' ? 'text-red-400' : 
                      status.color === 'yellow' ? 'text-yellow-400' : 'text-gray-400'
                    }`}>
                      {r.date ? new Date(r.date).toLocaleDateString('zh-CN') : '未设置'}
                    </p>
                    <Badge color={status.color}>{status.label}</Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
