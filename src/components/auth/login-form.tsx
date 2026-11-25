"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "./auth-shell";
import { GoogleButton } from "./google-button";
import { Button, Field, Input, ErrorNote } from "@/components/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";
import { loginSchema, fieldErrors, authErrorMessage } from "@/lib/validation/auth";

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/inicio";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(params.get("erro") ? "Não foi possível concluir o login. Tente novamente." : null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = loginSchema.safeParse(fd);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setLoading(true);
    const { error } = await getSupabase().auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) return setFormError(authErrorMessage(error.message));
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthShell title="Que bom te ver de novo" subtitle="Entre para continuar organizando sua vida." footer={<>Ainda não tem conta? <Link className="font-semibold text-primary" href="/cadastro">Criar conta</Link></>}>
      <GoogleButton next={next} />
      <div className="my-6 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />ou com e-mail<span className="h-px flex-1 bg-line" /></div>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <ErrorNote message={formError} />}
        <Field label="E-mail" error={errors.email}>{(id, d) => <Input id={id} name="email" type="email" autoComplete="email" inputMode="email" aria-describedby={d} invalid={!!errors.email} />}</Field>
        <Field label="Senha" error={errors.password}>{(id, d) => <Input id={id} name="password" type="password" autoComplete="current-password" aria-describedby={d} invalid={!!errors.password} />}</Field>
        <div className="text-right text-sm"><Link href="/recuperar-senha" className="font-semibold text-primary">Esqueci minha senha</Link></div>
        <Button type="submit" className="w-full" loading={loading}>Entrar</Button>
      </form>
    </AuthShell>
  );
}
