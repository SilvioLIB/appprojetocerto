"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROTAS_TELA_CHEIA, SITE } from "@/lib/site";
import { Marca } from "@/components/marca";

export function SiteFooter() {
  const pathname = usePathname();
  if (ROTAS_TELA_CHEIA.includes(pathname)) return null;

  return (
    <footer className="border-t print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Marca className="size-5 shrink-0" />
          <p>
            <span className="font-medium text-foreground">{SITE.nome}</span> · Cálculos conforme a <span className="whitespace-nowrap">{SITE.normaReferencia}</span>.
            Ferramenta de apoio: a responsabilidade técnica é do projetista.
          </p>
        </div>
        <p className="flex shrink-0 items-center gap-3">
          <Link href="/ajuda" className="underline-offset-4 hover:text-foreground hover:underline">
            Como usar
          </Link>
          <span aria-hidden>·</span>
          <span className="font-mono tabular-nums">v{SITE.versao}</span>
        </p>
      </div>
    </footer>
  );
}
