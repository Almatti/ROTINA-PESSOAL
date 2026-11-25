"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { User, Camera, Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Card, Field, Input, SectionTitle } from "@/components/ui/primitives";
import { useSession } from "@/lib/session";
import { uploadUserFile, useFileUrl } from "@/lib/files";
import { useToast } from "@/components/ui/toast";
import { getSupabase } from "@/lib/supabase/client";
import { passwordSchema } from "@/lib/validation/auth";

const GOALS = ["Ter uma rotina mais leve", "Organizar minhas finanças", "Dormir melhor", "Criar hábitos saudáveis", "Ser mais produtiva", "Cuidar da saúde mental", "Estudar com constância", "Treinar regularmente", "Organizar a casa", "Realizar um sonho"];

export default function ProfilePage() {
  const { user, profile, updateProfile } = useSession();
  const toast = useToast();
  const [name, setName] = useState("");
  const [nick, setNick] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [pw, setPw] = useState("");
  const avatar = useFileUrl(profile?.avatar_url);
  useEffect(() => { if (profile) { setName(profile.full_name ?? ""); setNick(profile.nickname ?? ""); setGoals(profile.goals ?? []); } }, [profile]);
  if (!profile) return null;
  return (
    <>
      <PageHeader title="Perfil" icon={<User className="size-5" />} actions={<Link href="/configuracoes" aria-label="Configurações" className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><Settings className="size-5" /></Link>} />
      <Card className="flex items-center gap-4">
        <label className="relative grid size-20 cursor-pointer place-items-center overflow-hidden rounded-full bg-primary-soft text-primary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatar ? <img src={avatar} alt="Foto de perfil" className="size-full object-cover" /> : <Camera className="size-7" aria-hidden />}
          <input type="file" accept="image/*" className="sr-only" aria-label="Trocar foto de perfil" onChange={async (e) => { const f = e.target.files?.[0]; if (!f || !user) return; try { const path = await uploadUserFile(user.id, "avatar", f); await updateProfile({ avatar_url: path }); toast.show("Foto atualizada.", "success"); } catch (err) { toast.show((err as Error).message, "error"); } }} />
        </label>
        <div className="min-w-0"><p className="truncate text-lg font-bold">{profile.nickname || profile.full_name || "Você"}</p><p className="truncate text-sm text-muted">{user?.email}</p></div>
      </Card>
      <SectionTitle>Dados pessoais</SectionTitle>
      <Card className="space-y-4">
        <Field label="Nome">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />}</Field>
        <Field label="Apelido">{(id) => <Input id={id} value={nick} onChange={(e) => setNick(e.target.value)} maxLength={60} />}</Field>
        <fieldset><legend className="label">Objetivos</legend><div className="flex flex-wrap gap-2">{GOALS.map((g) => <button key={g} type="button" aria-pressed={goals.includes(g)} onClick={() => setGoals((l) => (l.includes(g) ? l.filter((x) => x !== g) : [...l, g]))} className={`rounded-pill px-3 py-1.5 text-sm ${goals.includes(g) ? "bg-primary text-primary-ink" : "bg-surface-2"}`}>{g}</button>)}</div></fieldset>
        <Button onClick={async () => { await updateProfile({ full_name: name.trim() || null, nickname: nick.trim() || null, goals }); toast.show("Perfil salvo.", "success"); }}>Salvar</Button>
      </Card>
      {user?.app_metadata?.provider === "email" && (
        <>
          <SectionTitle>Segurança</SectionTitle>
          <Card className="space-y-3">
            <Field label="Nova senha" hint="Mínimo de 8 caracteres, com letras e números.">{(id, d) => <Input id={id} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby={d} />}</Field>
            <Button variant="outline" onClick={async () => { const p = passwordSchema.safeParse(pw); if (!p.success) return toast.show(p.error.issues[0].message, "error"); const { error } = await getSupabase().auth.updateUser({ password: pw }); if (error) return toast.show("Não foi possível alterar a senha.", "error"); setPw(""); toast.show("Senha alterada.", "success"); }}>Alterar senha</Button>
          </Card>
        </>
      )}
    </>
  );
}
