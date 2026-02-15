import React, { useState } from 'react';
import { IoMenu } from 'react-icons/io5';
import Sidebar from './Sidebar';

export default function Layout({ currentPage, onNavigate, onLogout, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-dark-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-30 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200`}>
        <Sidebar currentPage={currentPage} onNavigate={(page) => { onNavigate(page); setSidebarOpen(false); }} onLogout={onLogout} user={user} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center p-4 bg-dark-800 border-b border-dark-700">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400">
            <IoMenu size={24} />
          </button>
          <h1 className="ml-3 text-lg font-semibold text-gray-100">SnailShell</h1>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {React.Children.map(React.isValidElement(currentPage) ? currentPage : null, child => child)}
        </div>
      </div>
    </div>
  );
}
