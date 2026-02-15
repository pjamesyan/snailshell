import React, { useState } from 'react';
import Modal from './common/Modal';
import { IoClose, IoExpand, IoDownload, IoDocument } from 'react-icons/io5';

export default function ImageViewer({ src, alt = '图片', className = '', thumbnailSize = 'w-20 h-20' }) {
  const [showFull, setShowFull] = useState(false);

  if (!src) return null;

  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(src);
  const isPDF = /\.pdf$/i.test(src);
  const filename = src.split('/').pop();

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = filename;
    a.click();
  };

  if (!isImage) {
    // Non-image file: show icon + filename, click to download
    return (
      <div
        className={`relative group cursor-pointer rounded-lg overflow-hidden border border-dark-700 bg-dark-700/30 flex flex-col items-center justify-center gap-1 p-2 ${thumbnailSize} ${className}`}
        onClick={handleDownload}
      >
        <IoDocument className="text-gray-400" size={24} />
        <span className="text-xs text-gray-400 truncate max-w-full">{filename}</span>
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <IoDownload className="text-white" size={20} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`relative group cursor-pointer rounded-lg overflow-hidden border border-dark-700 ${thumbnailSize} ${className}`}
        onClick={() => setShowFull(true)}
      >
        <img src={src} alt={alt} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <IoExpand className="text-white" size={20} />
        </div>
      </div>

      {showFull && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowFull(false)}>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -top-3 -right-3 z-10 flex gap-2">
              <button
                onClick={handleDownload}
                className="p-1.5 bg-dark-800 border border-dark-700 rounded-full text-gray-400 hover:text-white transition-colors"
                title="下载"
              >
                <IoDownload size={18} />
              </button>
              <button
                onClick={() => setShowFull(false)}
                className="p-1.5 bg-dark-800 border border-dark-700 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <IoClose size={18} />
              </button>
            </div>
            <img src={src} alt={alt} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </>
  );
}
