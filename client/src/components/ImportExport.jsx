import React, { useState, useEffect } from 'react';
import { IoDownload, IoCloudUpload, IoServer, IoTrash, IoRefresh, IoLockClosed, IoLockOpen, IoClose } from 'react-icons/io5';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { encryptExport, decryptExport, isEncrypted } from '../utils/exportCrypto';

export default function ImportExport() {
  const [backups, setBackups] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState('merge'); // 'merge' | 'overwrite'
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirmPassword, setExportConfirmPassword] = useState('');
  const [exportEncrypted, setExportEncrypted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDecryptModal, setShowDecryptModal] = useState(false);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [pendingImportData, setPendingImportData] = useState(null);
  const [showCSVExportModal, setShowCSVExportModal] = useState(false);
  const [csvExportOptions, setCSVExportOptions] = useState({
    profiles: true,
    projects: true,
    registrations: true,
    exchanges: true,
    includePasswordHints: false,
  });

  useEffect(() => { loadBackups(); }, []);

  const loadBackups = async () => {
    try { const res = await api.listBackups(); if (Array.isArray(res)) setBackups(res); } catch {}
  };

  const handleExportJSON = async () => {
    setShowExportModal(true);
  };

  const handleConfirmExport = async () => {
    if (exportEncrypted) {
      if (!exportPassword || exportPassword.length < 8) {
        toast.error('导出密码至少需要8位');
        return;
      }
      if (exportPassword !== exportConfirmPassword) {
        toast.error('两次密码不一致');
        return;
      }
    }

    setExporting(true);
    try {
      const res = await api.exportJSON();
      const data = res.plain || res;
      
      let finalData = data;
      let filename = `accounts-${new Date().toISOString().slice(0, 10)}.json`;
      
      if (exportEncrypted) {
        finalData = await encryptExport(data, exportPassword);
        filename = `accounts-encrypted-${new Date().toISOString().slice(0, 10)}.json`;
        toast.success('数据已加密');
      }
      
      const blob = new Blob([JSON.stringify(finalData, null, 2)], { type: 'application/json' });
      download(blob, filename);
      toast.success('JSON 导出成功');
      
      setShowExportModal(false);
      setExportPassword('');
      setExportConfirmPassword('');
      setExportEncrypted(false);
    } catch (err) {
      toast.error(err.message);
    }
    setExporting(false);
  };

  const handleExportCSV = async () => {
    setShowCSVExportModal(true);
  };

  const handleConfirmCSVExport = async () => {
    try {
      const sections = [];
      if (csvExportOptions.profiles) sections.push('profiles');
      if (csvExportOptions.projects) sections.push('projects');
      if (csvExportOptions.registrations) sections.push('registrations');
      if (csvExportOptions.exchanges) sections.push('exchanges');
      
      if (sections.length === 0) {
        toast.error('请至少选择一个导出模块');
        return;
      }

      const params = new URLSearchParams({
        sections: sections.join(','),
        includePasswordHints: csvExportOptions.includePasswordHints ? 'true' : 'false',
      });
      
      const csv = await api.exportCSV(params.toString());
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      download(blob, `accounts-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('CSV 导出成功');
      setShowCSVExportModal(false);
    } catch (err) { toast.error(err.message); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      
      // Check if encrypted
      if (isEncrypted(parsed)) {
        setPendingImportData(parsed);
        setShowDecryptModal(true);
        e.target.value = '';
        return;
      }
      
      // Plain import
      await doImport(parsed);
    } catch (err) {
      toast.error('导入失败: ' + err.message);
    }
    e.target.value = '';
  };

  const handleDecryptAndImport = async () => {
    if (!decryptPassword) {
      toast.error('请输入解密密码');
      return;
    }
    
    setImporting(true);
    try {
      const decrypted = await decryptExport(pendingImportData, decryptPassword);
      await doImport(decrypted);
      setShowDecryptModal(false);
      setDecryptPassword('');
      setPendingImportData(null);
    } catch (err) {
      toast.error(err.message);
    }
    setImporting(false);
  };

  const doImport = async (data) => {
    setImporting(true);
    try {
      const res = await api.importJSON({ data: data.profiles ? data : { profiles: [] }, mode: importMode });
      toast.success(res.message || `导入成功`);
    } catch (err) {
      toast.error('导入失败: ' + err.message);
    }
    setImporting(false);
  };

  const handleBackup = async () => {
    try { await api.createBackup(); toast.success('备份创建成功'); loadBackups(); }
    catch (err) { toast.error(err.message); }
  };

  const handleRestore = async (name) => {
    if (!confirm(`确定恢复备份 "${name}" 吗？`)) return;
    try { await api.restoreBackup(name); toast.success('恢复成功，请重新登录'); }
    catch (err) { toast.error(err.message); }
  };

  const handleDeleteBackup = async (name) => {
    if (!confirm(`确定删除备份 "${name}" 吗？`)) return;
    try { await api.deleteBackup(name); toast.success('已删除'); loadBackups(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-100 mb-6">📥 导入导出</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export */}
        <div className="bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <IoDownload /> 导出数据
          </h3>
          <div className="space-y-3">
            <button onClick={handleExportJSON}
              className="w-full bg-[#0f172a] hover:bg-[#334155] text-gray-300 py-3 rounded-lg transition-colors text-sm border border-[#334155]">
              📄 导出为 JSON
            </button>
            <button onClick={handleExportCSV}
              className="w-full bg-[#0f172a] hover:bg-[#334155] text-gray-300 py-3 rounded-lg transition-colors text-sm border border-[#334155]">
              📊 导出为 CSV
            </button>
          </div>
        </div>

        {/* Import */}
        <div className="bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <IoCloudUpload /> 导入数据
          </h3>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">导入模式</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="importMode" value="merge" checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="text-blue-500 focus:ring-blue-500" />
                <span className="text-sm text-gray-300">合并（跳过重复）</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="importMode" value="overwrite" checked={importMode === 'overwrite'}
                  onChange={() => setImportMode('overwrite')}
                  className="text-red-500 focus:ring-red-500" />
                <span className="text-sm text-gray-300">覆盖（清空后导入）</span>
              </label>
            </div>
          </div>
          <label className="block w-full bg-blue-500/10 border-2 border-dashed border-blue-500/50 rounded-lg py-8 text-center cursor-pointer hover:bg-blue-500/20 transition-colors">
            <IoCloudUpload className="mx-auto mb-2 text-blue-400" size={24} />
            <span className="text-blue-400 text-sm">{importing ? '导入中...' : '点击选择 JSON 文件'}</span>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={importing} />
          </label>
        </div>
      </div>

      {/* Backups */}
      <div className="mt-6 bg-[#1e293b] rounded-xl p-6 border border-[#334155]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <IoServer /> 数据库备份
          </h3>
          <button onClick={handleBackup}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm">
            <IoRefresh size={14} /> 创建备份
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无备份</p>
        ) : (
          <div className="space-y-2">
            {backups.map(b => (
              <div key={b.name} className="flex items-center justify-between p-3 bg-[#0f172a] rounded-lg border border-[#334155]">
                <div>
                  <p className="text-gray-300 text-sm">{b.name}</p>
                  <p className="text-gray-500 text-xs">
                    {new Date(b.created).toLocaleString('zh-CN')} · {(b.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRestore(b.name)} className="text-xs text-blue-400 hover:underline">恢复</button>
                  <button onClick={() => handleDeleteBackup(b.name)} className="text-xs text-red-400 hover:underline">删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">导出 JSON</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-200">
                <IoClose size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-[#0f172a] rounded-lg border border-[#334155]">
                <input
                  type="checkbox"
                  id="exportEncrypted"
                  checked={exportEncrypted}
                  onChange={(e) => setExportEncrypted(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="exportEncrypted" className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  {exportEncrypted ? <IoLockClosed className="text-green-400" /> : <IoLockOpen className="text-gray-400" />}
                  <span>加密导出（推荐）</span>
                </label>
              </div>

              {exportEncrypted && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">导出密码（至少8位）</label>
                    <input
                      type="password"
                      value={exportPassword}
                      onChange={(e) => setExportPassword(e.target.value)}
                      className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="输入导出密码"
                      minLength={8}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">确认密码</label>
                    <input
                      type="password"
                      value={exportConfirmPassword}
                      onChange={(e) => setExportConfirmPassword(e.target.value)}
                      className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="再次输入密码"
                    />
                  </div>
                  <p className="text-xs text-yellow-500/70">
                    ⚠️ 请妥善保管导出密码，丢失后无法恢复数据
                  </p>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleConfirmExport}
                  disabled={exporting}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white py-2 rounded-lg transition-colors"
                >
                  {exporting ? '导出中...' : '确认导出'}
                </button>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 bg-[#0f172a] hover:bg-[#334155] text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Export Modal */}
      {showCSVExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">导出 CSV</h3>
              <button onClick={() => setShowCSVExportModal(false)} className="text-gray-400 hover:text-gray-200">
                <IoClose size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">选择导出内容：</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={csvExportOptions.profiles}
                      onChange={(e) => setCSVExportOptions(o => ({ ...o, profiles: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span>身份</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={csvExportOptions.projects}
                      onChange={(e) => setCSVExportOptions(o => ({ ...o, projects: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span>项目</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={csvExportOptions.registrations}
                      onChange={(e) => setCSVExportOptions(o => ({ ...o, registrations: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span>注册记录</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={csvExportOptions.exchanges}
                      onChange={(e) => setCSVExportOptions(o => ({ ...o, exchanges: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span>交易所</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-[#334155] pt-3">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={csvExportOptions.includePasswordHints}
                    onChange={(e) => setCSVExportOptions(o => ({ ...o, includePasswordHints: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span>包含密码提示</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  不会导出真实密码，仅导出密码提示词
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleConfirmCSVExport}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition-colors"
                >
                  确认导出
                </button>
                <button
                  onClick={() => setShowCSVExportModal(false)}
                  className="px-4 py-2 bg-[#0f172a] hover:bg-[#334155] text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decrypt Modal */}
      {showDecryptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                <IoLockClosed className="text-yellow-400" />
                解密导入
              </h3>
              <button onClick={() => { setShowDecryptModal(false); setPendingImportData(null); setDecryptPassword(''); }} className="text-gray-400 hover:text-gray-200">
                <IoClose size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                检测到加密的导出文件，请输入导出时设置的密码
              </p>
              <div>
                <label className="block text-sm text-gray-400 mb-1">解密密码</label>
                <input
                  type="password"
                  value={decryptPassword}
                  onChange={(e) => setDecryptPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDecryptAndImport()}
                  className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="输入密码"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleDecryptAndImport}
                  disabled={importing}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white py-2 rounded-lg transition-colors"
                >
                  {importing ? '解密中...' : '解密并导入'}
                </button>
                <button
                  onClick={() => { setShowDecryptModal(false); setPendingImportData(null); setDecryptPassword(''); }}
                  className="px-4 py-2 bg-[#0f172a] hover:bg-[#334155] text-gray-300 rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
