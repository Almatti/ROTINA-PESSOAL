"use client";
import Link from "next/link";
import { Bell, CheckCheck, Trash2, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, EmptyState, cn } from "@/components/ui/primitives";
import { useNotifications } from "@/lib/data/hooks";
import { mutate, invalidate } from "@/lib/data/store";
import { getSupabase } from "@/lib/supabase/client";
import { requestNotificationPermission } from "@/lib/notify";
import { useToast } from "@/components/ui/toast";

export default function NotificationsPage() {
  const toast = useToast();
  const { data: items = [] } = useNotifications();
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission), []);
  const unread = items.filter((n) => !n.read_at);
  return (
    <>
      <PageHeader title="Notificações" icon={<Bell className="size-5" />} actions={unread.length > 0 && <Button size="sm" variant="soft" icon={<CheckCheck className="size-4" />} onClick={async () => { await getSupabase().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null); invalidate("notifications"); }}>Marcar lidas</Button>} />
      {perm === "default" && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-primary-soft p-3 text-sm">
          <BellRing className="size-5 text-primary" aria-hidden />
          <span className="flex-1">Ative as notificações do dispositivo para receber lembretes.</span>
          <Button size="sm" onClick={async () => { const p = await requestNotificationPermission(); setPerm(p); if (p === "granted") toast.show("Notificações ativadas!", "success"); }}>Ativar</Button>
        </div>
      )}
      {perm === "denied" && <p className="mb-4 rounded-2xl bg-warning-soft p-3 text-sm text-warning">As notificações estão bloqueadas no navegador. Libere nas configurações do site para receber lembretes.</p>}
      {items.length === 0 ? <EmptyState icon="🔔" title="Nenhuma notificação" description="Resumos, lembretes de vencimentos e conquistas aparecerão aqui." /> : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-3 rounded-2xl p-3", n.read_at ? "bg-surface" : "bg-primary-soft/70")}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden />
              <div className="min-w-0 flex-1">
                {n.link ? <Link href={n.link} onClick={() => !n.read_at && mutate({ action: "update", table: "notifications", id: n.id, values: { read_at: new Date().toISOString() } })} className="font-semibold hover:underline">{n.title}</Link> : <p className="font-semibold">{n.title}</p>}
                {n.body && <p className="whitespace-pre-wrap text-sm text-ink-soft">{n.body}</p>}
                <p className="mt-0.5 text-xs text-muted">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
              </div>
              {!n.read_at && <Button size="icon" variant="ghost" aria-label="Marcar como lida" onClick={() => mutate({ action: "update", table: "notifications", id: n.id, values: { read_at: new Date().toISOString() } })}><CheckCheck className="size-4" /></Button>}
              <Button size="icon" variant="ghost" aria-label="Excluir notificação" onClick={() => mutate({ action: "delete", table: "notifications", id: n.id })}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
