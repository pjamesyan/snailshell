import React, { useState } from 'react';
import { IoEye, IoEyeOff, IoCopy } from 'react-icons/io5';

export default function PasswordField({ value, onChange, placeholder, label, className = '' }) {
  const [visible, setVisible] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    // Auto-clear clipboard after 10 seconds
    setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => {});
    }, 10000);
  };

  return (
    <div className={`relative ${className}`}>
      {label && <label className="block text-xs text-gray-400 mb-1">{label}</label>}
      <div className="flex gap-1">
        <input
          type={visible ? 'text' : 'password'}
          value={value || ''}
          onChange={onChange}
          className="flex-1 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
          placeholder={placeholder}
        />
        <button type="button" onClick={() => setVisible(!visible)}
          className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-[#334155] transition-colors">
          {visible ? <IoEyeOff size={14} /> : <IoEye size={14} />}
        </button>
        {value && (
          <button type="button" onClick={handleCopy}
            className="p-2 text-gray-400 hover:text-blue-400 rounded-lg hover:bg-[#334155] transition-colors">
            <IoCopy size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
