import React from 'react';
import { IoCopy } from 'react-icons/io5';
import toast from 'react-hot-toast';

export default function CopyText({ text, label, className = '' }) {
  if (!text) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast.success('已复制');
  };

  return (
    <div className={`flex items-center gap-2 group ${className}`}>
      {label && <span className="text-gray-400 text-sm">{label}</span>}
      <span className="text-gray-200 text-sm font-mono truncate">{text}</span>
      <button
        onClick={handleCopy}
        className="p-1 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
        title="复制"
      >
        <IoCopy size={14} />
      </button>
    </div>
  );
}
