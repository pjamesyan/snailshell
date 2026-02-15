import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Collapsible from './common/Collapsible';
import toast from 'react-hot-toast';
import { IoArrowBack, IoBusinessOutline, IoAdd, IoTrash, IoDocument, IoPhonePortrait } from 'react-icons/io5';

const presetExchanges = ['币安 (Binance)', 'OKX', 'Gate.io', 'Bitget', 'Bybit'];
const presetChains = ['ETH', 'BTC', 'SOL', 'TRX', 'BSC', 'ARB', 'OP', 'BASE', 'MATIC', 'AVAX'];

export default function ExchangeForm({ exchangeId, onNavigate }) {
  const [form, setForm] = useState({
    profileId: '',
    exchange_name: '',
    custom_name: '',
    account_email: '',
    password_hint: '',
    kyc_status: 'none',
    exchange_uid: '',
    deposit_addresses: [{ chain: '', address: '' }],
    login_devices: [''],
    assets: [{ currency: '', amount: '', value_usd: '' }],
    notes: '',
  });
  const [profiles, setProfiles] = useState([]);
  const [useCustomName, setUseCustomName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfiles();
    if (exchangeId) loadExchange();
  }, [exchangeId]);

  const loadProfiles = async () => {
    try {
      const data = await api.listProfiles();
      setProfiles(Array.isArray(data) ? data : data.profiles || data.data || []);
    } catch {}
  };

  const loadExchange = async () => {
    setLoading(true);
    try {
      const data = await api.getExchange(exchangeId);
      const ex = data.exchange || data;
      const name = ex.exchange_name || ex.exchangeName || ex.name || '';
      const isPreset = presetExchanges.includes(name);
      setUseCustomName(!isPreset);
      setForm({
        profileId: ex.profileId || ex.profile_id || ex.profile?._id || '',
        exchange_name: isPreset ? name : '',
        custom_name: isPreset ? '' : name,
        account_email: ex.account_email || ex.accountEmail || '',
        password_hint: ex.password_hint || ex.passwordHint || '',
        kyc_status: ex.kyc_status || ex.kycStatus || 'none',
        exchange_uid: ex.exchange_uid || '',
        deposit_addresses: (ex.deposit_addresses || []).length > 0
          ? ex.deposit_addresses
          : [{ chain: '', address: '' }],
        login_devices: (ex.login_devices || []).length > 0
          ? ex.login_devices
          : [''],
        assets: (ex.assets || ex.asset_details || []).length > 0
          ? (ex.assets || ex.asset_details).map(a => ({
              currency: a.currency || a.coin || '',
              amount: a.amount || a.quantity || '',
              value_usd: a.value_usd || a.valueUsd || '',
            }))
          : [{ currency: '', amount: '', value_usd: '' }],
        notes: ex.notes || '',
      });
    } catch (err) {
      toast.error('加载交易所失败');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = useCustomName ? form.custom_name : form.exchange_name;
    if (!form.profileId || !name) {
      toast.error('请选择身份和交易所');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        profile_id: form.profileId,
        exchange_name: name,
        account_email: form.account_email || '',
        password_hint: form.password_hint || '',
        kyc_status: form.kyc_status,
        exchange_uid: form.exchange_uid || '',
        deposit_addresses: form.deposit_addresses.filter(d => d.chain && d.address),
        login_devices: form.login_devices.filter(d => d.trim()),
        assets: form.assets.filter(a => a.currency || a.coin).map(a => ({
          coin: a.currency || a.coin,
          amount: String(a.amount || 0),
          value_usd: Number(a.value_usd) || 0,
        })),
        total_value_usd: form.assets.reduce((sum, a) => sum + (Number(a.value_usd) || 0), 0),
        notes: form.notes,
      };
      if (exchangeId) {
        await api.updateExchange(exchangeId, payload);
        toast.success('交易所已更新');
      } else {
        await api.createExchange(payload);
        toast.success('交易所已创建');
      }
      onNavigate('exchanges');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const addAsset = () => {
    setForm(f => ({ ...f, assets: [...f.assets, { currency: '', amount: '', value_usd: '' }] }));
  };

  const updateAsset = (index, field, value) => {
    setForm(f => {
      const assets = [...f.assets];
      assets[index] = { ...assets[index], [field]: value };
      return { ...f, assets };
    });
  };

  const removeAsset = (index) => {
    setForm(f => ({ ...f, assets: f.assets.filter((_, i) => i !== index) }));
  };

  const addDepositAddress = () => {
    setForm(f => ({ ...f, deposit_addresses: [...f.deposit_addresses, { chain: '', address: '' }] }));
  };

  const updateDepositAddress = (index, field, value) => {
    setForm(f => {
      const deposit_addresses = [...f.deposit_addresses];
      deposit_addresses[index] = { ...deposit_addresses[index], [field]: value };
      return { ...f, deposit_addresses };
    });
  };

  const removeDepositAddress = (index) => {
    setForm(f => ({ ...f, deposit_addresses: f.deposit_addresses.filter((_, i) => i !== index) }));
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

  const totalValue = form.assets.reduce((sum, a) => sum + (Number(a.value_usd) || 0), 0);

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
        <button onClick={() => onNavigate('exchanges')} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors">
          <IoArrowBack size={20} />
        </button>
        <h2 className="text-2xl font-bold text-gray-100">
          {exchangeId ? '编辑交易所' : '添加交易所'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Collapsible title="基本信息" defaultOpen={true} icon={<IoBusinessOutline size={16} />}>
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
              <label className={labelClass}>交易所 *</label>
              {useCustomName ? (
                <div className="flex gap-2">
                  <input type="text" value={form.custom_name} onChange={(e) => setForm(f => ({ ...f, custom_name: e.target.value }))} className={inputClass} placeholder="自定义交易所名称" />
                  <button type="button" onClick={() => setUseCustomName(false)} className="px-2 text-xs text-accent hover:text-blue-400 whitespace-nowrap">预设</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select value={form.exchange_name} onChange={(e) => setForm(f => ({ ...f, exchange_name: e.target.value }))} className={inputClass}>
                    <option value="">请选择</option>
                    {presetExchanges.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setUseCustomName(true)} className="px-2 text-xs text-accent hover:text-blue-400 whitespace-nowrap">自定义</button>
                </div>
              )}
            </div>
            <div>
              <label className={labelClass}>账户邮箱</label>
              <input type="email" value={form.account_email} onChange={(e) => setForm(f => ({ ...f, account_email: e.target.value }))} className={inputClass} placeholder="交易所注册邮箱" />
            </div>
            <div>
              <label className={labelClass}>🔑 密码提示</label>
              <input type="text" value={form.password_hint} onChange={(e) => setForm(f => ({ ...f, password_hint: e.target.value }))} className={inputClass} placeholder="密码提示词（帮你记住密码）" />
            </div>
            <div>
              <label className={labelClass}>UID</label>
              <input type="text" value={form.exchange_uid} onChange={(e) => setForm(f => ({ ...f, exchange_uid: e.target.value }))} className={inputClass} placeholder="交易所 UID" />
            </div>
            <div>
              <label className={labelClass}>KYC 状态</label>
              <select value={form.kyc_status} onChange={(e) => setForm(f => ({ ...f, kyc_status: e.target.value }))} className={inputClass}>
                <option value="none">未KYC</option>
                <option value="pending">待验证</option>
                <option value="verified">已验证</option>
              </select>
            </div>
          </div>
        </Collapsible>

        <Collapsible title="充值地址" icon={<span className="text-sm">💳</span>}>
          <div className="space-y-3">
            {form.deposit_addresses.map((d, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="w-32">
                  <label className={labelClass}>链</label>
                  <select value={d.chain} onChange={(e) => updateDepositAddress(i, 'chain', e.target.value)} className={inputClass}>
                    <option value="">选择链</option>
                    {presetChains.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="custom">自定义</option>
                  </select>
                </div>
                {d.chain === 'custom' && (
                  <div className="w-32">
                    <label className={labelClass}>自定义链</label>
                    <input type="text" value={d.customChain || ''} onChange={(e) => updateDepositAddress(i, 'customChain', e.target.value)} className={inputClass} placeholder="链名称" />
                  </div>
                )}
                <div className="flex-1">
                  <label className={labelClass}>地址</label>
                  <input type="text" value={d.address} onChange={(e) => updateDepositAddress(i, 'address', e.target.value)} className={inputClass} placeholder="充值地址" />
                </div>
                <button type="button" onClick={() => removeDepositAddress(i)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg mb-0.5">
                  <IoTrash size={16} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addDepositAddress} className="flex items-center gap-1 text-sm text-accent hover:text-blue-400">
              <IoAdd size={16} /> 添加充值地址
            </button>
          </div>
        </Collapsible>

        <Collapsible title="主要登录设备" icon={<IoPhonePortrait size={16} />}>
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

        <Collapsible title={`资产明细 (总估值: $${totalValue.toLocaleString()})`} defaultOpen={true} icon={<span className="text-sm">💰</span>}>
          <div className="space-y-3">
            {form.assets.map((a, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className={labelClass}>币种</label>
                  <input type="text" value={a.currency} onChange={(e) => updateAsset(i, 'currency', e.target.value)} className={inputClass} placeholder="BTC / ETH / USDT..." />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>数量</label>
                  <input type="number" value={a.amount} onChange={(e) => updateAsset(i, 'amount', e.target.value)} className={inputClass} placeholder="0" step="any" />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>估值 (USD)</label>
                  <input type="number" value={a.value_usd} onChange={(e) => updateAsset(i, 'value_usd', e.target.value)} className={inputClass} placeholder="0" step="0.01" />
                </div>
                <button type="button" onClick={() => removeAsset(i)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg mb-0.5">
                  <IoTrash size={16} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addAsset} className="flex items-center gap-1 text-sm text-accent hover:text-blue-400">
              <IoAdd size={16} /> 添加资产
            </button>
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
            {saving ? '保存中...' : exchangeId ? '更新' : '创建'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('exchanges')}
            className="px-6 py-2.5 bg-dark-700 hover:bg-dark-700/80 text-gray-300 rounded-lg transition-colors"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
