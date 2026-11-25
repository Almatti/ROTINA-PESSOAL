import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vilma — Minha Vida",
    short_name: "Vilma",
    description: "Sua central de organização pessoal: agenda, tarefas, hábitos, finanças, bem-estar e a assistente Vilma.",
    lang: "pt-BR",
    start_url: "/inicio?origem=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#F7F4FB",
    theme_color: "#312A44",
    categories: ["productivity", "lifestyle", "finance", "health"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Nova ação", url: "/inicio?nova=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Falar com a Vilma", url: "/vilma", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Registrar gasto", url: "/financas?novo=despesa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
