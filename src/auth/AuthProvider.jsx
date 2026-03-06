import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthCtx = createContext(null);

function withTimeout(promise, ms, label = "timeout") {
  let t;
  const timeoutPromise = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(t));
}

export function AuthProvider({ children }) {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const loadingRef = useRef(false);

  async function loadProfile(userId, { silent = false } = {}) {
    if (!userId) return;
    // evita doppie chiamate concorrenti che possono incastrare lo stato
    if (loadingRef.current) return;

    loadingRef.current = true;
    if (!silent) setProfileLoading(true);

    try {
      const res = await withTimeout(
        supabase
          .from("profiles")
          .select("role, display_name")
          .eq("user_id", userId)
          .single(),
        5000,
        "profiles request timeout"
      );

      const { data, error } = res;
      if (error) throw error;

      setProfile(data);
      localStorage.setItem("ts_role", data?.role || "");
      localStorage.setItem("ts_display_name", data?.display_name || "");
    } catch (e) {
      console.error("loadProfile error:", e);

      // fallback: cache (così non rimani mai “vuota”)
      const cachedRole = localStorage.getItem("ts_role");
      const cachedName = localStorage.getItem("ts_display_name");

      if (cachedRole) {
        setProfile({ role: cachedRole, display_name: cachedName || null });
      } else {
        // non azzerare aggressivamente
        setProfile((prev) => prev ?? null);
      }
    } finally {
      loadingRef.current = false;
      if (!silent) setProfileLoading(false);
    }
  }

  async function refreshSessionAndProfile() {
    try {
      // session refresh con timeout (evita “Caricamento…” infinito)
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        5000,
        "getSession timeout"
      );
      setSession(data.session ?? null);

      const uid = data.session?.user?.id;
      if (uid) await loadProfile(uid, { silent: true }); // silent = non blocca UI
    } catch (e) {
      console.warn("refreshSessionAndProfile:", e);
      // se fallisce, non bloccare tutta l'app
      setSessionLoading(false);
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          5000,
          "getSession timeout"
        );
        if (!mounted) return;

        setSession(data.session ?? null);

        if (data.session?.user?.id) {
          await loadProfile(data.session.user.id);
        } else {
          setProfile(null);
        }
      } catch (e) {
        console.error("init session error:", e);
        // fallback cache
        const cachedRole = localStorage.getItem("ts_role");
        const cachedName = localStorage.getItem("ts_display_name");
        if (cachedRole) setProfile({ role: cachedRole, display_name: cachedName || null });
      } finally {
        if (mounted) setSessionLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession ?? null);

      if (newSession?.user?.id) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        localStorage.removeItem("ts_role");
        localStorage.removeItem("ts_display_name");
      }
    });

    // 🔥 quando torni sulla tab, rinfresca sessione+profilo
    const onVis = () => {
      if (document.visibilityState === "visible") {
        refreshSessionAndProfile();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const value = useMemo(() => ({
    sessionLoading,
    profileLoading,
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      await supabase.auth.signOut();
    }
  }), [sessionLoading, profileLoading, session, profile]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}