"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button, Field, Input, ErrorNote } from "@/components/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";
import { resetSchema, fieldErrors, authErrorMessage } from "@/lib/validation/auth";
import { useToast } from "@/components/ui/toast";

export default function ResetPage() {
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = resetSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setLoading(true);
    const { error } = await getSupabase().auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) return setFormError(/session/i.test(error.message) ? "O link expirou. Solicite um novo em “Esqueci minha senha”." : authErrorMessage(error.message));
    toast.show("Senha atualizada com sucesso!", "success");
    router.replace("/inicio");
  }

  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma senha nova para sua conta.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <ErrorNote message={formError} />}
        <Field label="Nova senha" error={errors.password} hint="Mínimo de 8 caracteres, com letras e números.">{(id, d) => <Input id={id} name="password" type="password" autoComplete="new-password" aria-describedby={d} invalid={!!errors.password} />}</Field>
        <Field label="Confirme a nova senha" error={errors.confirm}>{(id, d) => <Input id={id} name="confirm" type="password" autoComplete="new-password" aria-describedby={d} invalid={!!errors.confirm} />}</Field>
        <Button type="submit" className="w-full" loading={loading}>Salvar nova senha</Button>
      </form>
    </AuthShell>
  );
}
