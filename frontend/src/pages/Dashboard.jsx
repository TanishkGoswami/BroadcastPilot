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
  const { session, user } = useAuth();
  const navigate = useNavigate();
  
  const [leads, setLeads] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.access_token) {
      fetchAllData();
    }
  }, [session]);

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

      // Fetch campaigns requires orgId if we use the list endpoint, 
      // but let's see if the user object has organization_id
      const orgId = user?.user_metadata?.organization_id || user?.organization_id;
      if (orgId) {
        const campRes = await fetch(`${API_BASE}/api/campaigns/list/${orgId}`, { headers });
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
      <div className="flex h-full w-full items-center justify-center bg-[#f4f5f7]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#f4f5f7] font-sans">
      {/* Global Header */}
      <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-100 shadow-sm z-10 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#1c1e21] tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 animate-fade-in-up">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Total Leads Card */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
              <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 transform group-hover:scale-110 transition-transform duration-500"></div>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-gray-500 text-sm font-semibold tracking-wide uppercase mb-1">Total Leads</p>
                  <h3 className="text-4xl font-black text-gray-900 tracking-tight">{leads.length}</h3>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users size={24} />
                </div>
              </div>
              <div className="mt-6 flex items-center text-sm font-semibold text-emerald-600 relative z-10 bg-emerald-50 w-fit px-3 py-1 rounded-full">
                <TrendingUp size={14} className="mr-1.5" />
                <span>Growing steadily</span>
              </div>
            </div>

            {/* Open Conversations Card */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
              <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transform group-hover:scale-110 transition-transform duration-500"></div>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-gray-500 text-sm font-semibold tracking-wide uppercase mb-1">Open Chats</p>
                  <h3 className="text-4xl font-black text-gray-900 tracking-tight">{conversations.length}</h3>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <MessageSquare size={24} />
                </div>
              </div>
              <div className="mt-6 flex items-center text-sm font-semibold text-blue-600 relative z-10 bg-blue-50 w-fit px-3 py-1 rounded-full">
                <Clock size={14} className="mr-1.5" />
                <span>Awaiting response</span>
              </div>
            </div>

            {/* Active Broadcasts Card */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
              <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 transform group-hover:scale-110 transition-transform duration-500"></div>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-gray-500 text-sm font-semibold tracking-wide uppercase mb-1">Active Broadcasts</p>
                  <h3 className="text-4xl font-black text-gray-900 tracking-tight">{activeCampaigns}</h3>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Radio size={24} />
                </div>
              </div>
              <div className="mt-6 flex items-center text-sm font-semibold text-emerald-600 relative z-10 bg-emerald-50 w-fit px-3 py-1 rounded-full">
                <Radio size={14} className="mr-1.5" />
                <span>Currently running</span>
              </div>
            </div>

          </div>

          {/* Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Recent Messages */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-7 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Recent Messages</h2>
                <button 
                  onClick={() => navigate('/inbox')}
                  className="text-sm font-bold text-[#0070d1] hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  Go to Inbox <ArrowRight size={16} />
                </button>
              </div>
              
              <div className="flex flex-col gap-3">
                {recentConversations.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-sm font-medium text-gray-500">No recent messages.</p>
                  </div>
                ) : (
                  recentConversations.map(conv => (
                    <div key={conv.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100 cursor-pointer group" onClick={() => navigate('/inbox')}>
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-gray-100 shadow-sm border border-gray-200">
                        {conv.contacts?.profile_pic ? (
                          <img src={conv.contacts.profile_pic} alt="avatar" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(getDisplayName(conv.contacts))}&background=random`} alt="avatar" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-[15px] font-bold text-gray-900 truncate">{getDisplayName(conv.contacts)}</p>
                          <span className="text-xs font-semibold text-gray-400 whitespace-nowrap bg-gray-100 px-2.5 py-1 rounded-full">{formatTime(conv.last_message_at)}</span>
                        </div>
                        <p className="text-sm text-gray-500 truncate font-medium">{conv.last_message_preview || 'New message'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Leads */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-7 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">New Leads</h2>
                <button 
                  onClick={() => navigate('/contacts')}
                  className="text-sm font-bold text-[#0070d1] hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  View All <ArrowRight size={16} />
                </button>
              </div>
              
              <div className="flex flex-col gap-3">
                {recentLeads.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-sm font-medium text-gray-500">No new leads yet.</p>
                  </div>
                ) : (
                  recentLeads.map(lead => (
                    <div key={lead.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100 group">
                      <div className="w-12 h-12 rounded-full bg-blue-50/80 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-100/50 group-hover:scale-105 transition-transform">
                        <UserCircle size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-gray-900 truncate">{lead.name}</p>
                        <p className="text-sm text-gray-500 truncate font-medium mt-0.5">{lead.phone || lead.email}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
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
