import React, { useState, useEffect } from 'react';
import { X, Mail, Save, User, MapPin, ToggleLeft, ToggleRight, Smartphone, Key, Hash, Check } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';

export default function Settings() {
  const { session } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';

  // Email Settings State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [contactInfo, setContactInfo] = useState({ senderName: '', contactAddress: '', brandingEnabled: true });
  
  // SMS Settings State
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsInfo, setSmsInfo] = useState({ accountSid: '', authToken: '', fromNumber: '' });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isFacebookConnected, setIsFacebookConnected] = useState(false);

  useEffect(() => {
    const fetchMetaConnections = async () => {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`${API_URL}/auth/meta/status`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        if (data.success && data.connections?.length > 0) {
          setIsFacebookConnected(true);
        }
      } catch (err) {
        console.error('Failed to fetch meta connections in Settings:', err);
      }
    };
    fetchMetaConnections();
  }, [session, API_URL]);

  const handleSaveContactInfo = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`http://localhost:3001/api/settings/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: 'test-org-123',
          ...contactInfo
        })
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Contact information saved successfully!');
      setShowEmailModal(false);
    } catch (error) {
      alert('Failed to save settings: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSmsInfo = async () => {
    setIsSaving(true);
    try {
      const mockAssignedNumber = '+18166536732';
      
      const res = await fetch(`http://127.0.0.1:3001/api/settings/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: 'test-org-123',
          accountSid: 'MASTER_ACCOUNT_SID', // To be replaced by backend .env logic later
          authToken: 'MASTER_AUTH_TOKEN', 
          fromNumber: mockAssignedNumber
        })
      });
      if (!res.ok) throw new Error(await res.text());
      alert(`SMS Activated! Your assigned number is ${mockAssignedNumber}`);
      setShowSmsModal(false);
    } catch (error) {
      alert('Failed to activate SMS: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const channels = [
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Supercharge your Instagram marketing with messaging automation.',
      icon: <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm">Ig</div>,
      status: 'connect',
      badge: null
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      description: 'Elevate your marketing with TikTok\'s seamless automation.',
      icon: <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold italic text-sm">d</div>,
      status: 'connect',
      badge: null
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'Use the world\'s most popular messaging app to chat and engage your customers.',
      icon: <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">Wa</div>,
      status: 'connect',
      badge: 'UPGRADE'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      description: 'Build relationships with customers through interactive and tailored content.',
      icon: <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">f</div>,
      status: isFacebookConnected ? 'connected' : 'connect',
      badge: null
    },
    {
      id: 'sms',
      name: 'SMS',
      description: 'Collect phone numbers and reengage your contacts via text.',
      icon: <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-xs">SMS</div>,
      status: 'connect',
      badge: 'UPGRADE'
    },
    {
      id: 'email',
      name: 'Email',
      description: 'Use Email marketing for automation and rich content campaigns.',
      icon: <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">@</div>,
      status: 'connect',
      badge: 'UPGRADE'
    },
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Unleash the power of limitless Telegram messaging automation.',
      icon: <div className="w-8 h-8 bg-blue-400 text-white rounded-full flex items-center justify-center font-bold text-sm">Tg</div>,
      status: 'connect',
      badge: null
    }
  ];

  return (
    <div className="flex h-full w-full">
      {/* Settings Sidebar */}
      <div className="w-64 border-r border-gray-200 bg-gray-50/50 flex flex-col">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900">Settings</h2>
        </div>
        <nav className="flex-1">
          <div className="px-3 space-y-1">
            <a href="#" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-900 bg-white shadow-sm border border-gray-200">
              Channels
            </a>
            <a href="#" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
              General
            </a>
            <a href="#" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
              Notifications
            </a>
            <a href="#" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
              Billing
            </a>
          </div>
        </nav>
      </div>

      {/* Main Settings Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">Connect Channel</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {channels.map((channel) => (
              <div key={channel.id} className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow">
                <div className="mb-4">
                  {channel.icon}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-base font-bold text-gray-900">{channel.name}</h3>
                  {channel.badge && (
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                      {channel.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-6 flex-1">
                  {channel.description}
                </p>
                
                <button 
                  className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors border flex items-center justify-center gap-2 ${
                    channel.status === 'connected'
                      ? 'border-green-200 bg-green-50 text-green-700 cursor-default'
                      : channel.status === 'reconnect' 
                        ? 'border-gray-300 text-gray-700 hover:bg-gray-50' 
                        : 'border-gray-200 text-gray-900 hover:border-gray-300 shadow-sm'
                  }`}
                  onClick={() => {
                    if (channel.status === 'connected') return; // Do nothing if already connected
                    
                    if (channel.id === 'whatsapp') {
                      alert('WhatsApp connection modal will open here.');
                    } else if (channel.id === 'email') {
                      setShowEmailModal(true);
                    } else if (channel.id === 'sms') {
                      setShowSmsModal(true);
                    } else {
                      alert(`Connection for ${channel.name} is coming soon!`);
                    }
                  }}
                >
                  {channel.status === 'connected' && <Check size={16} className="text-green-600" />}
                  {channel.status === 'connected' ? 'Connected' : channel.status === 'reconnect' ? 'Reconnect' : 'Connect'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Email Contact Info Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[500px] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Mail className="text-purple-600" size={20} />
                Email Settings
              </h2>
              <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-2">
                <p className="text-sm text-blue-800 font-medium">Emails will be sent from <span className="font-bold">noreply@broadcastpilot.com</span>.</p>
                <p className="text-xs text-blue-600 mt-1">Customize how your brand appears to recipients below.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Sender Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={contactInfo.senderName} onChange={e => setContactInfo({...contactInfo, senderName: e.target.value})} className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all" placeholder="e.g. MetaBull Support" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Contact Address</label>
                <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">This physical address will be included at the bottom of your emails to comply with anti-spam laws.</p>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                  <textarea value={contactInfo.contactAddress} onChange={e => setContactInfo({...contactInfo, contactAddress: e.target.value})} className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all resize-none h-20" placeholder="123 Business Rd, Suite 100&#10;Tech City, CA 94000" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-bold text-gray-900">Show Branding</label>
                  <p className="text-xs text-gray-500 mt-0.5">Include "Powered by BroadcastPilot" at the bottom of emails.</p>
                </div>
                <button 
                  onClick={() => setContactInfo({...contactInfo, brandingEnabled: !contactInfo.brandingEnabled})}
                  className="text-purple-600 hover:text-purple-700 transition-colors"
                >
                  {contactInfo.brandingEnabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} className="text-gray-400" />}
                </button>
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowEmailModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">Cancel</button>
              <button onClick={handleSaveContactInfo} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-bold shadow-sm transition-colors disabled:opacity-50">
                {isSaving ? 'Saving...' : <><Save size={16} /> Save Settings</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Twilio Info Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[500px] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Smartphone className="text-emerald-600" size={20} />
                Twilio SMS Settings
              </h2>
              <button onClick={() => setShowSmsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-2">
                <p className="text-sm text-emerald-800 font-medium">Activate SMS Broadcasting for your account.</p>
                <p className="text-xs text-emerald-600 mt-1">When you activate, our team will automatically assign a dedicated Twilio phone number to your business for sending messages.</p>
              </div>

              <div className="flex items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <div className="text-center">
                  <Smartphone className="mx-auto text-gray-400 mb-2" size={32} />
                  <p className="text-sm font-medium text-gray-900">No technical setup required</p>
                  <p className="text-xs text-gray-500 mt-1">We handle the Twilio infrastructure for you.</p>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowSmsModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">Cancel</button>
              <button onClick={handleSaveSmsInfo} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-bold shadow-sm transition-colors disabled:opacity-50">
                {isSaving ? 'Activating...' : <><Smartphone size={16} /> Activate SMS & Get Number</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
