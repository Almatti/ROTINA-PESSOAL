import { WifiOff } from "lucide-react";

export const metadata = { title: "Sem conexão" };

export default function Offline() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="grid size-16 place-items-center rounded-3xl bg-primary-soft text-primary"><WifiOff className="size-8" aria-hidden /></div>
      <h1 className="font-display text-3xl font-semibold">Você está offline</h1>
      <p className="text-ink-soft">As telas que você já abriu continuam disponíveis e o que você registrar será sincronizado assim que a internet voltar.</p>
      <a href="/inicio" className="mt-2 inline-flex h-11 items-center rounded-pill bg-primary px-5 font-semibold text-primary-ink">Tentar novamente</a>
    </main>
  );
}
