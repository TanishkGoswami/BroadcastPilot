import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, Settings, Check, AlertTriangle, Trash2, Star, Mail, Paperclip, Smile, Heart, UserCircle, ChevronDown, SlidersHorizontal, RefreshCw } from 'lucide-react';

import { useAuth } from '../context/AuthProvider';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const TABS = ['All messages', 'Messenger', 'Instagram', 'WhatsApp'];
const SUBTABS = ['All', 'Unread', 'Priority', 'Follow up'];

export default function Inbox() {
  const { session } = useAuth();
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('All messages');
  const [activeSubTab, setActiveSubTab] = useState('All');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  const handleSyncHistory = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/chat/sync-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ channel: activeTab === 'Instagram' ? 'instagram' : 'messenger' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message || 'Sync started successfully in the background!');
    } catch (e) {
      alert(`Failed to sync history: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) return;
    
    setIsSending(true);
    const tempText = newMessage;
    setNewMessage('');
    
    // Optimistic UI update
    const tempMsg = {
      id: 'temp_' + Date.now(),
      content: tempText,
      direction: 'outbound',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch(`${API_URL}/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          text: tempText
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to send message: ${err.error}`);
        // Revert optimistic update
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
        setNewMessage(tempText);
      } else {
        const realMsg = await res.json();
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...realMsg, content: realMsg.content.text } : m));
      }
    } catch (error) {
      console.error("Send error", error);
      alert('Failed to send message due to network error');
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setNewMessage(tempText);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchConversations();
    }
  }, [session]);

  useEffect(() => {
    if (selectedConversation && session?.access_token) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation, session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_URL}/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setConversations(data);
      }
    } catch (error) {
      console.error("Failed to fetch conversations", error);
    }
  };

  const fetchMessages = async (conversationId, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/chat/messages/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch messages", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    // Setup Supabase Realtime for instant LiveChat updates
    if (!session?.access_token) return;

    // We will poll every 5 seconds as a simple fallback if Supabase Realtime isn't configured in frontend yet.
    // In a production app, you would import supabase client here and use .channel('public:w_messages').on(...)
    const interval = setInterval(() => {
      fetchConversations();
      if (selectedConversation) {
        fetchMessages(selectedConversation.id, false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session, selectedConversation]);

  const getDisplayName = (contact) => {
    if (!contact) return "Unknown Contact";
    if (contact.custom_name) return contact.custom_name;
    if (contact.name && !/^\d+$/.test(contact.name)) return contact.name;
    return contact.phone || contact.wa_id || "Unknown";
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    // e.g., "1:17 PM" or "May 6" if older
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'whatsapp': return <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center z-10"><span className="text-[8px] font-bold text-white">Wa</span></div>;
      case 'instagram': return <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-full border-2 border-white flex items-center justify-center z-10"><span className="text-[8px] font-bold text-white">Ig</span></div>;
      case 'messenger': return <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center z-10"><MessageSquare size={10} className="text-white fill-white" /></div>;
      default: return null;
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (activeTab !== 'All messages') {
      const targetChannel = activeTab.split(' ')[0].toLowerCase(); // e.g. 'messenger', 'instagram', 'whatsapp'
      if (c.channel !== targetChannel) return false;
    }
    if (activeSubTab === 'Unread') return c.unread_count > 0;
    // Priority and Follow up not implemented yet
    return true;
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#f4f5f7] overflow-hidden font-sans">
      
      {/* Global Header */}
      <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-100 shadow-sm z-10 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-[#1c1e21] tracking-tight">Inbox</h2>
          <p className="text-sm text-gray-500 mt-1">Respond to messages and manage your conversations.</p>
        </div>
      </div>

      {/* Main Omnichat Container */}
      <div className="flex-1 bg-white m-8 rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col animate-fade-in-up">
        
        {/* Top Tab Bar */}
        <div className="flex items-center border-b border-gray-100 px-2 overflow-x-auto shrink-0 hide-scrollbar bg-gray-50/40 backdrop-blur-sm">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all relative ${
                activeTab === tab ? 'text-[#0070d1]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0070d1] rounded-t-full shadow-[0_-2px_4px_rgba(0,112,209,0.2)]" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: Chat List */}
          <div className="w-[320px] lg:w-[380px] border-r border-gray-200 flex flex-col bg-white shrink-0">
            
            {/* Search and Manage Row */}
            <div className="p-4 border-b border-gray-100 flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search" 
                  className="w-full pl-9 pr-4 py-1.5 bg-gray-100 border-transparent rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white focus:border-blue-300 transition-all"
                />
              </div>

              {(activeTab === 'Messenger' || activeTab === 'Instagram') && (
                <button 
                  onClick={handleSyncHistory}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 bg-blue-50 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                  title="Sync historical chats from the last 30 days"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  Sync
                </button>
              )}

              <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                <SlidersHorizontal size={14} />
                Manage
              </button>
            </div>

            {/* Sub-tabs Row */}
            <div className="flex items-center px-4 py-2 border-b border-gray-100">
              <div className="flex items-center gap-4 flex-1">
                {SUBTABS.map(subtab => (
                  <button
                    key={subtab}
                    onClick={() => setActiveSubTab(subtab)}
                    className={`text-[13px] font-medium pb-1 relative ${activeSubTab === subtab ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {subtab}
                  </button>
                ))}
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <SlidersHorizontal size={14} />
              </button>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <p className="text-gray-500 text-sm">No messages found in this view.</p>
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isSelected = selectedConversation?.id === conv.id;
                  return (
                    <div 
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`flex items-start gap-3 p-4 cursor-pointer border-l-4 transition-colors ${
                        isSelected ? 'border-blue-600 bg-gray-50' : 'border-transparent hover:bg-gray-50'
                      }`}
                    >
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                          {/* Avatar */}
                          <img 
                            src={conv.contacts?.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(getDisplayName(conv.contacts))}&background=random`} 
                            alt="avatar" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {getChannelIcon(conv.channel)}
                      </div>
                      
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex justify-between items-center mb-0.5">
                          <h3 className={`font-semibold text-sm truncate ${conv.unread_count > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                            {getDisplayName(conv.contacts)}
                          </h3>
                          <span className={`text-[11px] whitespace-nowrap ${conv.unread_count > 0 ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                        <p className={`text-[13px] truncate ${conv.unread_count > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                          {conv.channel === 'whatsapp' ? 'WhatsApp Message...' : 'You: Hey! Thanks for commenting...'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Chat Window */}
          {selectedConversation ? (
            <div className="flex-1 flex flex-col bg-white">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                      <img 
                        src={selectedConversation.contacts?.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(getDisplayName(selectedConversation.contacts))}&background=random`} 
                        alt="avatar" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {getChannelIcon(selectedConversation.channel)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 leading-tight flex items-center gap-2">
                      {getDisplayName(selectedConversation.contacts)}
                    </h3>
                    <div className="text-[12px] text-gray-500 flex items-center gap-1 cursor-pointer hover:text-gray-700">
                      Assign this conversation <ChevronDown size={12} />
                    </div>
                  </div>
                </div>

              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loading ? (
                  <div className="flex justify-center text-sm text-gray-500">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="flex justify-center text-sm text-gray-500">No messages yet.</div>
                ) : (
                  messages.map((msg, index) => {
                    const isInbound = msg.direction === 'inbound';
                    return (
                      <div key={msg.id || index} className="flex flex-col">
                        <div className="flex justify-center mb-3">
                          <span className="text-[10px] text-gray-400">{formatTime(msg.created_at)}</span>
                        </div>
                        <div className={`flex items-end gap-2 ${isInbound ? 'flex-row' : 'flex-row-reverse'}`}>
                          {isInbound && (
                            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-gray-200">
                               <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(getDisplayName(selectedConversation.contacts))}&background=random`} alt="avatar" />
                            </div>
                          )}
                          <div className={`max-w-[70%] px-4 py-2.5 text-[14px] leading-snug ${
                            isInbound 
                              ? 'bg-gray-100/80 text-gray-900 rounded-2xl rounded-bl-sm border border-gray-200/50 shadow-sm' 
                              : 'bg-gradient-to-br from-[#0070d1] to-blue-500 shadow-md text-white rounded-2xl rounded-br-sm'
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="px-6 py-4 bg-white border-t border-gray-100 shrink-0">
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl bg-gray-50/50 focus-within:bg-white focus-within:border-[#0070d1] focus-within:ring-2 focus-within:ring-blue-100/50 transition-all shadow-sm pl-4 pr-2 py-2">
                  <textarea 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 resize-none outline-none text-sm text-gray-900 bg-transparent py-1.5 h-8 my-auto leading-relaxed hide-scrollbar"
                    rows="1"
                    disabled={isSending}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={isSending || !newMessage.trim()}
                    className="px-5 py-2 bg-[#0070d1] text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow active:scale-95 shrink-0"
                  >
                    Send
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/30">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mb-4 animate-fade-in-up">
                <MessageSquare size={32} className="text-blue-200" />
              </div>
              <p className="text-gray-500 font-medium tracking-tight animate-fade-in-up" style={{ animationDelay: '100ms' }}>Select a conversation to view chat</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
