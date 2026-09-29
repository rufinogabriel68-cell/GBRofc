import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GBR Gestão",
    short_name: "GBR Gestão",
    description: "Sistema de gestão completo para prestadores de serviços: CRM, orçamentos, OS, agenda, estoque e financeiro.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08090b",
    theme_color: "#08090b",
    lang: "pt-BR",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Novo orçamento", url: "/orcamentos?new=1" },
      { name: "Nova OS", url: "/ordens-de-servico?new=1" },
      { name: "Agenda", url: "/agenda" },
    ],
  };
}
