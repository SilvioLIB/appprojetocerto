"use client";

import type { ReactNode } from "react";
import { Check, Trash2 } from "lucide-react";

import { useProjetoV2 } from "@/lib/projeto-v2-store";
import { estruturaPorId, fmt } from "@/lib/dimensionamento";
import { ventoNoPonto } from "@/lib/vento";
import { paraNumero } from "./campos";

type Estado = "feito" | "atual" | "pendente";

/** Marcador circular de um nó da linha. */
function Marcador({ estado, children }: { estado: Estado; children?: ReactNode }) {
  const base =
    "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold tabular-nums transition-colors";
  if (estado === "feito")
    return <span className={`${base} border-primary bg-primary text-primary-foreground`}>{children ?? <Check className="size-3.5" strokeWidth={3} />}</span>;
  if (estado === "atual")
    return (
      <span className={`${base} border-primary bg-background text-primary ring-4 ring-primary/15`}>
        {children ?? <span className="size-1.5 rounded-full bg-primary" />}
      </span>
    );
  return (
    <span className={`${base} border-border bg-background text-muted-foreground`}>
      {children ?? <span className="size-1.5 rounded-full bg-border" />}
    </span>
  );
}

function No({
  estado, rotulo, valor, marcador, acao, onClick, dica,
}: {
  estado: Estado;
  rotulo: string;
  valor?: ReactNode;
  marcador?: ReactNode;
  acao?: ReactNode;
  /** Torna o nó clicável (ex.: reabrir um poste já dimensionado). */
  onClick?: () => void;
  /** Rótulo acessível / dica do clique. */
  dica?: string;
}) {
  const conteudo = (
    <>
      <Marcador estado={estado}>{marcador}</Marcador>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className={`text-[13px] leading-tight ${estado === "pendente" ? "text-muted-foreground" : "font-medium"}`}>
          <span className={`block truncate ${onClick ? "group-hover/no:text-primary" : ""}`}>{rotulo}</span>
        </div>
        {valor && <div className="mt-0.5 truncate text-xs text-muted-foreground">{valor}</div>}
      </div>
    </>
  );
  return (
    <li className="group/no relative flex items-start gap-2 py-2">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          title={dica}
          aria-label={dica}
          className="-mx-1 flex min-w-0 flex-1 items-start gap-3 rounded-md px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {conteudo}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3">{conteudo}</div>
      )}
      {acao && <div className="pt-0.5">{acao}</div>}
    </li>
  );
}

/**
 * A linha do projeto — o fio condutor do fluxo. As três amarras e cada poste
 * dimensionado viram nós ligados pelo condutor de cobre; a linha cresce com a
 * obra, como a própria rede.
 */
export function LinhaProjeto() {
  const s = useProjetoV2();
  const aberto = s.fase === "abertura";

  // Validade das amarras durante a abertura (espelha o formulário).
  const dadosOk = s.projetista.trim() !== "" && s.obra.trim() !== "";
  const lat = paraNumero(s.coordLat);
  const lon = paraNumero(s.coordLon);
  const coordOk = !Number.isNaN(lat) && !Number.isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  const condutorOk = s.tipoCabo !== "" && s.awg !== "";

  const vento = s.vento ?? (coordOk ? ventoNoPonto(lat, lon) : null);

  const estAmarra = (ok: boolean): Estado => (aberto ? (ok ? "feito" : "atual") : "feito");

  return (
    <aside className="print:hidden">
      <div className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Linha do projeto
      </div>
      <ol className="relative mt-2">
        {/* o condutor: liga todos os nós, do primeiro ao último */}
        <div
          aria-hidden
          className="absolute top-4 bottom-4 left-[11px] w-0.5 rounded-full bg-gradient-to-b from-primary/80 via-primary/30 to-border"
        />

        <No
          estado={estAmarra(dadosOk)}
          rotulo="Projetista e obra"
          valor={dadosOk ? `${s.projetista} · ${s.obra}` : "Quem assina e o que se constrói"}
        />
        <No
          estado={estAmarra(coordOk)}
          rotulo="Vento de projeto"
          valor={vento ? `${fmt(vento.v_kmh, 1)} km/h — NBR 6123` : "Coordenada → isopletas"}
        />
        <No
          estado={estAmarra(condutorOk)}
          rotulo="Condutor"
          valor={condutorOk ? `${s.tipoCabo} ${s.awg}` : "Fixado para toda a obra"}
        />

        {s.postes.map((p, i) => (
          <No
            key={p.id}
            estado={p.id === s.editandoId ? "atual" : "feito"}
            marcador={i + 1}
            rotulo={`Poste ${String(i + 1).padStart(2, "0")}${p.id === s.editandoId ? " · editando" : ""}`}
            onClick={() => (p.id === s.editandoId ? s.cancelarEdicao() : s.editarPoste(p.id))}
            dica={
              p.id === s.editandoId
                ? `Sair da edição do poste ${i + 1}`
                : `Reabrir o poste ${i + 1} para refazer ou alterar`
            }
            valor={
              <span className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${p.memoria.aprovado ? "bg-green-500" : "bg-destructive"}`}
                />
                {p.memoria.especTrafo != null
                  ? `${fmt(p.memoria.especTrafo.esforcoDaN, 0)} daN · ${estruturaPorId(p.entrada.estrutura).label}`
                  : p.memoria.especAmarracao != null
                    ? `${fmt(p.memoria.especAmarracao.esforcoDaN, 0)} daN · ${estruturaPorId(p.entrada.estrutura).label}`
                    : `${fmt(p.memoria.Ftotal, 1)} daN · ${estruturaPorId(p.entrada.estrutura).label}${p.memoria.estaiado ? " · estai" : ""}`}
              </span>
            }
            acao={
              s.fase === "postes" ? (
                <button
                  type="button"
                  onClick={() => s.removerPoste(p.id)}
                  aria-label={`Remover poste ${i + 1}`}
                  className="alvo-toque rounded p-0.5 text-muted-foreground/60 opacity-0 transition-opacity outline-none group-hover/no:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : undefined
            }
          />
        ))}

        {s.fase === "postes" && (
          <No
            estado={s.editandoId ? "pendente" : "atual"}
            marcador={s.postes.length + 1}
            rotulo={`Poste ${String(s.postes.length + 1).padStart(2, "0")}`}
            valor={s.editandoId ? "Voltar ao próximo poste" : "Em dimensionamento…"}
            onClick={s.editandoId ? s.cancelarEdicao : undefined}
            dica={s.editandoId ? "Sair da edição e voltar ao próximo poste" : undefined}
          />
        )}

        <No
          estado={s.fase === "concluido" ? "atual" : "pendente"}
          rotulo="Conclusão"
          valor={s.fase === "concluido" ? "Memorial do projeto" : undefined}
        />
      </ol>
    </aside>
  );
}
