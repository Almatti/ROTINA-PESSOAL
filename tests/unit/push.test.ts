import { describe, it, expect, beforeAll } from "vitest";
import { buildPayload, sendPushToUser } from "@/lib/push/send";

function fakeSb(subs: { id: string; endpoint: string; p256dh: string; auth: string }[]) {
  const ops: string[] = [];
  const chain = (table: string): unknown => {
    let op = "select";
    const c: Record<string, unknown> = {
      select: () => c,
      update: () => { op = "update"; return c; },
      delete: () => { op = "delete"; return c; },
      eq: () => c,
      then: (res: (v: unknown) => void) => { ops.push(`${table}:${op}`); res({ data: op === "select" ? subs : null, error: null }); },
    };
    return c;
  };
  return { sb: { from: chain } as never, ops };
}

describe("Web Push", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
  });

  it("payload limita tamanho e só aceita links internos", () => {
    const p = JSON.parse(buildPayload({ title: "x".repeat(300), body: "y", url: "https://malicioso.com" }));
    expect(p.title).toHaveLength(120);
    expect(p.url).toBe("/inicio");
    expect(JSON.parse(buildPayload({ title: "a", url: "//evil" })).url).toBe("/inicio");
    expect(JSON.parse(buildPayload({ title: "a", url: "/financas" })).url).toBe("/financas");
  });

  it("envia para cada dispositivo e remove inscrições expiradas (410)", async () => {
    const { sb, ops } = fakeSb([
      { id: "1", endpoint: "https://push/a", p256dh: "k", auth: "a" },
      { id: "2", endpoint: "https://push/b", p256dh: "k", auth: "a" },
    ]);
    const calls: string[] = [];
    const sender = {
      sendNotification: async (sub: { endpoint: string }) => {
        calls.push(sub.endpoint);
        if (sub.endpoint.endsWith("b")) throw Object.assign(new Error("gone"), { statusCode: 410 });
        return { statusCode: 201, body: "", headers: {} };
      },
    };
    const r = await sendPushToUser(sb, "u1", { title: "Oi" }, sender as never);
    expect(calls).toEqual(["https://push/a", "https://push/b"]);
    expect(r).toEqual({ sent: 1, removed: 1 });
    expect(ops).toContain("push_subscriptions:delete");
  });

  it("não faz nada sem chaves VAPID configuradas", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const { sb, ops } = fakeSb([{ id: "1", endpoint: "https://push/a", p256dh: "k", auth: "a" }]);
    expect(await sendPushToUser(sb, "u1", { title: "Oi" })).toEqual({ sent: 0, removed: 0 });
    expect(ops).toHaveLength(0);
  });
});
