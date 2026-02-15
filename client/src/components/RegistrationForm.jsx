import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Collapsible from './common/Collapsible';
import ImageViewer from './ImageViewer';
import toast from 'react-hot-toast';
import { IoArrowBack, IoDocument, IoCloudUpload, IoTrash } from 'react-icons/io5';

export default function RegistrationForm({ registrationId, onNavigate, initialData = {} }) {
  const [form, setForm] = useState({
    profileId: initialData.profileId || '',
    projectId: initialData.projectId || '',
    password_hint: '',
    status: 'active',
    investment: '',
    revenue: '',
    referrer: '',
    screenshots: [],
    notes: '',
  });
  const [profiles, setProfiles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOptions();
    if (registrationId) loadRegistration();
  }, [registrationId]);

  const loadOptions = async () => {
    try {
      const [pData, prData] = await Promise.all([
        api.listProfiles(),
        api.listProjects(),
      ]);
      setProfiles(Array.isArray(pData) ? pData : pData.profiles || pData.data || []);
      setProjects(Array.isArray(prData) ? prData : prData.projects || prData.data || []);
    } catch {}
  };

  const loadRegistration = async () => {
    setLoading(true);
    try {
      // Try to get registration data - it might be embedded in profile or project data
      const regs = await api.getByProfile(initialData.profileId || 'none').catch(() => []);
      const allRegs = Array.isArray(regs) ? regs : regs.registrations || regs.data || [];
      const reg = allRegs.find(r => (r._id || r.id) === registrationId);
      if (reg) {
        setForm({
          profileId: reg.profileId || reg.profile_id || reg.profile?._id || '',
          projectId: reg.projectId || reg.project_id || reg.project?._id || '',
          password_hint: reg.password_hint || reg.passwordHint || '',
          status: reg.status || 'active',
          investment: reg.investment || reg.cost || '',
          revenue: reg.revenue || reg.earnings || '',
          referrer: reg.referrer || '',
          screenshots: reg.screenshots || [],
          notes: reg.notes || '',
        });
      }
    } catch {}
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.profileId || !form.projectId) {
      toast.error('请选择身份和项目');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        profile_id: form.profileId,
        project_id: form.projectId,
        password_hint: form.password_hint,
        status: form.status,
        investment: form.investment ? String(form.investment) : '0',
        investment_currency: 'USDT',
        earnings: form.revenue ? String(form.revenue) : '0',
        earnings_currency: 'USDT',
        referrer_profile_id: form.referrer || null,
        screenshots: form.screenshots,
        notes: form.notes,
      };
      if (registrationId) {
        await api.updateRegistration(registrationId, payload);
        toast.success('注册记录已更新');
      } else {
        await api.createRegistration(payload);
        toast.success('注册记录已创建');
      }
      // Navigate back
      if (initialData.profileId) {
        onNavigate('profile-detail', initialData.profileId);
      } else if (initialData.projectId) {
        onNavigate('project-detail', initialData.projectId);
      } else {
        onNavigate('profiles');
      }
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const handleScreenshotUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await api.uploadFile(file);
      const filename = result.file?.filename || result.filename || result.name;
      setForm(f => ({ ...f, screenshots: [...f.screenshots, filename] }));
      toast.success('截图已上传');
    } catch {
      toast.error('上传失败');
    }
  };

  const removeScreenshot = (index) => {
    setForm(f => ({
      ...f,
      screenshots: f.screenshots.filter((_, i) => i !== index),
    }));
  };

  const inputClass = "w-full px-3 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent/50 text-sm";
  const labelClass = "block text-sm text-gray-400 mb-1";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('profiles')} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors">
          <IoArrowBack size={20} />
        </button>
        <h2 className="text-2xl font-bold text-gray-100">
          {registrationId ? '编辑注册记录' : '添加注册记录'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Collapsible title="基本信息" defaultOpen={true} icon={<IoDocument size={16} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>选择身份 *</label>
              <select value={form.profileId} onChange={(e) => setForm(f => ({ ...f, profileId: e.target.value }))} className={inputClass}>
                <option value="">请选择身份</option>
                {profiles.map(p => (
                  <option key={p._id || p.id} value={p._id || p.id}>{p.nickname || p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>选择项目 *</label>
              <select value={form.projectId} onChange={(e) => setForm(f => ({ ...f, projectId: e.target.value }))} className={inputClass}>
                <option value="">请选择项目</option>
                {projects.map(p => (
                  <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>状态</label>
              <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                <option value="active">进行中</option>
                <option value="completed">已完成</option>
                <option value="pending">待处理</option>
                <option value="failed">失败</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>推荐人（此项目中）</label>
              <select value={form.referrer} onChange={(e) => setForm(f => ({ ...f, referrer: e.target.value }))} className={inputClass}>
                <option value="">无</option>
                {profiles.filter(p => (p._id || p.id) !== form.profileId).map(p => (
                  <option key={p._id || p.id} value={p._id || p.id}>{p.nickname || p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>密码提示词</label>
              <input type="text" value={form.password_hint} onChange={(e) => setForm(f => ({ ...f, password_hint: e.target.value }))} className={inputClass} placeholder="密码提示..." />
            </div>
            <div>
              <label className={labelClass}>投入金额 (USD)</label>
              <input type="number" value={form.investment} onChange={(e) => setForm(f => ({ ...f, investment: e.target.value }))} className={inputClass} placeholder="0" step="0.01" />
            </div>
            <div>
              <label className={labelClass}>收益金额 (USD)</label>
              <input type="number" value={form.revenue} onChange={(e) => setForm(f => ({ ...f, revenue: e.target.value }))} className={inputClass} placeholder="0" step="0.01" />
            </div>
          </div>
        </Collapsible>

        <Collapsible title="截图" icon={<IoCloudUpload size={16} />}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {form.screenshots.map((file, i) => (
                <div key={i} className="relative group">
                  <ImageViewer src={api.getFileUrl(file)} alt="截图" thumbnailSize="w-24 h-24" />
                  <button
                    type="button"
                    onClick={() => removeScreenshot(i)}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <IoTrash size={10} />
                  </button>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 px-3 py-2 bg-dark-700 border border-dashed border-dark-700 rounded-lg cursor-pointer hover:border-accent/50 transition-colors">
              <IoCloudUpload className="text-gray-400" />
              <span className="text-sm text-gray-400">上传截图</span>
              <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleScreenshotUpload} />
            </label>
          </div>
        </Collapsible>

        <Collapsible title="备注" icon={<IoDocument size={16} />}>
          <textarea
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            className={`${inputClass} h-24 resize-y`}
            placeholder="备注..."
          />
        </Collapsible>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-accent hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? '保存中...' : registrationId ? '更新' : '创建'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('profiles')}
            className="px-6 py-2.5 bg-dark-700 hover:bg-dark-700/80 text-gray-300 rounded-lg transition-colors"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
