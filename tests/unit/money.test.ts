import { describe, it, expect } from "vitest";
import { parseBRL, formatBRL, splitInstallments, toCents, centsToDecimalString } from "@/lib/domain/money";

describe("dinheiro", () => {
  it("interpreta valores digitados em português", () => {
    expect(parseBRL("R$ 1.234,56")).toBe(123456);
    expect(parseBRL("150")).toBe(15000);
    expect(parseBRL("3.000")).toBe(300000);
    expect(parseBRL("3 mil")).toBe(300000);
    expect(parseBRL("12,5")).toBe(1250);
    expect(parseBRL("84,90")).toBe(8490);
    expect(parseBRL("1,234.56")).toBe(123456);
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("")).toBeNull();
  });
  it("formata em reais", () => {
    expect(formatBRL(500)).toBe("R$ 500,00");
    expect(formatBRL("868.57")).toBe("R$ 868,57");
    expect(formatBRL(-10.5)).toBe("-R$ 10,50");
  });
  it("evita erro de ponto flutuante", () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
    expect(centsToDecimalString(30)).toBe("0.30");
    expect(centsToDecimalString(-1205)).toBe("-12.05");
  });
  it("parcelas somam exatamente o total", () => {
    const p = splitInstallments(10000, 3);
    expect(p).toEqual([3334, 3333, 3333]);
    expect(p.reduce((a, b) => a + b)).toBe(10000);
    expect(() => splitInstallments(100, 0)).toThrow();
  });
});
