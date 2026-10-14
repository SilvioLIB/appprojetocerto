"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Cable, ChevronDown, Info, RotateCw, Undo2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { estruturaPorId, fmt } from "@/lib/dimensionamento";
import { useProjetoV2 } from "@/lib/projeto-v2-store";
import { montarPlanta, type NoPlanta, type SentidoDeflexao } from "@/lib/planta-rede";
import { GlifoNDU, VERMELHO_NDU, larguraGlifoNDU } from "@/components/simbologia/simbolo-ndu";
import { anguloForte } from "./simbolo-dt";
import { LegendaPlanta } from "./legenda-planta";

const W = 680;
const H = 280;
const MARGEM = 56;
/** Maior vão na tela (px) — evita uma rede de 2 postes esticada de ponta a ponta. */
const VAO_MAX_PX = 120;
const CHAVE_ABERTA = "planta-rede-aberta";

const num = (i: number) => String(i + 1).padStart(2, "0");

type Vetor = [number, number];

/** Ângulo (graus, sentido de tela) de um vetor já em coordenadas de tela. */
const graus = (v: Vetor) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;

/** Gira um vetor em metros (y para norte; positivo = anti-horário). */
const girarM = (v: Vetor, g: number): Vetor => {
  const r = (g * Math.PI) / 180;
  return [v[0] * Math.cos(r) - v[1] * Math.sin(r), v[0] * Math.sin(r) + v[1] * Math.cos(r)];
};

/** Descrição do cabo no padrão da norma: fases#bitola tipo (ex.: 3#2 CAA). */
const descCabo = (nFases: number, awg: string, tipo: string) => `${nFases}#${awg} ${tipo}`;

/** Largura aproximada (px) de um texto de 10 px — para o oval do texto projetado. */
const larguraTexto = (t: string) => t.length * 5.6;

const ALTURA_TRAFO = 18;

/** Id NDU do símbolo do poste (tipo físico × situação). */
const idPoste = (circular: boolean, existente: boolean) =>
  `poste_${circular ? "concreto_tubular" : "duplo_t"}_${existente ? "existente" : "projetado"}`;

const CHAVE_LEGENDA = "planta-rede-legenda";

/** Preferência liga/desliga lembrada no navegador (padrão: ligada). */
function lerPreferencia(chave: string): boolean {
  try {
    return window.localStorage.getItem(chave) !== "0";
  } catch {
    return true;
  }
}

function gravarPreferencia(chave: string, valor: boolean) {
  try {
    window.localStorage.setItem(chave, valor ? "1" : "0");
  } catch {
    /* armazenamento indisponível: só não lembra a preferência */
  }
}

const lerAberta = () => lerPreferencia(CHAVE_ABERTA);

/** Cor do traço da resultante conforme o estado do poste. */
function corEstado(no: NoPlanta): string {
  if (no.estado === "excede") return "var(--destructive)";
  if (no.estado === "alerta") return "var(--esforco-cava)";
  return "var(--esforco-lisa)";
}

/** Frase de situação do poste selecionado. */
function situacao(no: NoPlanta, Rn: number): string {
  if (no.estado === "especificado") return "Poste especificado (transformador ou amarração): sem esforço a orientar.";
  const esf = fmt(no.resultante?.esforco ?? 0, 0);
  if (no.circular)
    return no.estado === "excede"
      ? `Circular: ${esf} daN excede os ${fmt(Rn, 0)} daN do poste. Suba a classe ou adicione estai.`
      : `Circular: resiste igual em qualquer direção (${esf} de ${fmt(Rn, 0)} daN).`;
  if (no.estado === "excede")
    return `${esf} daN excede até a face lisa (${fmt(Rn, 0)} daN). Suba a classe ou adicione estai.`;
  if (no.face === "lisa") return `Face lisa voltada para a resultante: ${esf} de ${fmt(Rn, 0)} daN.`;
  return no.estado === "alerta"
    ? `Resultante nas cavas: ${esf} daN passa dos ${fmt(Rn / 2, 0)} daN desse lado. Vire o poste para a face lisa.`
    : `Resultante nas cavas: ${esf} de ${fmt(Rn / 2, 0)} daN. Atende mesmo sem virar.`;
}

/**
 * Planta da rede (vista de topo): o traçado dos postes já dimensionados, cada
 * um com o símbolo do poste orientado e a resultante marcada pela face que a
 * recebe (face lisa: traço contínuo; cavas: tracejado). É só um vislumbre da
 * disposição — a numeração e o cálculo continuam os do fluxo.
 */
export function PlantaRede({ fantasma = false }: { fantasma?: boolean }) {
  const postes = useProjetoV2((s) => s.postes);
  const condutor = useProjetoV2((s) => s.condutor);
  const ajustarPlanta = useProjetoV2((s) => s.ajustarPlanta);
  const [aberta, setAberta] = useState(lerAberta);
  const [legendaAberta, setLegendaAberta] = useState(() => lerPreferencia(CHAVE_LEGENDA));
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const uid = `planta${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const { nos, proximo } = useMemo(() => montarPlanta(postes), [postes]);

  if (postes.length === 0) return null;

  const alternar = () => {
    const nova = !aberta;
    setAberta(nova);
    gravarPreferencia(CHAVE_ABERTA, nova);
  };

  const alternarLegenda = () => {
    const nova = !legendaAberta;
    setLegendaAberta(nova);
    gravarPreferencia(CHAVE_LEGENDA, nova);
  };

  // Enquadramento: todos os postes (e o fantasma) cabem no quadro.
  const pts = nos.map((n) => n.pos);
  if (fantasma) pts.push(proximo.pos);
  let somaVaos = 0;
  for (let i = 1; i < pts.length; i++) somaVaos += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const vaoMedio = pts.length > 1 ? somaVaos / (pts.length - 1) : 1;

  // Rede existente na derivação (poste 01): trecho ilustrativo da rede de onde
  // a linha sai, no ângulo θ informado. Fim de linha: só o vão que chega.
  const rede = postes[0].entrada.estrutura === "derivacao" ? postes[0].entrada.redeExistente : undefined;
  const existente: Vetor[] = [];
  if (rede) {
    const L = (pts.length > 1 ? vaoMedio : 40) * 0.7;
    const o = nos[0].pos;
    const u = girarM(nos[0].eixo, rede.anguloDerivacao || 90);
    existente.push([o[0] - u[0] * L, o[1] - u[1] * L], o);
    if (rede.situacao !== "fim_linha") {
      const v = rede.situacao === "angulo" ? girarM(u, rede.alfa || 0) : u;
      existente.push([o[0] + v[0] * L, o[1] + v[1] * L]);
    }
  }

  const todos = [...pts, ...existente];
  const xs = todos.map((p) => p[0]);
  const ys = todos.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const escala = Math.min(
    VAO_MAX_PX / Math.max(vaoMedio, 1e-6),
    (W - 2 * MARGEM) / Math.max(x1 - x0, 1e-6),
    (H - 2 * MARGEM) / Math.max(y1 - y0, 1e-6),
  );
  const cx = W / 2 - (escala * (x0 + x1)) / 2;
  const cy = H / 2 + (escala * (y0 + y1)) / 2;
  const tela = (p: [number, number]): [number, number] => [cx + escala * p[0], cy - escala * p[1]];
  const vt = (v: [number, number]): [number, number] => [v[0], -v[1]];

  // Texto projetado (condutor) no maior vão, ao longo dele e sempre de pé.
  let textoVao: { x: number; y: number; ang: number; texto: string } | null = null;
  if (condutor && nos.length > 1) {
    let iMax = 1;
    let maior = -1;
    for (let i = 1; i < nos.length; i++) {
      const c = Math.hypot(nos[i].pos[0] - nos[i - 1].pos[0], nos[i].pos[1] - nos[i - 1].pos[1]);
      if (c > maior) [maior, iMax] = [c, i];
    }
    const [ax, ay] = tela(nos[iMax - 1].pos);
    const [bx, by] = tela(nos[iMax].pos);
    let ang = graus([bx - ax, by - ay]);
    if (ang > 90) ang -= 180;
    if (ang <= -90) ang += 180;
    textoVao = {
      x: (ax + bx) / 2,
      y: (ay + by) / 2,
      ang,
      texto: descCabo(postes[iMax].entrada.nFases, condutor.awg, condutor.tipoCabo),
    };
  }
  const larguraTrafo = larguraGlifoNDU("trafo_empresa_projetado", ALTURA_TRAFO);

  /** Poste 01 de derivação é o poste existente da rede; os demais são projetados. */
  const existenteNo = (i: number) => i === 0 && postes[0].entrada.estrutura === "derivacao";

  // O símbolo é simétrico a cada 180°: normalizar em (−90°, 90°] faz o giro
  // entre a posição padrão e a virada (90° de diferença) seguir o caminho curto.
  const normalizar = (a: number) => {
    let r = ((a % 180) + 180) % 180;
    if (r > 90) r -= 180;
    return r;
  };

  const marcador = (no: NoPlanta) =>
    no.estado === "excede" ? `${uid}-exc` : no.estado === "alerta" ? `${uid}-cav` : `${uid}-lis`;

  const noSel = nos.find((n) => postes[n.indice].id === selecionado) ?? null;
  const posteSel = noSel ? postes[noSel.indice] : null;
  const alertas = nos.filter((n) => n.estado === "alerta" || n.estado === "excede");

  const aoTeclar = (id: string) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelecionado((s) => (s === id ? null : id));
    }
  };

  return (
    <section className="break-inside-avoid rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberta}
          className="flex items-center gap-1.5 rounded text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronDown className={`size-3.5 transition-transform print:hidden ${aberta ? "" : "-rotate-90"}`} />
          Planta da rede
        </button>
        {aberta && condutor && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.06] px-2.5 py-0.5 text-xs">
            <Cable className="size-3 text-primary" />
            <span className="font-medium">
              {condutor.tipoCabo} {condutor.awg}
            </span>
            <span className="text-muted-foreground tabular-nums">· d = {fmt(condutor.d, 2)} mm</span>
          </span>
        )}
        {aberta && (
          <button
            type="button"
            onClick={alternarLegenda}
            aria-expanded={legendaAberta}
            className={`${condutor ? "" : "ml-auto"} flex items-center gap-1 rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 print:hidden`}
          >
            <Info className="size-3.5" />
            {legendaAberta ? "Ocultar legenda" : "Legenda"}
          </button>
        )}
      </header>

      {aberta && (
        <>
          {/* Celular em toque: a planta mantém escala legível (símbolos e nós
              tocáveis) e rola na horizontal, em vez de encolher até a largura. */}
          <div className="overscroll-x-contain max-md:pointer-coarse:overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full border-y border-border max-md:pointer-coarse:min-w-[600px]"
            role="group"
            aria-label={`Planta da rede com ${postes.length} poste${postes.length > 1 ? "s" : ""}`}
          >
            <defs>
              <pattern id={`${uid}-grade`} width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="12" cy="12" r="1" fill="var(--border)" />
              </pattern>
              {[
                [`${uid}-lis`, "var(--esforco-lisa)"],
                [`${uid}-cav`, "var(--esforco-cava)"],
                [`${uid}-exc`, "var(--destructive)"],
              ].map(([id, cor]) => (
                <marker key={id} id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M1 1L9 5L1 9z" style={{ fill: cor }} />
                </marker>
              ))}
            </defs>
            <rect width={W} height={H} fill={`url(#${uid}-grade)`} />

            {/* Rede primária existente (NDU: vermelho contínuo) + texto existente */}
            {rede && existente.length > 1 && (() => {
              // Texto existente: ao lado da ponta do vão que chega, fora da linha.
              const ponta = tela(existente[0]);
              const [ox, oy] = tela(existente[1]);
              const c = Math.hypot(ponta[0] - ox, ponta[1] - oy) || 1;
              const lado: Vetor = [-(ponta[1] - oy) / c, (ponta[0] - ox) / c];
              const [tx, ty] = [ponta[0] - (ponta[0] - ox) / c * 10 + lado[0] * 8, ponta[1] - (ponta[1] - oy) / c * 10 + lado[1] * 8];
              return (
                <g aria-hidden>
                  <polyline
                    points={existente.map((p) => tela(p).join(",")).join(" ")}
                    fill="none"
                    stroke={VERMELHO_NDU}
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <text
                    x={tx}
                    y={ty + 3.5}
                    textAnchor={lado[0] > 0.3 ? "start" : lado[0] < -0.3 ? "end" : "middle"}
                    stroke="var(--card)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    className="fill-foreground text-[10px]"
                  >
                    {descCabo(rede.nFases, rede.awg, rede.tipoCabo)}
                  </text>
                </g>
              );
            })()}

            {/* Rede primária projetada (NDU: vermelho tracejado) */}
            <polyline
              points={nos.map((n) => tela(n.pos).join(",")).join(" ")}
              fill="none"
              stroke={VERMELHO_NDU}
              strokeWidth="2"
              strokeDasharray="8 5"
              strokeLinejoin="round"
            />
            {fantasma && (
              <line
                x1={tela(nos[nos.length - 1].pos)[0]}
                y1={tela(nos[nos.length - 1].pos)[1]}
                x2={tela(proximo.pos)[0]}
                y2={tela(proximo.pos)[1]}
                stroke={VERMELHO_NDU}
                strokeOpacity="0.4"
                strokeWidth="2"
                strokeDasharray="8 5"
              />
            )}

            {/* Texto projetado (NDU: descrição dentro de um oval) */}
            {textoVao && (
              <g
                transform={`translate(${textoVao.x} ${textoVao.y}) rotate(${textoVao.ang}) translate(0 -13)`}
                className="text-foreground"
                aria-hidden
              >
                <rect
                  x={-(larguraTexto(textoVao.texto) + 12) / 2}
                  y={-7}
                  width={larguraTexto(textoVao.texto) + 12}
                  height={14}
                  rx={7}
                  fill="var(--card)"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <text y={3.5} textAnchor="middle" className="fill-foreground text-[10px]">
                  {textoVao.texto}
                </text>
              </g>
            )}

            {nos.map((no) => {
              const p = postes[no.indice];
              const [x, y] = tela(no.pos);
              const n = vt(no.normal);
              const e = vt(no.eixo);
              const sel = p.id === selecionado;
              const Rn = p.entrada.resistencia;

              // Resultante: tamanho pela fração do esforço sobre Rn.
              const setas: [number, number][] = no.resultante
                ? no.resultante.duasPontas
                  ? [n, [-n[0], -n[1]]]
                  : [n]
                : [];
              const comp = 14 + Math.min((no.resultante?.esforco ?? 0) / Math.max(Rn, 1), 1.5) * 18;
              const naCava = no.face === "cava";

              // Número: na diagonal entre o condutor e a resultante, do lado de fora.
              const d = [(-n[0] + e[0]) / Math.SQRT2, (-n[1] + e[1]) / Math.SQRT2];
              const [bx, by] = [x + d[0] * 26, y + d[1] * 26];

              // Altura/esforço: na diagonal oposta ao número, também do lado de fora.
              const r = [(-n[0] - e[0]) / Math.SQRT2, (-n[1] - e[1]) / Math.SQRT2];
              const [rx, ry] = [x + r[0] * 24, y + r[1] * 24];
              const ancora = r[0] > 0.3 ? "start" : r[0] < -0.3 ? "end" : "middle";
              const rotulo = `${String(p.entrada.comprimento).replace(".", ",")}/${Math.round(Rn)}`;

              return (
                <g key={p.id}>
                  {/* Estai de âncora projetado: do lado oposto à resultante */}
                  {no.estaiado && (
                    <g
                      transform={`translate(${x - n[0] * 12} ${y - n[1] * 12}) rotate(${graus([-n[0], -n[1]])}) translate(15 0)`}
                      className="text-foreground"
                      aria-hidden
                    >
                      <GlifoNDU id="estai_ancora_projetado" altura={9} />
                    </g>
                  )}
                  {/* Transformador da empresa projetado: ao lado do poste, para fora */}
                  {p.entrada.estrutura === "transformador" && (
                    <g
                      transform={`translate(${x + n[0] * 11} ${y + n[1] * 11}) rotate(${graus(n)}) translate(${larguraTrafo / 2} 0)`}
                      className="text-foreground"
                      aria-hidden
                    >
                      <GlifoNDU id="trafo_empresa_projetado" altura={ALTURA_TRAFO} />
                    </g>
                  )}
                  {setas.map((u, k) => (
                    <line
                      key={k}
                      x1={x + u[0] * 13}
                      y1={y + u[1] * 13}
                      x2={x + u[0] * (13 + comp)}
                      y2={y + u[1] * (13 + comp)}
                      stroke={corEstado(no)}
                      strokeWidth={naCava ? 1.6 : 2.5}
                      strokeDasharray={naCava ? "4 3" : undefined}
                      markerEnd={`url(#${marcador(no)})`}
                      aria-hidden
                    />
                  ))}

                  <g
                    transform={`translate(${x} ${y})`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={sel}
                    aria-label={`Poste ${num(no.indice)}: ${situacao(no, Rn)}`}
                    onClick={() => setSelecionado(sel ? null : p.id)}
                    onKeyDown={aoTeclar(p.id)}
                    className="cursor-pointer outline-none [&:focus-visible>.foco]:opacity-100"
                  >
                    <circle r="18" fill="transparent" />
                    <circle
                      className="foco opacity-0"
                      r="16"
                      fill="none"
                      stroke="var(--ring)"
                      strokeWidth="1.5"
                    />
                    {sel && <circle r="16" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 2" />}
                    {(no.estado === "alerta" || no.estado === "excede") && (
                      <circle
                        r="14"
                        fill="none"
                        stroke={no.estado === "excede" ? "var(--destructive)" : "var(--esforco-cava)"}
                        strokeWidth="2"
                      />
                    )}
                    {/* Fundo: a rede não atravessa o símbolo */}
                    <circle r="11" fill="var(--card)" />
                    <g
                      className="transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                      style={{ transform: `rotate(${no.circular ? 0 : normalizar(anguloForte(vt(no.forte)))}deg)` }}
                    >
                      <GlifoNDU id={idPoste(no.circular, existenteNo(no.indice))} altura={24} />
                    </g>
                  </g>

                  <g aria-hidden>
                    <circle cx={bx} cy={by} r="10" fill="var(--primary)" />
                    <text
                      x={bx}
                      y={by + 3.8}
                      textAnchor="middle"
                      className="fill-primary-foreground text-[11px] font-semibold tabular-nums"
                    >
                      {num(no.indice)}
                    </text>
                  </g>

                  <text
                    x={rx}
                    y={ry + (r[1] > 0.3 ? 9 : r[1] < -0.3 ? 0 : 4)}
                    textAnchor={ancora}
                    stroke="var(--card)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    className="fill-foreground text-[11px] font-semibold tabular-nums"
                    aria-hidden
                  >
                    {rotulo}
                  </text>
                </g>
              );
            })}

            {fantasma && (() => {
              const [x, y] = tela(proximo.pos);
              return (
                <g aria-hidden>
                  <circle cx={x} cy={y} r="10" fill="var(--card)" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 2" />
                  <text x={x} y={y + 3.8} textAnchor="middle" className="fill-primary text-[11px] font-semibold tabular-nums">
                    {num(nos.length)}
                  </text>
                </g>
              );
            })()}
          </svg>
          </div>

          {/* Legenda: oculta na tela quando fechada, mas sempre sai na impressão. */}
          <div className={legendaAberta ? "" : "hidden print:block"}>
            <LegendaPlanta
              qtdDuploT={nos.filter((n) => !n.circular).length}
              qtdCircular={nos.filter((n) => n.circular).length}
              condutor={condutor}
              fantasma={fantasma}
              temEstai={nos.some((n) => n.estaiado)}
              temTrafo={postes.some((p) => p.entrada.estrutura === "transformador")}
              posteExistente={existenteNo(0) ? (nos[0].circular ? "circular" : "duplo T") : null}
              redeExistente={rede ? descCabo(rede.nFases, rede.awg, rede.tipoCabo) : null}
            />
          </div>

          {/* Detalhe do poste selecionado, ou resumo com os postes que pedem atenção */}
          <div className="px-4 py-3 text-sm print:hidden">
            {noSel && posteSel ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums">
                    {noSel.indice + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      Poste {num(noSel.indice)}
                      <span className="font-normal text-muted-foreground">
                        {" "}· {estruturaPorId(posteSel.entrada.estrutura).label} · {posteSel.entrada.tipoFisico}{" "}
                        {posteSel.entrada.comprimento} m / {fmt(posteSel.entrada.resistencia, 0)} daN
                        {noSel.alfa > 0 ? ` · α ${fmt(noSel.alfa, 0)}°` : ""}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 text-xs ${
                        noSel.estado === "excede"
                          ? "text-destructive"
                          : noSel.estado === "alerta"
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {situacao(noSel, posteSel.entrada.resistencia)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelecionado(null)}
                    aria-label="Fechar detalhe do poste"
                    className="rounded p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-9">
                  {noSel.podeVirar && (
                    <Button
                      size="sm"
                      variant={noSel.estado === "alerta" ? "default" : "outline"}
                      onClick={() => ajustarPlanta(posteSel.id, { virado: !noSel.planta.virado })}
                    >
                      {noSel.planta.virado ? <Undo2 /> : <RotateCw />}
                      {noSel.planta.virado ? "Voltar à posição padrão" : "Virar para face lisa"}
                    </Button>
                  )}
                  {noSel.alfa > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Curva para
                      <div role="group" aria-label="Lado da curva" className="inline-flex rounded-md border">
                        {(["esquerda", "direita"] as SentidoDeflexao[]).map((sd) => {
                          const ativo = noSel.planta.sentido === sd;
                          return (
                            <button
                              key={sd}
                              type="button"
                              aria-pressed={ativo}
                              onClick={() => ajustarPlanta(posteSel.id, { sentido: sd })}
                              className={`px-2.5 py-1 text-xs capitalize outline-none first:rounded-l-md last:rounded-r-md focus-visible:ring-2 focus-visible:ring-ring/50 ${
                                ativo ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted"
                              }`}
                            >
                              {sd}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <span>Toque em um poste para virá-lo para a face lisa ou ajustar o lado da curva.</span>
                {alertas.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1.5">
                    Pedem atenção:
                    {alertas.map((n) => (
                      <button
                        key={postes[n.indice].id}
                        type="button"
                        onClick={() => setSelecionado(postes[n.indice].id)}
                        className={`rounded-md border px-1.5 py-0.5 font-semibold tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 ${
                          n.estado === "excede" ? "border-destructive text-destructive" : "border-esforco-cava text-foreground"
                        }`}
                      >
                        {num(n.indice)}
                      </button>
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
