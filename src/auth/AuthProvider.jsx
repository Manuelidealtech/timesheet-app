import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeDepartment } from '../lib/access';

const AuthCtx = createContext(null);

function readCachedProfile(userId = null) {
  const cachedRole = localStorage.getItem('ts_role');
  const cachedName = localStorage.getItem('ts_display_name');
  const cachedDepartment = localStorage.getItem('ts_department');
  const cachedEmployeeId = localStorage.getItem('ts_employee_id');
  const cachedIsActive = localStorage.getItem('ts_is_active');

  if (!(cachedRole || cachedName || cachedDepartment || cachedEmployeeId)) {
    return null;
  }

  return {
    user_id: userId,
    role: cachedRole || null,
    display_name: cachedName || null,
    department: normalizeDepartment(cachedDepartment),
    employee_id: cachedEmployeeId ? Number(cachedEmployeeId) : null,
    is_active: cachedIsActive !== 'false',
  };
}

function persistProfile(profile, userId = null) {
  const normalizedProfile = profile
    ? {
        ...profile,
        user_id: profile.user_id ?? userId ?? null,
        department: normalizeDepartment(profile?.department),
        is_active: profile?.is_active !== false,
      }
    : null;

  localStorage.setItem('ts_role', normalizedProfile?.role || '');
  localStorage.setItem('ts_display_name', normalizedProfile?.display_name || '');
  localStorage.setItem('ts_department', normalizedProfile?.department || '');
  localStorage.setItem(
    'ts_employee_id',
    normalizedProfile?.employee_id ? String(normalizedProfile.employee_id) : ''
  );
  localStorage.setItem(
    'ts_is_active',
    normalizedProfile?.is_active === false ? 'false' : 'true'
  );

  return normalizedProfile;
}

function clearCachedProfile() {
  localStorage.removeItem('ts_role');
  localStorage.removeItem('ts_display_name');
  localStorage.removeItem('ts_department');
  localStorage.removeItem('ts_employee_id');
  localStorage.removeItem('ts_is_active');
}

export function AuthProvider({ children }) {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const loadingRef = useRef(false);

  async function loadProfile(userId, { silent = false } = {}) {
    if (!userId || loadingRef.current) return null;

    loadingRef.current = true;
    if (!silent) setProfileLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, role, display_name, department, employee_id, is_active, email')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      const normalizedProfile = persistProfile(data, userId);
      setProfile(normalizedProfile);
      return normalizedProfile;
    } catch (e) {
      console.error('loadProfile error:', e);

      const cachedProfile = readCachedProfile(userId);
      setProfile(cachedProfile);
      return cachedProfile;
    } finally {
      loadingRef.current = false;
      if (!silent) setProfileLoading(false);
    }
  }

  async function bootstrapAuth() {
    try {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      setSession(currentSession ?? null);

      const uid = currentSession?.user?.id ?? null;

      if (uid) {
        // Usa subito la cache per rendere la UI istantanea
        const cachedProfile = readCachedProfile(uid);
        if (cachedProfile) {
          setProfile(cachedProfile);
        } else {
          setProfile(null);
        }

        // Chiudi subito il bootstrap auth
        setSessionLoading(false);

        // Aggiorna il profilo in background
        await loadProfile(uid, { silent: true });
      } else {
        setProfile(null);
        clearCachedProfile();
        setSessionLoading(false);
      }
    } catch (e) {
      console.error('init session error:', e);

      const cachedProfile = readCachedProfile(null);
      setProfile(cachedProfile);
      setSession(null);
      setSessionLoading(false);
    } finally {
      setProfileLoading(false);
    }
  }

  async function refreshSessionAndProfile() {
    try {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      setSession(currentSession ?? null);

      const uid = currentSession?.user?.id;
      if (uid) {
        const cachedProfile = readCachedProfile(uid);
        if (cachedProfile) {
          setProfile(cachedProfile);
        }
        await loadProfile(uid, { silent: true });
      } else {
        setProfile(null);
        clearCachedProfile();
      }
    } catch (e) {
      console.warn('refreshSessionAndProfile error:', e);
    } finally {
      setSessionLoading(false);
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      bootstrapAuth();
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;

      setSession(newSession ?? null);

      if (newSession?.user?.id) {
        const uid = newSession.user.id;
        const cachedProfile = readCachedProfile(uid);

        if (cachedProfile) {
          setProfile(cachedProfile);
        }

        setSessionLoading(false);
        setProfileLoading(false);

        await loadProfile(uid, { silent: true });
      } else {
        setProfile(null);
        clearCachedProfile();
        setSessionLoading(false);
        setProfileLoading(false);
      }
    });

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        refreshSessionAndProfile();
      }
    };

    document.addEventListener('visibilitychange', onVis);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const value = useMemo(
    () => ({
      sessionLoading,
      profileLoading,
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      department: profile?.department ?? null,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [sessionLoading, profileLoading, session, profile]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}