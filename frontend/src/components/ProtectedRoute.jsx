import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../supabaseClient';

export function ProtectedRoute({ children }) {
    const { user, userProfile, loading, authError, signOut } = useAuth();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [error, setError] = useState(null);
    const allowLocalAuth = import.meta.env.VITE_ENABLE_LOCAL_AUTH === 'true';
    const hubLoginUrl = import.meta.env.VITE_HUB_LOGIN_URL;
    const isAcceptInvite = location.pathname.startsWith('/accept-invite');

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

    const redirectToHub = () => {
        if (!hubLoginUrl) return;

        const url = new URL(hubLoginUrl);
        url.searchParams.set('redirect_to', window.location.href);
        window.location.assign(url.toString());
    };

    if (!user) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-md">
                    <img src="/logo2.png" alt="BroadcastPilot Logo" className="h-16 mx-auto mb-4 object-contain" />
                    <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">BroadcastPilot</h1>
                    <p className="text-gray-500 text-center mb-6 text-sm">
                        Please continue from your MetaBull hub account.
                    </p>
                    
                    {(authError || error) && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
                            {authError || error}
                        </div>
                    )}

                    {hubLoginUrl ? (
                        <button
                            type="button"
                            onClick={redirectToHub}
                            className="w-full bg-[#0070d1] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors"
                        >
                            Continue to Hub Login
                        </button>
                    ) : (
                        <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm">
                            Hub login URL is not configured. Set VITE_HUB_LOGIN_URL for production.
                        </div>
                    )}

                    {allowLocalAuth && (
                        <>
                            <div className="mt-4 flex items-center justify-between">
                                <span className="w-1/5 border-b lg:w-1/4"></span>
                                <span className="text-xs text-center text-gray-500 uppercase">local dev</span>
                                <span className="w-1/5 border-b lg:w-1/4"></span>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-4 mt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                    <input
                                        type="password"
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={authLoading}
                                    className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 rounded-lg transition-colors"
                                >
                                    {authLoading ? 'Logging in...' : 'Sign In with Email'}
                                </button>
                            </form>

                            <button
                                onClick={handleGoogleLogin}
                                className="mt-4 w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg transition-colors"
                            >
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                                Sign in with Google
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (!isAcceptInvite && authError && !userProfile) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
                <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                    <img src="/logo2.png" alt="BroadcastPilot Logo" className="h-16 mx-auto mb-4 object-contain" />
                    <h1 className="mb-2 text-2xl font-bold text-gray-900">BroadcastPilot access required</h1>
                    <p className="mb-6 text-sm leading-relaxed text-gray-500">
                        {authError}
                    </p>
                    <div className="flex flex-col gap-3">
                        {hubLoginUrl && (
                            <button
                                type="button"
                                onClick={redirectToHub}
                                className="w-full rounded-lg bg-[#0070d1] py-2 font-medium text-white transition-colors hover:bg-blue-700"
                            >
                                Open from Hub
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={signOut}
                            className="w-full rounded-lg border border-gray-300 bg-white py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            Use another account
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return children;
}
