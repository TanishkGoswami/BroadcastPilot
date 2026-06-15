import React, { useState, useEffect, useRef } from 'react';
import { Upload, RefreshCw, FileSpreadsheet, File, Users, Search, Filter, Plus, FolderOpen, UserCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';

export default function Contacts() {
  const { session, userProfile } = useAuth();
  const ORG_ID = userProfile?.organization_id || session?.user?.user_metadata?.organization_id;
  
  const [leads, setLeads] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  const isOwner = userProfile?.role === 'owner' || session?.user?.user_metadata?.role === 'owner';
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'sheet'
  const [sheetUrl, setSheetUrl] = useState('');
  
  // Column Mapping State
  const [mappingStep, setMappingStep] = useState(false);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [mapping, setMapping] = useState({ nameCol: '', phoneCol: '', emailCol: '' });
  
  // Create Manual Contact State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '' });
  
  const [metaConnections, setMetaConnections] = useState([]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = (lead.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (lead.phone || '').includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!session) return;
    
    console.log("Contacts.jsx mounted. ORG_ID:", ORG_ID, "isOwner:", isOwner, "userProfile:", userProfile);

    fetchLeads();
    fetchMetaConnections();
    if (isOwner) fetchTeam();

    if (ORG_ID) {
      const subscription = supabase
        .channel('b_leads_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'b_leads', 
          filter: `organization_id=eq.${ORG_ID}` 
        }, payload => {
          fetchLeads();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [ORG_ID, session, userProfile, isOwner]);

  const fetchLeads = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/leads`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      console.log("fetchLeads response:", data);
      if (Array.isArray(data)) {
        setLeads(data);
      } else {
        console.error("Leads data is not an array:", data);
      }
    } catch (error) {
      console.error('Failed to fetch leads', error);
    } finally {
      setInitialLoad(false);
    }
  };

  const fetchTeam = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/team`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setTeam(data.filter(m => m.role === 'agent'));
    } catch (error) {
      console.error('Failed to fetch team', error);
    }
  };

  const fetchMetaConnections = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/meta/status`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (data.success && data.connections) {
        setMetaConnections(data.connections);
      }
    } catch (error) {
      console.error('Failed to fetch meta connections', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', ORG_ID);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/sheets/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData
      });
      const data = await res.json();
      if(data.success) {
        alert(`Uploaded ${data.insertedCount} leads from file successfully!`);
        resetModal();
        fetchLeads();
      } else {
        alert('Upload failed: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('Upload failed');
    } finally {
      setLoading(false);
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFetchHeaders = async () => {
    // If it's a full URL, extract the ID
    let spreadsheetId = sheetUrl;
    if (sheetUrl.includes('/d/')) {
        spreadsheetId = sheetUrl.split('/d/')[1].split('/')[0];
    }
    
    if (!spreadsheetId) return alert("Please enter a valid Spreadsheet ID or URL");
    
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/sheets/headers`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ spreadsheetId })
      });
      const data = await res.json();
      
      if(data.success) {
        setSheetHeaders(data.headers);
        setSheetUrl(spreadsheetId); // Save the clean ID
        setMappingStep(true);
      } else {
        alert('Failed to connect: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to connect to sheet.');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
      setShowImportModal(false);
      setMappingStep(false);
      setSheetHeaders([]);
      setSheetUrl('');
      setMapping({ nameCol: '', phoneCol: '', emailCol: '' });
  };

  const handleSheetIngest = async () => {
    if (!sheetUrl) return alert("Please enter Spreadsheet ID");
    
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/sheets/ingest`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          spreadsheetId: sheetUrl,
          mapping: mapping
        })
      });
      const data = await res.json();
      if(data.success) {
        alert(`Ingested ${data.insertedCount} leads successfully!`);
        resetModal();
        fetchLeads();
      } else {
        alert('Ingestion failed: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('Ingestion failed');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (leadId, newStatus) => {
    setSyncing(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/leads/${leadId}/status`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      fetchLeads();
    } catch (error) {
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateContact = async (e) => {
    e.preventDefault();
    if (!newContact.phone) return alert("Phone number is required");
    
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/leads`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: newContact.name,
          phone: newContact.phone,
          email: newContact.email
        })
      });
      const data = await res.json();
      if(data.success) {
        setShowCreateModal(false);
        setNewContact({ name: '', phone: '', email: '' });
        fetchLeads();
      } else {
        alert('Failed to create contact: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to create contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-8 border-b border-hairline z-10">
        <div>
          <h1 className="text-5xl font-bold font-display text-ink leading-none -tracking-[1.8px]">Contacts</h1>
          <p className="text-base text-charcoal mt-3">Manage your leads and assignments</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="button-outline"
          >
            <Plus size={16} />
            New Contact
          </button>
          <button 
            onClick={() => setShowImportModal(true)}
            className="button-primary"
          >
            <Upload size={16} />
            Import
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-8 flex flex-col relative">
        {initialLoad ? (
          <div className="m-auto flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : leads.length === 0 ? (
          <div className="m-auto flex flex-col items-center justify-center max-w-md text-center py-10 animate-fade-in-up">
            <div className="w-24 h-24 bg-surface-card rounded-full flex items-center justify-center mb-6 border border-hairline">
              <FolderOpen size={40} className="text-primary" />
            </div>
            <h2 className="text-3xl font-bold font-display text-ink mb-3 leading-none">No contacts yet</h2>
            <p className="text-charcoal text-base mb-8 leading-relaxed">
              Upload your external contacts to start assigning them to agents and using them in your marketing broadcasts.
            </p>
            <button 
              onClick={() => setShowImportModal(true)}
              className="button-primary"
            >
              <Upload size={16} />
              Import Contacts
            </button>
          </div>
        ) : (
          <div className="w-full max-w-7xl mx-auto flex flex-col h-full animate-fade-in-up">
            
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
              <div className="relative w-full sm:w-96">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={16} className="text-mute" />
                </div>
                <input
                  type="text"
                  placeholder="Search contacts by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-input pl-10"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={16} className="text-mute" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-input px-4 pr-8"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="INTERESTED">Interested</option>
                  <option value="MIGHT_CONVERT">Might Convert</option>
                  <option value="NOT_INTERESTED">Not Interested</option>
                </select>
              </div>
            </div>

            {/* Table Card */}
            <div className="bg-surface-card border border-hairline rounded-[16px] overflow-hidden flex flex-col flex-1">
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-canvas border-b border-hairline sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-charcoal uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-4 text-xs font-semibold text-charcoal uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-4 text-xs font-semibold text-charcoal uppercase tracking-wider">Assignee</th>
                      <th className="px-6 py-4 text-xs font-semibold text-charcoal uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-charcoal uppercase tracking-wider w-48 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-mute text-sm">
                          No contacts match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map(lead => (
                        <tr key={lead.id} className="hover:bg-surface-bone transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-canvas text-ink flex items-center justify-center font-bold text-sm shrink-0 border border-hairline">
                                {lead.name ? lead.name.charAt(0).toUpperCase() : <UserCircle size={18} />}
                              </div>
                              <span className="text-sm font-medium text-ink">{lead.name || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-charcoal font-medium tracking-wide">{lead.phone}</td>
                          {isOwner ? (
                            <td className="px-6 py-4">
                              <div className="relative inline-block w-40">
                                <select 
                                  value={lead.agent_id || ''}
                                  onChange={async (e) => {
                                      setSyncing(true);
                                      try {
                                          await fetch(`${import.meta.env.VITE_API_URL}/api/leads/${lead.id}/assign`, {
                                              method: 'PUT',
                                              headers: { 
                                                  'Content-Type': 'application/json',
                                                  'Authorization': `Bearer ${session.access_token}`
                                              },
                                              body: JSON.stringify({ agent_id: e.target.value || null })
                                          });
                                          fetchLeads();
                                      } catch (err) {
                                          console.error(err);
                                      } finally {
                                          setSyncing(false);
                                      }
                                  }}
                                  disabled={syncing}
                                  className="w-full appearance-none border border-transparent hover:border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-transparent hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                                >
                                  <option value="">Unassigned</option>
                                  {team.map(t => (
                                      <option key={t.user_id} value={t.user_id}>{t.auth_users?.email?.split('@')[0]}</option>
                                  ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </td>
                          ) : (
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                Assigned to You
                              </span>
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              lead.status === 'INTERESTED' ? 'bg-green-50 text-green-700 border-green-200' :
                              lead.status === 'NOT_INTERESTED' ? 'bg-red-50 text-red-700 border-red-200' :
                              lead.status === 'MIGHT_CONVERT' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                            }`}>
                              {lead.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <select 
                              value={lead.status}
                              onChange={(e) => updateStatus(lead.id, e.target.value)}
                              disabled={syncing}
                              className="appearance-none bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-sm hover:border-gray-300"
                            >
                              <option value="PENDING">Pending</option>
                              <option value="INTERESTED">Interested</option>
                              <option value="MIGHT_CONVERT">Might Convert</option>
                              <option value="NOT_INTERESTED">Not Interested</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-surface-deep/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
          <div className="bg-surface-card rounded-[16px] shadow-2xl w-full max-w-lg overflow-hidden border border-hairline transform scale-100">
            <div className="px-6 py-5 border-b border-hairline flex items-center justify-between bg-canvas">
              <h3 className="text-xl font-bold font-display text-ink leading-none">Import Contacts</h3>
              <button onClick={resetModal} className="text-mute hover:text-ink transition-colors p-1 rounded-md hover:bg-surface-bone">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-6">
              <div className="flex bg-canvas border border-hairline rounded-[16px] p-1.5 mb-6">
                <button 
                  onClick={() => setUploadMode('file')}
                  className={`flex-1 py-2 rounded-[12px] text-sm font-semibold transition-all ${uploadMode === 'file' ? 'bg-surface-card shadow-sm text-ink border border-hairline' : 'text-charcoal hover:text-ink'}`}
                >
                  File Upload
                </button>
                <button 
                  onClick={() => setUploadMode('sheet')}
                  className={`flex-1 py-2 rounded-[12px] text-sm font-semibold transition-all ${uploadMode === 'sheet' ? 'bg-surface-card shadow-sm text-ink border border-hairline' : 'text-charcoal hover:text-ink'}`}
                >
                  Google Sheet
                </button>
                <button 
                  onClick={() => setUploadMode('meta')}
                  className={`flex-1 py-2 rounded-[12px] text-sm font-semibold transition-all ${uploadMode === 'meta' ? 'bg-surface-card shadow-sm text-ink border border-hairline' : 'text-charcoal hover:text-ink'}`}
                >
                  Meta Ads
                </button>
              </div>

              {uploadMode === 'file' ? (
                <div className="border border-dashed border-hairline bg-canvas rounded-[16px] p-10 flex flex-col items-center text-center transition-colors hover:bg-surface-bone">
                  <div className="w-14 h-14 bg-surface-card shadow-sm rounded-full border border-hairline flex items-center justify-center mb-5 text-primary">
                    <Upload size={24} />
                  </div>
                  <h4 className="text-base font-semibold text-ink mb-1">Upload a CSV or Excel file</h4>
                  <p className="text-sm text-charcoal mb-6">Drag and drop or click to browse</p>
                  <input 
                    type="file" 
                    accept=".csv, .xlsx"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="button-outline"
                  >
                    {loading ? <RefreshCw className="animate-spin text-primary" size={16} /> : <File size={16} className="text-charcoal" />}
                    Browse Files
                  </button>
                </div>
              ) : uploadMode === 'sheet' ? (
                <div className="space-y-4">
                  {!mappingStep ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Spreadsheet Link or ID</label>
                        <input 
                          type="text" 
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                          value={sheetUrl}
                          onChange={(e) => setSheetUrl(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                          <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          Sheet must be set to "Anyone with the link can view".
                        </p>
                      </div>
                      <button 
                        onClick={handleFetchHeaders}
                        disabled={loading}
                        className="w-full px-4 py-2.5 bg-[#0070d1] text-white font-medium rounded-lg hover:bg-blue-700 transition-all text-sm shadow-sm flex items-center justify-center gap-2"
                      >
                        {loading ? <RefreshCw className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                        Connect Sheet
                      </button>
                    </>
                  ) : (
                    <div className="space-y-4 animate-fade-in-up">
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-4 flex items-start gap-3">
                        <div className="p-1 bg-emerald-100 rounded-full text-emerald-600 shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">Sheet Connected!</p>
                          <p className="text-xs text-emerald-700 mt-0.5">Please map your columns to BroadcastPilot fields below.</p>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Name Column <span className="text-gray-400 font-normal">(Optional)</span></label>
                          <select 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                            value={mapping.nameCol}
                            onChange={(e) => setMapping({ ...mapping, nameCol: e.target.value })}
                          >
                            <option value="">-- Ignore --</option>
                            {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Column</label>
                          <select 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                            value={mapping.phoneCol}
                            onChange={(e) => setMapping({ ...mapping, phoneCol: e.target.value })}
                          >
                            <option value="">-- Select Column --</option>
                            {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Column</label>
                          <select 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                            value={mapping.emailCol}
                            onChange={(e) => setMapping({ ...mapping, emailCol: e.target.value })}
                          >
                            <option value="">-- Select Column --</option>
                            {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => setMappingStep(false)}
                          className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all text-sm shadow-sm"
                        >
                          Back
                        </button>
                        <button 
                          onClick={handleSheetIngest}
                          disabled={loading || (!mapping.phoneCol && !mapping.emailCol)}
                          className="flex-1 px-4 py-2.5 bg-[#0070d1] text-white font-medium rounded-lg hover:bg-blue-700 transition-all text-sm shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? <RefreshCw className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                          Sync Contacts
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center text-center py-6">
                  <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center mb-5 shadow-sm">
                    <svg className="w-8 h-8 text-[#0064e0]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"></path>
                    </svg>
                  </div>
                  {metaConnections.length > 0 ? (
                    <>
                      <h4 className="text-lg font-bold text-gray-900 mb-2">Meta Ads Connected</h4>
                      <p className="text-sm text-gray-600 mb-6 max-w-sm">
                        Actively syncing leads from <strong>{metaConnections[0].page_name || 'your Facebook Page'}</strong>.
                      </p>
                      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-full mb-8 font-medium">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        Syncing leads instantly in real-time
                      </div>
                      <button 
                        onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/meta?organizationId=${ORG_ID}`; }}
                        className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all text-sm shadow-sm"
                      >
                        Reconnect Account
                      </button>
                    </>
                  ) : (
                    <>
                      <h4 className="text-lg font-bold text-gray-900 mb-2">Connect Meta Lead Ads</h4>
                      <p className="text-sm text-gray-600 mb-8 max-w-sm leading-relaxed">
                        Sync leads instantly from your Facebook and Instagram ad campaigns. Real-time syncing, no Zapier required.
                      </p>
                      <button 
                        onClick={() => { 
                            if (!ORG_ID) return alert('Organization ID not loaded yet. Please wait a moment.');
                            window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/meta?organizationId=${ORG_ID}`; 
                        }}
                        disabled={!ORG_ID}
                        className={`px-8 py-3 w-full ${ORG_ID ? 'bg-[#0064e0] hover:bg-blue-700 shadow-md hover:shadow-lg' : 'bg-gray-400 cursor-not-allowed'} text-white font-medium rounded-lg transition-all text-sm flex items-center justify-center gap-2`}
                      >
                        Login with Facebook
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Contact Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-surface-deep/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
          <div className="bg-surface-card rounded-[16px] shadow-2xl w-full max-w-md overflow-hidden border border-hairline">
            <div className="px-6 py-5 border-b border-hairline flex items-center justify-between bg-canvas">
              <h3 className="text-xl font-bold font-display text-ink leading-none">Create New Contact</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-mute hover:text-ink transition-colors p-1 rounded-md hover:bg-surface-bone">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleCreateContact} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Jane Smith"
                  className="text-input"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Phone Number <span className="text-primary">*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. +1234567890"
                  className="text-input"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Email <span className="text-charcoal font-normal">(Optional)</span></label>
                <input 
                  type="email" 
                  placeholder="e.g. jane@example.com"
                  className="text-input"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="button-outline flex-1"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="button-primary flex-1"
                >
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />}
                  Create Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
