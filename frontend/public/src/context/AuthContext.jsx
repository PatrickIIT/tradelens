// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);   // full profile from users table
  const [session, setSession] = useState(null);   // Supabase session (access_token etc.)
  const [loading, setLoading] = useState(true);   // true until initial session check done

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Fetch the user profile (role, country, is_active) from the users table
  // using the Supabase Auth user id
  const fetchProfile = async (authUser) => {
    if (!authUser) return null;

    const { data: profile, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, country, phone, is_active, created_at')
      .eq('id', authUser.id)
      .single();

    if (error || !profile) {
      console.error('[AuthContext] Failed to fetch profile:', error?.message);
      return null;
    }

    return profile;
  };

  // ── Session Bootstrap ──────────────────────────────────────────────────────
  // On mount: check for an existing Supabase session (persisted in localStorage)
  useEffect(() => {
    const bootstrap = async () => {
      const { data: { session: existingSession } } = await supabase.auth.getSession();

      if (existingSession) {
        const profile = await fetchProfile(existingSession.user);
        setSession(existingSession);
        setUser(profile);
      }

      setLoading(false);
    };

    bootstrap();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const profile = await fetchProfile(newSession?.user);
          setSession(newSession);
          setUser(profile);
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Auth Actions ───────────────────────────────────────────────────────────

  // Login — calls backend POST /api/auth/login, not Supabase directly,
  // so the backend can enforce is_active and return role + country
  const login = async (email, password) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/login`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { success: false, message: data.message || 'Login failed.' };
    }

    // Set the Supabase session manually so supabase-js uses the token
    // returned by our backend (which includes role-aware profile data)
    await supabase.auth.setSession({
      access_token:  data.data.access_token,
      refresh_token: data.data.refresh_token,
    });

    setSession({
      access_token:  data.data.access_token,
      refresh_token: data.data.refresh_token,
      expires_at:    data.data.expires_at,
    });
    setUser(data.data.user);

    return { success: true, user: data.data.user };
  };

  // Register — Trader self-registration only
  const register = async ({ email, password, full_name, country, phone }) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/register`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email,
          password,
          full_name,
          role: 'trader', // only traders self-register
          country,
          phone: phone || undefined,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { success: false, message: data.message || 'Registration failed.' };
    }

    return { success: true, message: data.message };
  };

  // Logout — calls backend to invalidate Supabase session server-side
  const logout = async () => {
    try {
      await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/logout`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );
    } catch (err) {
      console.error('[AuthContext] Logout request failed:', err.message);
    }

    // Always clear local state regardless of server response
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  // Update own profile (full_name, phone)
  const updateProfile = async ({ full_name, phone }) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/me`,
      {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ full_name, phone }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { success: false, message: data.message || 'Update failed.' };
    }

    // Sync updated profile into context state
    setUser((prev) => ({ ...prev, ...data.data }));

    return { success: true, user: data.data };
  };

  // ── Role Helpers ───────────────────────────────────────────────────────────
  // Used in pages and ProtectedRoute to gate UI and navigation

  const isTrader          = user?.role === 'trader';
  const isStandardsOfficer = user?.role === 'standards_officer';
  const isCustomsOfficer  = user?.role === 'customs_officer';
  const isAdmin           = user?.role === 'admin';
  const isOfficer         = ['standards_officer', 'customs_officer', 'admin'].includes(user?.role);

  // ── Country Helpers ────────────────────────────────────────────────────────
  const isTanzania = user?.country === 'TZ';
  const isZambia   = user?.country === 'ZM';

  // ── Token Helper ───────────────────────────────────────────────────────────
  // Convenience getter for the access token — used in fetch calls across pages
  const getToken = () => session?.access_token || null;

  // ─── Context Value ──────────────────────────────────────────────────────────
  const value = {
    // State
    user,
    session,
    loading,

    // Auth actions
    login,
    register,
    logout,
    updateProfile,

    // Role flags
    isTrader,
    isStandardsOfficer,
    isCustomsOfficer,
    isAdmin,
    isOfficer,

    // Country flags
    isTanzania,
    isZambia,

    // Token
    getToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('[useAuth] must be used inside <AuthProvider>. Wrap your app in AuthProvider.');
  }
  return context;
};

export default AuthContext;
