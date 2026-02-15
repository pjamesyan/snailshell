import React from 'react';
import { IoSearch } from 'react-icons/io5';

export default function SearchBar({ value, onChange, placeholder = '搜索...' }) {
  return (
    <div className="relative">
      <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
      />
    </div>
  );
}
