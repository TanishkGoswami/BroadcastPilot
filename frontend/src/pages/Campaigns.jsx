import React, { useState } from 'react';
import { 
  Plus, Search, Filter, Calendar, CheckCircle2, 
  ChevronRight, ArrowLeft, Smartphone, Clock, 
  MessageSquare, Mail, Send, Eye, MoreHorizontal, UserCircle, Settings, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthProvider';

// MOCK_BROADCASTS removed - using real data from backend
const CHANNELS = [
  { id: 'messenger', name: 'Messenger', icon: <MessageSquare className="text-blue-500" size={28} />, desc: 'Send to Facebook Messenger subscribers' },
  { id: 'instagram', name: 'Instagram', icon: <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">Ig</div>, desc: 'DM your Instagram followers' },
  { id: 'whatsapp', name: 'WhatsApp', icon: <div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center text-white font-bold text-xs">Wa</div>, desc: 'Send template messages on WhatsApp' },
  { id: 'sms', name: 'SMS', icon: <Smartphone className="text-emerald-500" size={28} />, desc: 'Text message your contacts' },
  { id: 'email', name: 'Email', icon: <Mail className="text-purple-500" size={28} />, desc: 'Rich HTML email campaigns' },
];

export default function Campaigns() {
  const { session, userProfile } = useAuth();
  const ORG_ID = userProfile?.organization_id || session?.user?.user_metadata?.organization_id || '847e859b-9bd7-4407-93c7-84e6b7a499f2';
  
  const [broadcasts, setBroadcasts] = React.useState([]);
  const [view, setView] = useState('list'); // 'list' or 'create'
  const [activeTab, setActiveTab] = useState('history'); // 'drafts', 'scheduled', 'history'
  
  // WhatsApp Template State
  const [metaTemplates, setMetaTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [mapping, setMapping] = useState({});

  React.useEffect(() => {
    if (session) {
      fetchBroadcasts();
      fetchMetaTemplates();
    }
  }, [session]);

  const fetchBroadcasts = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:3001/api/campaigns/list/${ORG_ID}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBroadcasts(data.broadcasts);
      }
    } catch (err) {
      console.error('Failed to fetch broadcasts', err);
    }
  };

  const fetchMetaTemplates = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3001/api/whatsapp/templates', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMetaTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch templates', err);
    }
  };
  
  // Creation Flow State
  const [step, setStep] = useState(1);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messageContent, setMessageContent] = useState('Hi {{First_Name}}, check out our latest offer!');
  const [emailSubject, setEmailSubject] = useState('Exclusive Update for You!');
  const [condition, setCondition] = useState('INTERESTED');
  const [schedule, setSchedule] = useState('now');
  const [isSending, setIsSending] = useState(false);

  const handleStartCreation = () => {
    setView('create');
    setStep(1);
    setSelectedChannel(null);
    setMessageContent('Hi {{First_Name}}, check out our latest offer!');
    setEmailSubject('Exclusive Update for You!');
  };

  const handleSend = async () => {
    setIsSending(true);
    
    try {
      if (selectedChannel === 'email') {
        const res = await fetch(`http://127.0.0.1:3001/api/email-campaigns/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: 'test-org-123',
            targetStatus: condition,
            subject: emailSubject,
            htmlBody: messageContent,
            campaignName: `Email Broadcast ${new Date().toLocaleDateString()}`
          })
        });
        
        if (!res.ok) {
          const err = await res.json();
          alert(`Error: ${err.error}`);
          return;
        }
      } else if (selectedChannel === 'sms') {
        const res = await fetch(`http://127.0.0.1:3001/api/sms-campaigns/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: 'test-org-123',
            leadStatusFilter: condition,
            messageContent: messageContent,
            campaignName: `SMS Broadcast ${new Date().toLocaleDateString()}`
          })
        });
        
        if (!res.ok) {
          const err = await res.json();
          alert(`Error: ${err.error}`);
          return;
        }
      } else if (selectedChannel === 'whatsapp') {
        if (!selectedTemplate) {
          alert('Please select a Meta Template first');
          setIsSending(false);
          return;
        }
        
        const res = await fetch(`http://127.0.0.1:3001/api/campaigns/broadcast`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            organizationId: ORG_ID,
            targetStatus: condition,
            templateName: selectedTemplate.name,
            templateLanguage: selectedTemplate.language,
            campaignName: `WhatsApp Broadcast ${new Date().toLocaleDateString()}`,
            mapping: mapping
          })
        });
        
        if (!res.ok) {
          let errorMsg = 'Unknown Error';
          try {
            const err = await res.json();
            errorMsg = err.error || errorMsg;
          } catch(e) {
            errorMsg = await res.text();
          }
          alert(`Server Error: ${errorMsg}`);
          setIsSending(false);
          return;
        }
      } else {
        await new Promise(r => setTimeout(r, 1500));
      }

      setView('list');
      setActiveTab('history');
      alert('Broadcast Scheduled Successfully!');
      fetchBroadcasts();
    } catch (error) {
      alert(`Failed to schedule broadcast: ${error.message}`);
      console.error('Broadcast Error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const renderListView = () => {
    const filteredBroadcasts = broadcasts.filter(b => {
      if (activeTab === 'drafts') return b.status === 'draft';
      if (activeTab === 'scheduled') return b.status === 'scheduled';
      if (activeTab === 'history') return b.status === 'sent' || b.status === 'processing' || b.status === 'completed';
      return true;
    });

    return (
      <div className="flex flex-col h-full bg-[#f4f5f7] font-sans">
        <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-100 shadow-sm z-10 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Broadcasts</h1>
            <p className="text-sm text-gray-500 mt-1">Manage and track your marketing campaigns.</p>
          </div>
          <button 
            onClick={handleStartCreation}
            className="flex items-center gap-2 bg-[#0070d1] hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={18} />
            New Broadcast
          </button>
        </div>

        <div className="flex-1 p-8 overflow-auto flex flex-col relative animate-fade-in-up">
          <div className="max-w-6xl mx-auto w-full flex flex-col h-full">
            {/* Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                <button 
                  onClick={() => setActiveTab('drafts')}
                  className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'drafts' ? 'bg-[#0070d1] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                  Drafts
                </button>
                <button 
                  onClick={() => setActiveTab('scheduled')}
                  className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'scheduled' ? 'bg-[#0070d1] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                  Scheduled
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'history' ? 'bg-[#0070d1] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                  History
                </button>
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search broadcasts..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 text-sm font-medium transition-all shadow-sm">
                  <Filter size={16} />
                  Filters
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col flex-1">
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-gray-50/80 border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Target</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sent / Read</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBroadcasts.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                        No broadcasts found in this category.
                      </td>
                    </tr>
                  ) : filteredBroadcasts.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50/80 transition-colors group cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                            {CHANNELS.find(c => c.id === b.channel)?.icon || <MessageSquare size={16} className="text-gray-500" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{b.name}</p>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border mt-1 ${
                              b.status === 'sent' || b.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                              b.status === 'scheduled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              b.status === 'processing' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                            }`}>
                              {b.status}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">{b.targets.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Sent</p>
                            <p className="text-sm font-medium text-gray-900">{b.sent.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Read</p>
                            <p className="text-sm font-medium text-gray-900">{b.read > 0 ? `${Math.round((b.read / b.sent) * 100)}%` : '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{b.date}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-gray-400 hover:text-gray-700 p-1.5 rounded-md hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100">
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
    );
  };

  const renderCreationFlow = () => {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Stepper Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shadow-sm shrink-0 relative z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('list')}
              className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            
            {/* Steps */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${step === 1 ? 'bg-blue-50 text-blue-700 font-medium' : step > 1 ? 'text-gray-900 cursor-pointer hover:bg-gray-50' : 'text-gray-400'}`} onClick={() => step > 1 && setStep(1)}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? 'bg-blue-600 text-white' : step > 1 ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-500'}`}>1</span>
                Channel
              </div>
              <ChevronRight size={16} className="text-gray-300" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${step === 2 ? 'bg-blue-50 text-blue-700 font-medium' : step > 2 ? 'text-gray-900 cursor-pointer hover:bg-gray-50' : 'text-gray-400'}`} onClick={() => step > 2 && setStep(2)}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-blue-600 text-white' : step > 2 ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
                Content
              </div>
              <ChevronRight size={16} className="text-gray-300" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${step === 3 ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</span>
                Settings
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5">Save Draft</button>
            {step < 3 ? (
              <button 
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !selectedChannel}
                className="bg-[#0070d1] hover:bg-blue-700 text-white px-5 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                Next Step
                <ChevronRight size={16} />
              </button>
            ) : (
              <button 
                onClick={handleSend}
                disabled={isSending}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSending ? 'Scheduling...' : <><Send size={16} /> Schedule Broadcast</>}
              </button>
            )}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-auto bg-[#f9fafb]">
          
          {step === 1 && (
            <div className="max-w-4xl mx-auto py-12 px-8">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Choose a Channel</h2>
                <p className="text-gray-500">Select the platform where you want to send this broadcast.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {CHANNELS.map(channel => (
                  <div 
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel.id)}
                    className={`bg-white border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-md ${selectedChannel === channel.id ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-4">
                        {channel.icon}
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{channel.name}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{channel.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex h-full">
              {/* Left: Editor */}
              <div className="flex-1 border-r border-gray-200 bg-white p-8 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Message Content</h2>
                  <p className="text-sm text-gray-500 mt-1">Design your broadcast flow. Add text, buttons, or images.</p>
                </div>
                
                <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 p-6 relative flex flex-col items-center">
                  {selectedChannel === 'email' ? (
                    <div className="w-[600px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mx-auto flex flex-col h-full">
                      <div className="bg-purple-600 px-4 py-3 flex items-center gap-2 shrink-0">
                        <Mail size={16} className="text-white" />
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Email Composer</span>
                      </div>
                      <div className="p-5 flex flex-col flex-1 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Subject Line</label>
                          <input 
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            className="w-full text-sm text-gray-900 border border-gray-300 rounded p-2 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                            placeholder="Enter email subject"
                          />
                        </div>
                        <div className="flex-1 flex flex-col">
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Email Body (HTML/Text)</label>
                          <textarea 
                            className="flex-1 w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono bg-gray-50"
                            value={messageContent}
                            onChange={(e) => setMessageContent(e.target.value)}
                            placeholder="<h1>Hello {{First_Name}},</h1><p>Your content here...</p>"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-[450px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mx-auto flex flex-col h-full">
                      <div className="bg-[#25D366] px-4 py-3 flex items-center gap-2 shrink-0">
                        <MessageSquare size={16} className="text-white" />
                        <span className="text-sm font-bold text-white uppercase tracking-wider">WhatsApp Template</span>
                      </div>
                      <div className="p-5 flex flex-col flex-1 gap-4 overflow-y-auto">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Select Template</label>
                          <select 
                            className="w-full text-sm text-gray-900 border border-gray-300 rounded p-2 outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
                            onChange={(e) => {
                              const tmpl = metaTemplates.find(t => t.id === e.target.value);
                              setSelectedTemplate(tmpl);
                              setMapping({});
                            }}
                            value={selectedTemplate?.id || ''}
                          >
                            <option value="" disabled>Choose an approved template</option>
                            {metaTemplates.filter(t => t.status === 'APPROVED').map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                            ))}
                          </select>
                        </div>
                        
                        {selectedTemplate && (
                          <div className="flex-1 flex flex-col gap-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Template Variables</label>
                            {selectedTemplate.components.map((comp, idx) => {
                                if (comp.type === 'BODY' && comp.example?.body_text?.[0]) {
                                  // Example: ["Tanishk", "Product"] -> implies {{1}}, {{2}} exist
                                  return comp.example.body_text[0].map((ex, vIdx) => (
                                    <div key={`body-${vIdx}`}>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">Variable {'{{' + (vIdx + 1) + '}}'} (e.g., "{ex}")</label>
                                      <input 
                                        type="text"
                                        placeholder="Enter value or use Lead field (e.g. name)"
                                        className="w-full text-sm border border-gray-300 rounded p-2 outline-none focus:border-[#25D366]"
                                        value={mapping[vIdx + 1] || ''}
                                        onChange={(e) => setMapping({...mapping, [vIdx + 1]: e.target.value})}
                                      />
                                    </div>
                                  ));
                                }
                                return null;
                            })}
                            {Object.keys(mapping).length === 0 && (
                              <p className="text-sm text-gray-500 italic">This template requires no variables.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Preview */}
              <div className="w-[400px] bg-gray-50 p-8 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-6 text-gray-500">
                  <Eye size={18} />
                  <span className="text-sm font-medium">Live Preview</span>
                </div>
                
                  {/* Phone Mockup or Desktop Mockup based on channel */}
                {selectedChannel === 'email' ? (
                  <div className="w-full h-[500px] bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col mt-4">
                    <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex flex-col gap-1 shrink-0">
                      <div className="text-sm"><span className="font-medium text-gray-500 w-16 inline-block">From:</span> <span className="text-gray-900">hello@broadcastpilot.com</span></div>
                      <div className="text-sm"><span className="font-medium text-gray-500 w-16 inline-block">To:</span> <span className="text-gray-900">subscriber@example.com</span></div>
                      <div className="text-sm"><span className="font-medium text-gray-500 w-16 inline-block">Subject:</span> <span className="text-gray-900 font-medium">{emailSubject || '(No Subject)'}</span></div>
                    </div>
                    <div className="flex-1 p-6 overflow-auto bg-white text-gray-800 text-sm" dangerouslySetInnerHTML={{ __html: messageContent || '<p>Start typing HTML to see preview...</p>' }} />
                  </div>
                ) : (
                  <div className="w-[300px] h-[600px] bg-white rounded-[40px] shadow-xl border-[8px] border-gray-900 overflow-hidden relative flex flex-col">
                    {/* Notch */}
                    <div className="absolute top-0 inset-x-0 h-6 bg-gray-900 rounded-b-3xl w-40 mx-auto z-20"></div>
                    
                    {/* Phone Header */}
                    <div className="bg-gray-100 px-4 pt-10 pb-3 border-b border-gray-200 flex items-center gap-3 shrink-0">
                      <ArrowLeft size={18} className="text-[#25D366]" />
                      <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">BP</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-900">BroadcastPilot</p>
                        <p className="text-[10px] text-gray-500">Business Account</p>
                      </div>
                    </div>

                    {/* Phone Screen */}
                    <div className="flex-1 bg-[#e5ddd5] p-4 flex flex-col gap-3 overflow-y-auto">
                      <div className="bg-white p-3 rounded-2xl rounded-tl-none max-w-[85%] shadow-sm relative self-start">
                        {selectedTemplate ? (
                          <div className="text-sm text-gray-900 whitespace-pre-wrap">
                            {selectedTemplate.components.map((comp, i) => {
                              if (comp.type === 'BODY') {
                                let txt = comp.text;
                                // Inject mappings for preview
                                Object.keys(mapping).forEach(k => {
                                  txt = txt.replace(`{{${k}}}`, mapping[k] || `{{${k}}}`);
                                });
                                return <p key={i}>{txt}</p>;
                              }
                              return null;
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Select a template to preview...</p>
                        )}
                        <span className="text-[9px] text-gray-400 absolute bottom-1 right-2">12:00 PM</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-4xl mx-auto py-10 px-8 flex gap-8">
              {/* Settings Form */}
              <div className="flex-1 space-y-8">
                
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Users size={20} className="text-gray-400" /> Target Audience
                  </h3>
                  
                  {selectedChannel === 'email' ? (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Send Email To:</label>
                      <select 
                        value={condition === 'Tag is "VIP"' ? 'Interested Leads' : condition}
                        onChange={(e) => setCondition(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                      >
                        <option value="Interested Leads">All Interested Leads (Recommended)</option>
                        <option value="All Leads">All Pending Leads</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-2">Emails will only be sent to leads that have a valid email address on file.</p>
                    </div>
                  ) : selectedChannel === 'sms' ? (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Send SMS To:</label>
                      <select 
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                      >
                        <option value="INTERESTED">All Interested Leads (Recommended)</option>
                        <option value="PENDING">All Pending Leads</option>
                        <option value="NOT_INTERESTED">Not Interested Leads</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-2">Texts will only be sent to leads that have a valid phone number on file.</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Send WhatsApp To:</label>
                      <select 
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-green-500 outline-none"
                      >
                        <option value="INTERESTED">All Interested Leads</option>
                        <option value="PENDING">All Pending Leads</option>
                        <option value="NOT_INTERESTED">Not Interested Leads</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-2">Messages will only be sent to leads matching this status.</p>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Settings size={20} className="text-gray-400" /> Broadcast Settings
                  </h3>
                  
                  <div className="space-y-6">
                    {selectedChannel !== 'email' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Message Type</label>
                        <select className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none">
                          <option>Promotional Message</option>
                          <option>Non-Promotional / Update</option>
                          <option>Subscription Message</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Make sure you comply with the platform's 24-hour messaging rule.</p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Schedule</label>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input 
                            type="radio" 
                            name="schedule" 
                            checked={schedule === 'now'}
                            onChange={() => setSchedule('now')}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" 
                          />
                          <span className="text-sm text-gray-900 font-medium">Start sending now</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input 
                            type="radio" 
                            name="schedule"
                            checked={schedule === 'later'}
                            onChange={() => setSchedule('later')}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" 
                          />
                          <span className="text-sm text-gray-900 font-medium">Schedule for later</span>
                        </label>
                      </div>
                      
                      {schedule === 'later' && (
                        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-4">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                            <input type="date" className="w-full border border-gray-300 rounded text-sm p-2 outline-none" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                            <input type="time" className="w-full border border-gray-300 rounded text-sm p-2 outline-none" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Summary Sidebar */}
              <div className="w-[280px]">
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm sticky top-8">
                  <h4 className="font-bold text-gray-900 mb-4">Summary</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                      <span className="text-sm text-gray-500">Channel</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">{selectedChannel}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                      <span className="text-sm text-gray-500">Target Reach</span>
                      <span className="text-sm font-bold text-green-600">~1,240 users</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Cost</span>
                      <span className="text-sm font-medium text-gray-900">Free</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleSend}
                    disabled={isSending}
                    className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {isSending ? 'Sending...' : <><Send size={16} /> Schedule Broadcast</>}
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <>
      {view === 'list' ? renderListView() : renderCreationFlow()}
    </>
  );
}
