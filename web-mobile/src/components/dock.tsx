"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

import type { Usuario } from "@/lib/auth/users";
import { NAVEGACAO, ROTAS_TELA_CHEIA, rotaAtiva } from "@/lib/site";
import { useMounted } from "@/lib/use-mounted";

/**
 * Dock do celular e do tablet (abaixo de lg): uma única faixa fixa no rodapé,
 * ao alcance do polegar, com
 *  1. a ação principal da tela (vem de cada página via <AcaoDock>), e
 *  2. as abas do site.
 *
 * A altura real do dock é publicada em `--dock-h` (no <html>), para o fim da
 * página e as barras "grudadas" nunca ficarem escondidas atrás dele.
 * Com o teclado virtual aberto o dock desce e sai da frente do campo.
 */

const ID_ALVO = "dock-acao";

/** Teclado virtual aberto = um campo de texto focado num aparelho de toque. */
function useTecladoAberto(): boolean {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const toque = window.matchMedia("(pointer: coarse)");
    const ehCampo = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"])') ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable);
    const entrar = (e: FocusEvent) => {
      if (toque.matches && ehCampo(e.target)) setAberto(true);
    };
    // Ao sair, espera o foco assentar: "Próximo" pula de um campo a outro sem piscar o dock.
    const sair = () =>
      window.setTimeout(() => {
        if (!ehCampo(document.activeElement)) setAberto(false);
      }, 120);
    document.addEventListener("focusin", entrar);
    document.addEventListener("focusout", sair);
    return () => {
      document.removeEventListener("focusin", entrar);
      document.removeEventListener("focusout", sair);
    };
  }, []);
  return aberto;
}

export function Dock({ usuario }: { usuario: Usuario | null }) {
  const pathname = usePathname();
  const caixa = useRef<HTMLDivElement>(null);
  const teclado = useTecladoAberto();
  const ativo = !!usuario && !ROTAS_TELA_CHEIA.includes(pathname);

  // Publica a altura do dock (some com o teclado → 0).
  useEffect(() => {
    const el = caixa.current;
    const raiz = document.documentElement;
    if (!el || !ativo) {
      raiz.style.setProperty("--dock-h", "0px");
      return;
    }
    const publicar = () => {
      const visivel = getComputedStyle(el).display !== "none" && !teclado;
      raiz.style.setProperty("--dock-h", visivel ? `${el.offsetHeight}px` : "0px");
    };
    publicar();
    const ro = new ResizeObserver(publicar);
    ro.observe(el);
    window.addEventListener("resize", publicar);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publicar);
    };
  }, [ativo, teclado]);

  if (!ativo) return null;

  return (
    <>
      {/* reserva o espaço do dock para o fim da página não ficar escondido */}
      <div aria-hidden className="h-(--dock-h) shrink-0 lg:hidden print:hidden" />
      <div
        ref={caixa}
        data-teclado={teclado || undefined}
        className="fixed inset-x-0 bottom-0 z-40 transition-transform duration-200 ease-out data-teclado:translate-y-full lg:hidden print:hidden"
      >
        {/* Ação principal da tela (portal de <AcaoDock>); vazio = some. */}
        <div
          id={ID_ALVO}
          className="border-t bg-card/95 px-3 pt-2.5 pb-2.5 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur-md empty:hidden supports-[backdrop-filter]:bg-card/85"
        />
        <nav
          aria-label="Principal"
          className="border-t bg-background/90 pb-(--sa-bottom) backdrop-blur-md supports-[backdrop-filter]:bg-background/75"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-3">
            {NAVEGACAO.map(({ href, rotulo, icone: Icone }) => {
              const atual = rotaAtiva(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={atual ? "page" : undefined}
                    className={`relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] leading-none outline-none transition-colors focus-visible:bg-muted active:bg-muted/60 ${
                      atual ? "font-semibold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {/* fio de cobre da aba ativa */}
                    <span
                      aria-hidden
                      className={`absolute top-0 h-0.5 w-10 rounded-full bg-primary transition-opacity ${atual ? "opacity-100" : "opacity-0"}`}
                    />
                    <span
                      className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                        atual ? "bg-primary/12 text-primary" : ""
                      }`}
                    >
                      <Icone className="size-[19px]" />
                    </span>
                    {rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}

/**
 * Coloca a ação principal da tela no dock do celular/tablet. No desktop (lg+)
 * o dock não aparece — a página mantém os próprios botões (use `max-lg:hidden`
 * neles para não duplicar no celular). Sem dock montado (ex.: tela sem
 * usuário), a ação aparece no próprio lugar.
 */
export function AcaoDock({ children }: { children: ReactNode }) {
  // O dock mora no layout: depois de montar no cliente o alvo já está no DOM.
  const montado = useMounted();
  if (!montado) return null;
  const alvo = document.getElementById(ID_ALVO);
  if (alvo) return createPortal(children, alvo);
  return <div className="lg:hidden">{children}</div>;
}
