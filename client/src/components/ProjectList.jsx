import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Card from './common/Card';
import Badge from './common/Badge';
import SearchBar from './common/SearchBar';
import toast from 'react-hot-toast';
import { IoAdd, IoTrash, IoCreate, IoEye, IoPeople, IoStar, IoLaptop } from 'react-icons/io5';
import { FaApple, FaWindows, FaAndroid } from 'react-icons/fa';
import { useCardSize, CardSizeControl } from './common/CardSizeControl';
import { useDragSort } from '../hooks/useDragSort';

const getDeviceIcon = (deviceName) => {
  const name = (deviceName || '').toLowerCase();
  if (name.includes('mac') || name.includes('iphone') || name.includes('ipad')) return <FaApple className="text-gray-400" size={12} />;
  if (name.includes('windows')) return <FaWindows className="text-gray-400" size={12} />;
  if (name.includes('android')) return <FaAndroid className="text-gray-400" size={12} />;
  return <IoLaptop className="text-gray-400" size={12} />;
};

const phaseColors = {
  testnet: 'yellow', mainnet: 'green', tge: 'blue', ended: 'gray',
};
const phaseLabels = {
  testnet: '测试网', mainnet: '主网', tge: 'TGE', ended: '已结束',
};
const statusConfig = {
  active: { label: '进行中', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  waiting: { label: '等待中', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  ended: { label: '已结束', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export default function ProjectList({ onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const cardSize = useCardSize('projectCardSize');

  const handleReorder = async (newItems) => {
    const idOrder = newItems.map(p => p.id);
    setProjects(prev => {
      const reordered = [...prev];
      return reordered.sort((a, b) => {
        const ai = idOrder.indexOf(a.id);
        const bi = idOrder.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    });
    const orders = newItems.map((p, i) => ({ id: p.id, sort_order: i }));
    try { await api.updateProjectSort(orders); } catch { toast.error('排序保存失败'); }
  };

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await api.listProjects();
      setProjects(Array.isArray(data) ? data : data.projects || data.data || []);
    } catch (err) { toast.error('加载项目列表失败'); }
    setLoading(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('确定删除此项目？')) return;
    try { await api.deleteProject(id); toast.success('已删除'); loadProjects(); } catch (err) { toast.error(err.message); }
  };

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.type_tags || '').toLowerCase().includes(q) || (p.ecosystem_tags || '').toLowerCase().includes(q) || (p.chain || '').toLowerCase().includes(q);
    const matchPhase = !phaseFilter || p.phase === phaseFilter;
    const matchStatus = !statusFilter || (p.status || 'active') === statusFilter;
    return matchSearch && matchPhase && matchStatus;
  });

  const { getDragProps } = useDragSort(filtered, handleReorder);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-100">📁 项目库</h2>
        <button onClick={() => onNavigate('project-form')} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-blue-600 text-white rounded-lg transition-colors">
          <IoAdd size={18} /> 添加项目
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索项目..." />
        </div>
        <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className="px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-accent/50">
          <option value="">全部阶段</option>
          <option value="testnet">测试网</option>
          <option value="mainnet">主网</option>
          <option value="tge">TGE</option>
          <option value="ended">已结束</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-accent/50">
          <option value="">全部状态</option>
          <option value="active">🟢 进行中</option>
          <option value="waiting">🟡 等待中</option>
          <option value="ended">🔴 已结束</option>
        </select>
        <CardSizeControl cardSize={cardSize} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{search || phaseFilter || statusFilter ? '没有匹配的项目' : '暂无项目，点击上方按钮添加'}</div>
      ) : (
        <div className={`grid ${cardSize.gridClass} gap-4`}>
          {filtered.map((p, idx) => {
            const st = statusConfig[p.status || 'active'] || statusConfig.active;
            const priority = p.priority || 1;
            const dragProps = getDragProps(idx);
            return (
              <div key={p.id} {...dragProps} className={`cursor-grab active:cursor-grabbing ${dragProps.className}`}>
              <Card onClick={() => onNavigate('project-detail', p.id)}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {p.logo && <img src={p.logo} className="w-8 h-8 rounded-lg object-cover" onError={(e) => e.target.style.display='none'} />}
                      <h3 className="font-semibold text-gray-100 text-lg">{p.name || '未命名'}</h3>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1,2,3,4].map(s => <IoStar key={s} size={12} className={s <= priority ? 'text-yellow-400' : 'text-gray-700'} />)}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.phase && <Badge color={phaseColors[p.phase] || 'gray'}>{phaseLabels[p.phase] || p.phase}</Badge>}
                      {p.type_tags && p.type_tags.split(',').slice(0, 2).map((t, i) => <Badge key={i} color="blue">{t.trim()}</Badge>)}
                    </div>
                  </div>
                  {p.chain && (
                    <div className="flex flex-wrap gap-1">
                      {p.chain.split(',').map((c, i) => <span key={i} className="text-xs px-1.5 py-0.5 bg-dark-700 text-gray-400 rounded">{c.trim()}</span>)}
                    </div>
                  )}
                  {p.login_devices && p.login_devices.length > 0 && p.login_devices.some(d => d) && (
                    <div className="flex flex-wrap gap-1">
                      {p.login_devices.filter(d => d).slice(0, 2).map((device, i) => (
                        <div key={i} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-dark-700/50 rounded text-xs text-gray-400">
                          {getDeviceIcon(device)}
                          <span className="truncate max-w-[100px]">{device}</span>
                        </div>
                      ))}
                      {p.login_devices.filter(d => d).length > 2 && (
                        <span className="text-xs text-gray-500">+{p.login_devices.filter(d => d).length - 2}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <IoPeople size={14} />
                    <span>{p.profile_count || 0} 个身份</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-dark-700">
                  <button onClick={(e) => { e.stopPropagation(); onNavigate('project-detail', p.id); }} className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-accent transition-colors"><IoEye size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); onNavigate('project-form', p.id); }} className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-accent transition-colors"><IoCreate size={16} /></button>
                  <button onClick={(e) => handleDelete(p.id, e)} className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-red-400 transition-colors"><IoTrash size={16} /></button>
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
