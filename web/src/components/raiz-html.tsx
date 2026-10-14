import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Archivo, Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { NavegacaoInferior, SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import type { Usuario } from "@/lib/auth/users";
import { SITE } from "@/lib/site";

/**
 * Casca HTML comum aos dois alvos. Cada alvo tem o seu layout raiz fino:
 * `app/layout.web.tsx` (lê a sessão do cookie) e `app/layout.app.tsx`
 * (usuário local do APK) — ver next.config.ts.
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Fonte de marca: grotesca com eixo de largura — o nome "Projeto Certo" sai
// levemente expandido, com cara de placa de identificação de equipamento.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadataRaiz: Metadata = {
  title: {
    default: `${SITE.nome} — ${SITE.slogan}`,
    template: `%s · ${SITE.nome}`,
  },
  description: SITE.descricao,
  applicationName: SITE.nome,
  // App privado atrás do portão de login: nada de indexação.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewportRaiz: Viewport = {
  // Ocupa a tela toda no celular (área do entalhe/barra de gestos via safe-area).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#1c2029" },
  ],
};

export function RaizHtml({
  usuario,
  menuUsuario,
  aviso,
  children,
}: {
  usuario: Usuario | null;
  /** Menu de conta no cabeçalho (só no alvo web, que tem login). */
  menuUsuario?: ReactNode;
  /** Faixa logo abaixo do cabeçalho (só no APK: aviso de sem internet). */
  aviso?: ReactNode;
  children: ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <SiteHeader usuario={usuario} menuUsuario={menuUsuario} />
          {aviso}
          <main id="conteudo" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <NavegacaoInferior usuario={usuario} />
          {/* No celular, o aviso desce abaixo da barra de status (edge-to-edge). */}
          <Toaster richColors position="top-center" mobileOffset={{ top: "calc(var(--sa-top) + 16px)" }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
