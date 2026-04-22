import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeDepartment } from '../lib/access';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const loadingRef = useRef(false);

  async function loadProfile(userId, { silent = false } = {}) {
    if (!userId || loadingRef.current) return;

    loadingRef.current = true;
    if (!silent) setProfileLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, role, display_name, department, employee_id, is_active, email')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      const normalizedProfile = data
        ? {
            ...data,
            department: normalizeDepartment(data?.department),
            is_active: data?.is_active !== false,
          }
        : null;

      setProfile(normalizedProfile);

      localStorage.setItem('ts_role', normalizedProfile?.role || '');
      localStorage.setItem('ts_display_name', normalizedProfile?.display_name || '');
      localStorage.setItem('ts_department', normalizedProfile?.department || '');
      localStorage.setItem('ts_employee_id', normalizedProfile?.employee_id ? String(normalizedProfile.employee_id) : '');
      localStorage.setItem('ts_is_active', normalizedProfile?.is_active === false ? 'false' : 'true');
    } catch (e) {
      console.error('loadProfile error:', e);

      const cachedRole = localStorage.getItem('ts_role');
      const cachedName = localStorage.getItem('ts_display_name');
      const cachedDepartment = localStorage.getItem('ts_department');
      const cachedEmployeeId = localStorage.getItem('ts_employee_id');
      const cachedIsActive = localStorage.getItem('ts_is_active');

      if (cachedRole || cachedName || cachedDepartment || cachedEmployeeId) {
        setProfile({
          user_id: userId,
          role: cachedRole || null,
          display_name: cachedName || null,
          department: normalizeDepartment(cachedDepartment),
          employee_id: cachedEmployeeId ? Number(cachedEmployeeId) : null,
          is_active: cachedIsActive !== 'false',
        });
      } else {
        setProfile(null);
      }
    } finally {
      loadingRef.current = false;
      if (!silent) setProfileLoading(false);
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
        await loadProfile(uid, { silent: true });
      } else {
        setProfile(null);
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

    (async () => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;
        if (!mounted) return;

        setSession(currentSession ?? null);

        if (currentSession?.user?.id) {
          await loadProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (e) {
        console.error('init session error:', e);

        const cachedRole = localStorage.getItem('ts_role');
        const cachedName = localStorage.getItem('ts_display_name');
        const cachedDepartment = localStorage.getItem('ts_department');
        const cachedEmployeeId = localStorage.getItem('ts_employee_id');
        const cachedIsActive = localStorage.getItem('ts_is_active');

        if (cachedRole || cachedName || cachedDepartment || cachedEmployeeId) {
          setProfile({
            role: cachedRole || null,
            display_name: cachedName || null,
            department: normalizeDepartment(cachedDepartment),
            employee_id: cachedEmployeeId ? Number(cachedEmployeeId) : null,
            is_active: cachedIsActive !== 'false',
          });
        } else {
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setSessionLoading(false);
          setProfileLoading(false);
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession ?? null);

      if (newSession?.user?.id) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        localStorage.removeItem('ts_role');
        localStorage.removeItem('ts_display_name');
        localStorage.removeItem('ts_department');
        localStorage.removeItem('ts_employee_id');
        localStorage.removeItem('ts_is_active');
      }

      setSessionLoading(false);
      setProfileLoading(false);
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