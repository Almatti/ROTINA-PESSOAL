import { describe, it, expect } from "vitest";
import { effectiveStatus, sortTasks, productivityStats, suggestReschedule } from "@/lib/domain/tasks";
import { findConflicts, conflictsWith } from "@/lib/domain/conflicts";
import { levelFromPoints } from "@/lib/domain/gamification";
import * as P from "@/lib/domain/pomodoro";

describe("tarefas", () => {
  const base = { priority: "media" as const, status: "pendente" as const, due_date: null };
  it("status atrasada é derivado", () => {
    expect(effectiveStatus({ ...base, id: "1", due_date: "2026-11-24" }, "2026-11-25")).toBe("atrasada");
    expect(effectiveStatus({ ...base, id: "1", due_date: "2026-11-25" }, "2026-11-25")).toBe("pendente");
    expect(effectiveStatus({ ...base, id: "1", due_date: "2026-11-01", status: "concluida" }, "2026-11-25")).toBe("concluida");
  });
  it("ordenação: atrasadas primeiro, depois data e prioridade", () => {
    const list = sortTasks([
      { ...base, id: "a", due_date: "2026-11-26" },
      { ...base, id: "b", due_date: "2026-11-20" },
      { ...base, id: "c", due_date: "2026-11-26", priority: "urgente" },
      { ...base, id: "d" },
    ], "2026-11-25");
    expect(list.map((t) => t.id)).toEqual(["b", "c", "a", "d"]);
  });
  it("indicadores de produtividade", () => {
    const s = productivityStats([
      { ...base, id: "1", status: "concluida", due_date: "2026-11-25", completed_at: "2026-11-25T12:00:00Z" },
      { ...base, id: "2", due_date: "2026-11-23" },
      { ...base, id: "3", due_date: "2026-11-25", estimated_minutes: 30 },
    ], "2026-11-25", (iso) => iso.slice(0, 10));
    expect(s).toMatchObject({ completedToday: 1, open: 2, overdue: 1, completionRateWeek: 33, plannedMinutesToday: 30 });
  });
  it("sugestão de reagendamento prioriza urgentes para hoje", () => {
    const s = suggestReschedule([
      { ...base, id: "x", due_date: "2026-11-20" },
      { ...base, id: "y", due_date: "2026-11-21", priority: "urgente" },
    ], "2026-11-25");
    expect(s[0]).toEqual({ id: "y", from: "2026-11-21", to: "2026-11-25" });
    expect(s[1].to).toBe("2026-11-26");
  });
});

describe("conflitos de horário", () => {
  const ev = (id: string, s: string, e: string) => ({ id, title: id, starts_at: `2026-11-25T${s}:00-03:00`, ends_at: `2026-11-25T${e}:00-03:00` });
  it("detecta sobreposição e ignora encostados/dia inteiro", () => {
    const items = [ev("a", "09:00", "10:00"), ev("b", "09:30", "11:00"), ev("c", "11:00", "12:00"), { ...ev("d", "00:00", "23:59"), all_day: true }];
    const c = findConflicts(items);
    expect(c.map(([x, y]) => x.id + y.id)).toEqual(["ab"]);
    expect(conflictsWith(ev("n", "10:30", "11:30"), items).map((i) => i.id)).toEqual(["b", "c"]);
  });
});

describe("gamificação", () => {
  it("níveis progressivos sem perda", () => {
    expect(levelFromPoints(0).level).toBe(1);
    expect(levelFromPoints(100).level).toBe(2);
    expect(levelFromPoints(299).level).toBe(2);
    expect(levelFromPoints(300).level).toBe(3);
    expect(levelFromPoints(150).progress).toBe(25);
  });
});

describe("pomodoro baseado em timestamps", () => {
  it("mantém consistência após 'navegar' (tempo calculado do relógio)", () => {
    let s = P.initialState();
    s = P.start(s, 0);
    expect(P.remaining(s, 60_000)).toBe(24 * 60_000);
    s = P.pause(s, 120_000);
    expect(P.remaining(s, 999_999)).toBe(23 * 60_000);
    s = P.start(s, 1_000_000);
    expect(P.remaining(s, 1_000_000 + 23 * 60_000 + 5000)).toBe(0);
    expect(P.formatClock(23 * 60_000)).toBe("23:00");
  });
  it("ciclo foco → pausa curta → ... → pausa longa", () => {
    let s = P.initialState();
    for (let i = 0; i < 3; i++) {
      s = P.nextAfterFinish(s, P.DEFAULT_POMODORO);
      expect(s.mode).toBe("pausa_curta");
      s = P.nextAfterFinish(s, P.DEFAULT_POMODORO);
    }
    s = P.nextAfterFinish(s, P.DEFAULT_POMODORO);
    expect(s.mode).toBe("pausa_longa");
    expect(s.completedFocus).toBe(4);
  });
});
