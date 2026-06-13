import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { Shield, UserPlus, Users, X, Send } from 'lucide-react';

export default function TeamManagement() {
    const { userProfile, session } = useAuth();
    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Invite Modal State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteLink, setInviteLink] = useState('');

    const isOwner = userProfile?.role === 'owner' || session?.user?.user_metadata?.role === 'owner';
    
    const fetchTeam = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/team`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to fetch team: ${response.status} ${text.substring(0, 50)}`);
            }
            
            const data = await response.json();
            setTeam(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOwner) return;
        fetchTeam();
    }, [isOwner, session]);

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail) return;

        setInviteLoading(true);
        setInviteLink('');
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/team/invite`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: inviteEmail })
            });
            
            const data = await response.json();
            if (!response.ok) {
                let errorMsg = 'Failed to invite user';
                if (data.error) errorMsg = data.error;
                throw new Error(errorMsg);
            }
            
            setInviteLink(data.link);
            setInviteEmail('');
            fetchTeam();
        } catch (err) {
            alert(err.message);
        } finally {
            setInviteLoading(false);
        }
    };

    if (!isOwner) {
        return (
            <div className="flex h-full items-center justify-center bg-gray-50 p-8">
                <div className="text-center">
                    <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-500">Only organization owners can view team settings.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-[#f4f5f7] font-sans">
            {/* Global Header */}
            <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-100 shadow-sm z-10 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-[#1c1e21] tracking-tight">Team Management</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage your agents and organization members.</p>
                </div>
                <button 
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 bg-[#0070d1] hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all hover:shadow-md"
                >
                    <UserPlus size={18} />
                    Invite Agent
                </button>
            </div>

            <div className="flex-1 overflow-auto p-8 animate-fade-in-up">
                <div className="max-w-5xl mx-auto space-y-6">

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start gap-3">
                        <X size={20} className="shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Team List */}
                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-700 font-bold text-sm uppercase tracking-wider">
                            <Users size={18} className="text-[#0070d1]" />
                            Members ({team.length})
                        </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">Loading team members...</div>
                        ) : team.map((member) => (
                            <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                        <span className="text-blue-600 font-semibold">
                                            {member.auth_users?.email?.substring(0, 2).toUpperCase() || '??'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{member.auth_users?.email || 'Pending Invite...'}</p>
                                        <p className="text-sm text-gray-500 capitalize">{member.role}</p>
                                    </div>
                                </div>
                                {member.role !== 'owner' && (
                                    <button className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors">
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                        {!loading && team.length === 0 && (
                            <div className="p-12 text-center flex flex-col items-center justify-center text-gray-500">
                                <Users size={48} className="text-gray-200 mb-4" />
                                <p className="font-medium text-gray-600">No team members found.</p>
                                <p className="text-sm mt-1">Invite agents to collaborate on BroadcastPilot.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900">
                                {inviteLink ? 'Invitation Link Ready!' : 'Invite Agent'}
                            </h3>
                            <button onClick={() => { setShowInviteModal(false); setInviteLink(''); }} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        
                        {inviteLink ? (
                            <div className="p-6 space-y-4">
                                <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm border border-green-100">
                                    <p className="font-medium mb-1">Agent successfully invited!</p>
                                    <p>Share this secure link with your agent so they can set their password and log in.</p>
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value={inviteLink}
                                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 outline-none"
                                    />
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(inviteLink);
                                            alert('Copied to clipboard!');
                                        }}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded transition-colors text-sm border border-gray-200"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <div className="pt-2">
                                    <button 
                                        onClick={() => { setShowInviteModal(false); setInviteLink(''); }}
                                        className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors text-sm"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleInvite} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                                    <input 
                                        type="email" 
                                        required
                                        placeholder="agent@company.com"
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        disabled={inviteLoading}
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        You will receive a secure sign-up link to share with them.
                                    </p>
                                </div>
                                
                                <div className="pt-4 flex gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setShowInviteModal(false)}
                                        className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 transition-colors text-sm"
                                        disabled={inviteLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={inviteLoading}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2"
                                    >
                                        {inviteLoading ? 'Generating...' : (
                                            <>
                                                <Send size={16} />
                                                Generate Link
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
            
        </div>
    );
}
