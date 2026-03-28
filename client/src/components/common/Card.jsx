import React from 'react';

export default function Card({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-dark-800 border border-dark-700 rounded-lg p-4 ${onClick ? 'cursor-pointer hover:border-accent/50 transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
