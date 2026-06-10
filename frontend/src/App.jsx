import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Contacts from './pages/Contacts';
import Campaigns from './pages/Campaigns';
import Inbox from './pages/Inbox';
import Settings from './pages/Settings';
import { 
  Users, 
  MessageSquare, 
  Radio, 
  Settings as SettingsIcon,
  HelpCircle
} from 'lucide-react';

function Sidebar() {
  const location = useLocation();

  const getLinkClass = (path) => {
    const isActive = location.pathname === path || (path === '/contacts' && location.pathname === '/');
    return `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg mx-2 ${
      isActive 
        ? 'text-gray-900 bg-gray-100' 
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    }`;
  };

  return (
    <div className="w-[260px] bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
      {/* Brand Header */}
      <div className="h-[72px] flex items-center px-6 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          BroadcastPilot
        </h1>
      </div>

      {/* Account Switcher Mock */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-600 font-semibold text-xs">BP</span>
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-sm font-medium text-gray-900 truncate">My Account</span>
            <span className="text-xs text-white bg-green-600 rounded px-1.5 py-0.5 self-start mt-0.5">PRO</span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1">
        <Link to="/" className={getLinkClass('/contacts')}>
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
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-gray-100 flex flex-col gap-3">
        <div className="flex items-center gap-3 px-2 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 cursor-pointer">
          <div className="w-6 h-6 rounded-full bg-gray-200"></div>
          <span>My Profile</span>
        </div>
        <div className="flex items-center gap-3 px-2 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 cursor-pointer">
          <HelpCircle size={18} />
          <span>Help</span>
        </div>
        
        <div className="mt-2 bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <div className="w-3 h-3 rounded-full border-2 border-gray-300"></div>
            <span>Contacts limit: 0/1000</span>
          </div>
          <button className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 px-4 rounded transition-colors">
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
      <div className="flex h-screen w-full bg-[#f8f9fa] overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white rounded-tl-xl border-t border-l border-gray-200 shadow-sm mt-2">
          <Routes>
            <Route path="/" element={<Contacts />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
