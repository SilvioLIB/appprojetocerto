import type { MetadataRoute } from "next";

// Exigido pelo export estático do APK; no site já era gerado no build.
export const dynamic = "force-static";

import { SITE } from "@/lib/site";

/** Permite "adicionar à tela inicial" no celular — o projetista usa em campo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.nome} — ${SITE.slogan}`,
    short_name: SITE.nome,
    description: SITE.descricao,
    lang: "pt-BR",
    id: "/",
    start_url: "/projeto",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#1c2029",
    theme_color: "#1c2029",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
