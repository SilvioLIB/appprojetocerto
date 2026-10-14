"use client";

import { useEffect, useRef } from "react";
import { Check, Flag, Trash2, X } from "lucide-react";

import { useProjetoV2, type PosteProjeto } from "@/lib/projeto-v2-store";
import { estruturaPorId, fmt } from "@/lib/dimensionamento";

/** Esforço exibido para o poste (mesma regra da linha lateral do desktop). */
function esforcoDoPoste(p: PosteProjeto): string {
  const m = p.memoria;
  if (m.especTrafo != null) return `${fmt(m.especTrafo.esforcoDaN, 0)} daN especificado`;
  if (m.especAmarracao != null) return `${fmt(m.especAmarracao.esforcoDaN, 0)} daN tabelado`;
  return `${fmt(m.Ftotal, 1)} daN${m.estaiado ? " · com estai" : ""}`;
}

/**
 * A linha do projeto em versão horizontal — celular e tablet (abaixo de lg),
 * onde a linha lateral não cabe. Mesmo fio de cobre ligando os nós; tocar num
 * poste reabre a tela dele para edição, com o resumo e a opção de remover.
 */
export function LinhaProjetoCompacta() {
  const s = useProjetoV2();
  const selecionado = s.editandoId;
  const trilho = useRef<HTMLOListElement>(null);
  const emPostes = s.fase === "postes";

  // Mantém à vista o fim da linha (o poste em dimensionamento).
  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    // Espera o layout assentar antes de rolar até o fim.
    const id = requestAnimationFrame(() => el.scrollTo({ left: el.scrollWidth }));
    return () => cancelAnimationFrame(id);
  }, [s.postes.length]);

  const idx = s.postes.findIndex((p) => p.id === selecionado);
  const sel = idx >= 0 ? s.postes[idx] : null;

  const no =
    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[11px] font-semibold tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50";

  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10 lg:hidden print:hidden">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <span className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Linha do projeto</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {s.postes.length} {s.postes.length === 1 ? "poste" : "postes"}
        </span>
      </div>

      <ol ref={trilho} className="relative mt-2 flex items-start gap-1 overflow-x-auto pt-1.5 pb-2 [scrollbar-width:thin]">
        {/* amarras (projeto, vento, condutor) já travadas */}
        <li className="flex w-14 shrink-0 flex-col items-center gap-1">
          <span className={`${no} border-primary bg-primary text-primary-foreground`} title="Amarras travadas">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
          <span className="text-[10px] text-muted-foreground">Amarras</span>
        </li>

        {s.postes.map((p, i) => {
          const ativo = p.id === selecionado;
          const ok = p.memoria.aprovado;
          return (
            <li key={p.id} className="flex shrink-0 items-start gap-1">
              <span aria-hidden className="mt-[15px] h-0.5 w-3 shrink-0 rounded-full bg-primary/70" />
              <div className="flex w-14 flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => (ativo ? s.cancelarEdicao() : s.editarPoste(p.id))}
                  aria-pressed={ativo}
                  aria-label={`Poste ${i + 1}: ${ok ? "aprovado" : "a rever"} — ${ativo ? "sair da edição" : "reabrir para editar"}`}
                  className={`${no} alvo-toque ${
                    ativo ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 bg-background text-foreground"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                  <span
                    aria-hidden
                    className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card ${ok ? "bg-green-500" : "bg-destructive"}`}
                  />
                </button>
                <span className="max-w-14 truncate text-center text-[10px] text-muted-foreground">
                  {estruturaPorId(p.entrada.estrutura).label}
                </span>
              </div>
            </li>
          );
        })}

        {emPostes && (
          <li className="flex shrink-0 items-start gap-1">
            <span aria-hidden className="mt-[15px] h-0.5 w-3 shrink-0 rounded-full bg-primary/30" />
            <div className="flex w-14 flex-col items-center gap-1">
              {selecionado ? (
                <button
                  type="button"
                  onClick={s.cancelarEdicao}
                  aria-label="Sair da edição e voltar ao próximo poste"
                  className={`${no} alvo-toque border-border bg-background text-muted-foreground`}
                >
                  {String(s.postes.length + 1).padStart(2, "0")}
                </button>
              ) : (
                <span className={`${no} border-primary bg-background text-primary ring-4 ring-primary/15`}>
                  {String(s.postes.length + 1).padStart(2, "0")}
                </span>
              )}
              <span className={`text-[10px] font-medium ${selecionado ? "text-muted-foreground" : "text-primary"}`}>
                {selecionado ? "Próximo" : "Atual"}
              </span>
            </div>
          </li>
        )}

        <li className="flex shrink-0 items-start gap-1">
          <span aria-hidden className="mt-[15px] h-0.5 w-3 shrink-0 rounded-full bg-border" />
          <div className="flex w-14 flex-col items-center gap-1">
            <span
              className={`${no} ${
                s.fase === "concluido" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
              }`}
            >
              <Flag className="size-3.5" />
            </span>
            <span className="text-[10px] text-muted-foreground">Memorial</span>
          </div>
        </li>
      </ol>

      {sel && (
        <div className="mt-1 flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              Editando poste {String(idx + 1).padStart(2, "0")} · {estruturaPorId(sel.entrada.estrutura).label}
            </p>
            <p className="truncate text-muted-foreground tabular-nums">
              {sel.entrada.tipoFisico} {sel.entrada.comprimento} m · {esforcoDoPoste(sel)} ·{" "}
              <span className={sel.memoria.aprovado ? "text-green-700 dark:text-green-400" : "text-destructive"}>
                {sel.memoria.aprovado ? "aprovado" : "a rever"}
              </span>
            </p>
          </div>
          {emPostes && (
            <button
              type="button"
              onClick={() => s.removerPoste(sel.id)}
              className="flex h-8 items-center gap-1 rounded-md px-2 text-destructive outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Trash2 className="size-3.5" /> Remover
            </button>
          )}
          <button
            type="button"
            onClick={s.cancelarEdicao}
            aria-label="Sair da edição do poste"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
