"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";

/**
 * Texto de apoio que, no celular e no tablet (abaixo de lg), fica recolhido
 * atrás de um "Como funciona" — a tela pequena mostra primeiro os campos. No
 * desktop aparece sempre, como antes. O conteúdo é renderizado uma vez só.
 */
export function Nota({
  children,
  rotulo = "Como funciona",
  className = "mt-1",
}: {
  children: ReactNode;
  rotulo?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="alvo-toque -my-0.5 inline-flex items-center gap-1 rounded text-xs font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:hidden"
      >
        <Info className="size-3.5" />
        {rotulo}
        <ChevronDown className={`size-3.5 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      <div className={`text-xs text-muted-foreground ${aberto ? "max-lg:mt-1.5" : "max-lg:hidden"}`}>{children}</div>
    </div>
  );
}

/**
 * Bloco longo (ex.: memória de cálculo) recolhido no celular/tablet, com um
 * resumo no botão; no desktop fica sempre aberto e o botão some.
 */
export function Recolhivel({
  resumo,
  children,
  className = "",
}: {
  resumo: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted lg:hidden"
      >
        <span className="min-w-0">{resumo}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      <div className={aberto ? "" : "max-lg:hidden"}>{children}</div>
    </div>
  );
}
