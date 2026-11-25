"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { DEFAULT_TZ, localDateISO, zonedParts } from "@/lib/domain/dates";
import { setDataUser, startSync, mutate } from "@/lib/data/store";
import type { Profile } from "@/lib/types";
import { useToast } from "@/components/ui/toast";

interface SessionValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  tz: string;
  today: string;
  hour: number;
  displayName: string;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  reloadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function applyTheme(theme: Profile["theme"] | undefined) {
  const root = document.documentElement;
  const dark = theme === "dark" || (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  try {
    localStorage.setItem("vilma:theme", theme ?? "system");
  } catch {}
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const toast = useToast();

  const tz = profile?.timezone || DEFAULT_TZ;

  const loadProfile = useCallback(async (uid: string) => {
    const cacheKey = `vilma:${uid}:profile`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) setProfile(JSON.parse(cached));
    } catch {}
    const { data, error } = await getSupabase().from("profiles").select("*").eq("id", uid).single();
    if (!error && data) {
      setProfile(data as Profile);
      applyTheme((data as Profile).theme);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {}
    }
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    let stopSync: (() => void) | undefined;
    sb.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      setDataUser(data.user?.id ?? null);
      if (data.user) {
        await loadProfile(data.user.id);
        // automações: executa uma vez por dia por dispositivo ao abrir o app (além do cron diário)
        try {
          const key = `vilma:auto:${data.user.id}:${new Date().toISOString().slice(0, 10)}`;
          if (navigator.onLine && !localStorage.getItem(key)) {
            localStorage.setItem(key, "1");
            void fetch("/api/automations/run", { method: "POST" }).catch(() => localStorage.removeItem(key));
          }
        } catch {}
        stopSync = startSync(data.user.id, (r) => {
          if (r.sent) toast.show(`${r.sent} alteração(ões) sincronizada(s).`, "success");
          r.failed.forEach((f) => toast.show(`Não foi possível sincronizar: ${f}`, "error"));
        });
      }
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setDataUser(null);
      } else if (session?.user) setUser(session.user);
    });
    return () => {
      sub.subscription.unsubscribe();
      stopSync?.();
    };
  }, [loadProfile, toast]);

  // Atualiza "hoje" a cada minuto (virada de dia e saudação).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!user) return;
      setProfile((p) => (p ? { ...p, ...patch } : p));
      if (patch.theme) applyTheme(patch.theme);
      await mutate({ action: "update", table: "profiles", id: user.id, values: patch as Record<string, unknown> });
      try {
        const cacheKey = `vilma:${user.id}:profile`;
        const cur = JSON.parse(localStorage.getItem(cacheKey) || "{}");
        localStorage.setItem(cacheKey, JSON.stringify({ ...cur, ...patch }));
      } catch {}
    },
    [user],
  );

  const value = useMemo<SessionValue>(() => {
    const parts = zonedParts(now, tz);
    const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
    const displayName = profile?.nickname || profile?.full_name?.split(" ")[0] || meta.full_name?.split(" ")[0] || meta.name?.split(" ")[0] || "";
    return {
      user,
      profile,
      loading,
      tz,
      today: localDateISO(now, tz),
      hour: parts.hour,
      displayName,
      updateProfile,
      reloadProfile: async () => {
        if (user) await loadProfile(user.id);
      },
      signOut: async () => {
        await getSupabase().auth.signOut();
        window.location.href = "/entrar";
      },
    };
  }, [user, profile, loading, tz, now, updateProfile, loadProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession fora do SessionProvider");
  return v;
}
