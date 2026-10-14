import { SITE } from "@/lib/site";
import { Logotipo } from "@/components/marca";

/** x dos postes na ilustração (os de fora cortam a borda de propósito). */
const POSTES_X = [-40, 180, 400, 620];

/** Três fases de uma rede, com a flecha (sag) do vão. */
const FASES = [
  { y: 0, flecha: 34 },
  { y: 16, flecha: 36 },
  { y: 32, flecha: 38 },
];

function vao(x1: number, x2: number, y: number, flecha: number) {
  const meio = (x1 + x2) / 2;
  // Quadrática com controle em 2×flecha → ponto mais baixo = flecha.
  return `M ${x1} ${y} Q ${meio} ${y + flecha * 2} ${x2} ${y}`;
}

/** Uma "linha" de rede: postes + três fases entre eles. */
function Rede({ y, escala, opacidade, pulso }: { y: number; escala: number; opacidade: number; pulso?: boolean }) {
  return (
    <g transform={`translate(0 ${y}) scale(${escala})`} style={{ opacity: opacidade }}>
      {POSTES_X.map((x) => (
        <g key={x}>
          <rect x={x - 4} y={-18} width={8} height={420} rx={2} className="fill-foreground/15" />
          <rect x={x - 40} y={-14} width={80} height={5} rx={1.5} className="fill-foreground/25" />
        </g>
      ))}
      {FASES.map((f, i) =>
        POSTES_X.slice(0, -1).map((x, j) => {
          const d = vao(x, POSTES_X[j + 1], f.y, f.flecha);
          return (
            <g key={`${i}-${j}`}>
              <path d={d} fill="none" className="stroke-primary" strokeWidth={1.6} strokeOpacity={0.55} />
              {pulso && i === 1 && (
                <path
                  d={d}
                  fill="none"
                  className="pulso-corrente stroke-primary"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  style={{ animationDelay: `${j * 0.9}s` }}
                />
              )}
            </g>
          );
        }),
      )}
    </g>
  );
}

/** A cena da rede (três linhas em perspectiva) — reaproveitada no celular. */
export function CenaRede({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" className={className}>
      <Rede y={120} escala={0.55} opacidade={0.35} />
      <Rede y={210} escala={0.75} opacidade={0.6} />
      <Rede y={330} escala={1} opacidade={1} pulso />
    </svg>
  );
}

/**
 * Faixa de marca do celular/tablet: a mesma cena, recortada na altura das
 * catenárias, com o logotipo e a frase por cima.
 */
export function FaixaMarca() {
  return (
    <div className="relative -mx-6 -mt-16 mb-2 h-56 overflow-hidden border-b bg-card sm:-mx-8 lg:hidden">
      <svg aria-hidden viewBox="0 250 600 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <Rede y={210} escala={0.75} opacidade={0.45} />
        <Rede y={330} escala={1} opacidade={0.9} pulso />
      </svg>
      <div aria-hidden className="absolute inset-0 bg-linear-to-b from-card/40 via-card/10 to-card" />
      <div className="absolute inset-x-6 bottom-5 flex flex-col gap-2 sm:inset-x-8">
        <Logotipo />
        <p className="font-display max-w-xs text-lg leading-snug font-semibold tracking-tight text-balance [font-stretch:108%]">
          Cada poste dimensionado na ordem em que a rede é construída.
        </p>
      </div>
    </div>
  );
}

/**
 * Lado da marca na tela de entrada (estrutura do "Split Login" do 21st.dev).
 * No lugar das linhas abstratas do original: vãos de rede em perspectiva, com
 * catenárias de cobre e um pulso de corrente percorrendo a fase do meio.
 */
export function PainelMarca() {
  return (
    <aside className="relative hidden h-full min-h-svh flex-col overflow-hidden border-e bg-card p-10 lg:flex">
      <CenaRede className="absolute inset-0 size-full" />
      {/* degradê para o texto respirar em cima e embaixo */}
      <div aria-hidden className="absolute inset-0 bg-linear-to-b from-card via-transparent to-card" />

      <div className="relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both motion-reduce:animate-none">
        <Logotipo />
      </div>

      <div className="relative z-10 mt-auto flex flex-col gap-4">
        <p
          className="font-display max-w-md text-3xl leading-[1.15] font-semibold tracking-tight text-balance animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both motion-reduce:animate-none [font-stretch:108%]"
          style={{ animationDelay: "150ms" }}
        >
          Cada poste dimensionado na ordem em que a rede é construída.
        </p>
        <p
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tracking-wide text-muted-foreground uppercase animate-in fade-in duration-700 fill-mode-both motion-reduce:animate-none"
          style={{ animationDelay: "300ms" }}
        >
          <span>Vento NBR 6123</span>
          <span aria-hidden className="text-border">|</span>
          <span>{SITE.normaReferencia}</span>
          <span aria-hidden className="text-border">|</span>
          <span>Memorial em PDF</span>
        </p>
      </div>
    </aside>
  );
}
