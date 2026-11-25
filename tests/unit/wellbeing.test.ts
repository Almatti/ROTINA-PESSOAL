import { describe, it, expect } from "vitest";
import { durationFromTimes, buildSleepInstants, sleepStats } from "@/lib/domain/sleep";
import { predictCycle, averageCycleLength, cycleCalendarMarks } from "@/lib/domain/cycle";
import { currentStreak, completionRate, isScheduledOn, bestStreak, type HabitLike } from "@/lib/domain/habits";

describe("sono", () => {
  it("atravessa a meia-noite corretamente", () => {
    expect(durationFromTimes("23:00", "07:00")).toBe(480);
    expect(durationFromTimes("01:30", "08:00")).toBe(390);
    expect(durationFromTimes("14:00", "15:30")).toBe(90);
    const r = buildSleepInstants("2026-11-25", "23:00", "07:00", "America/Sao_Paulo");
    expect(r.bedAt.toISOString()).toBe("2026-11-25T02:00:00.000Z");
    expect(r.duration).toBe(480);
  });
  it("estatísticas e dívida de sono", () => {
    const logs = [
      { sleep_date: "2026-11-25", bed_at: "", wake_at: "", duration_minutes: 480 },
      { sleep_date: "2026-11-24", bed_at: "", wake_at: "", duration_minutes: 420 },
      { sleep_date: "2026-11-23", bed_at: "", wake_at: "", duration_minutes: 540 },
    ];
    const s = sleepStats(logs, 480, "2026-11-25");
    expect(s.weekAvg).toBe(480);
    expect(s.nightsOnGoal).toBe(2);
    expect(s.streakOnGoal).toBe(1);
    expect(s.best?.duration_minutes).toBe(540);
    expect(s.debtMinutes).toBe(0); // 0 + 60 - 60
  });
});

describe("ciclo menstrual (estimativas)", () => {
  const periods = [
    { start_date: "2026-08-01", end_date: "2026-08-05" },
    { start_date: "2026-08-29", end_date: "2026-09-02" },
    { start_date: "2026-09-28", end_date: "2026-10-02" },
  ];
  it("média e previsão", () => {
    expect(averageCycleLength(periods)).toBe(29);
    const p = predictCycle(periods, "2026-10-10")!;
    expect(p.nextStart).toBe("2026-10-27");
    expect(p.periodLength).toBe(5);
    expect(p.currentDay).toBe(13);
    expect(p.basedOnHistory).toBe(true);
  });
  it("sem histórico suficiente usa padrão sinalizado", () => {
    const p = predictCycle([{ start_date: "2026-11-01", end_date: null }], "2026-11-10")!;
    expect(p.cycleLength).toBe(28);
    expect(p.basedOnHistory).toBe(false);
    const marks = cycleCalendarMarks([{ start_date: "2026-11-01", end_date: null }], p, "2026-11-01", "2026-11-30");
    expect(marks.get("2026-11-01")).toBe("menstruacao");
    expect(marks.get("2026-11-29")).toBe("previsao");
  });
});

describe("hábitos", () => {
  const h: HabitLike = { id: "h", frequency: { type: "daily" }, target_value: 1, started_on: "2026-11-01" };
  const log = (d: string, v = 1) => ({ habit_id: "h", log_date: d, value: v, completed: v >= 1 });
  it("sequência não quebra se hoje ainda não foi feito", () => {
    const logs = [log("2026-11-22"), log("2026-11-23"), log("2026-11-24")];
    expect(currentStreak(h, logs, "2026-11-25")).toBe(3);
    expect(currentStreak(h, [...logs, log("2026-11-25")], "2026-11-25")).toBe(4);
    expect(currentStreak(h, [log("2026-11-22")], "2026-11-25")).toBe(0);
  });
  it("dias específicos da semana pulam dias não agendados", () => {
    const seg_qua: HabitLike = { ...h, frequency: { type: "weekdays", days: [1, 3] } };
    expect(isScheduledOn(seg_qua, "2026-11-24")).toBe(false); // terça
    expect(currentStreak(seg_qua, [log("2026-11-23"), log("2026-11-25")], "2026-11-25")).toBe(2);
  });
  it("meta quantitativa e taxa de conclusão", () => {
    const agua: HabitLike = { ...h, target_value: 2000 };
    const logs = [{ habit_id: "h", log_date: "2026-11-25", value: 1500, completed: false }];
    expect(currentStreak(agua, logs, "2026-11-25")).toBe(0);
    expect(completionRate(h, [log("2026-11-24"), log("2026-11-25")], "2026-11-25", 4)).toBe(50);
    expect(bestStreak(h, [log("2026-11-02"), log("2026-11-03"), log("2026-11-05")], "2026-11-06")).toBe(2);
  });
  it("x vezes por semana conta semanas", () => {
    const tpw: HabitLike = { ...h, frequency: { type: "times_per_week", times: 2 } };
    const logs = [log("2026-11-16"), log("2026-11-18"), log("2026-11-23"), log("2026-11-24")];
    expect(currentStreak(tpw, logs, "2026-11-25")).toBe(2);
  });
});
