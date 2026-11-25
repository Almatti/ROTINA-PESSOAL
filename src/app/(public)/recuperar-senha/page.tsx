"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button, Field, Input, ErrorNote } from "@/components/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";
import { emailSchema, authErrorMessage } from "@/lib/validation/auth";
import { isLocalMode } from "@/lib/env";

export default function RecoverPage() {
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(new FormData(e.currentTarget).get("email"));
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    setLoading(true);
    const { error } = await getSupabase().auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    });
    setLoading(false);
    if (error && !/user not found/i.test(error.message)) return setFormError(authErrorMessage(error.message));
    setSent(true); // não revela se o e-mail existe
  }

  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha." footer={<Link className="font-semibold text-primary" href="/entrar">Voltar para o login</Link>}>
      {isLocalMode ? (
        <div className="card p-6 text-sm" role="status">No modo local não há envio de e-mail, pois os dados ficam só neste aparelho. Se você esqueceu a senha, crie uma nova conta neste aparelho — ou, depois de ativar a versão online, recupere por e-mail normalmente.</div>
      ) : sent ? (
        <div className="card p-6 text-center" role="status">Se houver uma conta com este e-mail, você receberá o link em instantes. Confira também a caixa de spam.</div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && <ErrorNote message={formError} />}
          <Field label="E-mail" error={error}>{(id, d) => <Input id={id} name="email" type="email" autoComplete="email" aria-describedby={d} invalid={!!error} />}</Field>
          <Button type="submit" className="w-full" loading={loading}>Enviar link</Button>
        </form>
      )}
    </AuthShell>
  );
}
