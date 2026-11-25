"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

const MAX = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain"];

/** Envia um arquivo para a pasta privada da usuária. Retorna o caminho no bucket. */
export async function uploadUserFile(userId: string, folder: string, file: File): Promise<string> {
  if (file.size > MAX) throw new Error("Arquivo maior que 10 MB.");
  if (!ALLOWED.includes(file.type)) throw new Error("Tipo de arquivo não permitido.");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getSupabase().storage.from("user-files").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Não foi possível enviar o arquivo.");
  return path;
}

/** URL temporária (assinada) para exibir arquivos privados. Aceita também URLs http(s). */
export function useFileUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(path && /^https?:/.test(path) ? path : null);
  useEffect(() => {
    if (!path) return setUrl(null);
    if (/^https?:/.test(path)) return setUrl(path);
    let alive = true;
    getSupabase().storage.from("user-files").createSignedUrl(path, 3600).then(({ data }) => alive && setUrl(data?.signedUrl ?? null));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}
