import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  MessageSquare, 
  Radio, 
  TrendingUp,
  ArrowRight,
  Clock,
  UserCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthProvider';


export default function Dashboard() {
  const { session, userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [leads, setLeads] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.access_token) {
      fetchAllData();
    }
  }, [session, userProfile]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL;
      const headers = { 'Authorization': `Bearer ${session.access_token}` };
      
      const [leadsRes, convRes] = await Promise.all([
        fetch(`${API_BASE}/api/leads`, { headers }),
        fetch(`${API_BASE}/api/chat/conversations`, { headers })
      ]);
      
      const leadsData = await leadsRes.json();
      const convData = await convRes.json();
      
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setConversations(Array.isArray(convData) ? convData : []);

      if (userProfile?.organization_id) {
        const campRes = await fetch(`${API_BASE}/api/campaigns/list/${userProfile.organization_id}`, { headers });
        const campData = await campRes.json();
        if (campData.success && Array.isArray(campData.broadcasts)) {
          setCampaigns(campData.broadcasts);
        }
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const activeCampaigns = campaigns.filter(c => c.status !== 'completed').length;
  const recentLeads = [...leads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  const recentConversations = [...conversations].sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)).slice(0, 5);

  const getDisplayName = (contact) => {
    if (!contact) return "Unknown";
    if (contact.custom_name) return contact.custom_name;
    if (contact.name && !/^\d+$/.test(contact.name)) return contact.name;
    return contact.phone || contact.wa_id || "Unknown";
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-transparent">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-transparent font-sans">
      {/* Global Header */}
      <div className="flex items-center justify-between px-8 py-8 border-b border-hairline z-10 shrink-0">
        <div>
          <h1 className="page-title text-5xl">Overview Dashboard</h1>
          <p className="text-base text-charcoal mt-3">Welcome back! Here's what's happening today.</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 animate-fade-in-up">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Total Leads Card */}
            <div className="bg-surface-card rounded-[16px] p-8 border border-hairline relative group transition-all duration-300 hover:border-hairline-strong hover:-translate-y-1">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-charcoal text-sm font-semibold tracking-wide uppercase mb-3">Total Leads</p>
                  <h3 className="metric-value text-6xl">{leads.length}</h3>
                </div>
                <div className="p-3 bg-canvas text-ink rounded-full border border-hairline">
                  <Users size={24} />
                </div>
              </div>
              <div className="mt-8 flex items-center text-sm font-semibold text-ink relative z-10 bg-badge-success text-on-dark w-fit px-3 py-1 rounded-full">
                <TrendingUp size={14} className="mr-1.5" />
                <span>Growing steadily</span>
              </div>
            </div>

            {/* Open Conversations Card */}
            <div className="bg-surface-card rounded-[16px] p-8 border border-hairline relative group transition-all duration-300 hover:border-hairline-strong hover:-translate-y-1">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-charcoal text-sm font-semibold tracking-wide uppercase mb-3">Open Chats</p>
                  <h3 className="metric-value text-6xl">{conversations.length}</h3>
                </div>
                <div className="p-3 bg-canvas text-ink rounded-full border border-hairline">
                  <MessageSquare size={24} />
                </div>
              </div>
              <div className="mt-8 flex items-center text-sm font-semibold text-ink relative z-10 bg-canvas w-fit px-3 py-1 rounded-full border border-hairline">
                <Clock size={14} className="mr-1.5" />
                <span>Awaiting response</span>
              </div>
            </div>

            {/* Active Broadcasts Card */}
            <div className="bg-surface-card rounded-[16px] p-8 border border-hairline relative group transition-all duration-300 hover:border-hairline-strong hover:-translate-y-1">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-charcoal text-sm font-semibold tracking-wide uppercase mb-3">Active Broadcasts</p>
                  <h3 className="metric-value text-6xl">{activeCampaigns}</h3>
                </div>
                <div className="p-3 bg-canvas text-ink rounded-full border border-hairline">
                  <Radio size={24} />
                </div>
              </div>
              <div className="mt-8 flex items-center text-sm font-semibold text-on-dark relative z-10 bg-badge-success w-fit px-3 py-1 rounded-full border border-badge-success">
                <Radio size={14} className="mr-1.5" />
                <span>Currently running</span>
              </div>
            </div>

          </div>

          {/* Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Recent Messages */}
            <div className="bg-surface-card rounded-[16px] border border-hairline p-8 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="section-title text-3xl">Recent Messages</h2>
                <button 
                  onClick={() => navigate('/inbox')}
                  className="button-ghost text-primary"
                >
                  Go to Inbox <ArrowRight size={16} />
                </button>
              </div>
              
              <div className="flex flex-col gap-3">
                {recentConversations.length === 0 ? (
                  <div className="text-center py-12 bg-canvas rounded-2xl border border-hairline">
                    <p className="text-sm font-medium text-charcoal">No recent messages.</p>
                  </div>
                ) : (
                  recentConversations.map(conv => (
                    <div key={conv.id} className="flex items-center gap-4 p-4 rounded-xl hover:bg-surface-bone transition-all border border-transparent cursor-pointer group" onClick={() => navigate('/inbox')}>
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-canvas border border-hairline">
                        {conv.contacts?.profile_pic ? (
                          <img src={conv.contacts.profile_pic} alt="avatar" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(getDisplayName(conv.contacts))}&background=random`} alt="avatar" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-[15px] font-bold text-ink truncate">{getDisplayName(conv.contacts)}</p>
                          <span className="text-xs font-semibold text-mute whitespace-nowrap bg-canvas px-2.5 py-1 rounded-full border border-hairline">{formatTime(conv.last_message_at)}</span>
                        </div>
                        <p className="text-sm text-charcoal truncate">{conv.last_message_preview || 'New message'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Leads */}
            <div className="bg-surface-card rounded-[16px] border border-hairline p-8 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="section-title text-3xl">New Leads</h2>
                <button 
                  onClick={() => navigate('/contacts')}
                  className="button-ghost text-primary"
                >
                  View All <ArrowRight size={16} />
                </button>
              </div>
              
              <div className="flex flex-col gap-3">
                {recentLeads.length === 0 ? (
                  <div className="text-center py-12 bg-canvas rounded-2xl border border-hairline">
                    <p className="text-sm font-medium text-charcoal">No new leads yet.</p>
                  </div>
                ) : (
                  recentLeads.map(lead => (
                    <div key={lead.id} className="flex items-center gap-4 p-4 rounded-xl hover:bg-surface-bone transition-all border border-transparent group cursor-pointer">
                      <div className="w-12 h-12 rounded-full bg-canvas text-ink flex items-center justify-center shrink-0 border border-hairline group-hover:scale-105 transition-transform">
                        <UserCircle size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-ink truncate">{lead.name}</p>
                        <p className="text-sm text-charcoal truncate font-medium mt-0.5">{lead.phone || lead.email}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-canvas border border-hairline text-charcoal">
                          {lead.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
