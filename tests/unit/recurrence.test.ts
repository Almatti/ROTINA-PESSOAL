import { describe, it, expect } from "vitest";
import { occurrences, nextOccurrence, describeRecurrence } from "@/lib/domain/recurrence";

describe("recorrência", () => {
  it("diária com intervalo", () => {
    expect(occurrences({ freq: "diaria", interval: 2 }, "2026-11-01", "2026-11-01", "2026-11-07")).toEqual(["2026-11-01", "2026-11-03", "2026-11-05", "2026-11-07"]);
  });
  it("semanal em dias específicos", () => {
    // seg e qua a partir de domingo 22/11
    expect(occurrences({ freq: "semanal", weekdays: [1, 3] }, "2026-11-22", "2026-11-22", "2026-12-02")).toEqual(["2026-11-23", "2026-11-25", "2026-11-30", "2026-12-02"]);
  });
  it("mensal mantém o dia 31 ajustando meses curtos", () => {
    expect(occurrences({ freq: "mensal" }, "2026-01-31", "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("respeita until e count", () => {
    expect(occurrences({ freq: "diaria", until: "2026-11-03" }, "2026-11-01", "2026-11-01", "2026-12-01")).toHaveLength(3);
    expect(occurrences({ freq: "semanal", count: 2 }, "2026-11-01", "2026-11-01", "2027-01-01")).toEqual(["2026-11-01", "2026-11-08"]);
  });
  it("próxima ocorrência e descrição", () => {
    expect(nextOccurrence({ freq: "anual" }, "2024-02-29", "2026-11-25")).toBe("2027-02-28");
    expect(describeRecurrence({ freq: "semanal", weekdays: [1, 5] })).toBe("Toda semana (seg, sex)");
    expect(describeRecurrence(null)).toBe("Não se repete");
  });
});
