"use client";

import { Check, ClipboardList, FileText, UtilityPole, type LucideIcon } from "lucide-react";

import { useProjetoV2, type FaseProjeto } from "@/lib/projeto-v2-store";

interface Etapa {
  fase: FaseProjeto;
  titulo: string;
  icone: LucideIcon;
}

const ETAPAS: Etapa[] = [
  { fase: "abertura", titulo: "Abertura", icone: ClipboardList },
  { fase: "postes", titulo: "Postes", icone: UtilityPole },
  { fase: "concluido", titulo: "Memorial", icone: FileText },
];

// Centro da 1ª e da última coluna (3 colunas iguais): o fio vai de um ao outro.
const INICIO = 100 / ETAPAS.length / 2;
const VAO = 100 - 2 * INICIO;

/**
 * As três etapas do projeto guiado, com o fio de cobre avançando entre elas.
 * Adaptado do "Animated Progress Stepper" do 21st (id 28558), com as animações
 * em CSS (sem motion). Navega só para onde o fluxo já permite: do memorial de
 * volta aos postes; no modo desenvolvedor, livre.
 */
export function EtapasProjeto() {
  const s = useProjetoV2();
  const ativa = ETAPAS.findIndex((e) => e.fase === s.fase);
  const progresso = ativa / (ETAPAS.length - 1);

  const legenda = (e: Etapa, i: number): string => {
    if (e.fase === "abertura") return i < ativa ? s.obra || "Amarras travadas" : "Obra, vento e condutor";
    if (e.fase === "postes") {
      const qtd = `${s.postes.length} ${s.postes.length === 1 ? "poste" : "postes"}`;
      if (s.editandoId) {
        const idx = s.postes.findIndex((p) => p.id === s.editandoId);
        return `${qtd} · editando P${String(idx + 1).padStart(2, "0")}`;
      }
      return i <= ativa ? qtd : "Dimensionamento";
    }
    return i === ativa ? "Projeto concluído" : "Ao concluir";
  };

  const destino = (e: Etapa, i: number): (() => void) | undefined => {
    if (i === ativa) return undefined;
    if (s.dev) return () => s.irParaFase(e.fase);
    if (e.fase === "postes" && s.fase === "concluido") return s.reabrir;
    return undefined;
  };

  return (
    <nav aria-label="Etapas do projeto" className="print:hidden">
      <ol className="relative flex items-start">
        {/* trilho e fio de cobre */}
        <span aria-hidden className="absolute top-[15px] h-0.5 rounded-full bg-border" style={{ left: `${INICIO}%`, right: `${INICIO}%` }} />
        <span
          aria-hidden
          className="absolute top-[15px] h-0.5 origin-left rounded-full bg-primary transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
          style={{ left: `${INICIO}%`, right: `${INICIO}%`, transform: `scaleX(${progresso})` }}
        />
        <span
          aria-hidden
          className="absolute top-4 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_3px_var(--background)] transition-[left] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
          style={{ left: `${INICIO + progresso * VAO}%` }}
        />

        {ETAPAS.map((e, i) => {
          const feita = i < ativa;
          const atual = i === ativa;
          const ir = destino(e, i);
          const Icone = e.icone;
          const bolinha = (
            <span className="relative z-10 flex size-8 items-center justify-center">
              <span
                className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                  feita || atual ? "bg-primary" : "border border-border bg-muted"
                }`}
              />
              {atual && <span aria-hidden className="etapa-pulso absolute inset-0 rounded-full ring-2 ring-primary/50" />}
              {feita ? (
                <Check key="feita" className="etapa-icone relative size-4 text-primary-foreground" strokeWidth={3} />
              ) : (
                <Icone
                  key="icone"
                  className={`etapa-icone relative size-4 ${atual ? "text-primary-foreground" : "text-muted-foreground"}`}
                />
              )}
            </span>
          );
          const textos = (
            <>
              <span className={`mt-1.5 text-xs font-semibold ${feita || atual ? "text-foreground" : "text-muted-foreground"}`}>
                {e.titulo}
              </span>
              <span className="max-w-full truncate px-1 text-[11px] text-muted-foreground max-sm:hidden">{legenda(e, i)}</span>
            </>
          );
          return (
            <li key={e.fase} aria-current={atual ? "step" : undefined} className="flex min-w-0 flex-1 flex-col items-center text-center">
              {ir ? (
                <button
                  type="button"
                  onClick={ir}
                  title={`Ir para ${e.titulo}`}
                  className="group/etapa flex min-w-0 flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&>span:first-child]:transition-transform hover:[&>span:first-child]:scale-110"
                >
                  {bolinha}
                  {textos}
                </button>
              ) : (
                <>
                  {bolinha}
                  {textos}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
