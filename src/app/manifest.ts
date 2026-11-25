import type { MetadataRoute } from "next";
import { withBase, isLocalMode } from "@/lib/env";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: withBase("/"),
    name: isLocalMode ? "Vilma — Minha Vida (local)" : "Vilma — Minha Vida",
    short_name: "Vilma",
    description: "Sua central de organização pessoal: agenda, tarefas, hábitos, finanças, bem-estar e a assistente Vilma.",
    lang: "pt-BR",
    start_url: withBase("/inicio?origem=pwa"),
    scope: withBase("/"),
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#F7F4FB",
    theme_color: "#312A44",
    categories: ["productivity", "lifestyle", "finance", "health"],
    icons: [
      { src: withBase("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: withBase("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
      { src: withBase("/icons/maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: withBase("/icons/icon.svg"), sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Nova ação", url: withBase("/inicio?nova=1"), icons: [{ src: withBase("/icons/icon-192.png"), sizes: "192x192" }] },
      { name: "Falar com a Vilma", url: withBase("/vilma"), icons: [{ src: withBase("/icons/icon-192.png"), sizes: "192x192" }] },
      { name: "Registrar gasto", url: withBase("/financas?novo=despesa"), icons: [{ src: withBase("/icons/icon-192.png"), sizes: "192x192" }] },
    ],
  };
}
