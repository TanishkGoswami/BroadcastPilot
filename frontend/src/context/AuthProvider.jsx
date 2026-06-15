/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();
const API_BASE_URL = import.meta.env.VITE_API_URL;

function readSsoParams() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    return {
        accessToken: searchParams.get('access_token') || hashParams.get('access_token'),
        refreshToken: searchParams.get('refresh_token') || hashParams.get('refresh_token'),
    };
}

function removeSensitiveAuthParams() {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));

    [
        'access_token',
        'refresh_token',
        'expires_at',
        'expires_in',
        'provider_token',
        'provider_refresh_token',
        'token_type',
        'type',
    ].forEach((key) => {
        url.searchParams.delete(key);
        hashParams.delete(key);
    });

    const nextHash = hashParams.toString();
    url.hash = nextHash ? `#${nextHash}` : '';

    return `${url.pathname}${url.search}${url.hash}`;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(null);
    const navigate = useNavigate();

    const fetchProfile = useCallback(async (currentSession, options = {}) => {
        if (!currentSession?.user) {
            setUserProfile(null);
            setLoading(false);
            return;
        }

        if (!API_BASE_URL) {
            setAuthError('BroadcastPilot API URL is not configured.');
            setUserProfile(null);
            setLoading(false);
            return;
        }

        try {
            const url = new URL(`${API_BASE_URL}/api/auth/me`);
            if (options.provisionOwner) {
                url.searchParams.set('provision', 'owner');
            }

            const res = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${currentSession.access_token}` },
            });

            if (!res.ok) {
                const errorBody = await res.json().catch(() => ({}));
                throw new Error(errorBody.error || `Profile request failed with ${res.status}`);
            }

            const data = await res.json();
            setUserProfile(data);
            setAuthError(null);
        } catch (err) {
            console.error('Failed to fetch profile', err);
            setAuthError(err.message || 'Your login was accepted, but profile access failed.');
            setUserProfile(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        const bootstrapSession = async () => {
            setLoading(true);

            const { accessToken, refreshToken } = readSsoParams();

            if (accessToken && refreshToken) {
                const isInviteAccept = window.location.pathname.startsWith('/accept-invite');
                const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (!isMounted) return;

                if (error) {
                    console.error('Hub SSO session handoff failed', error);
                    setAuthError('Hub login handoff failed. Please open BroadcastPilot from the hub again.');
                    setLoading(false);
                    navigate(removeSensitiveAuthParams(), { replace: true });
                    return;
                }

                setSession(data.session);
                setUser(data.session?.user ?? null);
                navigate(removeSensitiveAuthParams(), { replace: true });
                await fetchProfile(data.session, { provisionOwner: !isInviteAccept });
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();

            if (!isMounted) return;

            setSession(session);
            setUser(session?.user ?? null);
            if (session) {
                await fetchProfile(session);
            } else {
                setLoading(false);
            }
        };

        bootstrapSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session) {
                fetchProfile(session);
            } else {
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [fetchProfile, navigate]);

    const signOut = async () => {
        await supabase.auth.signOut();
        const hubLogoutUrl = import.meta.env.VITE_HUB_LOGOUT_URL || import.meta.env.VITE_HUB_LOGIN_URL;

        if (hubLogoutUrl) {
            window.location.assign(hubLogoutUrl);
        }
    };

    const refreshProfile = useCallback(() => fetchProfile(session), [fetchProfile, session]);

    const value = {
        session,
        user,
        userProfile,
        loading,
        authError,
        refreshProfile,
        signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
