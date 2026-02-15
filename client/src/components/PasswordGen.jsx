import React, { useState } from 'react';
import { FiCopy, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function PasswordGen() {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSpecial, setUseSpecial] = useState(true);
  const [password, setPassword] = useState('');
  const [history, setHistory] = useState([]);

  const generate = () => {
    let chars = '';
    if (useUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useLower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (useNumbers) chars += '0123456789';
    if (useSpecial) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) { toast.error('请至少选择一种字符类型'); return; }

    let result = '';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    setPassword(result);
    setHistory(prev => [result, ...prev.slice(0, 9)]);
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  const getStrength = (pwd) => {
    if (!pwd) return { label: '-', color: 'text-gray-500', percent: 0 };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (pwd.length >= 16) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score >= 6) return { label: '非常强', color: 'text-safe', percent: 100 };
    if (score >= 5) return { label: '强', color: 'text-safe', percent: 80 };
    if (score >= 4) return { label: '中等', color: 'text-yellow-500', percent: 60 };
    if (score >= 3) return { label: '较弱', color: 'text-warn', percent: 40 };
    return { label: '弱', color: 'text-warn', percent: 20 };
  };

  const strength = getStrength(password);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">密码生成器</h2>

      <div className="bg-dark-800 rounded-xl p-6 border border-dark-700 mb-6">
        {/* Generated password */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 font-mono text-lg text-white break-all">
            {password || '点击生成按钮...'}
          </div>
          <button onClick={() => copy(password)} disabled={!password}
            className="p-3 bg-dark-700 rounded-lg text-gray-400 hover:text-accent transition-colors disabled:opacity-30">
            <FiCopy size={18} />
          </button>
          <button onClick={generate}
            className="p-3 bg-accent rounded-lg text-white hover:bg-blue-600 transition-colors">
            <FiRefreshCw size={18} />
          </button>
        </div>

        {/* Strength indicator */}
        {password && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">密码强度</span>
              <span className={strength.color}>{strength.label}</span>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all duration-300 ${strength.percent >= 80 ? 'bg-safe' : strength.percent >= 60 ? 'bg-yellow-500' : 'bg-warn'}`}
                style={{ width: `${strength.percent}%` }} />
            </div>
          </div>
        )}

        {/* Options */}
        <div className="space-y-4">
          <div>
            <label className="flex items-center justify-between text-sm text-gray-400 mb-2">
              <span>密码长度: {length}</span>
            </label>
            <input type="range" min="6" max="64" value={length} onChange={e => setLength(Number(e.target.value))}
              className="w-full accent-accent" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Toggle label="大写字母 (A-Z)" checked={useUpper} onChange={setUseUpper} />
            <Toggle label="小写字母 (a-z)" checked={useLower} onChange={setUseLower} />
            <Toggle label="数字 (0-9)" checked={useNumbers} onChange={setUseNumbers} />
            <Toggle label="特殊字符 (!@#)" checked={useSpecial} onChange={setUseSpecial} />
          </div>
        </div>

        <button onClick={generate}
          className="w-full mt-6 bg-accent hover:bg-blue-600 text-white font-medium py-2.5 rounded-lg transition-colors">
          生成密码
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-dark-800 rounded-xl p-6 border border-dark-700">
          <h3 className="text-lg font-semibold text-white mb-4">生成历史</h3>
          <div className="space-y-2">
            {history.map((pwd, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-dark-700 rounded-lg">
                <span className="font-mono text-sm text-gray-300 truncate mr-2">{pwd}</span>
                <button onClick={() => copy(pwd)} className="text-gray-500 hover:text-accent transition-colors flex-shrink-0">
                  <FiCopy size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-dark-600'} relative`}
        onClick={() => onChange(!checked)}>
        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-gray-400">{label}</span>
    </label>
  );
}
