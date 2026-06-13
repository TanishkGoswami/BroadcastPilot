import React, { useState, useEffect } from 'react';
import { X, Mail, Save, User, MapPin, ToggleLeft, ToggleRight, Smartphone, Key, Hash, Check } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';

export default function Settings() {
  const { session, userProfile } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';

  // Email Settings State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [contactInfo, setContactInfo] = useState({ senderName: '', contactAddress: '', brandingEnabled: true });
  
  // SMS Settings State
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsInfo, setSmsInfo] = useState({ accountSid: '', authToken: '', fromNumber: '' });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isFacebookConnected, setIsFacebookConnected] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);

  // WhatsApp State
  const [showWaModal, setShowWaModal] = useState(false);
  const [waStatus, setWaStatus] = useState('disconnected');
  const [waQr, setWaQr] = useState(null);
  const [waAccount, setWaAccount] = useState(null);

  useEffect(() => {
    const fetchMetaConnections = async () => {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`${API_URL}/auth/meta/status`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        if (data.success && data.connections?.length > 0) {
          const hasFb = data.connections.some(c => c.page_id);
          const hasIg = data.connections.some(c => c.instagram_id);
          if (hasFb) setIsFacebookConnected(true);
          if (hasIg) setIsInstagramConnected(true);
        }
      } catch (err) {
        console.error('Failed to fetch meta connections in Settings:', err);
      }
    };
    
    const fetchWaStatus = async () => {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`${API_URL}/whatsapp/status`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        if (data.connected) {
          setWaStatus('connected');
          setWaAccount(data.account);
        } else {
          setWaStatus('disconnected');
        }
      } catch (err) {
        console.error('Failed to fetch WA status:', err);
      }
    };

    fetchMetaConnections();
    fetchWaStatus();
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

  const handleConnectWa = async () => {
    setShowWaModal(true);
    setWaStatus('connecting');
    try {
      const res = await fetch(`${API_URL}/whatsapp/qr`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (data.qr) {
        setWaQr(data.qr);
        setWaStatus('qr_ready');
      } else {
        setWaStatus('error');
      }
    } catch (err) {
      console.error(err);
      setWaStatus('error');
    }
  };

  const handleDisconnectWa = async () => {
    try {
      await fetch(`${API_URL}/whatsapp/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      setWaStatus('disconnected');
      setWaAccount(null);
      setWaQr(null);
    } catch (err) {
      console.error(err);
    }
  };

  const channels = [
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Supercharge your Instagram marketing with messaging automation.',
      icon: <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm">Ig</div>,
      status: isInstagramConnected ? 'connected' : 'connect',
      badge: null
    },

    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'Use the world\'s most popular messaging app to chat and engage your customers.',
      icon: <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">Wa</div>,
      status: waStatus === 'connected' ? 'connected' : 'connect',
      badge: null
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
    <div className="flex flex-col h-full w-full bg-[#f4f5f7] font-sans">
      
      {/* Global Header */}
      <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-100 shadow-sm z-10 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-[#1c1e21] tracking-tight">Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Connect channels and configure your workspace integrations.</p>
        </div>
      </div>

      {/* Main Settings Content */}
      <div className="flex-1 overflow-auto p-8 animate-fade-in-up">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-bold text-gray-900">Connected Channels</h1>
            <div className="text-sm text-gray-500 bg-white px-4 py-1.5 rounded-full border border-gray-200 shadow-sm">
              <span className="font-semibold text-gray-900">3</span> available integrations
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {channels.map((channel) => (
              <div key={channel.id} className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center text-center hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#0070d1]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="mb-5 shadow-sm rounded-2xl bg-gray-50 p-3 border border-gray-100 group-hover:scale-110 transition-transform duration-300">
                  {channel.icon}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{channel.name}</h3>
                  {channel.badge && (
                    <span className="bg-[#0070d1]/10 text-[#0070d1] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {channel.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-6 flex-1 px-2 leading-relaxed">
                  {channel.description}
                </p>
                
                <button 
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    channel.status === 'connected'
                      ? 'border border-green-200 bg-green-50 text-green-700 cursor-default shadow-sm'
                      : channel.status === 'reconnect' 
                        ? 'border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm' 
                        : 'bg-[#0070d1] text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                  }`}
                  onClick={() => {
                    if (channel.status === 'connected' && channel.id !== 'whatsapp' && channel.id !== 'facebook' && channel.id !== 'instagram') return;
                    
                    if (channel.id === 'whatsapp') {
                      if (waStatus === 'connected') setShowWaModal(true);
                      else handleConnectWa();
                    } else if (channel.id === 'instagram') {
                      const orgId = userProfile?.organization_id || session?.user?.user_metadata?.organization_id || 'test-org-123';
                      window.location.href = `${API_URL}/auth/meta/instagram?organizationId=${orgId}`;
                    } else if (channel.id === 'facebook') {
                      const orgId = userProfile?.organization_id || session?.user?.user_metadata?.organization_id || 'test-org-123';
                      window.location.href = `${API_URL}/auth/meta?organizationId=${orgId}`;
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
      
      {/* WhatsApp Info / Connect Modal */}
      {showWaModal && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[500px] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-xs">Wa</div>
                WhatsApp Connection
              </h2>
              <button onClick={() => setShowWaModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5 text-center">
              {waStatus === 'connecting' && (
                <div className="py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
                  <p className="mt-4 text-gray-600 font-medium">Generating secure QR code...</p>
                </div>
              )}
              
              {waStatus === 'qr_ready' && waQr && (
                <div className="py-4">
                  <p className="text-sm text-gray-700 font-medium mb-4">Open WhatsApp on your phone, tap Menu &gt; Linked Devices, and scan this code:</p>
                  <div className="bg-white p-4 border border-gray-200 rounded-xl inline-block shadow-sm">
                    <img src={waQr} alt="WhatsApp QR Code" className="w-64 h-64" />
                  </div>
                  <p className="text-xs text-gray-500 mt-4">This screen will automatically close when connected.</p>
                </div>
              )}
              
              {waStatus === 'connected' && waAccount && (
                <div className="py-6">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">WhatsApp is Connected</h3>
                  <p className="text-gray-600 font-medium">Number: +{waAccount.display_phone_number}</p>
                </div>
              )}
              
              {waStatus === 'error' && (
                <div className="py-6 text-red-600">
                  <p className="font-bold">Failed to load QR code</p>
                  <p className="text-sm mt-2">Please close this window and try again.</p>
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowWaModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                {waStatus === 'connected' ? 'Close' : 'Cancel'}
              </button>
              
              {waStatus === 'connected' && (
                <button onClick={handleDisconnectWa} className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md transition-colors">
                  Disconnect Account
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
