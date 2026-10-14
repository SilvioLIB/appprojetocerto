"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { Usuario } from "@/lib/auth/users";
import { NAVEGACAO, ROTAS_TELA_CHEIA, rotaAtiva } from "@/lib/site";
import { Logotipo } from "@/components/marca";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ usuario, menuUsuario }: { usuario: Usuario | null; menuUsuario?: ReactNode }) {
  const pathname = usePathname();
  if (ROTAS_TELA_CHEIA.includes(pathname)) return null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 pt-[var(--sa-top)] backdrop-blur-md print:hidden">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-4 lg:h-16">
        <Link href="/" aria-label="Projeto Certo — painel" className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <Logotipo className="hidden lg:flex" />
          <Logotipo compacto className="lg:hidden [&_svg]:size-7" />
        </Link>

        <div className="flex items-center gap-1 lg:gap-2">
          {usuario && (
            // Navegação em pílula (adaptada do "Sticky Header Navbar" do 21st.dev).
            // No celular e no tablet ela desce para o dock inferior (components/dock.tsx).
            <nav aria-label="Principal" className="hidden items-center rounded-full bg-muted/60 p-1 text-sm ring-1 ring-border lg:flex">
              {NAVEGACAO.map(({ href, rotulo, icone: Icone }) => {
                const ativa = rotaAtiva(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={ativa ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 outline-none pointer-coarse:py-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 ${
                      ativa
                        ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icone className={`size-4 ${ativa ? "text-primary" : ""}`} />
                    {rotulo}
                  </Link>
                );
              })}
            </nav>
          )}
          <ThemeToggle />
          {menuUsuario}
        </div>
      </div>
    </header>
  );
}
