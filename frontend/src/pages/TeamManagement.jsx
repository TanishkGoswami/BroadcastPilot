import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { AlertTriangle, Shield, UserPlus, Users, X, Send } from 'lucide-react';

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
    const [memberToRemove, setMemberToRemove] = useState(null);
    const [removeLoading, setRemoveLoading] = useState(false);

    const isOwner = userProfile?.role === 'owner';
    
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

    const handleRemoveMember = async () => {
        if (!memberToRemove) return;

        setRemoveLoading(true);
        try {
            const pendingQuery = memberToRemove.pending ? '?pending=true' : '';
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/team/members/${memberToRemove.id}${pendingQuery}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || 'Failed to remove team member');
            }

            setMemberToRemove(null);
            await fetchTeam();
        } catch (err) {
            alert(err.message);
        } finally {
            setRemoveLoading(false);
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
        <div className="flex flex-col h-full w-full bg-transparent font-sans">
            {/* Global Header */}
            <div className="flex items-center justify-between px-8 py-8 border-b border-hairline z-10 shrink-0">
                <div>
                    <h2 className="text-5xl font-bold font-display text-ink leading-none -tracking-[1.8px]">Team Management</h2>
                    <p className="text-base text-charcoal mt-3">Manage your agents and organization members.</p>
                </div>
                <button 
                    onClick={() => setShowInviteModal(true)}
                    className="button-primary"
                >
                    <UserPlus size={18} />
                    Invite Agent
                </button>
            </div>

            <div className="flex-1 overflow-auto p-8 animate-fade-in-up">
                <div className="max-w-5xl mx-auto space-y-6">

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-[12px] border border-red-200 flex items-start gap-3">
                        <X size={20} className="shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Team List */}
                <div className="bg-surface-card rounded-[16px] border border-hairline overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-hairline bg-canvas flex items-center justify-between">
                        <div className="flex items-center gap-2 text-ink font-bold text-sm uppercase tracking-wider">
                            <Users size={18} className="text-primary" />
                            Members ({team.length})
                        </div>
                    </div>
                    <div className="divide-y divide-hairline">
                        {loading ? (
                            <div className="p-8 text-center text-mute">Loading team members...</div>
                        ) : team.map((member) => (
                            <div key={member.id} className="p-4 flex items-center justify-between hover:bg-surface-bone transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                                        <span className="text-white font-bold font-display">
                                            {member.auth_users?.email?.substring(0, 2).toUpperCase() || '??'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-bold font-display text-ink">{member.auth_users?.email || 'Pending Invite...'}</p>
                                        <p className="text-sm text-charcoal capitalize">
                                            {member.pending ? 'Pending invite' : member.role}
                                        </p>
                                    </div>
                                </div>
                                {member.role !== 'owner' && (
                                    <button
                                        type="button"
                                        onClick={() => setMemberToRemove(member)}
                                        className="text-red-500 hover:text-red-700 text-sm font-bold px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors"
                                    >
                                        {member.pending ? 'Cancel Invite' : 'Remove'}
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
                <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-surface-card rounded-[16px] shadow-2xl w-full max-w-md overflow-hidden border border-hairline">
                        <div className="px-6 py-4 border-b border-hairline flex items-center justify-between bg-canvas">
                            <h3 className="text-2xl font-bold font-display text-ink">
                                {inviteLink ? 'Invitation Link Ready!' : 'Invite Agent'}
                            </h3>
                            <button onClick={() => { setShowInviteModal(false); setInviteLink(''); }} className="text-mute hover:text-ink">
                                <X size={20} />
                            </button>
                        </div>
                        
                        {inviteLink ? (
                            <div className="p-6 space-y-4">
                                <div className="bg-surface-bone text-ink p-4 rounded-[12px] text-sm border border-hairline">
                                    <p className="font-bold mb-1">Agent successfully invited!</p>
                                    <p className="text-charcoal">Share this secure BroadcastPilot link with your agent. They can sign in or create a hub account, then the invite will add them as an agent automatically.</p>
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value={inviteLink}
                                        className="text-input flex-1"
                                    />
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(inviteLink);
                                            alert('Copied to clipboard!');
                                        }}
                                        className="button-outline"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <div className="pt-2">
                                    <button 
                                        onClick={() => { setShowInviteModal(false); setInviteLink(''); }}
                                        className="w-full button-primary justify-center"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleInvite} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-ink mb-1">Email Address <span className="text-primary">*</span></label>
                                    <input 
                                        type="email" 
                                        required
                                        placeholder="agent@company.com"
                                        className="text-input"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        disabled={inviteLoading}
                                    />
                                    <p className="text-xs text-charcoal mt-2">
                                        They will use this secure link to join BroadcastPilot directly as an agent.
                                    </p>
                                </div>
                                
                                <div className="pt-4 flex gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setShowInviteModal(false)}
                                        className="flex-1 button-outline justify-center"
                                        disabled={inviteLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={inviteLoading}
                                        className="flex-1 button-primary justify-center"
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

            {memberToRemove && (
                <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-surface-card rounded-[16px] shadow-2xl w-full max-w-md overflow-hidden border border-hairline">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
                                <AlertTriangle size={26} className="text-red-600" />
                            </div>
                            <h3 className="text-2xl font-bold font-display text-ink mb-2">
                                {memberToRemove.pending ? 'Cancel this invite?' : 'Remove this agent?'}
                            </h3>
                            <p className="text-sm text-charcoal leading-relaxed">
                                {memberToRemove.pending
                                    ? `The invite for ${memberToRemove.auth_users?.email || 'this email'} will stop working immediately.`
                                    : `${memberToRemove.auth_users?.email || 'This agent'} will lose BroadcastPilot access. Any assigned contacts will be unassigned.`}
                            </p>
                        </div>
                        <div className="p-5 border-t border-hairline bg-canvas flex gap-3">
                            <button
                                type="button"
                                onClick={() => setMemberToRemove(null)}
                                disabled={removeLoading}
                                className="button-outline flex-1 justify-center"
                            >
                                Keep
                            </button>
                            <button
                                type="button"
                                onClick={handleRemoveMember}
                                disabled={removeLoading}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-base font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50 flex-1"
                            >
                                {removeLoading ? 'Removing...' : memberToRemove.pending ? 'Cancel Invite' : 'Remove Agent'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
        </div>
    );
}
