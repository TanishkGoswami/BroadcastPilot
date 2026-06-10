import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../supabaseClient';

export function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [error, setError] = useState(null);

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setAuthLoading(false);
    };

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) setError(error.message);
    };

    if (!user) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-md">
                    <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">BroadcastPilot Local Dev</h1>
                    <p className="text-gray-500 text-center mb-6 text-sm">Log in to test locally</p>
                    
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input 
                                type="email" 
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={authLoading}
                            className="w-full bg-[#0070d1] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors"
                        >
                            {authLoading ? 'Logging in...' : 'Sign In with Email'}
                        </button>
                    </form>

                    <div className="mt-4 flex items-center justify-between">
                        <span className="w-1/5 border-b lg:w-1/4"></span>
                        <span className="text-xs text-center text-gray-500 uppercase">or</span>
                        <span className="w-1/5 border-b lg:w-1/4"></span>
                    </div>

                    <button 
                        onClick={handleGoogleLogin}
                        className="mt-4 w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg transition-colors"
                    >
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                        Sign in with Google
                    </button>
                    
                    <div className="mt-6 text-center text-xs text-gray-400">
                        <p>Clear your LocalStorage first if you are stuck in an error loop!</p>
                    </div>
                </div>
            </div>
        );
    }

    return children;
}
