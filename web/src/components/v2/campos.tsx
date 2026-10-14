"use client";

import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/** Select controlado enxuto {value, onChange, opções em string}. */
export function SelectSimples({
  value, onChange, opcoes, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes: { label: string; valor: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value || null} onValueChange={(v: string | null) => onChange(v ?? "")}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
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
