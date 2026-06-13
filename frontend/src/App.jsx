import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Campaigns from './pages/Campaigns';
import Inbox from './pages/Inbox';
import Settings from './pages/Settings';
import TeamManagement from './pages/TeamManagement';
import { AuthProvider, useAuth } from './context/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { 
  Users, 
  MessageSquare, 
  Radio, 
  Settings as SettingsIcon,
  HelpCircle,
  LayoutDashboard,
  LogOut
} from 'lucide-react';

function Sidebar() {
  const location = useLocation();
  const { user, userProfile, signOut } = useAuth();
  const isOwner = userProfile?.role === 'owner' || user?.user_metadata?.role === 'owner' || !userProfile?.role;

  const getLinkClass = (path) => {
    const isActive = location.pathname === path;
    return `flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all rounded-xl mx-3 mb-1 ${
      isActive 
        ? 'text-[#0070d1] bg-blue-50/80 shadow-sm' 
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    }`;
  };

  return (
    <div className="w-[260px] bg-white border-r border-gray-100 flex flex-col h-full shrink-0 z-20 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      {/* Brand Header */}
      <div className="h-[76px] flex items-center px-7 border-b border-gray-50">
        <div className="w-8 h-8 bg-gradient-to-br from-[#0070d1] to-blue-400 rounded-lg flex items-center justify-center mr-3 shadow-md">
          <MessageSquare size={18} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          BroadcastPilot
        </h1>
      </div>

      {/* Account Switcher Mock */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-600 font-semibold text-xs">
              {user?.email ? user.email.substring(0, 2).toUpperCase() : 'BP'}
            </span>
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-sm font-medium text-gray-900 truncate">
              {user?.email || 'My Account'}
            </span>
            <span className="text-xs text-white bg-green-600 rounded px-1.5 py-0.5 self-start mt-0.5">PRO</span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 pt-6 overflow-y-auto">
        <Link to="/" className={getLinkClass('/')}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </Link>
        <Link to="/contacts" className={getLinkClass('/contacts')}>
          <Users size={18} />
          <span>Contacts</span>
        </Link>
        <Link to="/inbox" className={getLinkClass('/inbox')}>
          <MessageSquare size={18} />
          <span>Inbox</span>
        </Link>
        <Link to="/campaigns" className={getLinkClass('/campaigns')}>
          <Radio size={18} />
          <span>Broadcasts</span>
        </Link>
        <Link to="/settings" className={getLinkClass('/settings')}>
          <SettingsIcon size={18} />
          <span>Settings</span>
        </Link>
        {isOwner && (
          <Link to="/team" className={getLinkClass('/team')}>
            <Users size={18} />
            <span>Team</span>
          </Link>
        )}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-gray-100/50 flex flex-col gap-1">

        <div className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-gray-700 hover:text-[#0070d1] hover:bg-[#0070d1]/5 rounded-lg cursor-pointer transition-colors">
          <HelpCircle size={18} />
          <span>Help</span>
        </div>

        <div 
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </div>
        
        <div className="mt-3 bg-white/60 border border-gray-200/50 rounded-xl p-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            <span>Contacts: 0/1000</span>
          </div>
          <button className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-xs font-bold py-2 px-4 rounded-lg shadow-sm hover:shadow transition-all">
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProtectedRoute>
          <div className="flex h-screen w-full bg-[#f4f5f7] overflow-hidden font-sans">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/team" element={<TeamManagement />} />
              </Routes>
            </div>
          </div>
        </ProtectedRoute>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
