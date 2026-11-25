import { describe, it, expect } from "vitest";
import { parseQuickCommand, parseRelativeDate, parseTime } from "@/lib/domain/nlp";

const today = "2026-11-25"; // quarta-feira

describe("linguagem natural (pt-BR)", () => {
  it("datas relativas", () => {
    expect(parseRelativeDate("amanhã", today).date).toBe("2026-11-26");
    expect(parseRelativeDate("depois de amanhã", today).date).toBe("2026-11-27");
    expect(parseRelativeDate("na sexta", today).date).toBe("2026-11-27");
    expect(parseRelativeDate("quarta", today).date).toBe("2026-12-02");
    expect(parseRelativeDate("dia 10", today).date).toBe("2026-12-10");
    expect(parseRelativeDate("dia 28", today).date).toBe("2026-11-28");
    expect(parseRelativeDate("em 15/01", today).date).toBe("2027-01-15");
    expect(parseRelativeDate("daqui a 3 dias", today).date).toBe("2026-11-28");
  });
  it("horários", () => {
    expect(parseTime("às 7h").time).toBe("07:00");
    expect(parseTime("19h30").time).toBe("19:30");
    expect(parseTime("às 14:15").time).toBe("14:15");
    expect(parseTime("às 3 da tarde").time).toBe("15:00");
    expect(parseTime("sem hora").time).toBeNull();
  });
  it("comandos completos", () => {
    const a = parseQuickCommand("Agende academia amanhã às 7h", today);
    expect(a).toMatchObject({ intent: "compromisso", date: "2026-11-26", time: "07:00" });
    expect(a.title.toLowerCase()).toContain("academia");

    const b = parseQuickCommand("Adicione uma despesa de R$ 150 no mercado", today);
    expect(b).toMatchObject({ intent: "despesa", amountCents: 15000 });
    expect(b.title.toLowerCase()).toContain("mercado");

    expect(parseQuickCommand("Recebi R$ 3.000 de salário", today)).toMatchObject({ intent: "receita", amountCents: 300000 });
    expect(parseQuickCommand("Lembre-me de pagar a internet dia 10", today)).toMatchObject({ intent: "tarefa", date: "2026-12-10" });
    expect(parseQuickCommand("Registre que dormi oito horas", today)).toMatchObject({ intent: "sono", durationMinutes: 480 });
    expect(parseQuickCommand("bebi 500ml de água", today)).toMatchObject({ intent: "agua", waterMl: 500 });
  });
});
