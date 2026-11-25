/* Vilma — service worker
 * - Navegação: network-first com fallback para cache/offline.
 * - Assets estáticos do Next: cache-first (imutáveis por hash).
 * - Nunca armazena respostas de /api nem do Supabase (dados pessoais).
 */
const VERSION = "vilma-v3";
// base do escopo (permite publicar em subpasta, ex.: GitHub Pages)
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const SHELL = ["/offline", "/offline/", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon.svg"].map((p) => BASE + p);

self.addEventListener("install", (event) => {
  // cada item é opcional: falhar um não impede a instalação
  event.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => undefined)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase/Anthropic/Google: sempre rede
  const path = url.pathname.slice(BASE.length);
  if (path.startsWith("/api/") || path.startsWith("/auth/")) return;

  if (path.startsWith("/_next/static/") || path.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(BASE + "/offline/")) || (await caches.match(BASE + "/offline"))),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_CACHE") caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
});

// Web Push: notificações com o app fechado
self.addEventListener("push", (event) => {
  let data = { title: "Vilma", body: "", url: BASE + "/inicio" };
  try { data = { ...data, ...event.data.json() }; } catch { if (event.data) data.body = event.data.text(); }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", tag: data.tag, data: { url: data.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || BASE + "/inicio";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
