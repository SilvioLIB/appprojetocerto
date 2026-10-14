"use client";

import { useEffect, useMemo, useState } from "react";
import useMeasure from "react-use-measure";
import { LoaderCircle } from "lucide-react";

import { rotaGeometria, type Coordenada } from "@/lib/distancia";

/**
 * Mapa estático (fit-to-route) do trajeto derivação → entrega, sem depender de
 * biblioteca de mapas: tiles raster do OpenStreetMap posicionados num grid e a
 * rota do OSRM desenhada por cima em SVG (projeção Web Mercator). Quando a rota
 * não está disponível, desenha a reta entre os dois pontos.
 *
 * Uso de tiles conforme a política do OpenStreetMap (uso leve + atribuição).
 */

const TILE = 256;
const ALTURA = 340; // altura do mapa (px); no tablet em toque cresce com a tela (ver o contêiner)
const PADDING = 36; // folga (px) para a rota não colar nas bordas

/** Um poste posicionado na rota: tipo (identidade visual) + fração e distância. */
export interface MarcadorPoste {
  n: number; // número do poste (1-based)
  estrutura: string; // id da estrutura (define cor/rótulo)
  fracao: number; // 0..1 — posição ao longo do traçado (por vão acumulado)
  distanciaM: number; // estimativa de distância desde a derivação (m)
}

/** Identidade visual por tipo de estrutura (cor + rótulo curto). */
export const TIPO_POSTE: Record<string, { cor: string; label: string }> = {
  derivacao: { cor: "#1d4ed8", label: "Derivação" },
  transformador: { cor: "#7c3aed", label: "Equipamento" },
  passagem: { cor: "#0891b2", label: "Passagem" },
  angulo: { cor: "#d97706", label: "Com ângulo" },
  circuito_duplo: { cor: "#db2777", label: "Circuito duplo" },
  cruzamento: { cor: "#dc2626", label: "Cruzamento" },
  amarracao: { cor: "#0d9488", label: "Amarração" },
  fim_linha: { cor: "#475569", label: "Fim de linha" },
};

const TIPO_PADRAO = { cor: "#64748b", label: "Poste" };

/** Ponto interpolado a uma fração (0..1) do comprimento de uma polilinha na tela. */
function pontoNaFracao(linha: { x: number; y: number }[], f: number): { x: number; y: number } | null {
  if (linha.length === 0) return null;
  if (linha.length === 1) return linha[0];
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < linha.length; i++) {
    const d = Math.hypot(linha[i].x - linha[i - 1].x, linha[i].y - linha[i - 1].y);
    segs.push(d);
    total += d;
  }
  if (total === 0) return linha[0];
  const alvo = Math.min(Math.max(f, 0), 1) * total;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= alvo) {
      const t = segs[i] === 0 ? 0 : (alvo - acc) / segs[i];
      return {
        x: linha[i].x + (linha[i + 1].x - linha[i].x) * t,
        y: linha[i].y + (linha[i + 1].y - linha[i].y) * t,
      };
    }
    acc += segs[i];
  }
  return linha[linha.length - 1];
}

/** Coordenada (graus) → X em "pixels de mundo" no zoom z. */
function mundoX(lon: number, z: number): number {
  return ((lon + 180) / 360) * Math.pow(2, z) * TILE;
}
/** Coordenada (graus) → Y em "pixels de mundo" no zoom z (Web Mercator). */
function mundoY(lat: number, z: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return y * Math.pow(2, z) * TILE;
}

interface Layout {
  z: number;
  originX: number;
  originY: number;
  tiles: { key: string; src: string; left: number; top: number }[];
  paraTela: (c: Coordenada) => { x: number; y: number };
}

/** Escolhe o zoom e monta o grid de tiles que enquadram a lista de pontos. */
function calcularLayout(pontos: Coordenada[], W: number, H: number): Layout | null {
  if (W <= 0 || pontos.length === 0) return null;

  const lons = pontos.map((p) => p.lon);
  const lats = pontos.map((p) => p.lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Maior zoom (mais detalhe) em que a extensão dos pontos cabe na área útil.
  let z = 1;
  for (let cand = 19; cand >= 1; cand--) {
    const larg = Math.abs(mundoX(maxLon, cand) - mundoX(minLon, cand));
    const alt = Math.abs(mundoY(minLat, cand) - mundoY(maxLat, cand));
    if (larg <= W - 2 * PADDING && alt <= H - 2 * PADDING) {
      z = cand;
      break;
    }
  }

  const n = Math.pow(2, z);
  const cx = (mundoX(minLon, z) + mundoX(maxLon, z)) / 2;
  const cy = (mundoY(maxLat, z) + mundoY(minLat, z)) / 2;
  const originX = cx - W / 2;
  const originY = cy - H / 2;

  const tiles: Layout["tiles"] = [];
  const tX0 = Math.floor(originX / TILE);
  const tX1 = Math.floor((originX + W) / TILE);
  const tY0 = Math.floor(originY / TILE);
  const tY1 = Math.floor((originY + H) / TILE);
  for (let tx = tX0; tx <= tX1; tx++) {
    for (let ty = tY0; ty <= tY1; ty++) {
      if (ty < 0 || ty >= n) continue; // fora do mundo em latitude
      const wx = ((tx % n) + n) % n; // wrap em longitude
      tiles.push({
        key: `${z}-${tx}-${ty}`,
        src: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`,
        left: tx * TILE - originX,
        top: ty * TILE - originY,
      });
    }
  }

  return {
    z,
    originX,
    originY,
    tiles,
    paraTela: (c) => ({ x: mundoX(c.lon, z) - originX, y: mundoY(c.lat, z) - originY }),
  };
}

export function MapaTrajeto({
  derivacao,
  entrega,
  postes,
}: {
  derivacao: Coordenada;
  entrega: Coordenada;
  /** Postes a dispor sobre a rota. Quando ausente, mostra só derivação/entrega. */
  postes?: MarcadorPoste[];
}) {
  const [medirRef, bounds] = useMeasure();
  // Resultado carimbado com a "chave" das coordenadas que o geraram. Assim o
  // carregando é DERIVADO (chave atual ≠ chave do resultado) e não precisamos
  // de setState síncrono dentro do effect (react-hooks/set-state-in-effect).
  const [res, setRes] = useState<{ chave: string; pontos: Coordenada[]; semRota: boolean } | null>(
    null,
  );

  // Estabiliza as coordenadas por VALOR: o pai recria os objetos a cada render,
  // então dependemos das primitivas para não refazer a busca em loop.
  const dCoord = useMemo<Coordenada>(
    () => ({ lat: derivacao.lat, lon: derivacao.lon }),
    [derivacao.lat, derivacao.lon],
  );
  const eCoord = useMemo<Coordenada>(
    () => ({ lat: entrega.lat, lon: entrega.lon }),
    [entrega.lat, entrega.lon],
  );
  const chave = `${dCoord.lat},${dCoord.lon};${eCoord.lat},${eCoord.lon}`;

  // Busca o traçado sempre que as pontas mudam.
  useEffect(() => {
    const ac = new AbortController();
    rotaGeometria(dCoord, eCoord, ac.signal)
      .then((linha) => {
        if (ac.signal.aborted) return;
        if (linha && linha.length > 1) {
          setRes({ chave, pontos: linha, semRota: false });
        } else {
          setRes({ chave, pontos: [dCoord, eCoord], semRota: true }); // queda: reta
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setRes({ chave, pontos: [dCoord, eCoord], semRota: true });
      });
    return () => ac.abort();
  }, [dCoord, eCoord, chave]);

  const atual = res && res.chave === chave ? res : null;
  const carregando = atual === null;
  const semRota = atual?.semRota ?? false;

  const W = bounds.width;
  const H = bounds.height || ALTURA;
  const pontos = useMemo(() => atual?.pontos ?? [dCoord, eCoord], [atual, dCoord, eCoord]);
  const layout = useMemo(() => calcularLayout(pontos, W, H), [pontos, W, H]);

  const linhaSVG = layout ? pontos.map((p) => layout.paraTela(p)) : [];
  const pDeriv = layout ? layout.paraTela(dCoord) : null;
  const pEntrega = layout ? layout.paraTela(eCoord) : null;

  // Postes dispostos ao longo do traçado (posição por vão acumulado) e a lista
  // de tipos presentes para a legenda.
  const marcadores =
    layout && postes ? postes.map((m) => ({ ...m, pos: pontoNaFracao(linhaSVG, m.fracao) })) : [];
  const tiposPresentes: { id: string; cor: string; label: string }[] = [];
  if (postes) {
    const vistos = new Set<string>();
    for (const m of postes) {
      if (vistos.has(m.estrutura)) continue;
      vistos.add(m.estrutura);
      const t = TIPO_POSTE[m.estrutura] ?? TIPO_PADRAO;
      tiposPresentes.push({ id: m.estrutura, cor: t.cor, label: t.label });
    }
  }

  return (
    <div
      ref={medirRef}
      className="relative h-[340px] overflow-hidden rounded-lg ring-1 ring-foreground/15 bg-muted md:pointer-coarse:h-[clamp(340px,42svh,560px)]"
    >
      {/* Tiles do OpenStreetMap */}
      {layout?.tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={t.key}
          src={t.src}
          alt=""
          width={TILE}
          height={TILE}
          loading="lazy"
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{ left: t.left, top: t.top }}
        />
      ))}

      {/* Rota + marcadores */}
      {layout && pDeriv && pEntrega && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <polyline
            points={linhaSVG.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#1d4ed8"
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeOpacity={0.9}
          />
          {postes ? (
            /* Postes dispostos na rota, com identidade visual por tipo */
            marcadores.map((m) => {
              if (!m.pos) return null;
              const t = TIPO_POSTE[m.estrutura] ?? TIPO_PADRAO;
              return (
                <g key={m.n} className="pointer-events-auto">
                  <title>
                    {`Poste ${String(m.n).padStart(2, "0")} · ${t.label} · ~${Math.round(m.distanciaM)} m`}
                  </title>
                  <circle cx={m.pos.x} cy={m.pos.y} r={10} fill={t.cor} stroke="#fff" strokeWidth={2.5} />
                  <text
                    x={m.pos.x}
                    y={m.pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10}
                    fontWeight={700}
                    fill="#fff"
                  >
                    {m.n}
                  </text>
                </g>
              );
            })
          ) : (
            <>
              {/* Derivação (azul/primário) */}
              <circle cx={pDeriv.x} cy={pDeriv.y} r={7} fill="#1d4ed8" stroke="#fff" strokeWidth={2.5} />
              {/* Entrega (verde) */}
              <circle cx={pEntrega.x} cy={pEntrega.y} r={7} fill="#059669" stroke="#fff" strokeWidth={2.5} />
            </>
          )}
        </svg>
      )}

      {/* Estado de carregamento */}
      {carregando && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 text-xs text-muted-foreground">
          <LoaderCircle className="mr-1.5 size-4 animate-spin" /> Carregando trajeto…
        </div>
      )}

      {/* Legenda */}
      <div className="absolute left-2 top-2 flex max-w-[60%] flex-col gap-1 rounded-md bg-background/85 px-2 py-1.5 text-[11px] shadow-sm ring-1 ring-foreground/10 backdrop-blur">
        {postes ? (
          tiposPresentes.map((t) => (
            <span key={t.id} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: t.cor }} />
              {t.label}
            </span>
          ))
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-[#1d4ed8]" /> Derivação
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-[#059669]" /> Entrega
            </span>
          </>
        )}
        {semRota && !carregando && (
          <span className="text-muted-foreground">Rota indisponível — reta entre os pontos.</span>
        )}
      </div>

      {/* Atribuição obrigatória do OpenStreetMap */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-0 right-0 bg-background/85 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:underline"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
