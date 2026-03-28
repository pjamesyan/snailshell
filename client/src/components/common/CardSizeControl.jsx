import React, { useState, useEffect } from 'react';
import { IoRemove, IoAdd } from 'react-icons/io5';

const SIZES = [
  { label: 'S', cols: 'grid-cols-1 md:grid-cols-3 xl:grid-cols-4', scale: 0.85 },
  { label: 'M', cols: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3', scale: 1 },
  { label: 'L', cols: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-2', scale: 1.1 },
  { label: 'XL', cols: 'grid-cols-1 xl:grid-cols-2', scale: 1.2 },
];

export function useCardSize(key = 'cardSize') {
  const [sizeIndex, setSizeIndex] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved ? Math.min(Math.max(parseInt(saved) || 1, 0), SIZES.length - 1) : 1;
  });

  useEffect(() => { localStorage.setItem(key, sizeIndex); }, [sizeIndex, key]);

  const size = SIZES[sizeIndex];
  const canShrink = sizeIndex > 0;
  const canGrow = sizeIndex < SIZES.length - 1;

  return {
    gridClass: size.cols,
    scale: size.scale,
    sizeLabel: size.label,
    shrink: () => canShrink && setSizeIndex(i => i - 1),
    grow: () => canGrow && setSizeIndex(i => i + 1),
    canShrink,
    canGrow,
  };
}

export function CardSizeControl({ cardSize }) {
  return (
    <div className="flex items-center gap-1 bg-dark-700 rounded-lg p-0.5">
      <button onClick={cardSize.shrink} disabled={!cardSize.canShrink}
        className="p-1.5 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <IoRemove size={14} />
      </button>
      <span className="text-xs text-gray-400 w-6 text-center">{cardSize.sizeLabel}</span>
      <button onClick={cardSize.grow} disabled={!cardSize.canGrow}
        className="p-1.5 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <IoAdd size={14} />
      </button>
    </div>
  );
}
