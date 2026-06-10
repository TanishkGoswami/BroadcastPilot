import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useSearchParams, useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        // 1. Check for tokens in the URL (from GAP SSO redirect)
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');

        if (accessToken && refreshToken) {
            supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            }).then(({ data, error }) => {
                if (!error) {
                    // Clear the tokens from URL for security
                    searchParams.delete('access_token');
                    searchParams.delete('refresh_token');
                    navigate('/', { replace: true });
                }
            });
        }

        const fetchProfile = async (currentSession) => {
            if (!currentSession?.user) {
                setUserProfile(null);
                setLoading(false);
                return;
            }
            try {
                // Fetch securely from our backend bypassing RLS
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
                const res = await fetch(`${API_URL}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${currentSession.access_token}` }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    setUserProfile(data);
                } else {
                    setUserProfile(null);
                }
            } catch (err) {
                console.error("Failed to fetch profile", err);
                setUserProfile(null);
            } finally {
                setLoading(false);
            }
        };

        // 2. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session) {
                fetchProfile(session);
            } else {
                setLoading(false);
            }
        });

        // 3. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session) {
                fetchProfile(session);
            } else {
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [searchParams, navigate]);

    const value = {
        session,
        user,
        userProfile,
        loading,
        signOut: () => supabase.auth.signOut(),
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
