import React, { useState } from 'react';
import { IoChevronDown, IoChevronForward } from 'react-icons/io5';

export default function Collapsible({ title, defaultOpen = false, children, icon }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-dark-700 rounded-lg overflow-hidden mb-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-dark-700/50 hover:bg-dark-700 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-accent">{icon}</span>}
          <span className="font-medium text-gray-200">{title}</span>
        </div>
        {isOpen ? <IoChevronDown className="text-gray-400" /> : <IoChevronForward className="text-gray-400" />}
      </button>
      {isOpen && (
        <div className="p-4 bg-dark-800/50">
          {children}
        </div>
      )}
    </div>
  );
}
