"use client";
/** Notificação local (via service worker quando disponível). Só dispara com permissão concedida. */
export async function notify(title: string, body: string, url = "/inicio", tag?: string) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts: NotificationOptions = { body, icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", data: { url }, tag };
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
    return true;
  } catch {
    return false;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}
