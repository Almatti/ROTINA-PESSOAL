import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM para tokens de integração. Formato: v1.<iv>.<tag>.<dados> (base64url). */
function key() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw) throw new Error("INTEGRATIONS_ENCRYPTION_KEY não configurada.");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("INTEGRATIONS_ENCRYPTION_KEY deve ter 32 bytes em base64.");
  return k;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1") throw new Error("Formato de token desconhecido.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}
