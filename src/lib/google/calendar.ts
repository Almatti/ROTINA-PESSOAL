import "server-only";
/**
 * Integração com o Google Agenda (OAuth 2.0 + API REST v3).
 * Sincronização bidirecional:
 *  - Recebe: eventos alterados na janela [-30, +180] dias (inclui cancelados).
 *  - Envia: eventos criados/alterados/excluídos no app desde a última sincronização.
 *  - Conflitos: vence a alteração mais recente (Google `updated` × `local_updated_at`).
 *  - Duplicidades: evento local sem vínculo com mesmo título e início de um evento
 *    do Google é vinculado em vez de duplicado.
 * Tokens ficam criptografados (AES-256-GCM) e só são lidos com service_role.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { encrypt, decrypt } from "@/lib/crypto";
import { addDays, localDateISO } from "@/lib/domain/dates";
import type { RecurrenceRule } from "@/lib/domain/recurrence";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";
export const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.readonly"];

export const isGoogleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.INTEGRATIONS_ENCRYPTION_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
export const redirectUri = () => `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/google/callback`;

export function authUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri(), grant_type: "authorization_code" }),
  });
  if (!res.ok) throw new Error(`Falha ao trocar código (${res.status})`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
}

interface Integration { id: string; user_id: string; access_token_enc: string | null; refresh_token_enc: string | null; token_expires_at: string | null; calendar_id: string; last_synced_at: string | null }

async function accessToken(admin: SupabaseClient, integ: Integration): Promise<string> {
  if (integ.access_token_enc && integ.token_expires_at && new Date(integ.token_expires_at).getTime() > Date.now() + 60_000) return decrypt(integ.access_token_enc);
  if (!integ.refresh_token_enc) throw new Error("Sem refresh token — reconecte o Google Agenda.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: decrypt(integ.refresh_token_enc), grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new Error(res.status === 400 ? "Acesso ao Google revogado — reconecte." : `Falha ao renovar token (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  await admin.from("integrations").update({ access_token_enc: encrypt(j.access_token), token_expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString() }).eq("id", integ.id).eq("user_id", integ.user_id);
  return j.access_token;
}

export async function saveTokens(admin: SupabaseClient, userId: string, t: { access_token: string; refresh_token?: string; expires_in: number; scope: string }) {
  const row: Record<string, unknown> = {
    user_id: userId,
    provider: "google_calendar",
    access_token_enc: encrypt(t.access_token),
    token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    scope: t.scope,
    status: "ativa",
    last_error: null,
  };
  if (t.refresh_token) row.refresh_token_enc = encrypt(t.refresh_token);
  const { error } = await admin.from("integrations").upsert(row, { onConflict: "user_id,provider" });
  if (error) throw error;
}

export async function revokeGoogle(admin: SupabaseClient, userId: string) {
  const { data } = await admin.from("integrations").select("*").eq("user_id", userId).eq("provider", "google_calendar").maybeSingle();
  if (!data) return;
  const token = data.refresh_token_enc ? decrypt(data.refresh_token_enc) : data.access_token_enc ? decrypt(data.access_token_enc) : null;
  if (token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
  await admin.from("integrations").delete().eq("id", data.id).eq("user_id", userId);
}

interface GEvent {
  id: string;
  status: string;
  summary?: string;
  description?: string;
  location?: string;
  updated: string;
  etag: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string };
  recurringEventId?: string;
}

/** Converte a regra de recorrência local em RRULE (RFC 5545). */
export function toRRule(r: RecurrenceRule | null): string[] | undefined {
  if (!r) return undefined;
  const freq = { diaria: "DAILY", semanal: "WEEKLY", mensal: "MONTHLY", anual: "YEARLY" }[r.freq];
  const parts = [`FREQ=${freq}`];
  if (r.interval && r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
  if (r.freq === "semanal" && r.weekdays?.length) parts.push(`BYDAY=${r.weekdays.map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][d]).join(",")}`);
  if (r.until) parts.push(`UNTIL=${r.until.replace(/-/g, "")}T235959Z`);
  if (r.count) parts.push(`COUNT=${r.count}`);
  return [`RRULE:${parts.join(";")}`];
}

function toGoogleBody(e: { title: string; description: string | null; location: string | null; starts_at: string; ends_at: string; all_day: boolean; recurrence: RecurrenceRule | null }, tz: string) {
  return {
    summary: e.title,
    description: e.description ?? undefined,
    location: e.location ?? undefined,
    start: e.all_day ? { date: localDateISO(new Date(e.starts_at), tz) } : { dateTime: e.starts_at, timeZone: tz },
    end: e.all_day ? { date: localDateISO(new Date(e.ends_at), tz) } : { dateTime: e.ends_at, timeZone: tz },
    recurrence: toRRule(e.recurrence),
  };
}

function fromGoogle(g: GEvent) {
  const allDay = !!g.start?.date;
  const starts = allDay ? `${g.start!.date}T00:00:00Z` : g.start!.dateTime!;
  const ends = allDay ? `${g.end?.date ?? addDays(g.start!.date!, 1)}T00:00:00Z` : g.end?.dateTime ?? starts;
  return { title: (g.summary ?? "(sem título)").slice(0, 200), description: g.description?.slice(0, 5000) ?? null, location: g.location?.slice(0, 300) ?? null, starts_at: new Date(starts).toISOString(), ends_at: new Date(ends).toISOString(), all_day: allDay };
}

/** Executa a sincronização bidirecional para uma usuária. Usa service_role, sempre filtrando por user_id. */
export async function syncGoogle(admin: SupabaseClient, userId: string, tz: string) {
  const { data: integ } = await admin.from("integrations").select("*").eq("user_id", userId).eq("provider", "google_calendar").maybeSingle();
  if (!integ) throw new Error("Google Agenda não conectado.");
  const startedAt = new Date().toISOString();
  let imported = 0, exported = 0;
  try {
    const token = await accessToken(admin, integ as Integration);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const cal = encodeURIComponent(integ.calendar_id || "primary");
    const lastSync = integ.last_synced_at ? new Date(new Date(integ.last_synced_at).getTime() - 5 * 60_000).toISOString() : null;

    // ---------- Receber do Google ----------
    const remote: GEvent[] = [];
    let pageToken: string | undefined;
    do {
      const p = new URLSearchParams({ singleEvents: "true", showDeleted: "true", maxResults: "250", timeMin: new Date(Date.now() - 30 * 86400_000).toISOString(), timeMax: new Date(Date.now() + 180 * 86400_000).toISOString() });
      if (lastSync) p.set("updatedMin", lastSync);
      if (pageToken) p.set("pageToken", pageToken);
      const res = await fetch(`${API}/calendars/${cal}/events?${p}`, { headers });
      if (!res.ok) throw new Error(`Google respondeu ${res.status} ao listar eventos.`);
      const j = (await res.json()) as { items?: GEvent[]; nextPageToken?: string };
      remote.push(...(j.items ?? []));
      pageToken = j.nextPageToken;
    } while (pageToken && remote.length < 5000);

    const { data: localLinked } = await admin.from("events").select("id,google_event_id,local_updated_at,google_updated_at").eq("user_id", userId).not("google_event_id", "is", null);
    const linked = new Map((localLinked ?? []).map((e) => [e.google_event_id as string, e]));
    for (const g of remote) {
      // instâncias de séries recorrentes criadas pelo app já existem localmente como regra: não duplicar
      if (g.recurringEventId && linked.has(g.recurringEventId)) continue;
      const local = linked.get(g.id);
      const gUpdated = new Date(g.updated).getTime();
      if (local && lastSync && new Date(local.local_updated_at).getTime() > gUpdated && new Date(local.local_updated_at) > new Date(lastSync)) continue; // alteração local mais recente vence
      if (g.status === "cancelled") {
        if (local) { await admin.from("events").delete().eq("id", local.id).eq("user_id", userId); imported++; }
        continue;
      }
      if (!g.start) continue;
      const row = { ...fromGoogle(g), google_event_id: g.id, google_etag: g.etag, google_updated_at: g.updated, source: "google", local_updated_at: g.updated, deleted_at: null };
      if (local) await admin.from("events").update(row).eq("id", local.id).eq("user_id", userId);
      else {
        // evita duplicidade: vincula evento local equivalente (mesmo título e início) ainda não vinculado
        const { data: dup } = await admin.from("events").select("id").eq("user_id", userId).is("google_event_id", null).eq("title", row.title).eq("starts_at", row.starts_at).limit(1);
        if (dup?.length) await admin.from("events").update(row).eq("id", dup[0].id).eq("user_id", userId);
        else await admin.from("events").insert({ ...row, user_id: userId });
      }
      imported++;
    }

    // ---------- Enviar para o Google ----------
    const { data: toCreate } = await admin.from("events").select("*").eq("user_id", userId).is("google_event_id", null).is("deleted_at", null).eq("source", "vilma").limit(200);
    for (const e of toCreate ?? []) {
      const res = await fetch(`${API}/calendars/${cal}/events`, { method: "POST", headers, body: JSON.stringify(toGoogleBody(e, tz)) });
      if (!res.ok) continue;
      const g = (await res.json()) as GEvent;
      await admin.from("events").update({ google_event_id: g.id, google_etag: g.etag, google_updated_at: g.updated }).eq("id", e.id).eq("user_id", userId);
      exported++;
    }
    if (lastSync) {
      const { data: changed } = await admin.from("events").select("*").eq("user_id", userId).not("google_event_id", "is", null).is("deleted_at", null).gt("local_updated_at", lastSync).limit(200);
      for (const e of changed ?? []) {
        if (e.google_updated_at && new Date(e.google_updated_at) >= new Date(e.local_updated_at)) continue;
        const res = await fetch(`${API}/calendars/${cal}/events/${encodeURIComponent(e.google_event_id)}`, { method: "PATCH", headers, body: JSON.stringify(toGoogleBody(e, tz)) });
        if (res.ok) {
          const g = (await res.json()) as GEvent;
          await admin.from("events").update({ google_etag: g.etag, google_updated_at: g.updated }).eq("id", e.id).eq("user_id", userId);
          exported++;
        }
      }
    }
    const { data: removed } = await admin.from("events").select("id,google_event_id").eq("user_id", userId).not("deleted_at", "is", null).not("google_event_id", "is", null).limit(200);
    for (const e of removed ?? []) {
      const res = await fetch(`${API}/calendars/${cal}/events/${encodeURIComponent(e.google_event_id)}`, { method: "DELETE", headers });
      if (res.ok || res.status === 404 || res.status === 410) {
        await admin.from("events").delete().eq("id", e.id).eq("user_id", userId);
        exported++;
      }
    }
    await admin.from("integrations").update({ last_synced_at: startedAt, status: "ativa", last_error: null }).eq("id", integ.id).eq("user_id", userId);
    return { imported, exported };
  } catch (e) {
    await admin.from("integrations").update({ status: "erro", last_error: (e as Error).message.slice(0, 300) }).eq("id", integ.id).eq("user_id", userId);
    throw e;
  }
}
