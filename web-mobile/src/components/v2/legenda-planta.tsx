"use client";

import type { ReactNode } from "react";

import { CONDUTORES } from "@/lib/validador";
import { fmt } from "@/lib/dimensionamento";
import type { CondutorProjeto } from "@/lib/projeto-v2-store";
import { GlifoNDU, SimboloNDU } from "@/components/simbologia/simbolo-ndu";
import { REFERENCIA_SIMBOLOGIA } from "@/lib/simbologia";

/**
 * Seta simples (linha + ponta) para os esquemas da legenda. Coordenadas em px
 * do próprio <svg>; a ponta fica em (x2, y2).
 */
function Seta({
  x1, y1, x2, y2, cor, tracejada = false, largura = 2,
}: {
  x1: number; y1: number; x2: number; y2: number;
  cor: string; tracejada?: boolean; largura?: number;
}) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const t = 5; // tamanho da ponta
  const px = x2 - Math.cos(ang) * t;
  const py = y2 - Math.sin(ang) * t;
  const nx = -Math.sin(ang) * (t * 0.6);
  const ny = Math.cos(ang) * (t * 0.6);
  return (
    <g>
      <line
        x1={x1} y1={y1} x2={px} y2={py}
        stroke={cor} strokeWidth={largura} strokeDasharray={tracejada ? "4 3" : undefined}
      />
      <path d={`M${x2} ${y2}L${px + nx} ${py + ny}L${px - nx} ${py - ny}z`} fill={cor} />
    </g>
  );
}

/** Amostra de traço usada nas linhas da legenda. */
function Traco({ cor, largura = 2.5, tracejado = false }: { cor: string; largura?: number; tracejado?: boolean }) {
  return (
    <svg width="26" height="8" aria-hidden className="shrink-0">
      <line x1="0" y1="4" x2="20" y2="4" stroke={cor} strokeWidth={largura} strokeDasharray={tracejado ? "4 3" : undefined} />
      <path d="M26 4L19 0.5L19 7.5z" fill={cor} />
    </svg>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{titulo}</div>
      {children}
    </div>
  );
}

function Item({ simbolo, children }: { simbolo: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className="flex w-[26px] shrink-0 justify-center">{simbolo}</span>
      <span className="min-w-0 text-muted-foreground">{children}</span>
    </div>
  );
}

/**
 * Esquema de um tipo de poste: o símbolo ao centro e as setas de esforço que
 * chegam por cada direção — contínua e grossa no lado de maior esforço (Rn),
 * tracejada e fina no de menor (Rn/2). No circular, as duas são iguais.
 */
function EsquemaPoste({ circular }: { circular: boolean }) {
  const c = 32;
  const cor = "var(--esforco-lisa)";
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden className="shrink-0 overflow-visible">
      {/* maior esforço: chega pela face lisa (vertical no símbolo) */}
      <Seta x1={c} y1={2} x2={c} y2={circular ? 17 : 15} cor={cor} largura={2.5} />
      {/* menor esforço (duplo T) ou o mesmo esforço (circular): chega pela lateral */}
      <Seta
        x1={62} y1={c} x2={circular ? 47 : 41} y2={c}
        cor={cor} largura={circular ? 2.5 : 1.6} tracejada={!circular}
      />
      <g transform={`translate(${c} ${c})`}>
        <GlifoNDU id={circular ? "poste_concreto_tubular_projetado" : "poste_duplo_t_projetado"} altura={34} />
      </g>
    </svg>
  );
}

function TipoPoste({
  circular, quantidade,
}: {
  circular: boolean;
  quantidade: number;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg p-2 ring-1 ring-foreground/10 ${quantidade === 0 ? "opacity-55" : ""}`}>
      <EsquemaPoste circular={circular} />
      <div className="min-w-0 text-xs">
        <div className="flex flex-wrap items-baseline gap-x-2 font-medium text-foreground">
          {circular ? "Circular" : "Duplo T"}
          <span className="font-normal text-muted-foreground tabular-nums">
            {quantidade === 0 ? "não usado" : `${quantidade} no projeto`}
          </span>
        </div>
        {circular ? (
          <p className="mt-1 leading-snug text-muted-foreground">
            Mesmo esforço em qualquer direção: <span className="font-medium text-foreground">Rn</span>. Não
            precisa ser orientado.
          </p>
        ) : (
          <p className="mt-1 leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">Face lisa</span> (seta cheia): maior esforço,{" "}
            <span className="font-medium text-foreground">Rn</span>.{" "}
            <span className="font-medium text-foreground">Cavas</span> (seta tracejada): menor esforço,{" "}
            <span className="font-medium text-foreground">Rn/2</span>. Pode ser virado.
          </p>
        )}
      </div>
    </div>
  );
}

/** Legenda da planta da rede: tipos de poste, resultante e elementos da rede. */
export function LegendaPlanta({
  qtdDuploT, qtdCircular, condutor, fantasma, temEstai, temTrafo, posteExistente, redeExistente,
}: {
  qtdDuploT: number;
  qtdCircular: number;
  condutor: CondutorProjeto | null;
  fantasma: boolean;
  temEstai: boolean;
  temTrafo: boolean;
  /** Tipo físico do poste 01 quando ele é o poste existente da derivação. */
  posteExistente: "duplo T" | "circular" | null;
  /** Descrição do cabo da rede existente na derivação. */
  redeExistente: string | null;
}) {
  const nomeCabo = condutor ? CONDUTORES[condutor.tipoCabo]?.nome : undefined;
  const bitola = condutor
    ? CONDUTORES[condutor.tipoCabo]?.bitolas.find((b) => b.awg === condutor.awg)
    : undefined;

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 border-b border-border px-4 py-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <Grupo titulo="Tipos de poste">
        <TipoPoste circular={false} quantidade={qtdDuploT} />
        <TipoPoste circular quantidade={qtdCircular} />
      </Grupo>

      <Grupo titulo="Resultante no poste">
        <Item simbolo={<Traco cor="var(--esforco-lisa)" />}>Na face lisa: atende até Rn</Item>
        <Item simbolo={<Traco cor="var(--esforco-lisa)" largura={1.6} tracejado />}>Nas cavas: atende até Rn/2</Item>
        <Item simbolo={<Traco cor="var(--esforco-cava)" largura={1.6} tracejado />}>
          Nas cavas, acima de Rn/2: vire para a face lisa
        </Item>
        <Item simbolo={<Traco cor="var(--destructive)" />}>Excede Rn: suba a classe ou estaie</Item>
        <p className="text-[11px] leading-snug text-muted-foreground/80">
          Quanto maior o esforço em relação a Rn, maior a seta. Seta nas duas pontas: esforço alternado.
        </p>
      </Grupo>

      <Grupo titulo="Rede">
        <div className="rounded-lg bg-primary/[0.06] p-2.5 ring-1 ring-primary/20">
          <div className="flex items-center gap-2.5">
            <SimboloNDU id="rede_primaria_projetada" altura={8} className="w-[26px] shrink-0" />
            <span className="text-xs font-medium text-foreground">
              Rede primária projetada · {condutor ? `${condutor.tipoCabo} ${condutor.awg}` : "—"}
            </span>
          </div>
          {condutor && (
            <p className="mt-1 pl-[36px] text-[11px] leading-snug text-muted-foreground tabular-nums">
              {nomeCabo ? `${nomeCabo} · ` : ""}d = {fmt(condutor.d, 2)} mm
              {bitola ? ` · ${fmt(bitola.pesoKgKm, 1)} kg/km` : ""}
              <br />
              Mesmo cabo em todos os vãos da obra; a descrição vai no oval (texto projetado).
            </p>
          )}
        </div>
        {redeExistente && (
          <Item simbolo={<SimboloNDU id="rede_primaria_existente" altura={8} className="w-[26px]" />}>
            Rede primária existente na derivação · {redeExistente} (texto existente)
          </Item>
        )}
        {posteExistente && (
          <Item
            simbolo={
              <SimboloNDU
                id={posteExistente === "circular" ? "poste_concreto_tubular_existente" : "poste_duplo_t_existente"}
                altura={18}
              />
            }
          >
            Poste 01 existente ({posteExistente}); os demais são projetados
          </Item>
        )}
        <Item
          simbolo={
            <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden>
              <circle r="10" fill="var(--primary)" />
              <text y="3.8" textAnchor="middle" className="fill-primary-foreground text-[11px] font-semibold">01</text>
            </svg>
          }
        >
          Número do poste. Toque no símbolo para ver o detalhe.
        </Item>
        {temEstai && (
          <Item
            simbolo={
              <SimboloNDU id="estai_ancora_projetado" altura={8} className="w-[26px] text-foreground" />
            }
          >
            Estai de âncora projetado (lado oposto à resultante)
          </Item>
        )}
        {temTrafo && (
          <Item simbolo={<SimboloNDU id="trafo_empresa_projetado" altura={14} className="text-foreground" />}>
            Transformador da empresa projetado
          </Item>
        )}
        {fantasma && (
          <Item
            simbolo={
              <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden>
                <circle r="9.5" fill="var(--card)" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 2" />
              </svg>
            }
          >
            Próximo poste, ainda em dimensionamento
          </Item>
        )}
        <p className="text-[11px] leading-snug text-muted-foreground/80">Símbolos: {REFERENCIA_SIMBOLOGIA}.</p>
      </Grupo>
    </div>
  );
}
