"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as P from "@/lib/domain/pomodoro";
import { mutate } from "@/lib/data/store";
import { award, unlock } from "@/lib/data/actions";
import { useToast } from "@/components/ui/toast";
import { notify } from "@/lib/notify";

interface FocusApi {
  state: P.PomodoroState;
  settings: P.PomodoroSettings;
  remainingMs: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setMode: (m: P.FocusMode) => void;
  setTask: (id: string | null) => void;
  updateSettings: (s: Partial<P.PomodoroSettings>) => void;
}

const Ctx = createContext<FocusApi | null>(null);
const KEY = "vilma:focus";

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = [660, 784, 988][i];
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.25);
    });
  } catch {}
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [settings, setSettings] = useState<P.PomodoroSettings>(P.DEFAULT_POMODORO);
  const [state, setState] = useState<P.PomodoroState>(() => P.initialState());
  const [now, setNow] = useState(() => Date.now());
  const finishing = useRef(false);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.settings) setSettings({ ...P.DEFAULT_POMODORO, ...saved.settings });
        if (saved.state) setState(saved.state);
      }
    } catch {}
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ state, settings }));
    } catch {}
  }, [state, settings]);

  // Sincroniza entre abas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        const saved = JSON.parse(e.newValue);
        setState(saved.state);
        setSettings(saved.settings);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (state.status !== "rodando") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state.status]);

  const remainingMs = P.remaining(state, now);

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    const s = state;
    const actual = Math.round(s.plannedMinutes);
    try {
      await mutate({
        action: "insert",
        table: "focus_sessions",
        values: { mode: s.mode, planned_minutes: s.plannedMinutes, actual_minutes: actual, started_at: new Date(s.startedAt ?? Date.now()).toISOString(), ended_at: new Date().toISOString(), completed: true, task_id: s.taskId },
      });
      if (s.mode === "foco") {
        await award("foco", `foco:${s.startedAt}`);
        void unlock("foco_1");
      }
    } catch {}
    if (settings.sound) beep();
    const msg = s.mode === "foco" ? "Sessão de foco concluída! Hora de uma pausa. 🌿" : "Pausa encerrada. Bora focar? ✨";
    toast.show(msg, "success");
    notify("Vilma · Modo foco", msg, "/foco");
    let next = P.nextAfterFinish(s, settings);
    if (settings.autoStartNext) next = P.start(next, Date.now());
    setState(next);
    finishing.current = false;
  }, [state, settings, toast]);

  useEffect(() => {
    if (state.status === "rodando" && remainingMs <= 0) void finish();
  }, [remainingMs, state.status, finish]);

  const api: FocusApi = {
    state,
    settings,
    remainingMs,
    start: () => {
      if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
      setState((s) => P.start(s, Date.now()));
    },
    pause: () => setState((s) => P.pause(s, Date.now())),
    reset: () => setState((s) => P.reset(s, settings)),
    skip: () => setState((s) => P.nextAfterFinish(s, settings)),
    setMode: (m) => setState((s) => P.switchMode(s, m, settings)),
    setTask: (id) => setState((s) => ({ ...s, taskId: id })),
    updateSettings: (patch) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      setState((s) => (s.status === "parado" ? P.switchMode(s, s.mode, next) : s));
    },
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useFocus() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFocus fora do FocusProvider");
  return v;
}
