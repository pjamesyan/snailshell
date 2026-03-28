import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Collapsible from './common/Collapsible';
import PasswordField from './common/PasswordField';
import ImageViewer from './ImageViewer';
import toast from 'react-hot-toast';
import { IoPerson, IoLogoDiscord, IoLogoTwitter, IoWallet, IoShield, IoDocument, IoAdd, IoTrash, IoArrowBack, IoCloudUpload } from 'react-icons/io5';
import { FaTelegram } from 'react-icons/fa';

const defaultWalletChains = ['BTC', 'ETH', 'SOL', 'BNB', 'Base'];

// Normalize wallets from various formats to [{chain, addresses: [...]}]
function normalizeWallets(wallets) {
  const defaults = defaultWalletChains.map(chain => ({ chain, addresses: ['', ''] }));
  if (!wallets || !Array.isArray(wallets) || wallets.length === 0) return defaults;
  // Already correct format: [{chain, addresses: [...]}]
  if (wallets[0]?.addresses && Array.isArray(wallets[0].addresses)) return wallets;
  // Backend format: [{chain, address}] — single address per entry
  if (wallets[0]?.address !== undefined) {
    const grouped = {};
    for (const w of wallets) {
      if (!grouped[w.chain]) grouped[w.chain] = [];
      if (w.address) grouped[w.chain].push(w.address);
    }
    const result = defaultWalletChains.map(chain => ({
      chain,
      addresses: grouped[chain]?.length ? grouped[chain] : ['', '']
    }));
    // Add any extra chains not in defaults
    for (const [chain, addrs] of Object.entries(grouped)) {
      if (!defaultWalletChains.includes(chain)) {
        result.push({ chain, addresses: addrs });
      }
    }
    return result;
  }
  return defaults;
}

export default function ProfileForm({ profileId, onNavigate }) {
  const [form, setForm] = useState({
    nickname: '',
    real_name: '',
    avatar: '',
    email: '',
    email_password_hint: '',
    email_password: '',
    phone: '',
    phone_password_hint: '',
    phone_password: '',
    social_accounts: {
      discord: '',
      discord_password_hint: '',
      discord_password: '',
      twitter: '',
      twitter_password_hint: '',
      twitter_password: '',
      telegram: '',
      telegram_password_hint: '',
      telegram_password: '',
      custom: [],
    },
    wallet_addresses: defaultWalletChains.map(chain => ({ chain, addresses: ['', ''] })),
    kyc_status: 'none',
    kyc_files: [],
    referrer: '',
    notes: '',
    login_devices: [''],
  });
  const [profiles, setProfiles] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfiles();
    loadAvatars();
    if (profileId) loadProfile();
  }, [profileId]);

  const loadAvatars = async () => {
    try {
      const data = await api.listAvatars();
      setAvatars(Array.isArray(data) ? data : data.avatars || []);
    } catch {}
  };

  const loadProfiles = async () => {
    try {
      const data = await api.listProfiles();
      setProfiles(Array.isArray(data) ? data : data.profiles || data.data || []);
    } catch {}
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getProfile(profileId);
      const p = data.profile || data;
      setForm({
        nickname: p.nickname || p.name || '',
        real_name: p.real_name || '',
        avatar: p.avatar || '',
        email: p.email || '',
        email_password_hint: p.email_password_hint || '',
        email_password: p.email_password || '',
        phone: p.phone || '',
        phone_password_hint: p.phone_password_hint || '',
        phone_password: p.phone_password || '',
        social_accounts: {
          discord: p.social_accounts?.discord || p.socialAccounts?.discord || p.discord || '',
          discord_password_hint: p.social_accounts?.discord_password_hint || p.discord_password_hint || '',
          discord_password: p.social_accounts?.discord_password || p.discord_password || '',
          twitter: p.social_accounts?.twitter || p.socialAccounts?.twitter || p.social_accounts?.x || p.twitter || '',
          twitter_password_hint: p.social_accounts?.twitter_password_hint || p.twitter_password_hint || '',
          twitter_password: p.social_accounts?.twitter_password || p.twitter_password || '',
          telegram: p.social_accounts?.telegram || p.socialAccounts?.telegram || p.telegram || '',
          telegram_password_hint: p.social_accounts?.telegram_password_hint || p.telegram_password_hint || '',
          telegram_password: p.social_accounts?.telegram_password || p.telegram_password || '',
          custom: p.social_accounts?.custom || p.socialAccounts?.custom || p.custom_socials || [],
        },
        wallet_addresses: normalizeWallets(p.wallet_addresses || p.walletAddresses || p.wallets),
        kyc_status: p.kyc_status || p.kycStatus || 'none',
        kyc_files: p.kyc_files || p.kycFiles || [],
        referrer: p.referrer || '',
        notes: p.notes || '',
        login_devices: p.login_devices || [''],
      });
    } catch (err) {
      toast.error('加载身份失败');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nickname.trim()) {
      toast.error('请填写昵称');
      return;
    }
    setSaving(true);
    try {
      // Map frontend form to backend expected fields
      const payload = {
        nickname: form.nickname,
        real_name: form.real_name,
        avatar: form.avatar,
        email: form.email,
        email_password_hint: form.email_password_hint,
        email_password: form.email_password,
        phone: form.phone,
        phone_password_hint: form.phone_password_hint,
        phone_password: form.phone_password,
        discord: form.social_accounts.discord,
        discord_password_hint: form.social_accounts.discord_password_hint,
        discord_password: form.social_accounts.discord_password,
        twitter: form.social_accounts.twitter,
        twitter_password_hint: form.social_accounts.twitter_password_hint,
        twitter_password: form.social_accounts.twitter_password,
        telegram: form.social_accounts.telegram,
        telegram_password_hint: form.social_accounts.telegram_password_hint,
        telegram_password: form.social_accounts.telegram_password,
        custom_socials: (form.social_accounts.custom || []).map(c => ({
          platform: c.platform,
          username: c.username,
          password_hint: c.password_hint || '',
          password: c.password || '',
        })),
        wallets: form.wallet_addresses.flatMap(w => 
          (w.addresses || []).filter(a => a.trim()).map(a => ({ chain: w.chain, address: a }))
        ),
        kyc_status: form.kyc_status,
        kyc_files: form.kyc_files.map(f => typeof f === 'object' ? (f.filename || f.name) : f).filter(Boolean),
        referrer_id: form.referrer || null,
        notes: form.notes,
        login_devices: form.login_devices.filter(d => d.trim()),
      };
      if (profileId) {
        await api.updateProfile(profileId, payload);
        toast.success('身份已更新');
      } else {
        await api.createProfile(payload);
        toast.success('身份已创建');
      }
      onNavigate('profiles');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const updateSocial = (key, value) => {
    setForm(f => ({ ...f, social_accounts: { ...f.social_accounts, [key]: value } }));
  };

  const addCustomSocial = () => {
    setForm(f => ({
      ...f,
      social_accounts: {
        ...f.social_accounts,
        custom: [...(f.social_accounts.custom || []), { platform: '', username: '' }],
      },
    }));
  };

  const updateCustomSocial = (index, field, value) => {
    setForm(f => {
      const custom = [...(f.social_accounts.custom || [])];
      custom[index] = { ...custom[index], [field]: value };
      return { ...f, social_accounts: { ...f.social_accounts, custom } };
    });
  };

  const removeCustomSocial = (index) => {
    setForm(f => {
      const custom = [...(f.social_accounts.custom || [])];
      custom.splice(index, 1);
      return { ...f, social_accounts: { ...f.social_accounts, custom } };
    });
  };

  const updateWalletAddress = (chainIndex, addrIndex, value) => {
    setForm(f => {
      const wallets = [...f.wallet_addresses];
      wallets[chainIndex] = { ...wallets[chainIndex], addresses: [...wallets[chainIndex].addresses] };
      wallets[chainIndex].addresses[addrIndex] = value;
      return { ...f, wallet_addresses: wallets };
    });
  };

  const addWalletAddress = (chainIndex) => {
    setForm(f => {
      const wallets = [...f.wallet_addresses];
      wallets[chainIndex] = { ...wallets[chainIndex], addresses: [...wallets[chainIndex].addresses, ''] };
      return { ...f, wallet_addresses: wallets };
    });
  };

  const addWalletChain = () => {
    setForm(f => ({
      ...f,
      wallet_addresses: [...f.wallet_addresses, { chain: '', addresses: [''] }],
    }));
  };

  const updateWalletChain = (index, chain) => {
    setForm(f => {
      const wallets = [...f.wallet_addresses];
      wallets[index] = { ...wallets[index], chain };
      return { ...f, wallet_addresses: wallets };
    });
  };

  const removeWalletChain = (index) => {
    setForm(f => {
      const wallets = [...f.wallet_addresses];
      wallets.splice(index, 1);
      return { ...f, wallet_addresses: wallets };
    });
  };

  const handleKYCUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await api.uploadFile(file);
      const filename = result.file?.filename || result.filename || result.name;
      setForm(f => ({ ...f, kyc_files: [...f.kyc_files, filename] }));
      toast.success('文件已上传');
    } catch (err) {
      toast.error('上传失败');
    }
  };

  const removeKYCFile = (index) => {
    setForm(f => {
      const files = [...f.kyc_files];
      files.splice(index, 1);
      return { ...f, kyc_files: files };
    });
  };

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
          {profileId ? '编辑身份' : '添加身份'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Avatar + Basic Info */}
        <Collapsible title="基本信息" defaultOpen={true} icon={<IoPerson size={16} />}>
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-dark-700 border-2 border-dark-700 overflow-hidden flex items-center justify-center text-2xl">
                {form.avatar ? <img key={form.avatar} src={`/api/files/avatars/${form.avatar}?t=${Date.now()}`} className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.parentElement.textContent = form.nickname?.[0] || '?'; }} /> : (form.nickname?.[0] || '?')}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAvatarPicker(!showAvatarPicker)} className="text-xs px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg transition-colors">选择头像</button>
                <label className="text-xs px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg transition-colors cursor-pointer">
                  上传头像
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    try { const r = await api.uploadAvatar(file); setForm(f => ({ ...f, avatar: r.filename })); toast.success('头像已上传'); loadAvatars(); } catch { toast.error('上传失败'); }
                  }} />
                </label>
              </div>
            </div>
            {showAvatarPicker && avatars.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-dark-700/50 rounded-lg">
                {avatars.map(a => (
                  <button key={a} type="button" onClick={() => { setForm(f => ({ ...f, avatar: a })); setShowAvatarPicker(false); }}
                    className={`w-12 h-12 rounded-full overflow-hidden border-2 ${form.avatar === a ? 'border-accent' : 'border-transparent'} hover:border-accent/50 transition-colors`}>
                    <img src={`/api/files/avatars/${a}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>昵称 *</label>
                <input type="text" value={form.nickname} onChange={(e) => setForm(f => ({ ...f, nickname: e.target.value }))} className={inputClass} placeholder="输入昵称" />
              </div>
              <div>
                <label className={labelClass}>实名</label>
                <input type="text" value={form.real_name} onChange={(e) => setForm(f => ({ ...f, real_name: e.target.value }))} className={inputClass} placeholder="输入实名（可选）" />
              </div>
              <div>
                <label className={labelClass}>邮箱</label>
                <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} placeholder="输入邮箱" />
                <input type="text" value={form.email_password_hint} onChange={(e) => setForm(f => ({ ...f, email_password_hint: e.target.value }))} className={`${inputClass} mt-1`} placeholder="🔑 邮箱密码提示" />
                <PasswordField value={form.email_password} onChange={(e) => setForm(f => ({ ...f, email_password: e.target.value }))} placeholder="🔒 邮箱密码（可选）" className="mt-1" />
              </div>
              <div>
                <label className={labelClass}>手机号</label>
                <input type="text" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} placeholder="输入手机号" />
                <input type="text" value={form.phone_password_hint} onChange={(e) => setForm(f => ({ ...f, phone_password_hint: e.target.value }))} className={`${inputClass} mt-1`} placeholder="🔑 手机密码提示" />
                <PasswordField value={form.phone_password} onChange={(e) => setForm(f => ({ ...f, phone_password: e.target.value }))} placeholder="🔒 手机密码（可选）" className="mt-1" />
            </div>
            <div>
              <label className={labelClass}>推荐人</label>
              <select value={form.referrer} onChange={(e) => setForm(f => ({ ...f, referrer: e.target.value }))} className={inputClass}>
                <option value="">无</option>
                {profiles.filter(p => (p._id || p.id) !== profileId).map(p => (
                  <option key={p._id || p.id} value={p._id || p.id}>{p.nickname || p.name}</option>
                ))}
              </select>
            </div>
            </div>
          </div>
        </Collapsible>

        {/* Social Accounts */}
        <Collapsible title="社交账号" icon={<IoLogoDiscord size={16} />}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1"><IoLogoDiscord className="text-indigo-400" size={14} /> Discord</span>
                </label>
                <input type="text" value={form.social_accounts.discord} onChange={(e) => updateSocial('discord', e.target.value)} className={inputClass} placeholder="Discord 用户名" />
                <input type="text" value={form.social_accounts.discord_password_hint} onChange={(e) => updateSocial('discord_password_hint', e.target.value)} className={`${inputClass} mt-1`} placeholder="🔑 Discord 密码提示" />
                <PasswordField value={form.social_accounts.discord_password} onChange={(e) => updateSocial('discord_password', e.target.value)} placeholder="🔒 密码（可选）" className="mt-1" />
              </div>
              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1"><IoLogoTwitter className="text-blue-400" size={14} /> X (Twitter)</span>
                </label>
                <input type="text" value={form.social_accounts.twitter} onChange={(e) => updateSocial('twitter', e.target.value)} className={inputClass} placeholder="@username" />
                <input type="text" value={form.social_accounts.twitter_password_hint} onChange={(e) => updateSocial('twitter_password_hint', e.target.value)} className={`${inputClass} mt-1`} placeholder="🔑 X 密码提示" />
                <PasswordField value={form.social_accounts.twitter_password} onChange={(e) => updateSocial('twitter_password', e.target.value)} placeholder="🔒 密码（可选）" className="mt-1" />
              </div>
              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1"><FaTelegram className="text-blue-300" size={14} /> Telegram</span>
                </label>
                <input type="text" value={form.social_accounts.telegram} onChange={(e) => updateSocial('telegram', e.target.value)} className={inputClass} placeholder="@username" />
                <input type="text" value={form.social_accounts.telegram_password_hint} onChange={(e) => updateSocial('telegram_password_hint', e.target.value)} className={`${inputClass} mt-1`} placeholder="🔑 Telegram 密码提示" />
                <PasswordField value={form.social_accounts.telegram_password} onChange={(e) => updateSocial('telegram_password', e.target.value)} placeholder="🔒 密码（可选）" className="mt-1" />
              </div>
            </div>

            {/* Custom socials */}
            {(form.social_accounts.custom || []).map((c, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className={labelClass}>平台名称</label>
                  <input type="text" value={c.platform} onChange={(e) => updateCustomSocial(i, 'platform', e.target.value)} className={inputClass} placeholder="平台名称" />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>用户名</label>
                  <input type="text" value={c.username} onChange={(e) => updateCustomSocial(i, 'username', e.target.value)} className={inputClass} placeholder="用户名" />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>密码提示</label>
                  <input type="text" value={c.password_hint || ''} onChange={(e) => updateCustomSocial(i, 'password_hint', e.target.value)} className={inputClass} placeholder="🔑 密码提示" />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>密码</label>
                  <PasswordField value={c.password || ''} onChange={(e) => updateCustomSocial(i, 'password', e.target.value)} placeholder="🔒 密码" />
                </div>
                <button type="button" onClick={() => removeCustomSocial(i)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg">
                  <IoTrash size={16} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addCustomSocial} className="flex items-center gap-1 text-sm text-accent hover:text-blue-400">
              <IoAdd size={16} /> 添加自定义平台
            </button>
          </div>
        </Collapsible>

        {/* Wallet Addresses */}
        <Collapsible title="钱包地址" icon={<IoWallet size={16} />}>
          <div className="space-y-4">
            {form.wallet_addresses.map((w, ci) => (
              <div key={ci} className="bg-dark-700/30 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  {defaultWalletChains.includes(w.chain) ? (
                    <span className="text-sm font-medium text-gray-200">{w.chain}</span>
                  ) : (
                    <input
                      type="text"
                      value={w.chain}
                      onChange={(e) => updateWalletChain(ci, e.target.value)}
                      className="px-2 py-1 bg-dark-700 border border-dark-700 rounded text-sm text-gray-200 focus:outline-none focus:border-accent/50"
                      placeholder="链名称"
                    />
                  )}
                  {!defaultWalletChains.includes(w.chain) && (
                    <button type="button" onClick={() => removeWalletChain(ci)} className="text-red-400 hover:text-red-300">
                      <IoTrash size={14} />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {w.addresses.map((addr, ai) => (
                    <input
                      key={ai}
                      type="text"
                      value={addr}
                      onChange={(e) => updateWalletAddress(ci, ai, e.target.value)}
                      className={inputClass}
                      placeholder={`${w.chain} 地址 ${ai + 1}`}
                    />
                  ))}
                </div>
                <button type="button" onClick={() => addWalletAddress(ci)} className="mt-2 flex items-center gap-1 text-xs text-accent hover:text-blue-400">
                  <IoAdd size={14} /> 添加地址
                </button>
              </div>
            ))}
            <button type="button" onClick={addWalletChain} className="flex items-center gap-1 text-sm text-accent hover:text-blue-400">
              <IoAdd size={16} /> 添加更多链
            </button>
          </div>
        </Collapsible>

        {/* KYC */}
        <Collapsible title="KYC 信息" icon={<IoShield size={16} />}>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>KYC 状态</label>
              <select value={form.kyc_status} onChange={(e) => setForm(f => ({ ...f, kyc_status: e.target.value }))} className={inputClass}>
                <option value="none">未KYC</option>
                <option value="pending">待验证</option>
                <option value="verified">已验证</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>KYC 文件</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.kyc_files.map((file, i) => (
                  <div key={i} className="relative group">
                    <ImageViewer src={api.getFileUrl(file)} alt="KYC文件" thumbnailSize="w-20 h-20" />
                    <button
                      type="button"
                      onClick={() => removeKYCFile(i)}
                      className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <IoTrash size={10} />
                    </button>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 px-3 py-2 bg-dark-700 border border-dashed border-dark-700 rounded-lg cursor-pointer hover:border-accent/50 transition-colors">
                <IoCloudUpload className="text-gray-400" />
                <span className="text-sm text-gray-400">上传文件</span>
                <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleKYCUpload} />
              </label>
            </div>
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
          <textarea
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            className={`${inputClass} h-32 resize-y`}
            placeholder="备注信息..."
          />
        </Collapsible>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-accent hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? '保存中...' : profileId ? '更新' : '创建'}
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
