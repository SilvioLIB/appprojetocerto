"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Select controlado enxuto {value, onChange, opções em string}.
 *
 * Versão mobile: `<select>` nativo — no celular/tablet abre a roda/lista do
 * próprio sistema (rolagem com o polegar, sem popup minúsculo); no desktop é o
 * menu do navegador. `data-slot="select-trigger"` mantém a regra de alvo de
 * toque de 44 px e a tecla "Próximo" dos campos numéricos (ver ui/input.tsx).
 */
export function SelectSimples({
  value, onChange, opcoes, placeholder, id, "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes: { label: string; valor: string }[];
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const vazio = !value || !opcoes.some((o) => o.valor === value);
  return (
    <div className="relative w-full">
      <select
        id={id}
        data-slot="select-trigger"
        aria-label={ariaLabel ?? placeholder}
        value={vazio ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={opcoes.length === 0}
        className={`h-10 w-full min-w-0 appearance-none truncate rounded-lg border border-input bg-transparent py-2 pr-9 pl-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 lg:h-8 lg:pl-2.5 lg:text-sm dark:bg-input/30 dark:hover:bg-input/50 [&>option]:bg-popover [&>option]:text-popover-foreground ${
          vazio ? "text-muted-foreground" : ""
        }`}
      >
        {(vazio || placeholder) && (
          <option value="" disabled>
            {placeholder ?? "Escolha"}
          </option>
        )}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/** Sufixo de unidade sobreposto à direita de um Input. */
export function ComUnidade({ children, unidade }: { children: ReactNode; unidade?: string }) {
  if (!unidade) return <>{children}</>;
  return (
    <div className="relative flex items-center">
      {children}
      <span className="pointer-events-none absolute right-3 text-xs text-muted-foreground">{unidade}</span>
    </div>
  );
}

/** "-7,1" ⇄ "7,1". Campo vazio vira "-" (coordenadas no Brasil são quase sempre negativas). */
function trocarSinal(v: string): string {
  const t = v.trim();
  return /^[-−‒–—﹣－]/.test(t) ? t.slice(1) : `-${t}`;
}

/**
 * Campo de latitude/longitude em graus decimais. No toque aparece o botão ±:
 * o teclado decimal do Android (Gboard, Samsung) não tem a tecla "−".
 */
export function CampoCoordenada({
  unidade, value, onChange, placeholder,
}: {
  unidade: "lat" | "lon";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <ComUnidade unidade={unidade}>
      <Input
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10 pointer-coarse:pl-12"
      />
      <button
        type="button"
        onClick={() => onChange(trocarSinal(value))}
        aria-label={`Trocar o sinal da ${unidade === "lat" ? "latitude" : "longitude"} (− / +)`}
        className="absolute left-0 hidden size-11 items-center justify-center rounded-md text-base font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:bg-muted pointer-coarse:inline-flex"
      >
        ±
      </button>
    </ComUnidade>
  );
}

/**
 * Converte "12,5" → 12.5; NaN quando vazio/inválido. Aceita o sinal de menos
 * tipográfico (−, –, —) que vem ao colar texto de documentos, e-mails ou chats.
 */
export function paraNumero(s: string): number {
  const t = s.replace(/[−‒–—﹣－]/g, "-").replace(",", ".").trim();
  return t === "" ? NaN : Number(t);
}
