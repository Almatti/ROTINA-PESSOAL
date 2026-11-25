"use client";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { isGoogleAuthEnabled } from "@/lib/env";

export function GoogleButton({ next = "/inicio" }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  if (!isGoogleAuthEnabled) return null;
  return (
    <Button
      variant="outline"
      className="w-full"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        const { error } = await getSupabase().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) {
          setLoading(false);
          toast.show("Login com Google indisponível. Verifique se o provedor está ativo no Supabase.", "error");
        }
      }}
      icon={
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.8 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.2H2.1a11 11 0 0 0 0 9.6L5.8 14Z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.2L5.8 10C6.7 7.3 9.1 5.4 12 5.4Z" />
        </svg>
      }
    >
      Continuar com Google
    </Button>
  );
}
