import React, { useState, useEffect, useRef } from 'react';
import { Upload, RefreshCw, FileSpreadsheet, File, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';

export default function Contacts() {
  const { session, userProfile } = useAuth();
  const ORG_ID = userProfile?.organization_id || session?.user?.user_metadata?.organization_id;
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';

  const [leads, setLeads] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);
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
      const res = await fetch(`${API_URL}/leads`, {
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
    }
  };

  const fetchTeam = async () => {
    try {
      const res = await fetch(`${API_URL}/team`, {
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
      const res = await fetch(`${API_URL}/auth/meta/status`, {
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
      const res = await fetch(`${API_URL}/sheets/upload`, {
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
      const res = await fetch(`${API_URL}/sheets/headers`, {
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
      const res = await fetch(`${API_URL}/sheets/ingest`, {
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
      await fetch(`${API_URL}/leads/${leadId}/status`, {
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
      const res = await fetch(`${API_URL}/leads`, {
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
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 border border-gray-200 text-gray-700 font-medium rounded hover:bg-gray-50 transition-colors text-sm"
          >
            Create New Contact
          </button>
          <button 
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-[#0070d1] text-white font-medium rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Import
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-gray-50/30 p-8">
        {leads.length === 0 ? (
          <div className="m-auto flex flex-col items-center justify-center max-w-md text-center py-20 h-full">
            {/* ManyChat style alien/empty state graphic placeholder */}
            <div className="w-64 h-64 mb-8 relative">
              <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <path fill="#e5e7eb" d="M45.7,-76.3C58.9,-69.3,69.2,-55.5,77.7,-41C86.2,-26.5,92.9,-11.3,91.3,3.3C89.7,17.9,79.8,31.9,69.5,43.7C59.2,55.5,48.5,65.1,35.6,72.4C22.7,79.7,7.6,84.7,-7.1,87.6C-21.8,90.5,-36.1,91.3,-48.5,84.6C-60.9,77.9,-71.4,63.7,-78.9,48.5C-86.4,33.3,-90.9,17.1,-89.2,1.5C-87.5,-14.1,-79.6,-28.2,-70,-40.4C-60.4,-52.6,-49.1,-62.9,-36.3,-70.3C-23.5,-77.7,-9.2,-82.2,6.1,-84.4C21.4,-86.6,42.8,-86.5,45.7,-76.3Z" transform="translate(100 100)" />
                <circle cx="100" cy="80" r="40" fill="#a7f3d0" />
                <circle cx="85" cy="70" r="6" fill="#065f46" />
                <circle cx="115" cy="70" r="6" fill="#065f46" />
                <path d="M 80 120 L 100 80 L 120 120 Z" fill="#34d399" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You don't have any contacts yet</h2>
            <p className="text-gray-500 text-sm mb-6">
              Upload your external contacts and use it with any marketing channel in BroadcastPilot. <a href="#" className="text-[#0070d1] hover:underline">Learn more</a>
            </p>
            <button 
              onClick={() => setShowImportModal(true)}
              className="px-6 py-2 bg-[#0070d1] text-white font-medium rounded hover:bg-blue-700 transition-colors text-sm"
            >
              Import
            </button>
          </div>
        ) : (
          <div className="w-full bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm flex flex-col h-full">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assignee</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{lead.name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{lead.phone}</td>
                      {isOwner ? (
                        <td className="px-6 py-4">
                          <select 
                            value={lead.agent_id || ''}
                            onChange={async (e) => {
                                setSyncing(true);
                                try {
                                    await fetch(`${API_URL}/leads/${lead.id}/assign`, {
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
                            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
                          >
                            <option value="">Unassigned</option>
                            {team.map(t => (
                                <option key={t.user_id} value={t.user_id}>{t.auth_users?.email?.split('@')[0]}</option>
                            ))}
                          </select>
                        </td>
                      ) : (
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Assigned to You
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          lead.status === 'INTERESTED' ? 'bg-green-100 text-green-800' :
                          lead.status === 'NOT_INTERESTED' ? 'bg-red-100 text-red-800' :
                          lead.status === 'MIGHT_CONVERT' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={lead.status}
                          onChange={(e) => updateStatus(lead.id, e.target.value)}
                          disabled={syncing}
                          className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="INTERESTED">Interested</option>
                          <option value="MIGHT_CONVERT">Might Convert</option>
                          <option value="NOT_INTERESTED">Not Interested</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Import Contacts</h3>
              <button onClick={resetModal} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="p-6">
              <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
                <button 
                  onClick={() => setUploadMode('file')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${uploadMode === 'file' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  File Upload
                </button>
                <button 
                  onClick={() => setUploadMode('sheet')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${uploadMode === 'sheet' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Google Sheet
                </button>
                <button 
                  onClick={() => setUploadMode('meta')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${uploadMode === 'meta' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Meta Ads
                </button>
              </div>

              {uploadMode === 'file' ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    <Upload className="text-[#0070d1]" size={24} />
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Click to upload or drag and drop</h4>
                  <p className="text-xs text-gray-500 mb-6">CSV or Excel files only</p>
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
                    className="px-6 py-2 bg-gray-900 text-white font-medium rounded hover:bg-black transition-colors text-sm flex items-center gap-2"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={16} /> : <File size={16} />}
                    Select File
                  </button>
                </div>
              ) : uploadMode === 'sheet' ? (
                <div className="space-y-4">
                  {!mappingStep ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Spreadsheet Link or ID</label>
                        <input 
                          type="text" 
                          placeholder="Paste Google Sheet Link here..."
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                          value={sheetUrl}
                          onChange={(e) => setSheetUrl(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          <strong>Note:</strong> Your sheet must be set to "Anyone with the link can view".
                        </p>
                      </div>
                      <button 
                        onClick={handleFetchHeaders}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-[#0070d1] text-white font-medium rounded hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        {loading ? <RefreshCw className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                        Connect Sheet
                      </button>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-3 rounded border border-blue-100 mb-4">
                        <p className="text-sm font-medium text-blue-800">Sheet Connected!</p>
                        <p className="text-xs text-blue-600">Please map your columns below.</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name Column (Optional)</label>
                        <select 
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          value={mapping.nameCol}
                          onChange={(e) => setMapping({ ...mapping, nameCol: e.target.value })}
                        >
                          <option value="">-- Ignore --</option>
                          {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Column</label>
                        <select 
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          value={mapping.phoneCol}
                          onChange={(e) => setMapping({ ...mapping, phoneCol: e.target.value })}
                        >
                          <option value="">-- Select Column --</option>
                          {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Column</label>
                        <select 
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          value={mapping.emailCol}
                          onChange={(e) => setMapping({ ...mapping, emailCol: e.target.value })}
                        >
                          <option value="">-- Select Column --</option>
                          {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      
                      <button 
                        onClick={handleSheetIngest}
                        disabled={loading || (!mapping.phoneCol && !mapping.emailCol)}
                        className="w-full px-4 py-2 mt-4 bg-[#0070d1] text-white font-medium rounded hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {loading ? <RefreshCw className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                        Sync Contacts
                      </button>
                        <button 
                        onClick={() => setMappingStep(false)}
                        className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 transition-colors text-sm"
                      >
                        Back
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center text-center py-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-[#0064e0]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"></path>
                    </svg>
                  </div>
                  {metaConnections.length > 0 ? (
                    <>
                      <h4 className="text-lg font-bold text-gray-900 mb-2">Meta Ads Connected</h4>
                      <p className="text-sm text-gray-600 mb-4 max-w-sm">
                        Actively syncing leads from <strong>{metaConnections[0].page_name || 'your Facebook Page'}</strong>.
                      </p>
                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-2 rounded-full mb-6">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        Syncing leads instantly in real-time
                      </div>
                      <button 
                        onClick={() => { window.location.href = `${API_URL}/auth/meta?organizationId=${ORG_ID}`; }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded hover:bg-gray-200 transition-colors text-sm"
                      >
                        Reconnect Account
                      </button>
                    </>
                  ) : (
                    <>
                      <h4 className="text-lg font-bold text-gray-900 mb-2">Connect Meta Lead Ads</h4>
                      <p className="text-sm text-gray-600 mb-6 max-w-sm">
                        Sync leads instantly from your Facebook and Instagram ad campaigns. No Zapier required.
                      </p>
                      <button 
                        onClick={() => { 
                            if (!ORG_ID) return alert('Organization ID not loaded yet. Please wait a moment.');
                            window.location.href = `${API_URL}/auth/meta?organizationId=${ORG_ID}`; 
                        }}
                        disabled={!ORG_ID}
                        className={`px-6 py-2 ${ORG_ID ? 'bg-[#0064e0] hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white font-medium rounded transition-colors text-sm flex items-center gap-2`}
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Create New Contact</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleCreateContact} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. John Doe"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. +919876543210"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  type="email" 
                  placeholder="e.g. john@example.com"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-[#0070d1] text-white font-medium rounded hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : <Users size={16} />}
                  Create Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
