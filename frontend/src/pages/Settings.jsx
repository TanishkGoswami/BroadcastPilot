import React, { useState, useEffect } from 'react';
import { X, Mail, Save, User, Smartphone, Check, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';

export default function Settings() {
  const { session, userProfile } = useAuth();
  const organizationId = userProfile?.organization_id;
  const authHeaders = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
  // Email Settings State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInfo, setEmailInfo] = useState({ senderName: '', senderEmail: '' });
  const [emailStatus, setEmailStatus] = useState({ status: 'not_connected', verificationStatus: 'not_started', lastError: '', metadata: {} });
  
  // SMS Settings State
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsInfo, setSmsInfo] = useState({
    businessName: '',
    website: '',
    useCase: '',
    sampleMessage: '',
    optInDescription: ''
  });
  const [smsStatus, setSmsStatus] = useState({ status: 'not_connected', verificationStatus: 'not_started', fromNumber: '', lastError: '', metadata: {} });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isFacebookConnected, setIsFacebookConnected] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);
  const [isEmailConnected, setIsEmailConnected] = useState(false);
  const [isSmsConnected, setIsSmsConnected] = useState(false);

  // WhatsApp State
  const [showWaModal, setShowWaModal] = useState(false);
  const [waStatus, setWaStatus] = useState('disconnected');
  const [waQr, setWaQr] = useState(null);
  const [waAccount, setWaAccount] = useState(null);

  useEffect(() => {
    const fetchSettingsStatus = async () => {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/settings/status`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await res.json();

        if (data.success) {
          setIsEmailConnected(Boolean(data.email?.connected));
          setIsSmsConnected(Boolean(data.sms?.connected));
          setEmailStatus({
            status: data.email?.status || 'not_connected',
            verificationStatus: data.email?.verificationStatus || 'not_started',
            lastError: data.email?.lastError || '',
            metadata: data.email?.metadata || {},
          });
          setSmsStatus({
            status: data.sms?.status || 'not_connected',
            verificationStatus: data.sms?.verificationStatus || 'not_started',
            fromNumber: data.sms?.fromNumber || '',
            lastError: data.sms?.lastError || '',
            metadata: data.sms?.metadata || {},
          });

          if (data.email?.senderEmail) {
            setEmailInfo({
              senderName: data.email.senderName || '',
              senderEmail: data.email.senderEmail || '',
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch email/SMS settings status:', err);
      }
    };

    const fetchMetaConnections = async () => {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/meta/status`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        if (data.success) {
          const connections = data.connections || [];
          setIsFacebookConnected(connections.some(c => c.page_id));
          setIsInstagramConnected(connections.some(c => c.instagram_id));
        }
      } catch (err) {
        console.error('Failed to fetch meta connections in Settings:', err);
      }
    };
    
    const fetchWaStatus = async () => {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/status`, {
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

    fetchSettingsStatus();
    fetchMetaConnections();
    fetchWaStatus();
  }, [session]);

  const handleSaveContactInfo = async () => {
    if (!organizationId || !session?.access_token) {
      alert('Workspace is still loading. Please wait a moment and try again.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/settings/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(emailInfo)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setIsEmailConnected(data.connection?.status === 'active');
      setEmailStatus({
        status: data.connection?.status || 'setup_required',
        verificationStatus: data.connection?.verification_status || 'not_started',
        lastError: data.connection?.last_error || '',
        metadata: data.connection?.metadata || {},
      });
      alert('Email sender saved successfully.');
      setShowEmailModal(false);
    } catch (error) {
      alert('Failed to save settings: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSmsInfo = async () => {
    if (!organizationId || !session?.access_token) {
      alert('Workspace is still loading. Please wait a moment and try again.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/settings/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(smsInfo)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setIsSmsConnected(data.connection?.status === 'active');
      setSmsStatus({
        status: data.connection?.status || 'pending_verification',
        verificationStatus: data.connection?.verification_status || 'pending_compliance',
        fromNumber: data.connection?.sender_identity || '',
        lastError: data.connection?.last_error || '',
        metadata: data.connection?.metadata || {},
      });
      alert(data.message || 'SMS setup saved.');
      setShowSmsModal(false);
    } catch (error) {
      alert('Failed to activate SMS: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getChannelStatusLabel = (status) => {
    const labels = {
      connected: 'Active',
      connect: 'Setup required',
      not_connected: 'Setup required',
      setup_required: 'Setup required',
      pending_verification: 'Pending verification',
      active: 'Active',
      paused: 'Paused',
      failed: 'Failed'
    };
    return labels[status] || 'Setup required';
  };

  const getChannelStatusClass = (status) => {
    if (status === 'connected' || status === 'active') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'pending_verification') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'failed' || status === 'paused') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-surface-bone text-charcoal border-hairline';
  };

  const getChannelButtonLabel = (channel) => {
    if (channel.status === 'connected' || channel.status === 'active') return 'Manage';
    if (channel.status === 'pending_verification') return 'Continue Setup';
    return 'Connect';
  };

  const handleConnectWa = async () => {
    setShowWaModal(true);
    setWaStatus('connecting');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/qr`, {
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
      await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/logout`, {
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
      status: smsStatus.status === 'active' ? 'active' : smsStatus.status,
      detail: smsStatus.fromNumber || 'Compliance required before broadcasts',
      lastError: smsStatus.lastError,
      badge: 'UPGRADE'
    },
    {
      id: 'email',
      name: 'Email',
      description: 'Use Email marketing for automation and rich content campaigns.',
      icon: <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">@</div>,
      status: emailStatus.status === 'active' ? 'active' : emailStatus.status,
      detail: emailInfo.senderEmail || 'Sender verification required',
      lastError: emailStatus.lastError,
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
    <div className="flex flex-col h-full w-full bg-transparent font-sans">
      
      {/* Global Header */}
      <div className="flex items-center justify-between px-8 py-8 border-b border-hairline z-10 shrink-0">
        <div>
          <h2 className="text-5xl font-bold font-display text-ink leading-none">Settings</h2>
          <p className="text-base text-charcoal mt-3">Connect channels and configure your workspace integrations.</p>
        </div>
      </div>

      {/* Main Settings Content */}
      <div className="flex-1 overflow-auto p-8 animate-fade-in-up">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold font-display text-ink">Connected Channels</h1>
            <div className="text-sm text-charcoal bg-surface-card px-4 py-1.5 rounded-[12px] border border-hairline">
              <span className="font-bold font-display text-ink">3</span> available integrations
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {channels.map((channel) => (
              <div key={channel.id} className="bg-surface-card border border-hairline rounded-[16px] p-6 flex flex-col items-center text-center hover:border-hairline-strong transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#0070d1]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="mb-5 rounded-[12px] bg-canvas p-3 border border-hairline group-hover:scale-110 transition-transform duration-300">
                  {channel.icon}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold font-display text-ink">{channel.name}</h3>
                  {channel.badge && (
                    <span className="bg-surface-bone text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {channel.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-charcoal mb-6 flex-1 px-2 leading-relaxed">
                  {channel.description}
                </p>
                <div className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${getChannelStatusClass(channel.status)}`}>
                  {(channel.status === 'active' || channel.status === 'connected') && <Check size={13} />}
                  {channel.status === 'pending_verification' && <Clock size={13} />}
                  {(channel.status === 'failed' || channel.status === 'paused') && <AlertTriangle size={13} />}
                  {getChannelStatusLabel(channel.status)}
                </div>
                {channel.detail && (
                  <p className="mb-4 min-h-[32px] text-xs leading-relaxed text-charcoal">{channel.detail}</p>
                )}
                
                <button 
                  className={`w-full ${
                    channel.status === 'connected' || channel.status === 'active'
                      ? 'button-outline justify-center'
                      : channel.status === 'reconnect' || channel.status === 'pending_verification'
                        ? 'button-outline justify-center' 
                        : 'button-primary justify-center'
                  }`}
                  onClick={() => {
                    if (channel.status === 'connected' && channel.id === 'telegram') return;
                    
                    if (channel.id === 'whatsapp') {
                      if (waStatus === 'connected') setShowWaModal(true);
                      else handleConnectWa();
                    } else if (channel.id === 'instagram') {
                      if (!organizationId) return alert('Workspace is still loading. Please wait a moment and try again.');
                      window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/meta/instagram?organizationId=${organizationId}`;
                    } else if (channel.id === 'facebook') {
                      if (!organizationId) return alert('Workspace is still loading. Please wait a moment and try again.');
                      window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/meta?organizationId=${organizationId}`;
                    } else if (channel.id === 'email') {
                      setShowEmailModal(true);
                    } else if (channel.id === 'sms') {
                      setShowSmsModal(true);
                    } else {
                      alert(`Connection for ${channel.name} is coming soon!`);
                    }
                  }}
                >
                  {getChannelButtonLabel(channel)}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Email Contact Info Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-[16px] shadow-2xl w-full max-w-md overflow-hidden border border-hairline">
            <div className="flex items-center justify-between p-5 border-b border-hairline bg-canvas">
              <h2 className="text-2xl font-bold font-display text-ink flex items-center gap-2">
                <Mail className="text-primary" size={24} />
                Email Sender
              </h2>
              <button onClick={() => setShowEmailModal(false)} className="text-mute hover:text-ink">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-surface-bone border border-hairline rounded-[12px] p-4 mb-2">
                <p className="text-sm text-ink font-bold">Set the sender name and reply email.</p>
                <p className="text-xs text-charcoal mt-1">Unverified domains are used as Reply-To while emails send from the verified platform address.</p>
                {emailStatus.verificationStatus && (
                  <p className="text-xs text-primary mt-2 font-semibold">Status: {emailStatus.verificationStatus.replace(/_/g, ' ')}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-mute uppercase tracking-wide mb-1">Sender Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                  <input type="text" value={emailInfo.senderName} onChange={e => setEmailInfo({...emailInfo, senderName: e.target.value})} className="text-input pl-9" placeholder="e.g. MetaBull Support" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-mute uppercase tracking-wide mb-1">Sender Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                  <input type="email" value={emailInfo.senderEmail} onChange={e => setEmailInfo({...emailInfo, senderEmail: e.target.value})} className="text-input pl-9" placeholder="e.g. hello@yourdomain.com" />
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-hairline bg-surface-card flex justify-end gap-3">
              <button onClick={() => setShowEmailModal(false)} className="button-outline border-transparent bg-transparent hover:border-hairline">Cancel</button>
              <button onClick={handleSaveContactInfo} disabled={isSaving} className="button-primary">
                {isSaving ? 'Saving...' : <><Save size={16} /> Save Settings</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Twilio Info Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-[16px] shadow-2xl w-full max-w-md overflow-hidden border border-hairline">
            <div className="flex items-center justify-between p-5 border-b border-hairline bg-canvas">
              <h2 className="text-2xl font-bold font-display text-ink flex items-center gap-2">
                <Smartphone className="text-primary" size={24} />
                SMS Compliance Setup
              </h2>
              <button onClick={() => setShowSmsModal(false)} className="text-mute hover:text-ink">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-surface-bone border border-hairline rounded-[12px] p-4 mb-2">
                <p className="text-sm text-ink font-bold">Request SMS broadcasting approval.</p>
                <p className="text-xs text-charcoal mt-1">We manage Twilio infrastructure, but carriers require business and opt-in details before SMS broadcasts are active.</p>
                {smsStatus.fromNumber && (
                  <p className="text-xs text-primary mt-2 font-semibold">Assigned number: {smsStatus.fromNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-mute uppercase tracking-wide mb-1">Business Name</label>
                <input
                  type="text"
                  value={smsInfo.businessName}
                  onChange={e => setSmsInfo({ ...smsInfo, businessName: e.target.value })}
                  className="text-input"
                  placeholder="e.g. MetaBull Universe"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-mute uppercase tracking-wide mb-1">Website</label>
                <input
                  type="url"
                  value={smsInfo.website}
                  onChange={e => setSmsInfo({ ...smsInfo, website: e.target.value })}
                  className="text-input"
                  placeholder="https://yourdomain.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-mute uppercase tracking-wide mb-1">Use Case</label>
                <input
                  type="text"
                  value={smsInfo.useCase}
                  onChange={e => setSmsInfo({ ...smsInfo, useCase: e.target.value })}
                  className="text-input"
                  placeholder="Promotions, reminders, lead follow-up"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-mute uppercase tracking-wide mb-1">Sample Message</label>
                <textarea
                  value={smsInfo.sampleMessage}
                  onChange={e => setSmsInfo({ ...smsInfo, sampleMessage: e.target.value })}
                  className="text-input min-h-[92px] resize-none"
                  placeholder="Hi {{First_Name}}, thanks for your interest. Reply STOP to opt out."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-mute uppercase tracking-wide mb-1">Opt-in Source</label>
                <textarea
                  value={smsInfo.optInDescription}
                  onChange={e => setSmsInfo({ ...smsInfo, optInDescription: e.target.value })}
                  className="text-input min-h-[92px] resize-none"
                  placeholder="Explain how contacts give consent, such as website form checkbox or lead ad disclosure."
                />
              </div>
            </div>
            
            <div className="p-5 border-t border-hairline bg-surface-card flex justify-end gap-3">
              <button onClick={() => setShowSmsModal(false)} className="button-outline border-transparent bg-transparent hover:border-hairline">Cancel</button>
              <button onClick={handleSaveSmsInfo} disabled={isSaving} className="button-primary">
                {isSaving ? 'Saving...' : <><Smartphone size={16} /> Save SMS Setup</>}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* WhatsApp Info / Connect Modal */}
      {showWaModal && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-[16px] shadow-2xl w-full max-w-md overflow-hidden border border-hairline">
            <div className="flex items-center justify-between p-5 border-b border-hairline bg-canvas">
              <h2 className="text-2xl font-bold font-display text-ink flex items-center gap-2">
                <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">Wa</div>
                WhatsApp
              </h2>
              <button onClick={() => setShowWaModal(false)} className="text-mute hover:text-ink">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5 text-center">
              {waStatus === 'connecting' && (
                <div className="py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-charcoal font-bold">Generating secure QR code...</p>
                </div>
              )}
              
              {waStatus === 'qr_ready' && waQr && (
                <div className="py-4">
                  <p className="text-sm text-ink font-bold mb-4">Open WhatsApp on your phone, tap Menu &gt; Linked Devices, and scan this code:</p>
                  <div className="bg-white p-4 border border-hairline rounded-[16px] inline-block shadow-sm">
                    <img src={waQr} alt="WhatsApp QR Code" className="w-64 h-64" />
                  </div>
                  <p className="text-xs text-charcoal mt-4">This screen will automatically close when connected.</p>
                </div>
              )}
              
              {waStatus === 'connected' && waAccount && (
                <div className="py-6">
                  <div className="w-16 h-16 bg-surface-bone text-primary border border-hairline rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} />
                  </div>
                  <h3 className="text-2xl font-bold font-display text-ink mb-1">WhatsApp is Connected</h3>
                  <p className="text-charcoal font-bold">Number: +{waAccount.display_phone_number}</p>
                </div>
              )}
              
              {waStatus === 'error' && (
                <div className="py-6 text-red-600">
                  <p className="font-bold">Failed to load QR code</p>
                  <p className="text-sm mt-2">Please close this window and try again.</p>
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-hairline bg-surface-card flex justify-end gap-3">
              <button onClick={() => setShowWaModal(false)} className="button-outline border-transparent bg-transparent hover:border-hairline">
                {waStatus === 'connected' ? 'Close' : 'Cancel'}
              </button>
              
              {waStatus === 'connected' && (
                <button onClick={handleDisconnectWa} className="button-outline border-red-200 text-red-600 bg-red-50 hover:bg-red-100">
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
