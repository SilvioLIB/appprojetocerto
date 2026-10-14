import type { MetadataRoute } from "next";

// Exigido pelo export estático do APK; no site já era gerado no build.
export const dynamic = "force-static";

/** Site privado (portão de login): nenhum robô deve rastrear. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
