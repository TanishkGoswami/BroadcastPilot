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

        const fetchProfile = async (sessionUser) => {
            if (!sessionUser) {
                setUserProfile(null);
                setLoading(false);
                return;
            }
            const { data } = await supabase
                .from('b_organization_members')
                .select('organization_id, role')
                .eq('user_id', sessionUser.id)
                .single();
            setUserProfile(data);
            setLoading(false);
        };

        // 2. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user);
            } else {
                setLoading(false);
            }
        });

        // 3. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user);
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
