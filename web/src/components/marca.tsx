import { SITE } from "@/lib/site";

/**
 * Marca do Projeto Certo: um visto (✓) cujo braço longo termina numa
 * cruzeta — o "certo" desenhado como um poste. Mesmo traço do icon.svg.
 */
export function Marca({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M8 16.5l5 5L23 8.5"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M18.5 8.5h9" className="stroke-primary-foreground" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Marca + nome + slogan. `compacto` esconde o slogan. */
export function Logotipo({ compacto = false, className = "" }: { compacto?: boolean; className?: string }) {
  return (
    <span className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <Marca className="size-8 shrink-0" />
      <span className="min-w-0 leading-none">
        <span className="font-display block text-[17px] font-bold tracking-tight whitespace-nowrap [font-stretch:112%]">
          {SITE.nome}
        </span>
        {!compacto && (
          <span className="mt-1 block truncate text-[11px] text-muted-foreground">{SITE.slogan}</span>
        )}
      </span>
    </span>
  );
}
