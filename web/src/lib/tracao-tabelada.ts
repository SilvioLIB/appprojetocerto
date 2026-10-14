/**
 * Tração de montagem dos condutores nus por tabela (vão × temperatura).
 *
 * FORA DE USO desde 07/10/2026: todo CAA usa a tração de projeto da NDU 007,
 * Tabela 26 (ver PELA_NDU_007 abaixo). As tabelas ficam aqui só como registro.
 *
 * Tabelas de tração de montagem até 200 m informadas pelo projetista:
 *   - CAA 2 AWG (Tabela 06), 1/0 AWG (Tabela 09) e 4/0 AWG (Tabela 12), Vmax 80 km/h;
 *   - CAA 336,4 MCM, Vmax 100 km/h (562,60 daN a 20 °C).
 *
 * Cadeia:
 *   1. Interpolação bilinear no vão (20 a 200 m, passo 20 m) e na temperatura
 *      (−5 a 50 °C, passo 5 °C). Fora das faixas vale a borda da tabela.
 *   2. Bitola sem tabela própria (ex.: CAA 4, 2/0, 266,8): flecha constante a
 *      partir da tabela da família com peso mais próximo, T = T_base · p / p_base
 *      (pesos do catálogo CONDUTORES).
 *   3. É a tração de projeto POR CONDUTOR, sem vento. No poste entra × nº de
 *      fases, somada ao vento no poste e nos cabos.
 * CA e CAL não têm tabela — caem na tabela fixa (TRACOES_PROJETO) ou na tração informada.
 */
import { CONDUTORES } from "./validador";

/** Vãos das colunas das tabelas (m). */
export const VAOS_TABELA = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200] as const;
/** Temperaturas das linhas das tabelas (°C). */
export const TEMPS_TABELA = [-5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

/** Faixa aceita para a temperatura de projeto (°C) — a das tabelas. */
export const TEMP_MIN = TEMPS_TABELA[0];
export const TEMP_MAX = TEMPS_TABELA[TEMPS_TABELA.length - 1];

interface TabelaMontagem {
  tipo: "CA" | "CAA";
  awg: string; // condutor da tabela
  titulo: string;
  /** Tração (daN): linhas = TEMPS_TABELA, colunas = VAOS_TABELA. */
  T: number[][];
}

const TABELAS: TabelaMontagem[] = [
  {
    tipo: "CAA",
    awg: "2",
    titulo: "Tabela 06 — Tração de montagem até 200 m — CAA 2 AWG, Vmax 80 km/h",
    T: [
      [372.82, 370.53, 366.83, 361.84, 355.77, 348.87, 341.41, 333.68, 325.95, 318.47],
      [347.35, 345.34, 342.09, 337.77, 332.56, 326.73, 320.51, 314.18, 307.95, 302.0],
      [321.9, 320.23, 317.55, 314.02, 309.84, 305.22, 300.39, 295.56, 290.89, 286.49],
      [296.49, 295.24, 293.26, 290.7, 287.71, 284.48, 281.17, 277.91, 274.82, 271.95],
      [271.11, 270.41, 269.31, 267.91, 266.31, 264.62, 262.93, 261.31, 259.79, 258.39],
      [245.8, 245.8, 245.8, 245.8, 245.8, 245.8, 245.8, 245.8, 245.8, 245.8],
      [220.57, 221.5, 222.89, 224.56, 226.35, 228.14, 229.84, 231.42, 232.86, 234.15],
      [195.48, 197.66, 200.8, 204.41, 208.14, 211.74, 215.11, 218.18, 220.94, 223.4],
      [170.59, 174.5, 179.79, 185.58, 191.31, 196.69, 201.62, 206.05, 210.0, 213.5],
      [146.07, 152.32, 160.19, 168.29, 175.98, 183.02, 189.35, 194.98, 199.98, 204.4],
      [122.17, 131.59, 142.34, 152.71, 162.2, 170.7, 178.25, 184.92, 190.82, 196.03],
      [99.43, 112.87, 126.51, 138.93, 149.95, 159.68, 168.24, 175.79, 182.45, 188.34],
    ],
  },
  {
    tipo: "CAA",
    awg: "1/0",
    titulo: "Tabela 09 — Tração de montagem até 200 m — CAA 1/0 AWG, Vmax 80 km/h",
    T: [
      [578.36, 574.36, 567.88, 559.2, 548.69, 536.82, 524.11, 511.08, 498.23, 485.96],
      [537.85, 534.32, 528.65, 521.11, 512.11, 502.09, 491.55, 480.93, 470.64, 460.96],
      [497.38, 494.44, 489.75, 483.6, 476.37, 468.48, 460.33, 452.28, 444.61, 437.5],
      [456.97, 454.77, 451.3, 446.83, 441.68, 436.18, 430.63, 425.25, 420.21, 415.6],
      [416.63, 415.38, 413.45, 411.01, 408.27, 405.42, 402.6, 399.93, 397.47, 395.25],
      [376.4, 376.4, 376.4, 376.4, 376.4, 376.4, 376.4, 376.4, 376.4, 376.4],
      [336.33, 337.99, 340.43, 343.31, 346.35, 349.32, 352.12, 354.67, 356.97, 359.0],
      [296.51, 300.42, 305.92, 312.11, 318.38, 324.34, 329.81, 334.74, 339.11, 342.98],
      [257.1, 264.08, 273.32, 283.17, 292.71, 301.52, 309.46, 316.52, 322.76, 328.23],
      [218.37, 229.58, 243.19, 256.81, 269.47, 280.88, 291.02, 299.95, 307.8, 314.68],
      [180.9, 197.7, 216.03, 233.24, 248.7, 262.36, 274.37, 284.9, 294.13, 302.23],
      [145.72, 169.36, 192.22, 212.54, 230.32, 245.84, 259.39, 271.25, 281.64, 290.77],
    ],
  },
  {
    tipo: "CAA",
    awg: "4/0",
    titulo: "Tabela 12 — Tração de montagem até 200 m — CAA 4/0 AWG, Vmax 80 km/h",
    T: [
      [1139.91, 1131.4, 1117.61, 1099.18, 1076.96, 1051.97, 1025.38, 998.35, 971.93, 946.95],
      [1058.76, 1051.24, 1039.15, 1023.15, 1004.13, 983.08, 961.09, 939.15, 918.08, 898.46],
      [977.69, 971.41, 961.41, 948.36, 933.1, 916.56, 899.62, 883.06, 867.43, 853.09],
      [896.74, 892.03, 884.64, 875.16, 864.31, 852.81, 841.31, 830.3, 820.08, 810.83],
      [815.95, 813.28, 809.15, 803.98, 798.23, 792.29, 786.49, 781.05, 776.08, 771.63],
      [735.4, 735.4, 735.4, 735.4, 735.4, 735.4, 735.4, 735.4, 735.4, 735.4],
      [655.2, 658.78, 663.99, 670.07, 676.39, 682.52, 688.21, 693.37, 697.96, 702.0],
      [575.56, 584.0, 595.71, 608.72, 621.69, 633.89, 644.98, 654.88, 663.6, 671.25],
      [496.84, 511.95, 531.55, 552.09, 571.71, 589.64, 605.65, 619.78, 632.16, 642.99],
      [419.7, 443.91, 472.6, 500.79, 526.65, 549.73, 570.07, 587.87, 603.43, 617.01],
      [345.43, 381.58, 419.85, 455.15, 486.51, 514.0, 537.99, 558.92, 577.17, 593.12],
      [276.5, 326.76, 373.9, 415.22, 451.06, 482.15, 509.15, 532.66, 553.19, 571.14],
    ],
  },
  {
    tipo: "CAA",
    awg: "336.4",
    titulo: "Tração de montagem até 200 m — CAA 336,4 MCM, Vmax 100 km/h",
    T: [
      [1113.0, 1088.28, 1048.94, 998.02, 940.03, 880.58, 825.06, 777.12, 737.96, 706.94],
      [1001.91, 979.36, 944.04, 899.53, 850.66, 802.64, 759.6, 723.56, 694.64, 671.87],
      [891.09, 871.51, 841.61, 805.3, 767.24, 731.59, 700.88, 675.81, 655.91, 640.27],
      [780.69, 765.34, 742.76, 716.71, 690.91, 667.91, 648.76, 633.41, 621.29, 611.76],
      [671.01, 661.82, 649.06, 635.32, 622.55, 611.68, 602.86, 595.86, 590.34, 585.97],
      [562.6, 562.6, 562.6, 562.6, 562.6, 562.6, 562.6, 562.6, 562.6, 562.6],
      [456.69, 470.32, 485.64, 499.46, 510.91, 520.09, 527.35, 533.11, 537.68, 541.35],
      [356.0, 388.62, 419.94, 446.0, 466.86, 483.38, 496.47, 506.88, 515.22, 521.96],
      [266.42, 321.0, 365.99, 401.53, 429.53, 451.69, 469.33, 483.48, 494.91, 504.22],
      [196.71, 268.64, 322.82, 364.82, 397.91, 424.25, 445.4, 462.52, 476.48, 487.94],
      [150.48, 229.74, 288.62, 334.52, 371.01, 400.38, 424.2, 443.67, 459.68, 472.95],
      [121.82, 201.01, 261.43, 309.36, 348.01, 379.49, 405.32, 426.63, 444.33, 459.11],
    ],
  },
];

/**
 * Famílias que NÃO usam tabela de montagem: a tração de projeto por condutor
 * sai da NDU 007, Tabela 26 (terno ÷ 3, `tracaoProjetoFeixe`).
 *
 * CAA: as tabelas acima misturavam critérios — 2, 1/0 e 4/0 em ~20% da ruptura,
 * 336,4 em ~9% — e deixavam o 4/0 com tração maior que o 336,4. Decisão do
 * projetista (07/10/2026): uma fonte só, a NDU 007, para todo CAA.
 */
const PELA_NDU_007 = new Set(["CAA"]);
const pelaNdu = (tipo: string) => PELA_NDU_007.has(tipo);

/** Posição (índice inferior e fração) de x numa grade crescente, presa às bordas. */
function posicao(grade: readonly number[], x: number): { i: number; f: number } {
  if (x <= grade[0]) return { i: 0, f: 0 };
  const n = grade.length - 1;
  if (x >= grade[n]) return { i: n - 1, f: 1 };
  const i = grade.findIndex((g) => g > x) - 1;
  return { i, f: (x - grade[i]) / (grade[i + 1] - grade[i]) };
}

/** Interpolação bilinear da tabela no vão e na temperatura. */
function interpolar(tab: TabelaMontagem, vao: number, tempC: number): number {
  const v = posicao(VAOS_TABELA, vao);
  const t = posicao(TEMPS_TABELA, tempC);
  const linha = (i: number) => tab.T[i][v.i] + (tab.T[i][v.i + 1] - tab.T[i][v.i]) * v.f;
  return linha(t.i) + (linha(t.i + 1) - linha(t.i)) * t.f;
}

function pesoKgKm(tipo: string, awg: string): number | null {
  return CONDUTORES[tipo]?.bitolas.find((b) => b.awg === awg)?.pesoKgKm ?? null;
}

/** Memória da tração tabelada (um circuito). */
export interface TracaoTabelada {
  tipo: "CA" | "CAA";
  awg: string; // cabo do projeto
  awgBase: string; // bitola da tabela usada (= awg quando tabelado)
  vao: number; // m — vão da tração (regulador do trecho, ou o do poste)
  tempC: number; // °C — temperatura de projeto
  tabela: string; // título da tabela usada
  /** Vão ou temperatura fora da tabela: valeu a borda. */
  foraDaFaixa: boolean;
  /** O cabo tem tabela própria; senão, flecha constante a partir de awgBase. */
  tabelado: boolean;
  Tbase: number; // daN — tração da tabela base no vão e na temperatura
  /** Tração de projeto POR CONDUTOR (× fases no poste), sem vento. */
  Tprojeto: number;
  flecha: number; // m — flecha do cabo do projeto no vão
}

/** Há tabela para a família do cabo (hoje só CAA)? */
export function temTabela(tipoCabo: string, awg: string): boolean {
  if (pelaNdu(tipoCabo)) return false;
  return TABELAS.some((t) => t.tipo === tipoCabo) && pesoKgKm(tipoCabo, awg) !== null;
}

/**
 * Tabela usada para o cabo: a da própria bitola ou, sem ela, a da família com
 * peso mais próximo (base da flecha constante).
 */
function tabelaDoCabo(tipoCabo: string, p: number): { tab: TabelaMontagem; pBase: number } | null {
  let melhor: { tab: TabelaMontagem; pBase: number } | null = null;
  for (const tab of TABELAS) {
    if (tab.tipo !== tipoCabo || pelaNdu(tab.tipo)) continue;
    const pBase = pesoKgKm(tab.tipo, tab.awg);
    if (pBase === null) continue;
    if (!melhor || Math.abs(pBase - p) < Math.abs(melhor.pBase - p)) melhor = { tab, pBase };
  }
  return melhor;
}

/** Tração por condutor do cabo pelas tabelas de montagem. */
export function tracaoTabelada(tipoCabo: string, awg: string, vao: number, tempC: number): TracaoTabelada | null {
  const p = pesoKgKm(tipoCabo, awg);
  if (pelaNdu(tipoCabo)) return null;
  if (p === null || !(vao > 0) || !Number.isFinite(tempC)) return null;
  const base = tabelaDoCabo(tipoCabo, p);
  if (!base) return null;
  const { tab, pBase } = base;

  const Tbase = interpolar(tab, vao, tempC);
  const Tprojeto = (Tbase * p) / pBase;
  return {
    tipo: tab.tipo, awg, awgBase: tab.awg, vao, tempC, tabela: tab.titulo,
    foraDaFaixa:
      vao < VAOS_TABELA[0] || vao > VAOS_TABELA[VAOS_TABELA.length - 1] || tempC < TEMP_MIN || tempC > TEMP_MAX,
    tabelado: awg === tab.awg,
    Tbase, Tprojeto,
    flecha: ((p / 1000) * vao ** 2) / (8 * Tprojeto),
  };
}
