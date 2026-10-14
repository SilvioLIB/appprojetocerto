"use client";

import { useEffect, useRef, useState } from "react";

import { fmt } from "@/lib/dimensionamento";

/** Usuário pediu menos movimento no sistema? */
function semMovimento(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Número que corre até o valor (ease-out). Parte de 0 na primeira vez e do
 * último valor exibido nas seguintes. Com movimento reduzido, salta direto.
 */
function useContagem(alvo: number, duracaoMs = 900): number {
  const [exibido, setExibido] = useState(() => (semMovimento() ? alvo : 0));
  const atual = useRef(exibido);

  useEffect(() => {
    const de = atual.current;
    if (de === alvo) return;
    const inicio = performance.now();
    const imediato = semMovimento();
    let quadro = 0;
    const passo = (agora: number) => {
      const t = imediato ? 1 : Math.min((agora - inicio) / duracaoMs, 1);
      const v = de + (alvo - de) * (1 - (1 - t) ** 3);
      atual.current = v;
      setExibido(v);
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, duracaoMs]);

  return exibido;
}

/**
 * Tom da utilização: verde folgado, âmbar perto do limite (> 85 %), vermelho
 * acima. Classes para o arco (stroke), o número em SVG (fill), em HTML (text)
 * e para preenchimentos em HTML (fundo — barras).
 */
export function tomUtilizacao(utilizacaoPct: number, limiarPct: number, aprovado: boolean) {
  if (!aprovado)
    return { arco: "stroke-destructive", fill: "fill-destructive", texto: "text-destructive", fundo: "bg-destructive" };
  if (utilizacaoPct > limiarPct * 0.85)
    return {
      arco: "stroke-amber-500",
      fill: "fill-amber-600 dark:fill-amber-400",
      texto: "text-amber-700 dark:text-amber-400",
      fundo: "bg-amber-500",
    };
  return {
    arco: "stroke-green-600 dark:stroke-green-500",
    fill: "fill-green-700 dark:fill-green-400",
    texto: "text-green-700 dark:text-green-400",
    fundo: "bg-green-600 dark:bg-green-500",
  };
}

// Arco de 180°, centro (60, 66), raio 50: da esquerda (0) à direita (2× limite).
const ARCO = "M 10 66 A 50 50 0 0 1 110 66";
const METADE_ADMISSIVEL = "M 10 66 A 50 50 0 0 1 60 16";
const METADE_ACIMA = "M 60 16 A 50 50 0 0 1 110 66";

/** Fração (0–100) do arco preenchida: escala de 0 a 2× o limite. */
const preenchimento = (utilizacaoPct: number, limiarPct: number) =>
  Math.max(0, Math.min(utilizacaoPct / (limiarPct * 2), 1)) * 100;

/**
 * Versão mínima do medidor (só o arco, sem textos) para tabelas e listas —
 * mesma escala, mesmo limite no topo e mesmas cores do medidor grande.
 */
export function MedidorMini({
  utilizacaoPct,
  limiarPct,
  aprovado,
  className = "w-9",
}: {
  utilizacaoPct: number;
  limiarPct: number;
  aprovado: boolean;
  className?: string;
}) {
  const preenchido = preenchimento(utilizacaoPct, limiarPct);
  return (
    <svg viewBox="0 2 120 74" className={`shrink-0 ${className}`} aria-hidden>
      <path d={METADE_ADMISSIVEL} fill="none" strokeWidth="16" className="stroke-muted" />
      <path d={METADE_ACIMA} fill="none" strokeWidth="16" className="stroke-destructive/15" />
      <path
        d={ARCO}
        fill="none"
        strokeWidth="16"
        strokeLinecap="round"
        pathLength={100}
        className={`medidor-arco ${tomUtilizacao(utilizacaoPct, limiarPct, aprovado).arco}`}
        style={{ strokeDashoffset: 100 - preenchido, opacity: preenchido > 0 ? 1 : 0 }}
      />
      <line x1="60" y1="4" x2="60" y2="28" strokeWidth="5" strokeLinecap="round" className="stroke-foreground/70" />
    </svg>
  );
}

/**
 * Medidor semicircular da utilização do poste (esforço ÷ capacidade), adaptado
 * do Gauge do 21st (id 3719) sem framer-motion. O limite do projetista fica no
 * topo do arco: a metade esquerda é a faixa admissível, a direita (tingida) é
 * acima do limite. Valores além de 2× o limite enchem o arco e o número mostra
 * o valor real.
 */
export function MedidorUtilizacao({
  utilizacaoPct,
  limiarPct,
  aprovado,
  rotulo = "utilização",
  className = "w-40 sm:w-44",
}: {
  utilizacaoPct: number;
  limiarPct: number;
  aprovado: boolean;
  rotulo?: string;
  className?: string;
}) {
  const max = limiarPct * 2;
  const preenchido = preenchimento(utilizacaoPct, limiarPct);
  const numero = useContagem(utilizacaoPct);
  const { arco: tom, fill: tomTexto } = tomUtilizacao(utilizacaoPct, limiarPct, aprovado);

  const arco = ARCO;
  const metadeAdmissivel = METADE_ADMISSIVEL;
  const metadeAcima = METADE_ACIMA;

  // Marcas a cada 25 % da escala; a do limite (topo) é mais longa.
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const ang = Math.PI * (1 - f);
    const r1 = f === 0.5 ? 34 : 38;
    return {
      f,
      x1: 60 + r1 * Math.cos(ang),
      y1: 66 - r1 * Math.sin(ang),
      x2: 60 + 42 * Math.cos(ang),
      y2: 66 - 42 * Math.sin(ang),
    };
  });

  return (
    <svg
      viewBox="0 0 120 78"
      className={`shrink-0 select-none ${className}`}
      role="img"
      aria-label={`${rotulo}: ${fmt(utilizacaoPct, 1)} % — limite ${fmt(limiarPct, 0)} %`}
    >
      {/* Trilho: faixa admissível neutra, faixa acima do limite tingida. */}
      <path d={metadeAdmissivel} fill="none" strokeWidth="9" className="stroke-muted" />
      <path d={metadeAcima} fill="none" strokeWidth="9" className="stroke-destructive/15" />

      {marcas.map((m) => (
        <line
          key={m.f}
          x1={m.x1}
          y1={m.y1}
          x2={m.x2}
          y2={m.y2}
          strokeWidth={m.f === 0.5 ? 1.4 : 0.8}
          strokeLinecap="round"
          className={m.f === 0.5 ? "stroke-foreground/70" : "stroke-muted-foreground/40"}
        />
      ))}

      {/* Valor */}
      <path
        d={arco}
        fill="none"
        strokeWidth="9"
        strokeLinecap="round"
        pathLength={100}
        className={`medidor-arco ${tom}`}
        style={{ strokeDashoffset: 100 - preenchido, opacity: preenchido > 0 ? 1 : 0 }}
      />

      <text x="60" y="8" textAnchor="middle" className="fill-muted-foreground text-[6px] font-medium">
        limite {fmt(limiarPct, 0)}%
      </text>
      <text
        x="60"
        y="58"
        textAnchor="middle"
        className={`font-display text-[17px] font-semibold tabular-nums [font-stretch:108%] ${tomTexto}`}
      >
        {fmt(numero, 1)}
        <tspan className="text-[9px]">%</tspan>
      </text>
      <text x="60" y="70" textAnchor="middle" className="fill-muted-foreground text-[6.5px]">
        {rotulo}
      </text>
      <text x="10" y="77" textAnchor="middle" className="fill-muted-foreground text-[5.5px] tabular-nums">
        0
      </text>
      <text x="110" y="77" textAnchor="middle" className="fill-muted-foreground text-[5.5px] tabular-nums">
        {fmt(max, 0)}
      </text>
    </svg>
  );
}
