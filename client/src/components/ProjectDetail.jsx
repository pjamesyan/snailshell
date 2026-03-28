import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Card from './common/Card';
import Badge from './common/Badge';
import toast from 'react-hot-toast';
import { IoArrowBack, IoCreate, IoTrash, IoAdd, IoPeople, IoCalendar, IoLink, IoGlobe } from 'react-icons/io5';

const phaseColors = { '测试网': 'yellow', 'testnet': 'yellow', '主网': 'green', 'mainnet': 'green', 'TGE': 'blue', 'tge': 'blue', '已结束': 'gray', 'ended': 'gray' };

export default function ProjectDetail({ projectId, onNavigate }) {
  const [project, setProject] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pData, regData] = await Promise.all([
        api.getProject(projectId),
        api.getByProject(projectId).catch(() => []),
      ]);
      setProject(pData.project || pData);
      setRegistrations(Array.isArray(regData) ? regData : regData.registrations || regData.data || []);
    } catch (err) {
      toast.error('加载项目详情失败');
    }
    setLoading(false);
  };

  const handleDeleteReg = async (regId) => {
    if (!confirm('确定删除此注册记录？')) return;
    try {
      await api.deleteRegistration(regId);
      toast.success('已删除');
      loadData();
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

  if (!project) {
    return <div className="text-center py-12 text-gray-500">项目不存在</div>;
  }

  const dates = project.important_dates || project.importantDates || [];
  const tags = project.tags || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('projects')} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors">
            <IoArrowBack size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-100">{project.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              {(project.phase || project.stage) && (
                <Badge color={phaseColors[project.phase || project.stage] || 'gray'}>{project.phase || project.stage}</Badge>
              )}
              {project.type && <Badge color="blue">{project.type}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate('registration-form', { projectId })} className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors">
            <IoAdd size={16} /> 关联身份
          </button>
          <button onClick={() => onNavigate('project-form', projectId)} className="flex items-center gap-1 px-3 py-2 bg-accent hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
            <IoCreate size={16} /> 编辑
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-3">项目信息</h3>
          <div className="space-y-2">
            {project.description && <p className="text-sm text-gray-300">{project.description}</p>}
            {project.website && (
              <a href={project.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-accent hover:underline">
                <IoGlobe size={14} /> {project.website}
              </a>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag, i) => (
                  <Badge key={i} color="purple">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Important Dates */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
            <IoCalendar className="text-accent" /> 重要日期
          </h3>
          {dates.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无重要日期</p>
          ) : (
            <div className="space-y-2">
              {dates.map((d, i) => {
                const dateObj = d.date ? new Date(d.date) : null;
                const isPast = dateObj && dateObj < new Date();
                const isNear = dateObj && !isPast && (dateObj - new Date()) < 7 * 24 * 60 * 60 * 1000;
                return (
                  <div key={i} className="flex items-center justify-between p-2 bg-dark-700/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${isPast ? 'text-red-400' : isNear ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {d.label || '未命名'}
                      </span>
                      {d.remind && <Badge color="yellow">提醒</Badge>}
                    </div>
                    <span className={`text-xs ${isPast ? 'text-red-400' : isNear ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {dateObj ? dateObj.toLocaleDateString('zh-CN') : '未设置'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Notes */}
        {project.notes && (
          <Card className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-100 mb-3">备注</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{project.notes}</p>
          </Card>
        )}
      </div>

      {/* Registrations */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <IoPeople className="text-accent" /> 关联身份 ({registrations.length})
          </h3>
        </div>
        {registrations.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无关联身份</p>
        ) : (
          <>
            <div className="space-y-2">
              {registrations.map(reg => (
                <div key={reg._id || reg.id} className="flex items-center justify-between p-3 bg-dark-700/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold overflow-hidden">
                      {(reg.profile_avatar || reg.avatar)
                        ? <img src={`/api/files/avatars/${reg.profile_avatar || reg.avatar}`} className="w-full h-full object-cover" />
                        : (reg.profileName || reg.profile_name || reg.profile?.nickname || '?')[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{reg.profileName || reg.profile_name || reg.profile?.nickname || reg.nickname || '未知身份'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {reg.status && <Badge color={reg.status === 'active' ? 'green' : 'gray'}>{reg.status}</Badge>}
                        {reg.username && <span className="text-xs text-gray-400">用户名: {reg.username}</span>}
                        {(reg.investment || reg.cost) && <span className="text-xs text-gray-400">投入: ${reg.investment || reg.cost}</span>}
                      </div>
                      {reg.password_hint && <div className="text-xs text-yellow-500/70 mt-0.5">🔑 {reg.password_hint}</div>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => onNavigate('registration-form', reg._id || reg.id)} className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-accent transition-colors">
                      <IoCreate size={14} />
                    </button>
                    <button onClick={() => handleDeleteReg(reg._id || reg.id)} className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-red-400 transition-colors">
                      <IoTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* Summary row */}
            <div className="mt-4 pt-4 border-t border-dark-700 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">汇总</span>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">
                  总投入: <span className="text-yellow-400 font-medium">
                    ${registrations.reduce((sum, r) => sum + (parseFloat(r.investment || r.cost) || 0), 0).toFixed(2)}
                  </span>
                </span>
                <span className="text-sm text-gray-400">
                  总收益: <span className="text-green-400 font-medium">
                    ${registrations.reduce((sum, r) => sum + (parseFloat(r.revenue || r.earnings) || 0), 0).toFixed(2)}
                  </span>
                </span>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
