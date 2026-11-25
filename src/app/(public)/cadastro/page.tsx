"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { isGoogleAuthEnabled } from "@/lib/env";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { Button, Field, Input, ErrorNote } from "@/components/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";
import { signupSchema, fieldErrors, authErrorMessage } from "@/lib/validation/auth";
import { MailCheck } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = signupSchema.safeParse({ ...raw, privacy: raw.privacy === "on" });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setLoading(true);
    const { data, error } = await getSupabase().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.name, privacy_accepted_at: new Date().toISOString() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    setLoading(false);
    if (error) return setFormError(authErrorMessage(error.message));
    if (data.session) {
      await getSupabase().from("profiles").update({ privacy_accepted_at: new Date().toISOString() }).eq("id", data.session.user.id);
      await getSupabase().from("consents").insert({ kind: "privacidade", granted: true });
      router.replace("/onboarding");
    } else setSentTo(parsed.data.email);
  }

  if (sentTo)
    return (
      <AuthShell title="Confira seu e-mail" footer={<Link className="font-semibold text-primary" href="/entrar">Voltar para o login</Link>}>
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <MailCheck className="size-10 text-primary" aria-hidden />
          <p>Enviamos um link de confirmação para <strong>{sentTo}</strong>. Abra-o para ativar sua conta.</p>
        </div>
      </AuthShell>
    );

  return (
    <AuthShell title="Crie sua conta" subtitle="Leva menos de um minuto. Você pode personalizar tudo depois." footer={<>Já tem conta? <Link className="font-semibold text-primary" href="/entrar">Entrar</Link></>}>
      <GoogleButton next="/onboarding" />
      {isGoogleAuthEnabled && <div className="my-6 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />ou com e-mail<span className="h-px flex-1 bg-line" /></div>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <ErrorNote message={formError} />}
        <Field label="Nome" error={errors.name}>{(id, d) => <Input id={id} name="name" autoComplete="name" aria-describedby={d} invalid={!!errors.name} />}</Field>
        <Field label="E-mail" error={errors.email}>{(id, d) => <Input id={id} name="email" type="email" autoComplete="email" aria-describedby={d} invalid={!!errors.email} />}</Field>
        <Field label="Senha" error={errors.password} hint="Mínimo de 8 caracteres, com letras e números.">{(id, d) => <Input id={id} name="password" type="password" autoComplete="new-password" aria-describedby={d} invalid={!!errors.password} />}</Field>
        <Field label="Confirme a senha" error={errors.confirm}>{(id, d) => <Input id={id} name="confirm" type="password" autoComplete="new-password" aria-describedby={d} invalid={!!errors.confirm} />}</Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="privacy" className="mt-1 size-4 accent-[var(--primary)]" aria-invalid={!!errors.privacy} />
          <span>Li e aceito a <Link href="/privacidade" className="font-semibold text-primary" target="_blank">Política de Privacidade</Link> e os <Link href="/termos" className="font-semibold text-primary" target="_blank">Termos de Uso</Link>.</span>
        </label>
        {errors.privacy && <p className="text-xs text-error" role="alert">{errors.privacy}</p>}
        <Button type="submit" className="w-full" loading={loading}>Criar conta</Button>
      </form>
    </AuthShell>
  );
}
