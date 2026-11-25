/**
 * Estado do Pomodoro baseado em timestamps: o tempo restante é sempre
 * calculado a partir de `endsAt`, então navegar entre telas, recarregar
 * ou bloquear a tela não desincroniza o cronômetro.
 */
export type FocusMode = "foco" | "pausa_curta" | "pausa_longa";

export interface PomodoroSettings {
  focus: number;
  shortBreak: number;
  longBreak: number;
  cyclesUntilLong: number;
  sound: boolean;
  autoStartNext: boolean;
}

export const DEFAULT_POMODORO: PomodoroSettings = { focus: 25, shortBreak: 5, longBreak: 15, cyclesUntilLong: 4, sound: true, autoStartNext: false };

export interface PomodoroState {
  mode: FocusMode;
  status: "parado" | "rodando" | "pausado";
  startedAt: number | null; // epoch ms do início da sessão
  endsAt: number | null; // epoch ms quando rodando
  remainingMs: number; // quando pausado/parado
  plannedMinutes: number;
  completedFocus: number;
  taskId: string | null;
}

export function initialState(s: PomodoroSettings = DEFAULT_POMODORO): PomodoroState {
  return { mode: "foco", status: "parado", startedAt: null, endsAt: null, remainingMs: s.focus * 60000, plannedMinutes: s.focus, completedFocus: 0, taskId: null };
}

export function minutesFor(mode: FocusMode, s: PomodoroSettings) {
  return mode === "foco" ? s.focus : mode === "pausa_curta" ? s.shortBreak : s.longBreak;
}

export function remaining(state: PomodoroState, now: number): number {
  if (state.status === "rodando" && state.endsAt) return Math.max(0, state.endsAt - now);
  return state.remainingMs;
}

export function start(state: PomodoroState, now: number): PomodoroState {
  if (state.status === "rodando") return state;
  return { ...state, status: "rodando", startedAt: state.startedAt ?? now, endsAt: now + state.remainingMs };
}

export function pause(state: PomodoroState, now: number): PomodoroState {
  if (state.status !== "rodando") return state;
  return { ...state, status: "pausado", endsAt: null, remainingMs: remaining(state, now) };
}

export function reset(state: PomodoroState, s: PomodoroSettings): PomodoroState {
  const m = minutesFor(state.mode, s);
  return { ...state, status: "parado", startedAt: null, endsAt: null, remainingMs: m * 60000, plannedMinutes: m };
}

export function switchMode(state: PomodoroState, mode: FocusMode, s: PomodoroSettings): PomodoroState {
  const m = minutesFor(mode, s);
  return { ...state, mode, status: "parado", startedAt: null, endsAt: null, remainingMs: m * 60000, plannedMinutes: m };
}

/** Avança para o próximo modo após terminar (foco → pausa curta/longa → foco). */
export function nextAfterFinish(state: PomodoroState, s: PomodoroSettings): PomodoroState {
  if (state.mode === "foco") {
    const completed = state.completedFocus + 1;
    const mode: FocusMode = completed % s.cyclesUntilLong === 0 ? "pausa_longa" : "pausa_curta";
    return { ...switchMode(state, mode, s), completedFocus: completed };
  }
  return switchMode(state, "foco", s);
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
