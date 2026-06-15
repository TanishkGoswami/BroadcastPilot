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
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = React.useState(false);

  const getLinkClass = (path) => {
    const isActive = location.pathname === path;
    return `flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-all rounded-[12px] mx-2 mb-1 ${
      isActive 
        ? 'text-primary bg-surface-card shadow-sm border border-hairline/50' 
        : 'text-charcoal hover:text-ink hover:bg-surface-card/50 border border-transparent'
    }`;
  };

  return (
    <div className="w-[250px] bg-transparent flex flex-col h-full shrink-0 z-20">
      {/* Brand Header */}
      <div className="h-[80px] flex items-center px-4">
        <img src="/logo3.png" alt="BroadcastPilot Logo" className="h-10 w-auto object-contain" />
      </div>

      {/* Account Switcher Mock */}
      <div className="px-4 pb-4 border-b border-hairline/50">
        <div className="flex items-center gap-3 p-2 rounded-[12px] hover:bg-surface-card cursor-pointer border border-transparent hover:border-hairline transition-all shadow-sm">
          <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center shrink-0">
            <span className="text-white font-bold font-display text-sm">
              {user?.email ? user.email.substring(0, 2).toUpperCase() : 'BP'}
            </span>
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-[13px] font-bold text-ink truncate font-display">
              {user?.email || 'My Account'}
            </span>
            <span className="text-[10px] text-primary font-bold tracking-wider uppercase mt-0.5">PRO Plan</span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 pt-6 px-2 overflow-y-auto space-y-1">
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
      <div className="p-4 flex flex-col gap-1 px-2">

        <div className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-charcoal hover:text-ink hover:bg-surface-card hover:shadow-sm rounded-[12px] cursor-pointer transition-all mx-2">
          <HelpCircle size={18} className="text-mute" />
          <span>Help</span>
        </div>

        <div 
          onClick={() => setIsLogoutDialogOpen(true)}
          className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-primary hover:bg-surface-card hover:shadow-sm rounded-[12px] cursor-pointer transition-all mx-2"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </div>
        
        <div className="mt-4 bg-surface-card rounded-[16px] p-4 border border-hairline mx-2 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-mute uppercase tracking-wider">Contacts</span>
            <span className="text-xs font-bold text-ink font-display">0 / 1000</span>
          </div>
          <div className="w-full h-1.5 bg-surface-bone rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-primary w-[5%] rounded-full"></div>
          </div>
          <button className="button-outline w-full text-xs py-2 h-auto hover:bg-canvas">
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      {isLogoutDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000000]/40 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-surface-card w-[380px] rounded-[24px] p-8 shadow-xl border border-hairline relative z-[101] text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-5 border border-red-100">
              <LogOut size={24} className="text-red-600 ml-1" />
            </div>
            <h2 className="text-2xl font-bold font-display text-ink mb-2">Log out</h2>
            <p className="text-charcoal mb-8 text-sm leading-relaxed">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setIsLogoutDialogOpen(false)}
                className="button-outline flex-1"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setIsLogoutDialogOpen(false);
                  signOut();
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-base font-bold text-white transition-colors hover:bg-red-700 flex-1"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProtectedRoute>
          <div className="flex h-screen w-full bg-surface-bone overflow-hidden font-sans p-3">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content Island */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-card rounded-[24px] shadow-sm border border-hairline relative">
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
