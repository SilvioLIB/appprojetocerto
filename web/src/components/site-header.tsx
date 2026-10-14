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
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 md:h-16">
        <Link href="/" aria-label="Projeto Certo — painel" className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <Logotipo className="hidden sm:flex" />
          <Logotipo compacto className="sm:hidden" />
        </Link>

        <div className="flex items-center gap-2">
          {usuario && (
            // Navegação em pílula (adaptada do "Sticky Header Navbar" do 21st.dev).
            // No celular ela desce para a barra inferior (NavegacaoInferior).
            <nav aria-label="Principal" className="hidden items-center rounded-full bg-muted/60 p-1 text-sm ring-1 ring-border md:flex">
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

/**
 * Navegação do celular: barra fixa no rodapé da tela, ao alcance do polegar,
 * com a mesma pílula do cabeçalho. Some a partir do tablet (md).
 */
export function NavegacaoInferior({ usuario }: { usuario: Usuario | null }) {
  const pathname = usePathname();
  if (!usuario || ROTAS_TELA_CHEIA.includes(pathname)) return null;

  return (
    <>
      {/* reserva o espaço da barra para o fim da página não ficar escondido */}
      <div aria-hidden className="h-[calc(4.75rem+var(--sa-bottom))] md:hidden print:hidden" />
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 px-3 pt-2 pb-[calc(0.5rem+var(--sa-bottom))] backdrop-blur-md md:hidden print:hidden"
      >
        <ul className="mx-auto flex max-w-md items-stretch gap-1 rounded-full bg-muted/60 p-1 ring-1 ring-border">
          {NAVEGACAO.map(({ href, rotulo, icone: Icone }) => {
            const ativa = rotaAtiva(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={ativa ? "page" : undefined}
                  className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    ativa
                      ? "bg-background font-semibold text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground"
                  }`}
                >
                  <Icone className={`size-[18px] ${ativa ? "text-primary" : ""}`} />
                  {rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
