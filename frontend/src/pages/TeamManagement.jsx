import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthProvider';
import { Shield, UserPlus, Users, X } from 'lucide-react';

export default function TeamManagement() {
    const { userProfile, session } = useAuth();
    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const isOwner = userProfile?.role === 'owner' || session?.user?.user_metadata?.role === 'owner' || !userProfile?.role;

    useEffect(() => {
        if (!isOwner) return;

        const fetchTeam = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/team`, {
                    headers: { 'Authorization': `Bearer ${session?.access_token}` }
                });
                
                if (!response.ok) throw new Error('Failed to fetch team');
                
                const data = await response.json();
                setTeam(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTeam();
    }, [isOwner, session]);

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
        <div className="flex-1 overflow-auto bg-gray-50/50 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
                        <p className="text-gray-500 mt-1">Manage your agents and organization members.</p>
                    </div>
                    <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
                        <UserPlus size={18} />
                        Invite Agent
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start gap-3">
                        <X size={20} className="shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Team List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2 text-gray-700 font-semibold text-sm">
                        <Users size={18} />
                        Members ({team.length})
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
                                        <p className="font-medium text-gray-900">{member.auth_users?.email || 'Unknown User'}</p>
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
                            <div className="p-8 text-center text-gray-500">No team members found.</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
