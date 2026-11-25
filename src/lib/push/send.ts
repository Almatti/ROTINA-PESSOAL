import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Envio de Web Push (VAPID). Funciona com cliente RLS ou service_role:
 * sempre filtra por user_id. Inscrições expiradas (404/410) são removidas.
 */
export const isPushConfigured = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let configured = false;
function setup() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@exemplo.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

/** Monta o payload enviado ao service worker (limita tamanho e garante link interno). */
export function buildPayload(p: PushPayload): string {
  const url = p.url && p.url.startsWith("/") && !p.url.startsWith("//") ? p.url : "/inicio";
  return JSON.stringify({ title: p.title.slice(0, 120), body: (p.body ?? "").slice(0, 400), url, tag: p.tag?.slice(0, 120) });
}

type Sender = Pick<typeof webpush, "sendNotification">;

export async function sendPushToUser(sb: SupabaseClient, userId: string, payload: PushPayload, sender: Sender = webpush) {
  if (!isPushConfigured()) return { sent: 0, removed: 0 };
  if (sender === webpush) setup();
  const { data: subs } = await sb.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", userId);
  let sent = 0, removed = 0;
  const body = buildPayload(payload);
  for (const s of subs ?? []) {
    try {
      await sender.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 12, urgency: "normal" });
      sent++;
      await sb.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", s.id).eq("user_id", userId);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await sb.from("push_subscriptions").delete().eq("id", s.id).eq("user_id", userId);
        removed++;
      }
    }
  }
  return { sent, removed };
}
