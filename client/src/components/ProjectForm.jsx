import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Collapsible from './common/Collapsible';
import toast from 'react-hot-toast';
import { IoFolder, IoPricetag, IoCalendar, IoDocument, IoAdd, IoTrash, IoArrowBack, IoStar, IoStarOutline, IoLink } from 'react-icons/io5';

const CHAIN_OPTIONS = ['ETH', 'Arbitrum', 'Optimism', 'zkSync', 'Base', 'Polygon', 'BSC', 'Solana', 'Sui', 'Aptos', 'Cosmos', 'Avalanche', 'Fantom', 'Near', 'Starknet', 'Scroll', 'Linea', 'Blast', 'Manta', 'Mantle', 'Sei', 'Celestia', 'Monad', 'Berachain'];
const STATUS_OPTIONS = [
  { value: 'active', label: '🟢 进行中', color: 'text-green-400' },
  { value: 'waiting', label: '🟡 等待中', color: 'text-yellow-400' },
  { value: 'ended', label: '🔴 已结束', color: 'text-red-400' },
];

export default function ProjectForm({ projectId, onNavigate }) {
  const [form, setForm] = useState({
    name: '',
    website: '',
    logo: '',
    type_tags: '',
    ecosystem_tags: '',
    phase: 'testnet',
    priority: 1,
    status: 'active',
    chain: '',
    important_dates: [],
    notes: '',
    login_devices: [''],
  });
  const [chainInput, setChainInput] = useState('');
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const data = await api.getProject(projectId);
      const p = data.project || data;
      setForm({
        name: p.name || '',
        website: p.website || '',
        logo: p.logo || '',
        type_tags: p.type_tags || '',
        ecosystem_tags: p.ecosystem_tags || '',
        phase: p.phase || 'testnet',
        priority: p.priority || 1,
        status: p.status || 'active',
        chain: p.chain || '',
        important_dates: (p.important_dates || []).map(d => ({
          label: d.label || '',
          date: d.date ? d.date.split('T')[0] : '',
          remind: d.remind || false,
        })),
        notes: p.notes || '',
        login_devices: p.login_devices || [''],
      });
    } catch (err) {
      toast.error('加载项目失败');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('请填写项目名称'); return; }
    setSaving(true);
    try {
      if (projectId) {
        await api.updateProject(projectId, form);
        toast.success('项目已更新');
      } else {
        await api.createProject(form);
        toast.success('项目已创建');
      }
      onNavigate('projects');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const selectedChains = form.chain ? form.chain.split(',').filter(Boolean) : [];
  const toggleChain = (c) => {
    const chains = selectedChains.includes(c) ? selectedChains.filter(x => x !== c) : [...selectedChains, c];
    setForm(f => ({ ...f, chain: chains.join(',') }));
  };
  const addCustomChain = () => {
    const c = chainInput.trim();
    if (c && !selectedChains.includes(c)) {
      setForm(f => ({ ...f, chain: [...selectedChains, c].join(',') }));
      setChainInput('');
    }
  };

  const addDate = () => setForm(f => ({ ...f, important_dates: [...f.important_dates, { label: '', date: '', remind: false }] }));
  const updateDate = (i, field, value) => setForm(f => { const d = [...f.important_dates]; d[i] = { ...d[i], [field]: value }; return { ...f, important_dates: d }; });
  const removeDate = (i) => setForm(f => ({ ...f, important_dates: f.important_dates.filter((_, idx) => idx !== i) }));

  const addDevice = () => {
    if (form.login_devices.length >= 3) {
      toast.error('最多添加3个设备');
      return;
    }
    setForm(f => ({ ...f, login_devices: [...f.login_devices, ''] }));
  };
  const updateDevice = (index, value) => {
    setForm(f => {
      const login_devices = [...f.login_devices];
      login_devices[index] = value;
      return { ...f, login_devices };
    });
  };
  const removeDevice = (index) => {
    setForm(f => ({ ...f, login_devices: f.login_devices.filter((_, i) => i !== index) }));
  };

  const inputClass = "w-full px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent/50 text-sm";
  const labelClass = "block text-sm text-gray-400 mb-1";

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('projects')} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors">
          <IoArrowBack size={20} />
        </button>
        <h2 className="text-2xl font-bold text-gray-100">{projectId ? '编辑项目' : '添加项目'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Collapsible title="基本信息" defaultOpen={true} icon={<IoFolder size={16} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>项目名称 *</label>
              <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="输入项目名称" />
            </div>
            <div>
              <label className={labelClass}>网站</label>
              <input type="url" value={form.website} onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} className={inputClass} placeholder="https://..." />
            </div>
            <div>
              <label className={labelClass}>Logo URL</label>
              <input type="text" value={form.logo} onChange={(e) => setForm(f => ({ ...f, logo: e.target.value }))} className={inputClass} placeholder="Logo 图片链接" />
            </div>
            <div>
              <label className={labelClass}>阶段</label>
              <div className="flex gap-2">
                <select value={['testnet','mainnet','tge','ended'].includes(form.phase) ? form.phase : '_custom'} onChange={(e) => {
                  if (e.target.value === '_custom') {
                    setForm(f => ({ ...f, phase: '' }));
                  } else {
                    setForm(f => ({ ...f, phase: e.target.value }));
                  }
                }} className={inputClass}>
                  <option value="testnet">测试网</option>
                  <option value="mainnet">主网</option>
                  <option value="tge">TGE</option>
                  <option value="ended">已结束</option>
                  <option value="_custom">自定义...</option>
                </select>
                {!['testnet','mainnet','tge','ended'].includes(form.phase) && (
                  <input type="text" value={form.phase} onChange={(e) => setForm(f => ({ ...f, phase: e.target.value }))}
                    className={inputClass} placeholder="输入自定义阶段" autoFocus />
                )}
              </div>
            </div>
            <div>
              <label className={labelClass}>类型标签</label>
              <input type="text" value={form.type_tags} onChange={(e) => setForm(f => ({ ...f, type_tags: e.target.value }))} className={inputClass} placeholder="L2,空投,DeFi（逗号分隔）" />
            </div>
            <div>
              <label className={labelClass}>生态标签</label>
              <input type="text" value={form.ecosystem_tags} onChange={(e) => setForm(f => ({ ...f, ecosystem_tags: e.target.value }))} className={inputClass} placeholder="Ethereum,Cosmos（逗号分隔）" />
            </div>
          </div>
        </Collapsible>

        {/* Priority & Status */}
        <Collapsible title="优先级与状态" defaultOpen={true} icon={<IoStar size={16} />}>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>重要度（1-4星）</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(star => (
                  <button key={star} type="button" onClick={() => setForm(f => ({ ...f, priority: star }))}
                    className="p-1 transition-colors">
                    {star <= form.priority
                      ? <IoStar size={24} className="text-yellow-400" />
                      : <IoStarOutline size={24} className="text-gray-600 hover:text-yellow-400/50" />}
                  </button>
                ))}
                <span className="ml-2 text-sm text-gray-400 self-center">{form.priority}星</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>状态</label>
              <div className="flex gap-3">
                {STATUS_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(f => ({ ...f, status: opt.value }))}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
                      form.status === opt.value
                        ? 'border-accent bg-accent/20 text-white'
                        : 'border-dark-700 bg-dark-700 text-gray-400 hover:border-gray-600'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Collapsible>

        {/* Chain */}
        <Collapsible title="所属链" icon={<IoLink size={16} />}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {selectedChains.map(c => (
                <span key={c} className="inline-flex items-center gap-1 px-2 py-1 bg-accent/20 text-accent rounded-full text-xs">
                  {c}
                  <button type="button" onClick={() => toggleChain(c)} className="hover:text-red-400">×</button>
                </span>
              ))}
            </div>
            <div className="relative">
              <div className="flex gap-2">
                <input type="text" value={chainInput}
                  onChange={(e) => { setChainInput(e.target.value); setShowChainDropdown(true); }}
                  onFocus={() => setShowChainDropdown(true)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomChain(); } }}
                  className={inputClass} placeholder="搜索或输入链名..." />
                <button type="button" onClick={addCustomChain} className="px-3 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg text-sm">添加</button>
              </div>
              {showChainDropdown && (
                <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-dark-800 border border-dark-700 rounded-lg shadow-lg">
                  {CHAIN_OPTIONS.filter(c => !selectedChains.includes(c) && (!chainInput || c.toLowerCase().includes(chainInput.toLowerCase()))).map(c => (
                    <button key={c} type="button"
                      onClick={() => { toggleChain(c); setChainInput(''); setShowChainDropdown(false); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-dark-700 transition-colors">
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {showChainDropdown && <div className="fixed inset-0 z-0" onClick={() => setShowChainDropdown(false)} />}
          </div>
        </Collapsible>

        {/* Important Dates */}
        <Collapsible title="重要日期" icon={<IoCalendar size={16} />}>
          <div className="space-y-3">
            {form.important_dates.map((d, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className={labelClass}>标签</label>
                  <input type="text" value={d.label} onChange={(e) => updateDate(i, 'label', e.target.value)} className={inputClass} placeholder="如：快照日期" />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>日期</label>
                  <input type="date" value={d.date} onChange={(e) => updateDate(i, 'date', e.target.value)} className={inputClass} />
                </div>
                <label className="flex items-center gap-1 pb-2 cursor-pointer">
                  <input type="checkbox" checked={d.remind} onChange={(e) => updateDate(i, 'remind', e.target.checked)} className="rounded border-dark-700 bg-dark-700 text-accent focus:ring-accent" />
                  <span className="text-xs text-gray-400">提醒</span>
                </label>
                <button type="button" onClick={() => removeDate(i)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg mb-0.5">
                  <IoTrash size={16} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addDate} className="flex items-center gap-1 text-sm text-accent hover:text-blue-400">
              <IoAdd size={16} /> 添加日期
            </button>
          </div>
        </Collapsible>

        {/* Login Devices */}
        <Collapsible title="主要登录设备" icon={<span className="text-sm">📱</span>}>
          <div className="space-y-2">
            {form.login_devices.map((device, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={device}
                  onChange={(e) => updateDevice(i, e.target.value)}
                  className={inputClass}
                  placeholder="设备名称（如 MacBook Pro, iPhone 15）"
                />
                {form.login_devices.length > 1 && (
                  <button type="button" onClick={() => removeDevice(i)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg">
                    <IoTrash size={16} />
                  </button>
                )}
              </div>
            ))}
            {form.login_devices.length < 3 && (
              <button type="button" onClick={addDevice} className="flex items-center gap-1 text-sm text-accent hover:text-blue-400">
                <IoAdd size={16} /> 添加设备（最多3个）
              </button>
            )}
          </div>
        </Collapsible>

        {/* Notes */}
        <Collapsible title="备注" icon={<IoDocument size={16} />}>
          <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className={`${inputClass} h-32 resize-y`} placeholder="备注信息..." />
        </Collapsible>

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-accent hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            {saving ? '保存中...' : projectId ? '更新' : '创建'}
          </button>
          <button type="button" onClick={() => onNavigate('projects')} className="px-6 py-2.5 bg-dark-700 hover:bg-dark-700/80 text-gray-300 rounded-lg transition-colors">取消</button>
        </div>
      </form>
    </div>
  );
}
