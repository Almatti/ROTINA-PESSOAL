import { describe, it, expect } from "vitest";
import * as D from "@/lib/domain/dates";

describe("datas e fuso horário", () => {
  it("data local em São Paulo difere de UTC perto da meia-noite", () => {
    const instant = new Date("2026-11-25T02:30:00Z"); // 23:30 do dia 24 em SP (UTC-3)
    expect(D.localDateISO(instant, "America/Sao_Paulo")).toBe("2026-11-24");
    expect(D.localTimeHHMM(instant, "America/Sao_Paulo")).toBe("23:30");
  });
  it("zonedToUtc converte horário local para instante", () => {
    expect(D.zonedToUtc("2026-11-25", "07:00", "America/Sao_Paulo").toISOString()).toBe("2026-11-25T10:00:00.000Z");
    expect(D.zonedToUtc("2026-07-01", "12:00", "Europe/Lisbon").toISOString()).toBe("2026-07-01T11:00:00.000Z");
  });
  it("aritmética de datas", () => {
    expect(D.addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(D.addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(D.addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(D.diffDays("2026-03-01", "2026-02-01")).toBe(28);
    expect(D.startOfWeek("2026-11-25")).toBe("2026-11-22"); // quarta → domingo
    expect(D.monthGrid("2026-09-15").length % 7).toBe(0);
  });
  it("formatos brasileiros", () => {
    expect(D.formatDateBR("2026-11-05")).toBe("05/11/2026");
    expect(D.parseDateBR("31/12/2026")).toBe("2026-12-31");
    expect(D.parseDateBR("31/02/2026")).toBeNull();
    expect(D.formatShortLabel("2026-09-22")).toBe("Ter, 22 set");
  });
  it("saudação por horário", () => {
    expect(D.greeting(6)).toBe("Bom dia");
    expect(D.greeting(13)).toBe("Boa tarde");
    expect(D.greeting(20)).toBe("Boa noite");
    expect(D.greeting(2)).toBe("Boa noite");
  });
  it("rótulos de duração", () => {
    expect(D.minutesToLabel(480)).toBe("8h");
    expect(D.minutesToLabel(465)).toBe("7h45");
    expect(D.minutesToLabel(-30)).toBe("-30min");
  });
});
