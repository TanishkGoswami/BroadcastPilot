import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, Settings, Check, AlertTriangle, Trash2, Star, Mail, Paperclip, Smile, Heart, UserCircle, ChevronDown, SlidersHorizontal, RefreshCw } from 'lucide-react';

import { useAuth } from '../context/AuthProvider';


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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/sync-history`, {
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/messages`, {
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

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/conversations`, {
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/messages/${conversationId}`, {
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
      case 'whatsapp': return <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white z-10 bg-white" />;
      case 'instagram': return <img src="https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg" alt="Instagram" className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white z-10 bg-white" />;
      case 'messenger': return <img src="https://upload.wikimedia.org/wikipedia/commons/b/be/Facebook_Messenger_logo_2020.svg" alt="Messenger" className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white z-10 bg-white" />;
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
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden font-sans">
      
      {/* Global Header */}
      <div className="flex items-center justify-between px-8 py-8 border-b border-hairline z-10 shrink-0">
        <div>
          <h2 className="text-5xl font-bold font-display text-ink leading-none -tracking-[1.8px]">Inbox</h2>
          <p className="text-base text-charcoal mt-3">Respond to messages and manage your conversations.</p>
        </div>
      </div>

      {/* Main Omnichat Container */}
      <div className="flex-1 bg-surface-card mx-8 mb-8 mt-2 rounded-[16px] border border-hairline overflow-hidden flex flex-col animate-fade-in-up">
        
        {/* Top Tab Bar */}
        <div className="flex items-center border-b border-hairline px-2 overflow-x-auto shrink-0 hide-scrollbar bg-canvas">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all relative ${
                activeTab === tab ? 'text-primary' : 'text-charcoal hover:text-ink'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: Chat List */}
          <div className="w-[320px] lg:w-[380px] border-r border-hairline flex flex-col bg-surface-card shrink-0">
            
            {/* Search and Manage Row */}
            <div className="p-4 border-b border-hairline flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" size={16} />
                <input 
                  type="text" 
                  placeholder="Search" 
                  className="w-full pl-9 pr-4 py-1.5 bg-canvas border border-transparent rounded-full text-sm text-ink focus:outline-none focus:border-hairline-strong transition-all"
                />
              </div>

              {(activeTab === 'Messenger' || activeTab === 'Instagram') && (
                <button 
                  onClick={handleSyncHistory}
                  disabled={isSyncing}
                  className="button-ghost border border-hairline hover:bg-surface-bone text-primary"
                  title="Sync historical chats from the last 30 days"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  Sync
                </button>
              )}

              <button className="button-ghost border border-hairline hover:bg-surface-bone text-ink">
                <SlidersHorizontal size={14} />
              </button>
            </div>

            {/* Sub-tabs Row */}
            <div className="flex items-center px-4 py-2 border-b border-hairline">
              <div className="flex items-center gap-4 flex-1">
                {SUBTABS.map(subtab => (
                  <button
                    key={subtab}
                    onClick={() => setActiveSubTab(subtab)}
                    className={`text-[13px] font-medium pb-1 relative ${activeSubTab === subtab ? 'text-ink border-b-2 border-ink' : 'text-charcoal hover:text-ink'}`}
                  >
                    {subtab}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-canvas">
                  <p className="text-charcoal text-sm">No messages found in this view.</p>
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isSelected = selectedConversation?.id === conv.id;
                  return (
                    <div 
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`flex items-start gap-3 p-4 cursor-pointer border-l-4 transition-colors ${
                        isSelected ? 'border-primary bg-surface-bone' : 'border-transparent hover:bg-surface-bone'
                      }`}
                    >
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full bg-canvas border border-hairline overflow-hidden flex items-center justify-center shrink-0">
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
                          <h3 className={`font-semibold text-sm truncate ${conv.unread_count > 0 ? 'text-ink' : 'text-charcoal'}`}>
                            {getDisplayName(conv.contacts)}
                          </h3>
                          <span className={`text-[11px] whitespace-nowrap ${conv.unread_count > 0 ? 'text-primary font-bold' : 'text-mute'}`}>
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                        <p className={`text-[13px] truncate ${conv.unread_count > 0 ? 'text-ink font-medium' : 'text-charcoal'}`}>
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
            <div className="flex-1 flex flex-col bg-surface-card">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-hairline shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full border border-hairline overflow-hidden flex items-center justify-center shrink-0 bg-canvas">
                      <img 
                        src={selectedConversation.contacts?.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(getDisplayName(selectedConversation.contacts))}&background=random`} 
                        alt="avatar" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {getChannelIcon(selectedConversation.channel)}
                  </div>
                  <div>
                    <h3 className="font-bold font-display text-ink leading-tight flex items-center gap-2">
                      {getDisplayName(selectedConversation.contacts)}
                    </h3>
                    <div className="text-[12px] text-charcoal flex items-center gap-1 cursor-pointer hover:text-ink">
                      Assign this conversation <ChevronDown size={12} />
                    </div>
                  </div>
                </div>

              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loading ? (
                  <div className="flex justify-center text-sm text-charcoal">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="flex justify-center text-sm text-charcoal">No messages yet.</div>
                ) : (
                  messages.map((msg, index) => {
                    const isInbound = msg.direction === 'inbound';
                    return (
                      <div key={msg.id || index} className="flex flex-col">
                        <div className="flex justify-center mb-3">
                          <span className="text-[10px] text-mute">{formatTime(msg.created_at)}</span>
                        </div>
                        <div className={`flex items-end gap-2 ${isInbound ? 'flex-row' : 'flex-row-reverse'}`}>
                          {isInbound && (
                            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-hairline">
                               <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(getDisplayName(selectedConversation.contacts))}&background=random`} alt="avatar" />
                            </div>
                          )}
                          <div className={`max-w-[70%] px-4 py-2.5 text-[14px] leading-snug ${
                            isInbound 
                              ? 'bg-surface-bone text-ink rounded-[16px] rounded-bl-sm border border-hairline' 
                              : 'bg-primary text-white rounded-[16px] rounded-br-sm'
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
              <div className="px-6 py-4 bg-surface-card border-t border-hairline shrink-0">
                <div className="flex items-center gap-2 border border-hairline rounded-full bg-surface-bone focus-within:bg-canvas focus-within:border-hairline-strong transition-all pl-5 pr-2 py-2">
                  <textarea 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 resize-none outline-none text-sm text-ink bg-transparent py-1.5 h-8 my-auto leading-relaxed hide-scrollbar"
                    rows="1"
                    disabled={isSending}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={isSending || !newMessage.trim()}
                    className="button-primary shrink-0 h-10 px-6 text-sm"
                  >
                    Send
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-canvas">
              <div className="w-20 h-20 bg-surface-card rounded-full flex items-center justify-center border border-hairline mb-4 animate-fade-in-up">
                <MessageSquare size={32} className="text-mute" />
              </div>
              <p className="text-charcoal font-medium tracking-tight animate-fade-in-up" style={{ animationDelay: '100ms' }}>Select a conversation to view chat</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
