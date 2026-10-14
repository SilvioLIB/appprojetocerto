"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MapPin, Thermometer, Wind, Zap } from "lucide-react";

import { fmt } from "@/lib/dimensionamento";
import { carregarTabelaNg, type ClimaRegiao, type PontaClima } from "@/lib/ng";

type Bandas = Awaited<ReturnType<typeof carregarTabelaNg>>["bandas"];

/** Faixas de Ng da tabela estática (já em cache depois da consulta). */
function useBandasNg(): Bandas | null {
  const [bandas, setBandas] = useState<Bandas | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTabelaNg()
      .then((t) => vivo && setBandas(t.bandas))
      .catch(() => {
        /* sem a tabela, a régua simplesmente não aparece */
      });
    return () => {
      vivo = false;
    };
  }, []);
  return bandas;
}

/** Cabeçalho de painel: ícone, título e um complemento à direita. */
function Painel({
  icone, titulo, extra, children,
}: {
  icone: ReactNode;
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-background/70 p-3 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {icone}
          {titulo}
        </span>
        {extra}
      </div>
      {children}
    </div>
  );
}

/**
 * Marcador de ponta (D = derivação, E = entrega). Fundo neutro para a letra ter
 * contraste em qualquer faixa; o anel leva a cor da faixa de Ng da ponta.
 */
function Pino({ letra, cor }: { letra: string; cor: string }) {
  return (
    <span
      className="flex size-[18px] items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background shadow-sm"
      style={{ boxShadow: `0 0 0 2px var(--background), 0 0 0 3.5px ${cor}` }}
    >
      {letra}
    </span>
  );
}

/* ----------------------------------------------------------------------------
 * Ng — régua das 4 faixas (NBR 5419-2, Sturges) com as duas pontas marcadas.
 * ------------------------------------------------------------------------- */

function ReguaNg({ clima, bandas }: { clima: ClimaRegiao; bandas: Bandas }) {
  const lim = bandas.limites;
  const topo = lim[lim.length - 1];
  const pos = (ng: number) => `${(Math.min(Math.max(ng, lim[0]), topo) / topo) * 100}%`;
  const pontas = [
    { letra: "D", ponta: clima.derivacao },
    { letra: "E", ponta: clima.entrega },
  ];
  // Pontas no mesmo lugar: afasta levemente para os dois pinos aparecerem.
  const mesmoPonto = Math.abs(clima.derivacao.ng - clima.entrega.ng) < topo * 0.03;

  return (
    <div className="mt-3">
      {/* pinos */}
      <div className="relative h-5">
        {pontas.map(({ letra, ponta }, i) => (
          <span
            key={letra}
            className="absolute top-0 -translate-x-1/2"
            style={{ left: pos(ponta.ng), marginLeft: mesmoPonto ? (i === 0 ? -9 : 9) : 0 }}
            title={`${letra === "D" ? "Derivação" : "Entrega"}: Ng ${fmt(ponta.ng, 0)}`}
          >
            <Pino letra={letra} cor={ponta.cor} />
          </span>
        ))}
      </div>
      {/* faixas */}
      <div className="mt-1 flex h-2.5 overflow-hidden rounded-full ring-1 ring-foreground/10">
        {bandas.rotulos.map((r, i) => (
          <div
            key={r}
            className="h-full"
            style={{
              width: `${((lim[i + 1] - lim[i]) / topo) * 100}%`,
              backgroundColor: bandas.cores[i],
              opacity: i + 1 === clima.faixaMax ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      {/* limites + rótulos */}
      <div className="relative mt-1 h-3.5 text-[10px] text-muted-foreground tabular-nums">
        {lim.map((l, i) => (
          <span
            key={l}
            className={`absolute ${i === 0 ? "" : i === lim.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: `${(l / topo) * 100}%` }}
          >
            {fmt(l, 0)}
          </span>
        ))}
      </div>
      <div className="mt-0.5 flex text-[10px]">
        {bandas.rotulos.map((r, i) => (
          <span
            key={r}
            className={`truncate text-center ${i + 1 === clima.faixaMax ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            style={{ width: `${((lim[i + 1] - lim[i]) / topo) * 100}%` }}
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Temperatura — faixa térmica por ponta sobre uma escala comum.
 * Barra: média das mínimas → média das máximas. Traço fino: extremos absolutos.
 * ------------------------------------------------------------------------- */

const GRADIENTE_TEMP = "linear-gradient(90deg, #0ea5e9 0%, #22c55e 35%, #f59e0b 65%, #ef4444 100%)";

function FaixaTemp({
  letra, cor, ponta, eixo,
}: {
  letra: string;
  cor: string;
  ponta: PontaClima;
  eixo: [number, number];
}) {
  const t = ponta.temp;
  const [a, b] = eixo;
  const pct = (v: number) => ((v - a) / (b - a)) * 100;

  if (!t) {
    return (
      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
        <Pino letra={letra} cor={cor} />
        <span>sem série de temperatura</span>
      </div>
    );
  }

  const ini = pct(t.minMedia);
  const larg = Math.max(pct(t.maxMedia) - ini, 1);
  // O gradiente é da escala toda: a barra mostra só o seu "recorte" dele.
  const tamanho = (100 / larg) * 100;
  const posicao = larg >= 100 ? 0 : (ini / (100 - larg)) * 100;

  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5">
      <Pino letra={letra} cor={cor} />
      <div className="relative h-4">
        {/* trilho */}
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
        {/* extremos absolutos */}
        <div
          className="absolute top-1/2 h-px -translate-y-1/2 bg-foreground/40"
          style={{ left: `${pct(t.minAbs)}%`, width: `${pct(t.maxAbs) - pct(t.minAbs)}%` }}
        />
        {[t.minAbs, t.maxAbs].map((v, i) => (
          <div
            key={i}
            className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-foreground/40"
            style={{ left: `${pct(v)}%` }}
          />
        ))}
        {/* médias */}
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full shadow-sm"
          style={{
            left: `${ini}%`,
            width: `${larg}%`,
            backgroundImage: GRADIENTE_TEMP,
            backgroundSize: `${tamanho}% 100%`,
            backgroundPosition: `${posicao}% 0`,
          }}
        />
      </div>
      <span className="text-xs font-medium whitespace-nowrap tabular-nums">
        {fmt(t.minMedia, 0)}–{fmt(t.maxMedia, 0)} °C
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Cartão de cada ponta: rótulo + valor em grade, legível sem aumentar a fonte.
 * ------------------------------------------------------------------------- */

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">{rotulo}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function PontaCartao({ letra, rotulo, ponta }: { letra: string; rotulo: string; ponta: PontaClima }) {
  return (
    <div className="rounded-lg bg-background/70 p-3 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2">
        <Pino letra={letra} cor={ponta.cor} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold">{rotulo}</div>
          <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {ponta.municipio}/{ponta.uf}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ color: ponta.cor, backgroundColor: `${ponta.cor}1f`, boxShadow: `inset 0 0 0 1px ${ponta.cor}40` }}
        >
          {ponta.nivel}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-2.5">
        <Dado rotulo="Ng">
          {fmt(ponta.ng, 0)}
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">/km²·ano</span>
        </Dado>
        <Dado rotulo="V0">
          {fmt(ponta.v0, 1)}
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">m/s</span>
        </Dado>
        <Dado rotulo="Extremos">
          {ponta.temp ? (
            <>
              {fmt(ponta.temp.minAbs, 0)}/{fmt(ponta.temp.maxAbs, 0)}
              <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">°C</span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Dado>
      </dl>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Resumo do contorno climático.
 * ------------------------------------------------------------------------- */

/** Cartão-resumo do contorno: Ng na régua das faixas, temperatura e as pontas. */
export function ResumoClima({ clima, motivoFalhaTemp }: { clima: ClimaRegiao; motivoFalhaTemp?: string | null }) {
  const bandas = useBandasNg();

  // Temperatura no corredor: extremos das pontas que trouxeram série (Open-Meteo).
  const td = clima.derivacao.temp;
  const te = clima.entrega.temp;
  const maxs = [td?.maxAbs, te?.maxAbs].filter((x): x is number => typeof x === "number");
  const mins = [td?.minAbs, te?.minAbs].filter((x): x is number => typeof x === "number");
  const temTemp = maxs.length > 0 && mins.length > 0;
  const janela = td ?? te;
  const tMax = temTemp ? Math.max(...maxs) : NaN;
  const tMin = temTemp ? Math.min(...mins) : NaN;
  // Escala comum às duas pontas, com folga e arredondada a 5 °C.
  const eixo: [number, number] = temTemp
    ? [Math.floor((tMin - 1) / 5) * 5, Math.ceil((tMax + 1) / 5) * 5]
    : [0, 1];

  return (
    <div
      className="rounded-xl border p-3 text-sm"
      style={{ borderColor: `${clima.corMax}40`, backgroundColor: `${clima.corMax}0d` }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Ng */}
        <Painel
          icone={<Zap className="size-3.5" />}
          titulo="Descargas atmosféricas"
          extra={<span className="text-[10px] text-muted-foreground">NBR 5419-2</span>}
        >
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-lg font-semibold" style={{ color: clima.corMax }}>
              {clima.nivelMax}
            </span>
            <span className="text-xs text-muted-foreground">
              faixa dominante · Ng até{" "}
              <span className="font-medium text-foreground tabular-nums">{fmt(clima.ngMax, 0)}</span> /km²·ano
            </span>
          </div>
          {bandas && <ReguaNg clima={clima} bandas={bandas} />}
        </Painel>

        {/* Temperatura */}
        <Painel
          icone={<Thermometer className="size-3.5" />}
          titulo="Temperatura no corredor"
          extra={
            janela ? (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                ERA5 · {janela.anoIni}–{janela.anoFim}
              </span>
            ) : undefined
          }
        >
          {temTemp ? (
            <>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[10px] tracking-wide text-muted-foreground uppercase">máx</span>
                  <span className="text-lg font-semibold text-red-600 tabular-nums dark:text-red-400">
                    {fmt(tMax, 0)}
                  </span>
                  <span className="text-xs text-muted-foreground">°C</span>
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[10px] tracking-wide text-muted-foreground uppercase">mín</span>
                  <span className="text-lg font-semibold text-sky-600 tabular-nums dark:text-sky-400">
                    {fmt(tMin, 0)}
                  </span>
                  <span className="text-xs text-muted-foreground">°C</span>
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <FaixaTemp letra="D" cor={clima.derivacao.cor} ponta={clima.derivacao} eixo={eixo} />
                <FaixaTemp letra="E" cor={clima.entrega.cor} ponta={clima.entrega} eixo={eixo} />
              </div>
              <div className="mt-1 grid grid-cols-[18px_minmax(0,1fr)_auto] gap-2.5 text-[10px] text-muted-foreground tabular-nums">
                <span />
                <span className="flex justify-between">
                  <span>{eixo[0]} °C</span>
                  <span>{eixo[1]} °C</span>
                </span>
                <span className="invisible text-xs">00–00 °C</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-4 rounded-full" style={{ backgroundImage: GRADIENTE_TEMP }} />
                  médias diárias (mín → máx)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="relative h-2.5 w-4">
                    <span className="absolute inset-x-0 top-1/2 h-px bg-foreground/40" />
                    <span className="absolute top-0 left-0 h-full w-px bg-foreground/40" />
                    <span className="absolute top-0 right-0 h-full w-px bg-foreground/40" />
                  </span>
                  extremos absolutos
                </span>
              </div>
            </>
          ) : (
            // Temperatura é "melhor esforço": quando a série não veio (falha de rede
            // ou resultado antigo, salvo antes desta amostragem), deixamos explícito
            // em vez de sumir — assim o projetista sabe que basta consultar de novo.
            <p className="mt-2 text-xs text-muted-foreground">
              Temperatura indisponível
              {motivoFalhaTemp ? <> — {motivoFalhaTemp}</> : <> — consulte o clima novamente para amostrar a série</>}{" "}
              (Open-Meteo/ERA5).
            </p>
          )}
        </Painel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PontaCartao letra="D" rotulo="Derivação" ponta={clima.derivacao} />
        <PontaCartao letra="E" rotulo="Entrega" ponta={clima.entrega} />
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Wind className="size-3.5 shrink-0" />
        <span>
          V0 no corredor:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {clima.v0Min === clima.v0Max
              ? `${fmt(clima.v0Max, 1)} m/s`
              : `${fmt(clima.v0Min, 1)}–${fmt(clima.v0Max, 1)} m/s`}
          </span>{" "}
          (isopletas NBR 6123) · Ng em 4 faixas de Sturges
        </span>
      </div>
    </div>
  );
}
