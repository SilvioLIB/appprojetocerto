/**
 * Vento de projeto (ABNT NBR 6123:2023) a partir de UMA coordenada (lat, lon).
 *
 * Porte fiel, para o cliente (sem backend), dos módulos Python do "Projeto
 * Validador de Projeto":
 *
 *   isopletas_nbr6123.py  → campo espacial de V0 (velocidade básica) reconstruído
 *                           do mapa de isopletas (Figura 1) por interpolação RBF
 *                           thin-plate-spline sobre pontos de controle.
 *   nbr6123.py            → Vk = V0·S1·S2·S3  e  q = 0,613·Vk²  (N/m²).
 *   vento_nbr6123.py      → ponte: aplica os fatores FIXOS adotados na rede de
 *                           distribuição e devolve a velocidade em km/h.
 *
 * Fatores FIXOS (sobre o V0 lido das isopletas pela coordenada aplica-se sempre):
 *     S1 = 1,00   S2 = 0,79   S3 = 0,85
 * Categoria de terreno, classe de estrutura, altura z e grupo de S3 NÃO
 * influenciam o resultado (por isso não são pedidos ao usuário).
 *
 * v_kmh = Vk · 3,6  é a velocidade que alimenta a ação do vento do validador
 * (Pvp = c · v², com v em km/h).
 */

// Faixa física válida do V0 na Figura 1 (m/s).
const V0_MIN = 30.0;
const V0_MAX = 50.0;

// Conversão m/s → km/h.
const MS_PARA_KMH = 3.6;

// Fatores fixos adotados pelo validador para a rede de distribuição.
export const S1_FIXO = 1.0;
export const S2_FIXO = 0.79;
export const S3_FIXO = 0.85;

// Suavização do RBF (scipy RBFInterpolator smoothing=1.0).
const SMOOTHING = 1.0;

/**
 * Pontos de controle → [lon, lat, V0].
 * Coordenadas das estações da Tabela C.1 (Anexo C, NBR 6123:2023); o V0 de cada
 * ponto foi lido da Figura 1. Pontos sintéticos ancoram a forma das isopletas.
 * (Transcrito de isopletas_nbr6123.py — mantenha os dois em sincronia.)
 */
const PONTOS: [number, number, number][] = [
  // Norte / Centro: platô de 30 m/s
  [-50.533, 2.067, 30], [-48.483, -1.383, 30], [-44.233, -2.583, 30],
  [-54.717, -2.433, 30], [-59.983, -3.15, 30], [-57.733, -6.267, 30],
  [-54.9, -9.367, 30], [-63.9, -8.767, 30], [-67.783, -9.967, 31],
  [-60.133, -12.733, 30], [-48.417, -10.7, 30], [-47.433, -7.333, 30],
  [-42.817, -5.083, 30], [-41.75, -2.9, 30], [-43.417, -13.267, 30],
  [-40.5, -9.4, 30],
  // Nordeste (litoral e faixa de 30)
  [-38.533, -3.783, 30], [-35.25, -5.917, 30], [-34.917, -8.133, 30],
  [-35.783, -9.517, 30], [-38.333, -12.9, 33], [-39.25, -17.633, 33],
  // Extremo Norte: língua de 35 (Roraima)
  [-60.7, 2.833, 33], [-61.0, 3.5, 35],
  // Centro-Oeste / Sudeste interior: transição 30→35→40
  [-56.1, -15.65, 31], [-47.917, -15.867, 35], [-48.95, -16.367, 34],
  [-49.217, -16.633, 34], [-48.233, -18.917, 35], [-43.95, -19.85, 35],
  [-54.667, -20.467, 38],
  // Sudeste: máximo local ~45 (região de Campinas/SP)
  [-47.133, -23.0, 45], [-47.35, -21.983, 43], [-46.467, -23.433, 43],
  [-46.65, -23.617, 43], [-46.3, -23.933, 40], [-51.133, -23.333, 42],
  // Litoral RJ/ES: faixa de 35
  [-43.367, -22.867, 35], [-43.167, -22.9, 35], [-43.717, -22.933, 35],
  [-40.283, -20.267, 35],
  // Sul: subida 40 → 45 → 48
  [-49.183, -25.517, 40], [-54.583, -25.517, 44], [-55.7, -22.55, 45],
  [-48.55, -27.667, 43], [-51.167, -30.0, 45], [-53.7, -29.717, 46],
  [-57.033, -29.783, 46], [-54.117, -31.383, 48],
  // Núcleo de 50 no extremo Sul do RS (sintético, borda da Figura 1)
  [-53.4, -33.6, 50], [-52.8, -33.3, 50], [-56.0, -30.6, 48],
];

/** Kernel thin-plate-spline: φ(r) = r²·ln(r), com φ(0)=0. */
function phi(r: number): number {
  return r <= 0 ? 0 : r * r * Math.log(r);
}

/**
 * Resolve A·x = b por eliminação de Gauss com pivotamento parcial.
 * A é modificada no processo; devolve x.
 */
function resolverSistema(A: number[][], b: number[]): number[] {
  const n = b.length;
  // matriz aumentada
  const M = A.map((linha, i) => [...linha, b[i]]);
  for (let col = 0; col < n; col++) {
    // pivô: maior valor absoluto na coluna
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (piv !== col) [M[col], M[piv]] = [M[piv], M[col]];
    const diag = M[col][col];
    if (Math.abs(diag) < 1e-14) continue; // singular/quase-singular: segue
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / diag;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((linha, i) => linha[n] / M[i][i]);
}

// Pesos do RBF (w dos N pontos + coeficientes [c0, c1·lon, c2·lat] do polinômio
// de grau 1). Calculados uma única vez (lazy).
let _pesos: { w: number[]; c: [number, number, number] } | null = null;

function pesos(): { w: number[]; c: [number, number, number] } {
  if (_pesos) return _pesos;
  const N = PONTOS.length;
  const dim = N + 3; // + polinômio [1, lon, lat]
  const A: number[][] = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const b = new Array(dim).fill(0);

  for (let i = 0; i < N; i++) {
    const [xi, yi, di] = PONTOS[i];
    b[i] = di;
    // bloco K + smoothing·I
    for (let j = 0; j < N; j++) {
      const [xj, yj] = PONTOS[j];
      const r = Math.hypot(xi - xj, yi - yj);
      A[i][j] = phi(r);
    }
    A[i][i] += SMOOTHING;
    // bloco polinomial P (colunas N, N+1, N+2) e sua transposta P^T (linhas)
    A[i][N] = 1; A[i][N + 1] = xi; A[i][N + 2] = yi;
    A[N][i] = 1; A[N + 1][i] = xi; A[N + 2][i] = yi;
  }

  const sol = resolverSistema(A, b);
  _pesos = {
    w: sol.slice(0, N),
    c: [sol[N], sol[N + 1], sol[N + 2]],
  };
  return _pesos;
}

/** V0 (m/s) interpolado num ponto, já limitado à faixa [30, 50] da Figura 1. */
export function v0Ponto(lat: number, lon: number): number {
  const { w, c } = pesos();
  let z = c[0] + c[1] * lon + c[2] * lat;
  for (let i = 0; i < PONTOS.length; i++) {
    const [xi, yi] = PONTOS[i];
    z += w[i] * phi(Math.hypot(lon - xi, lat - yi));
  }
  return Math.min(Math.max(z, V0_MIN), V0_MAX);
}

export interface VentoResultado {
  latitude: number;
  longitude: number;
  V0: number;
  S1: number;
  S2: number;
  S3: number;
  Vk: number;
  q_N_m2: number;
  v_kmh: number;
}

/**
 * Vento de projeto a partir de uma velocidade v (km/h) informada à mão —
 * usado no modo desenvolvedor para testar cenários sem depender da coordenada.
 * V0, Vk e q são reconstruídos da velocidade invertendo os fatores fixos, para
 * o memorial continuar coerente. Coordenada é apenas informativa (0,0 por padrão).
 */
export function ventoDeVelocidade(v_kmh: number, lat = 0, lon = 0): VentoResultado {
  const vk = v_kmh / MS_PARA_KMH; // m/s
  const v0 = vk / (S1_FIXO * S2_FIXO * S3_FIXO);
  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lon.toFixed(6)),
    V0: Number(v0.toFixed(2)),
    S1: S1_FIXO,
    S2: S2_FIXO,
    S3: S3_FIXO,
    Vk: Number(vk.toFixed(2)),
    q_N_m2: Number((0.613 * vk * vk).toFixed(1)),
    v_kmh: Number(v_kmh.toFixed(1)),
  };
}

/**
 * Vento de projeto na coordenada (lat, lon), com S2 e S3 FIXOS.
 * Espelha vento_nbr6123.vento_no_ponto.
 */
export function ventoNoPonto(lat: number, lon: number): VentoResultado {
  const v0 = v0Ponto(lat, lon);
  const vk = v0 * S1_FIXO * S2_FIXO * S3_FIXO;
  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lon.toFixed(6)),
    V0: Number(v0.toFixed(2)),
    S1: S1_FIXO,
    S2: S2_FIXO,
    S3: S3_FIXO,
    Vk: Number(vk.toFixed(2)),
    q_N_m2: Number((0.613 * vk * vk).toFixed(1)),
    v_kmh: Number((vk * MS_PARA_KMH).toFixed(1)),
  };
}
