import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import Register from './components/Register';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ProfileList from './components/ProfileList';
import ProfileForm from './components/ProfileForm';
import ProfileDetail from './components/ProfileDetail';
import ProjectList from './components/ProjectList';
import ProjectForm from './components/ProjectForm';
import ProjectDetail from './components/ProjectDetail';
import RegistrationForm from './components/RegistrationForm';
import ExchangeList from './components/ExchangeList';
import ExchangeForm from './components/ExchangeForm';
import ExchangeDetail from './components/ExchangeDetail';
import ExchangeStats from './components/ExchangeStats';
import Reminders from './components/Reminders';
import Finance from './components/Finance';
import PasswordGen from './components/PasswordGen';
import ImportExport from './components/ImportExport';
import Settings from './components/Settings';
import GlobalSearch from './components/GlobalSearch';
import StatsPage from './components/StatsPage';
import TodoList from './components/TodoList';
import NoteList from './components/NoteList';
import Chat from './components/Chat';

export default function App() {
  const { user, loading, login, register, logout, checkAuth } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [page, setPage] = useState('dashboard');
  const [pageData, setPageData] = useState(null);

  const navigate = (newPage, data = null) => {
    setPage(newPage);
    setPageData(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f172a]">
        <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } }} />
        {showRegister ? (
          <Register onRegister={register} onSwitchToLogin={() => setShowRegister(false)} />
        ) : (
          <Login onLogin={login} onSwitchToRegister={() => setShowRegister(true)} />
        )}
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} />;
      case 'profiles':
        return <ProfileList onNavigate={navigate} />;
      case 'profile-form':
        return <ProfileForm profileId={pageData?.id || pageData} onNavigate={navigate} onSave={() => navigate('profiles')} onCancel={() => navigate('profiles')} />;
      case 'profile-detail':
        return <ProfileDetail profileId={pageData?.id || pageData} onNavigate={navigate} />;
      case 'projects':
        return <ProjectList onNavigate={navigate} />;
      case 'project-form':
        return <ProjectForm projectId={pageData?.id || pageData} onNavigate={navigate} onSave={() => navigate('projects')} onCancel={() => navigate('projects')} />;
      case 'project-detail':
        return <ProjectDetail projectId={pageData?.id || pageData} onNavigate={navigate} />;
      case 'registration-form':
        return <RegistrationForm registrationId={pageData?.registrationId} initialData={pageData} onNavigate={navigate} onSave={() => navigate(pageData?._backTo || 'profiles')} onCancel={() => navigate(pageData?._backTo || 'profiles')} />;
      case 'exchanges':
        return <ExchangeList onNavigate={navigate} />;
      case 'exchange-form':
        return <ExchangeForm exchangeId={pageData?.id || pageData} onNavigate={navigate} onSave={() => navigate('exchanges')} onCancel={() => navigate('exchanges')} />;
      case 'exchange-detail':
        return <ExchangeDetail exchangeId={pageData?.id || pageData} onNavigate={navigate} />;
      case 'exchange-stats':
        return <ExchangeStats onNavigate={navigate} />;
      case 'stats':
        return <StatsPage onNavigate={navigate} />;
      case 'reminders':
        return <Reminders onNavigate={navigate} />;
      case 'finance':
        return <Finance onNavigate={navigate} />;
      case 'password':
        return <PasswordGen />;
      case 'import-export':
        return <ImportExport />;
      case 'settings':
        return <Settings user={user} onLogout={logout} checkAuth={checkAuth} />;
      case 'todos':
        return <TodoList onNavigate={navigate} />;
      case 'notes':
        return <NoteList onNavigate={navigate} />;
      case 'chat':
        return <Chat onNavigate={navigate} />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } }} />
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="hidden lg:block">
          <Sidebar currentPage={page} onNavigate={(p) => navigate(p)} onLogout={logout} user={user} />
        </div>

        {/* Mobile sidebar toggle handled inside content */}
        <div className="flex-1 overflow-y-auto">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center p-4 bg-[#1e293b] border-b border-[#334155] sticky top-0 z-10">
            <MobileMenu currentPage={page} onNavigate={navigate} onLogout={logout} user={user} />
            <h1 className="ml-3 text-lg font-semibold text-gray-100 flex-1">🐌 SnailShell</h1>
            <GlobalSearch onNavigate={navigate} />
          </div>

          {/* Desktop search bar */}
          <div className="hidden lg:flex items-center justify-end p-4 pb-0">
            <GlobalSearch onNavigate={navigate} />
          </div>

          <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileMenu({ currentPage, onNavigate, onLogout, user }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-[#334155] text-gray-400">
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-64">
            <Sidebar currentPage={currentPage} onNavigate={(p) => { onNavigate(p); setOpen(false); }} onLogout={onLogout} user={user} />
          </div>
        </>
      )}
    </>
  );
}
