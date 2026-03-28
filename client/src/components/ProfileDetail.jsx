import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Card from './common/Card';
import Badge from './common/Badge';
import ImageViewer from './ImageViewer';
import toast from 'react-hot-toast';
import { IoArrowBack, IoCreate, IoTrash, IoAdd, IoLogoDiscord, IoLogoTwitter, IoWallet, IoFolder, IoCopy } from 'react-icons/io5';
import { FaTelegram } from 'react-icons/fa';

export default function ProfileDetail({ profileId, onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileId) loadData();
  }, [profileId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pData, regData, refData] = await Promise.all([
        api.getProfile(profileId),
        api.getByProfile(profileId).catch(() => []),
        api.getProfileReferrals(profileId).catch(() => []),
      ]);
      setProfile(pData.profile || pData);
      setRegistrations(Array.isArray(regData) ? regData : regData.registrations || regData.data || []);
      setReferrals(Array.isArray(refData) ? refData : refData.referrals || refData.data || []);
    } catch (err) {
      toast.error('加载身份详情失败');
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

  if (!profile) {
    return <div className="text-center py-12 text-gray-500">身份不存在</div>;
  }

  const socials = profile.social_accounts || profile.socialAccounts || {
    discord: profile.discord,
    twitter: profile.twitter,
    telegram: profile.telegram,
    custom: profile.custom_socials || [],
  };
  const wallets = profile.wallet_addresses || profile.walletAddresses || profile.wallets || [];
  const kycFiles = profile.kyc_files || profile.kycFiles || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('profiles')} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors">
            <IoArrowBack size={20} />
          </button>
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xl font-bold overflow-hidden">
            {profile.avatar
              ? <img src={`/api/files/avatars/${profile.avatar}`} className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.parentElement.textContent = (profile.nickname || '?')[0].toUpperCase(); }} />
              : (profile.nickname || profile.name || '?')[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-100">{profile.nickname || profile.name}</h2>
            {profile.real_name && <p className="text-sm text-gray-300">实名: {profile.real_name}</p>}
            {profile.email && <p className="text-sm text-gray-400">{profile.email}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate('registration-form', { profileId })} className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors">
            <IoAdd size={16} /> 关联项目
          </button>
          <button onClick={() => onNavigate('profile-form', profileId)} className="flex items-center gap-1 px-3 py-2 bg-accent hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
            <IoCreate size={16} /> 编辑
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info & Password Hints */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
            <IoLogoDiscord className="text-accent" /> 社交账号
          </h3>
          <div className="space-y-2">
            {profile.email && (
              <div className="text-sm">
                <div className="flex items-center gap-2 group">
                  <span className="text-gray-400">📧 邮箱:</span>
                  <span className="text-gray-200">{profile.email}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(profile.email); toast.success('已复制'); }}
                    className="p-1 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="复制邮箱"
                  >
                    <IoCopy size={14} />
                  </button>
                </div>
                {profile.email_password_hint && <div className="text-xs text-yellow-500/70 pl-6">🔑 {profile.email_password_hint}</div>}
              </div>
            )}
            {socials.discord && (
              <div className="text-sm">
                <div className="flex items-center gap-2 group">
                  <IoLogoDiscord className="text-indigo-400" size={16} />
                  <span className="text-gray-400">Discord:</span>
                  <span className="text-gray-200">{socials.discord}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(socials.discord); toast.success('已复制'); }}
                    className="p-1 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="复制Discord"
                  >
                    <IoCopy size={14} />
                  </button>
                </div>
                {(profile.discord_password_hint || socials.discord_password_hint) && <div className="text-xs text-yellow-500/70 pl-6">🔑 {profile.discord_password_hint || socials.discord_password_hint}</div>}
              </div>
            )}
            {(socials.twitter || socials.x) && (
              <div className="text-sm">
                <div className="flex items-center gap-2 group">
                  <IoLogoTwitter className="text-blue-400" size={16} />
                  <span className="text-gray-400">X:</span>
                  <span className="text-gray-200">{socials.twitter || socials.x}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(socials.twitter || socials.x); toast.success('已复制'); }}
                    className="p-1 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="复制X账号"
                  >
                    <IoCopy size={14} />
                  </button>
                </div>
                {(profile.twitter_password_hint || socials.twitter_password_hint) && <div className="text-xs text-yellow-500/70 pl-6">🔑 {profile.twitter_password_hint || socials.twitter_password_hint}</div>}
              </div>
            )}
            {socials.telegram && (
              <div className="text-sm">
                <div className="flex items-center gap-2 group">
                  <FaTelegram className="text-blue-300" size={16} />
                  <span className="text-gray-400">Telegram:</span>
                  <span className="text-gray-200">{socials.telegram}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(socials.telegram); toast.success('已复制'); }}
                    className="p-1 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="复制Telegram"
                  >
                    <IoCopy size={14} />
                  </button>
                </div>
                {(profile.telegram_password_hint || socials.telegram_password_hint) && <div className="text-xs text-yellow-500/70 pl-6">🔑 {profile.telegram_password_hint || socials.telegram_password_hint}</div>}
              </div>
            )}
            {profile.phone && (
              <div className="text-sm">
                <div className="flex items-center gap-2 group">
                  <span className="text-gray-400">📱 手机:</span>
                  <span className="text-gray-200">{profile.phone}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(profile.phone); toast.success('已复制'); }}
                    className="p-1 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="复制手机号"
                  >
                    <IoCopy size={14} />
                  </button>
                </div>
                {profile.phone_password_hint && <div className="text-xs text-yellow-500/70 pl-6">🔑 {profile.phone_password_hint}</div>}
              </div>
            )}
            {(socials.custom || []).map((c, i) => (
              <div key={i} className="text-sm">
                <div className="flex items-center gap-2 group">
                  <span className="text-gray-400">{c.platform}:</span>
                  <span className="text-gray-200">{c.username}</span>
                  {c.username && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(c.username); toast.success('已复制'); }}
                      className="p-1 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="复制账号"
                    >
                      <IoCopy size={14} />
                    </button>
                  )}
                </div>
                {c.password_hint && <div className="text-xs text-yellow-500/70 pl-6">🔑 {c.password_hint}</div>}
              </div>
            ))}
            {!profile.email && !socials.discord && !socials.twitter && !socials.x && !socials.telegram && !(socials.custom || []).length && (
              <p className="text-gray-500 text-sm">暂无社交账号</p>
            )}
          </div>
        </Card>

        {/* Wallet Addresses */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
            <IoWallet className="text-accent" /> 钱包地址
          </h3>
          <div className="space-y-3">
            {wallets.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无钱包地址</p>
            ) : (
              wallets.map((w, i) => {
                const addrs = (w.addresses || []).filter(a => a);
                if (addrs.length === 0) return null;
                return (
                  <div key={i}>
                    <p className="text-sm font-medium text-gray-300 mb-1">{w.chain}</p>
                    {addrs.map((addr, j) => (
                      <div key={j} className="flex items-center gap-1 pl-3 group">
                        <p className="text-xs text-gray-400 font-mono truncate">{addr}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(addr); toast.success('已复制'); }}
                          className="p-0.5 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          title="复制地址"
                        >
                          <IoCopy size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* KYC */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-3">KYC 状态</h3>
          <div className="space-y-3">
            <Badge color={profile.kyc_status === 'verified' ? 'green' : profile.kyc_status === 'pending' ? 'yellow' : 'gray'}>
              {profile.kyc_status === 'verified' ? '已验证' : profile.kyc_status === 'pending' ? '待验证' : '未KYC'}
            </Badge>
            {kycFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {kycFiles.map((file, i) => (
                  <ImageViewer key={i} src={api.getFileUrl(file)} alt="KYC文件" thumbnailSize="w-16 h-16" />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Notes */}
        {profile.notes && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-100 mb-3">备注</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{profile.notes}</p>
          </Card>
        )}
      </div>

      {/* Registrations */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <IoFolder className="text-accent" /> 关联项目 ({registrations.length})
          </h3>
        </div>
        {registrations.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无关联项目</p>
        ) : (
          <>
            <div className="space-y-2">
              {registrations.map(reg => (
                <div key={reg._id || reg.id} className="flex items-center justify-between p-3 bg-dark-700/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{reg.projectName || reg.project_name || reg.project?.name || '未知项目'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {reg.status && <Badge color={reg.status === 'active' ? 'green' : reg.status === 'completed' ? 'blue' : 'gray'}>{reg.status}</Badge>}
                      {reg.username && <span className="text-xs text-gray-400">用户名: {reg.username}</span>}
                      {(reg.investment || reg.cost) && <span className="text-xs text-gray-400">投入: ${reg.investment || reg.cost}</span>}
                      {(reg.revenue || reg.earnings) && <span className="text-xs text-green-400">收益: ${reg.revenue || reg.earnings}</span>}
                    </div>
                    {reg.password_hint && <div className="text-xs text-yellow-500/70 mt-0.5">🔑 {reg.password_hint}</div>}
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

      {/* Referrals */}
      {referrals.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-3">推荐的身份 ({referrals.length})</h3>
          <div className="space-y-2">
            {referrals.map(ref => (
              <div
                key={ref._id || ref.id}
                className="flex items-center gap-3 p-2 bg-dark-700/30 rounded-lg cursor-pointer hover:bg-dark-700/50"
                onClick={() => onNavigate('profile-detail', ref._id || ref.id)}
              >
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold overflow-hidden">
                  {ref.avatar
                    ? <img src={`/api/files/avatars/${ref.avatar}`} className="w-full h-full object-cover" />
                    : (ref.nickname || ref.name || '?')[0]}
                </div>
                <span className="text-sm text-gray-200">{ref.nickname || ref.name}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
