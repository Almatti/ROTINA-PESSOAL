import { describe, it, expect } from "vitest";
import { executeTool, toolDefinitions, TOOLS, type ToolContext } from "@/lib/vilma/tools";

/** Cliente Supabase falso: registra operações e devolve respostas configuradas por tabela. */
function fakeSb(data: Record<string, unknown[]> = {}) {
  const ops: { table: string; op: string; payload?: unknown }[] = [];
  const builder = (table: string) => {
    let op = "select";
    let payload: unknown;
    const q: Record<string, unknown> = {};
    const result = () => {
      ops.push({ table, op, payload });
      if (op === "insert") return { data: Array.isArray(payload) ? payload : { id: "novo-id", ...(payload as object) }, error: null, count: 1 };
      if (op === "delete" || op === "update") return { data: null, error: null, count: 1 };
      return { data: data[table] ?? [], error: null };
    };
    const chain = new Proxy(q, {
      get(_t, prop: string) {
        if (prop === "then") return (res: (v: unknown) => void) => res(result());
        if (prop === "single" || prop === "maybeSingle") return () => Promise.resolve((() => { const r = result(); return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data }; })());
        if (["insert", "update", "delete", "upsert"].includes(prop)) return (p?: unknown) => { op = prop; payload = p; return chain; };
        return () => chain;
      },
    });
    return chain;
  };
  return { sb: { from: builder } as unknown as ToolContext["sb"], ops };
}

const ctx = (sb: ToolContext["sb"]): ToolContext => ({ sb, userId: "u1", tz: "America/Sao_Paulo", today: "2026-11-25", conversationId: "c1", sleepGoal: 480, wakeTime: "07:00:00" });

describe("ferramentas da Vilma", () => {
  it("todas as ferramentas têm esquema JSON e descrição", () => {
    const defs = toolDefinitions();
    expect(defs.length).toBe(Object.keys(TOOLS).length);
    for (const d of defs) {
      expect((d.description ?? "").length).toBeGreaterThan(10);
      expect(d.input_schema.type).toBe("object");
    }
  });

  it("rejeita parâmetros inválidos antes de tocar no banco", async () => {
    const { sb, ops } = fakeSb();
    const r = await executeTool("create_transaction", { type: "despesa", amount: -10, description: "x" }, ctx(sb));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Parâmetros inválidos/);
    expect(ops).toHaveLength(0);
    const r2 = await executeTool("create_event", { title: "A", date: "2026-02-31" }, ctx(sb));
    expect(r2.ok).toBe(false);
  });

  it("ferramenta desconhecida não executa nada", async () => {
    const { sb, ops } = fakeSb();
    expect((await executeTool("drop_database", {}, ctx(sb))).ok).toBe(false);
    expect(ops).toHaveLength(0);
  });

  it("exclusão NÃO executa: cria ação pendente de confirmação", async () => {
    const { sb, ops } = fakeSb({ tasks: [{ title: "Pagar internet" }] });
    const r = await executeTool("delete_task", { task_id: "6f1c2b9e-1111-4a2b-9c3d-000000000001" }, ctx(sb));
    expect(r.pendingId).toBe("novo-id");
    expect(r.summary).toContain("Pagar internet");
    expect(ops.some((o) => o.table === "tasks" && o.op === "delete")).toBe(false);
    expect(ops.some((o) => o.table === "pending_actions" && o.op === "insert")).toBe(true);
  });

  it("após confirmação a exclusão é executada", async () => {
    const { sb, ops } = fakeSb();
    const r = await executeTool("delete_task", { task_id: "6f1c2b9e-1111-4a2b-9c3d-000000000001" }, ctx(sb), { confirmed: true });
    expect(r.ok).toBe(true);
    expect(ops.some((o) => o.table === "tasks" && o.op === "delete")).toBe(true);
  });

  it("alteração em massa (reagendar) exige confirmação", async () => {
    const { sb, ops } = fakeSb({ tasks: [] });
    const r = await executeTool("reschedule_tasks", { moves: [{ task_id: "6f1c2b9e-1111-4a2b-9c3d-000000000001", new_date: "2026-11-26" }] }, ctx(sb));
    expect(r.pendingId).toBeTruthy();
    expect(ops.some((o) => o.table === "tasks" && o.op === "update")).toBe(false);
  });

  it("registrar despesa sem conta cadastrada orienta a usuária (não inventa saldo)", async () => {
    const { sb } = fakeSb({ categories: [], financial_accounts: [] });
    const r = await executeTool("create_transaction", { type: "despesa", amount: 150, description: "Mercado" }, ctx(sb));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Nenhuma conta cadastrada/);
  });

  it("registrar despesa com conta usa valor decimal exato", async () => {
    const { sb, ops } = fakeSb({ categories: [{ id: "cat1", name: "Mercado" }], financial_accounts: [{ id: "acc1" }] });
    const r = await executeTool("create_transaction", { type: "despesa", amount: 84.9, description: "Mercado", category_name: "mercado" }, ctx(sb));
    expect(r.ok).toBe(true);
    const ins = ops.find((o) => o.table === "transactions" && o.op === "insert")!.payload as Record<string, unknown>;
    expect(ins).toMatchObject({ amount: "84.90", category_id: "cat1", account_id: "acc1", occurred_on: "2026-11-25", status: "pago" });
    expect(r.summary).toContain("R$ 84,90");
  });

  it("sono por duração calcula horário de dormir atravessando a meia-noite", async () => {
    const { sb, ops } = fakeSb({ sleep_logs: [] });
    const r = await executeTool("log_sleep", { hours: 8 }, ctx(sb));
    expect(r.ok).toBe(true);
    const ins = ops.find((o) => o.table === "sleep_logs" && o.op === "insert")!.payload as Record<string, unknown>;
    expect(ins.duration_minutes).toBe(480);
    expect(ins.bed_at).toBe("2026-11-25T02:00:00.000Z"); // 23:00 do dia 24 em SP
  });
});
