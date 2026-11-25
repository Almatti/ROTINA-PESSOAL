"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import { isLocalMode } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";

/** No modo local não há middleware: quem já entrou vai direto para o Início. */
export function LocalSessionRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!isLocalMode) return;
    void getSupabase().auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/inicio");
    });
  }, [router]);
  return null;
}

export function LocalModeNotice({ className = "" }: { className?: string }) {
  if (!isLocalMode) return null;
  return (
    <div className={`flex gap-3 rounded-2xl bg-primary-soft p-3 text-sm text-primary-soft-ink ${className}`} role="note">
      <Smartphone className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p><strong>Modo local:</strong> seus dados ficam guardados só neste aparelho e navegador, sem servidor. Faça backups em Configurações › Privacidade › Exportar. A sincronização entre aparelhos e a IA completa chegam com a versão online.</p>
    </div>
  );
}
