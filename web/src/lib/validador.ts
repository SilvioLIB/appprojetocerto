/**
 * Motor de cálculo mecânico — porte do validador.py (Norma CPFL GED-3648 v2.9).
 *
 * Fonte de verdade das fórmulas e catálogos no lado do cliente. As funções
 * reproduzem as expressões da norma; os dados pré-definidos vêm das tabelas do
 * documento. Os números foram revalidados contra os exemplos da norma
 * (ver scripts/validar.ts).
 */

// ---------------------------------------------------------------------------
// Constantes e catálogos
// ---------------------------------------------------------------------------

/** Constante da pressão do vento por tipo de superfície (item 6.2.1.2). */
export const constantePvp: Record<string, number> = {
  circular: 0.00471,
  "duplo T": 0.00754,
};

/**
 * A velocidade do vento (Vb, em km/h) não é mais um preset regional: ela é
 * derivada da coordenada (lat, lon) do ponto da rede pelo esquema da NBR 6123
 * (isopletas → V0 → Vk = V0·S1·S2·S3 → v = Vk·3,6). Ver `./vento.ts`.
 */

/** Tensões de operação E (kV). */
export const TENSOES_OPERACAO = [13.8, 24.2, 36.2];

/**
 * Espaçamento mínimo entre condutores de um mesmo circuito, por faixa de tensão
 * (NT 11836). A tabela é dada em milímetros; no cálculo converte-se para metros.
 *
 *   tensões até 1 kV ............................ 200 mm
 *   tensões entre 1 kV e 15 kV .................. 500 mm
 *   acima de 15 kV até 36,2 kV ................. 600 mm
 *
 * Obs.: a faixa superior original é "acima de 15 kV e menor que 36,2 kV"; o
 * limite 36,2 kV é tratado como inclusivo para cobrir essa tensão de operação.
 */
export function espacamentoMinimoMm(E_kV: number): number {
  if (E_kV <= 1) return 200;
  if (E_kV <= 15) return 500;
  if (E_kV <= 36.2) return 600;
  throw new Error(`tensão fora da faixa tabelada (máx. 36,2 kV): ${E_kV} kV`);
}

/** Espaçamento mínimo entre condutores (m), já convertido de mm. */
export function espacamentoMinimo(E_kV: number): number {
  return espacamentoMinimoMm(E_kV) / 1000;
}

/** Espaçamento mínimo (m) para as tensões de operação padrão (NT 11836). */
export const ESPACAMENTO_MINIMO: Record<string, number> = {
  "13.8": espacamentoMinimo(13.8),
  "24.2": espacamentoMinimo(24.2),
  "36.2": espacamentoMinimo(36.2),
};

export const PARAMETROS = {
  vaoMecanico: [70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 300, 400, 500],
  anguloDeflexao: Array.from({ length: 18 }, (_, i) => (i + 1) * 5), // 5..90
  pesoEletricista: [70, 80, 90, 100],
};

export interface Condutor {
  awg: string;
  diamMm: number;
  pesoKgKm: number;
}

export const CONDUTORES: Record<string, { nome: string; bitolas: Condutor[] }> = {
  CA: {
    nome: "Cabo de alumínio nu (CA)",
    bitolas: [
      { awg: "2", diamMm: 7.41, pesoKgKm: 92.5 },
      { awg: "1/0", diamMm: 9.36, pesoKgKm: 147.6 },
      { awg: "2/0", diamMm: 10.5, pesoKgKm: 185.7 },
      { awg: "3/0", diamMm: 11.79, pesoKgKm: 234.1 },
      { awg: "4/0", diamMm: 13.26, pesoKgKm: 296.1 },
      { awg: "266.8", diamMm: 14.88, pesoKgKm: 372.9 },
      { awg: "336.4", diamMm: 16.9, pesoKgKm: 470 },
    ],
  },
  CAL: {
    nome: "Cabo de alumínio-liga (CAL 6201)",
    bitolas: [
      { awg: "2", diamMm: 7.41, pesoKgKm: 92 },
      { awg: "1/0", diamMm: 9.36, pesoKgKm: 146.8 },
      { awg: "4/0", diamMm: 13.26, pesoKgKm: 294.7 },
      { awg: "336.4", diamMm: 16.9, pesoKgKm: 487.3 },
    ],
  },
  CAA: {
    nome: "Cabo de alumínio nu com alma de aço (CAA)",
    bitolas: [
      { awg: "2", diamMm: 8.01, pesoKgKm: 135.8 },
      { awg: "1/0", diamMm: 10.11, pesoKgKm: 216.2 },
      { awg: "2/0", diamMm: 11.34, pesoKgKm: 272 },
      { awg: "3/0", diamMm: 12.75, pesoKgKm: 343.9 },
      { awg: "4/0", diamMm: 14.31, pesoKgKm: 433.2 },
      { awg: "266.8", diamMm: 16.28, pesoKgKm: 545.3 },
      { awg: "336.4", diamMm: 18.31, pesoKgKm: 689.9 },
    ],
  },
};

/** Pesos específicos e trações de ruptura dos condutores nus (item 6.5). */
export interface PesoEspecifico {
  secao: string;
  tipo: string;
  pesoKgM: number;
  rupturaDaN: number;
}

export const PESOS_ESPECIFICOS: PesoEspecifico[] = [
  { secao: "02", tipo: "CA", pesoKgM: 0.0918, rupturaDaN: 564 },
  { secao: "1/0", tipo: "CA", pesoKgM: 0.1465, rupturaDaN: 844 },
  { secao: "4/0", tipo: "CA", pesoKgM: 0.2941, rupturaDaN: 1622 },
  { secao: "336.4", tipo: "CA", pesoKgM: 0.4691, rupturaDaN: 2656 },
  { secao: "477", tipo: "CA", pesoKgM: 0.6635, rupturaDaN: 3665 },
  { secao: "04", tipo: "CAA", pesoKgM: 0.0856, rupturaDaN: 812 },
  { secao: "02", tipo: "CAA", pesoKgM: 0.1358, rupturaDaN: 1246 },
  { secao: "1/0", tipo: "CAA", pesoKgM: 0.2163, rupturaDaN: 1904 },
  { secao: "4/0", tipo: "CAA", pesoKgM: 0.4332, rupturaDaN: 3644 },
  { secao: "336.4", tipo: "CAA", pesoKgM: 0.6884, rupturaDaN: 6181 },
  { secao: "477", tipo: "CAA", pesoKgM: 0.9758, rupturaDaN: 8538 },
];

/**
 * Trações de projeto por TERNO de fases (daN) — Energisa NDU 007 v8.0
 * (abril/2026), Tabela 26 "Trações de Projeto de Redes Rurais". Nota I da
 * tabela: "valores de trações de projetos são por 03 terno de fases dos
 * condutores" — cada valor é a tração das 3 fases juntas, não de um condutor.
 * Nota III: CAL 6201 usa as mesmas trações do CAA.
 */
export interface TracaoProjeto {
  label: string;
  tracaoDaN: number;
}

export const TRACOES_PROJETO: TracaoProjeto[] = [
  { label: "3 × 2 AWG CA (*)", tracaoDaN: 267 },
  { label: "3 × 1/0 AWG CA", tracaoDaN: 426 },
  { label: "3 × 2/0 AWG CA", tracaoDaN: 507 },
  { label: "3 × 4/0 AWG CA", tracaoDaN: 852 },
  { label: "3 × 336,4 MCM CA", tracaoDaN: 1356 },
  { label: "3 × 4 AWG CAA/CAL", tracaoDaN: 325 },
  { label: "3 × 2 AWG CAA/CAL", tracaoDaN: 454 },
  { label: "3 × 1/0 AWG CAA/CAL", tracaoDaN: 605 },
  { label: "3 × 4/0 AWG CAA/CAL", tracaoDaN: 1212 },
  { label: "3 × 336,4 MCM CAA/CAL", tracaoDaN: 1517 },
  { label: "3 × 4/0 AWG CAA (*) tração reduzida", tracaoDaN: 800 },
  { label: "3 × 336,4 MCM (*) tração reduzida", tracaoDaN: 860 },
];

/**
 * Tração de projeto NORMAL por condutor (daN) para o cabo do catálogo: o valor
 * do terno em TRACOES_PROJETO dividido por 3 (NDU 007, Tabela 26, nota I).
 * CAA e CAL compartilham a mesma linha da tabela.
 * CAA fora da tabela (2/0, 3/0, 266,8): interpolado pelo peso entre as bitolas
 * tabeladas vizinhas (`tracaoProjetoInterpolada`).
 * `null` quando a combinação não está tabelada (ex.: CA 3/0, CA 266,8) — nesse
 * caso a tração deve ser informada.
 */
export function tracaoProjetoFeixe(tipoCabo: string, awg: string): number | null {
  return tracaoProjetoTabela(tipoCabo, awg) ?? tracaoProjetoInterpolada(tipoCabo, awg)?.T ?? null;
}

/** Linha da NDU 007 Tab. 26 para o cabo, por condutor; null se não houver. */
function tracaoProjetoTabela(tipoCabo: string, awg: string): number | null {
  const familia = tipoCabo === "CA" ? "CA" : tipoCabo === "CAA" || tipoCabo === "CAL" ? "CAA/CAL" : null;
  if (!familia) return null;
  const bitola = awg === "336.4" ? "336,4 MCM" : `${awg} AWG`;
  const chave = `3 × ${bitola} ${familia}`;
  // Aceita a marca "(*)" da tabela, mas nunca as linhas de tração reduzida.
  const linha = TRACOES_PROJETO.find((t) => t.label === chave || t.label === `${chave} (*)`);
  return linha ? linha.tracaoDaN / 3 : null;
}

/**
 * CAA sem linha na NDU 007 Tab. 26: tração por condutor interpolada
 * linearmente pelo peso (kg/km do catálogo) entre as bitolas tabeladas vizinhas.
 * Mantém a ordem das bitolas (um cabo mais pesado nunca traciona menos).
 * null para cabo tabelado, fora da faixa tabelada ou de outra família.
 */
export function tracaoProjetoInterpolada(
  tipoCabo: string,
  awg: string,
): { T: number; abaixo: string; acima: string } | null {
  if (tipoCabo !== "CAA" || tracaoProjetoTabela(tipoCabo, awg) !== null) return null;
  const bitolas = CONDUTORES.CAA.bitolas;
  const p = bitolas.find((b) => b.awg === awg)?.pesoKgKm;
  if (p === undefined) return null;
  const pontos = bitolas
    .map((b) => ({ awg: b.awg, p: b.pesoKgKm, T: tracaoProjetoTabela("CAA", b.awg) }))
    .filter((x): x is { awg: string; p: number; T: number } => x.T !== null)
    .sort((a, b) => a.p - b.p);
  const i = pontos.findIndex((x) => x.p > p);
  if (i <= 0) return null;
  const a = pontos[i - 1], b = pontos[i];
  return { T: a.T + ((p - a.p) / (b.p - a.p)) * (b.T - a.T), abaixo: a.awg, acima: b.awg };
}

// ---------------------------------------------------------------------------
// Cruzetas — dimensões para o esforço de vento (área frontal L × c)
// ---------------------------------------------------------------------------
export interface CruzetaModelo {
  formato: string;
  Lmm: number; // comprimento
  bmm: number; // largura
  cmm: number; // altura — usada como face exposta ao vento (L × c)
}

/** Cruzetas por material (dimensões em mm). Porte de CRUZETAS_DIM (validador.py). */
export const CRUZETAS_DIM: Record<string, { nome: string; modelos: CruzetaModelo[] }> = {
  PRFV: {
    nome: "PRFV (fibra de vidro)",
    modelos: [
      { formato: "Tipo L", Lmm: 1700, bmm: 90, cmm: 90 },
      { formato: "Tipo T", Lmm: 1900, bmm: 90, cmm: 90 },
      { formato: "Retangular", Lmm: 3000, bmm: 90, cmm: 112.5 },
      { formato: "Retangular", Lmm: 3500, bmm: 90, cmm: 112.5 },
      { formato: "Retangular", Lmm: 5000, bmm: 120, cmm: 140 },
    ],
  },
  PEAD: {
    nome: "PEAD (polietileno)",
    modelos: [
      { formato: "Tipo L", Lmm: 1700, bmm: 90, cmm: 90 },
      { formato: "Tipo T", Lmm: 1900, bmm: 120, cmm: 140 },
      { formato: "Retangular", Lmm: 2400, bmm: 90, cmm: 112.5 },
      { formato: "Tipo T", Lmm: 2400, bmm: 90, cmm: 90 },
      { formato: "Retangular", Lmm: 3000, bmm: 90, cmm: 112.5 },
      { formato: "Retangular", Lmm: 3500, bmm: 90, cmm: 112.5 },
      { formato: "Retangular", Lmm: 5000, bmm: 120, cmm: 140 },
    ],
  },
  concreto: {
    nome: "Concreto",
    modelos: [
      { formato: "Tipo L", Lmm: 1700, bmm: 90, cmm: 90 },
      { formato: "Tipo L", Lmm: 1900, bmm: 90, cmm: 90 },
      { formato: "Quadrada", Lmm: 2000, bmm: 90, cmm: 90 },
      { formato: "Tipo L", Lmm: 2000, bmm: 120, cmm: 90 },
      { formato: "Retangular", Lmm: 2400, bmm: 90, cmm: 115 },
      { formato: "Tipo L", Lmm: 2400, bmm: 90, cmm: 100 },
    ],
  },
  aco_galv: {
    nome: "Aço galvanizado",
    modelos: [
      { formato: "Retangular", Lmm: 2400, bmm: 90, cmm: 90 },
      { formato: "Retangular", Lmm: 3000, bmm: 90, cmm: 110 },
      { formato: "Retangular", Lmm: 5000, bmm: 120, cmm: 140 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Cruzetas — peso próprio (para o momento MR do poste com transformador)
// ---------------------------------------------------------------------------
export interface CruzetaPeso {
  tipo: string; // tipo/formato (rótulo)
  comprimentoMm: number; // comprimento nominal
  pesoKg: number; // massa da cruzeta
}

/**
 * Peso das cruzetas por tipo + comprimento — usado no momento do peso próprio
 * (Pcr) da verificação do poste com transformador. Tabela independente de
 * `CRUZETAS_DIM` (que guarda dimensões da face ao vento). A chave é tipo +
 * comprimento (o mesmo comprimento aparece em tipos diferentes).
 */
export const CRUZETAS_PESO: CruzetaPeso[] = [
  { tipo: "L (beco)", comprimentoMm: 1700, pesoKg: 50 },
  { tipo: "T (triangular)", comprimentoMm: 1900, pesoKg: 50 },
  { tipo: "T (triangular)", comprimentoMm: 2400, pesoKg: 75 },
  { tipo: "MB (meio beco)", comprimentoMm: 2400, pesoKg: 75 },
  { tipo: "Quadrada", comprimentoMm: 2000, pesoKg: 35 },
  { tipo: "Retangular", comprimentoMm: 2400, pesoKg: 75 },
];

/** Área frontal ao vento de uma cruzeta (m²) = L · c (mm → m). */
export function areaCruzeta(Lmm: number, cmm: number): number {
  return (Lmm / 1000) * (cmm / 1000);
}

/** Momentos fletores de postes de concreto circulares (Anexo 1). */
export interface MomentoAnexo1 {
  Rn: number;
  h: number;
  WA: number;
  WB: number;
}

export const MOMENTOS_ANEXO1: Record<string, MomentoAnexo1> = {
  "9/2": { Rn: 200, h: 7.3, WA: 223, WB: 1583 },
  "9/4": { Rn: 400, h: 7.3, WA: 337, WB: 1977 },
  "9/6": { Rn: 600, h: 7.3, WA: 476, WB: 2308 },
  "11/2": { Rn: 200, h: 9.1, WA: 223, WB: 2108 },
  "11/4": { Rn: 400, h: 9.1, WA: 337, WB: 2591 },
  "11/6": { Rn: 600, h: 9.1, WA: 476, WB: 2968 },
  "11/10": { Rn: 1000, h: 9.1, WA: 859, WB: 4032 },
  "12/4": { Rn: 400, h: 10.0, WA: 337, WB: 2929 },
  "12/6": { Rn: 600, h: 10.0, WA: 476, WB: 3329 },
  "12/10": { Rn: 1000, h: 10.0, WA: 859, WB: 4471 },
  "13/6": { Rn: 600, h: 10.9, WA: 476, WB: 3712 },
  "13/10": { Rn: 1000, h: 10.9, WA: 859, WB: 4933 },
};

export interface DimensaoPoste {
  dt: number;
  ds: number;
}

/** Dimensões (dt, ds em mm) por tipo / comprimento (m) / resistência (daN). */
export const postes: Record<string, Record<string, Record<string, DimensaoPoste>>> = {
  circular: {
    "10": { "300": { dt: 170, ds: 370 }, "600": { dt: 190, ds: 390 } },
    "11": {
      "300": { dt: 170, ds: 390 }, "600": { dt: 190, ds: 410 },
      "1000": { dt: 230, ds: 450 }, "1500": { dt: 290, ds: 510 }, "2000": { dt: 330, ds: 550 },
    },
    "12": {
      "300": { dt: 170, ds: 410 }, "600": { dt: 190, ds: 430 },
      "1000": { dt: 230, ds: 470 }, "1500": { dt: 290, ds: 530 }, "2000": { dt: 330, ds: 570 },
    },
    "13": {
      "600": { dt: 190, ds: 450 }, "1000": { dt: 230, ds: 490 },
      "1500": { dt: 290, ds: 550 }, "2000": { dt: 330, ds: 590 },
    },
    "14": {
      "600": { dt: 190, ds: 470 }, "1000": { dt: 230, ds: 510 },
      "1500": { dt: 290, ds: 570 }, "2000": { dt: 330, ds: 610 },
    },
    "15": {
      "600": { dt: 190, ds: 490 }, "1000": { dt: 230, ds: 530 },
      "1500": { dt: 290, ds: 590 }, "2000": { dt: 330, ds: 630 },
    },
    "16": {
      "600": { dt: 190, ds: 510 }, "1000": { dt: 230, ds: 550 },
      "1500": { dt: 290, ds: 610 }, "2000": { dt: 330, ds: 650 },
    },
    "17": {
      "600": { dt: 190, ds: 530 }, "1000": { dt: 230, ds: 570 },
      "1500": { dt: 290, ds: 630 }, "2000": { dt: 330, ds: 670 },
    },
  },
  "duplo T": {
    "9": { "300": { dt: 110, ds: 290 }, "600": { dt: 110, ds: 290 } },
    "10": { "150": { dt: 100, ds: 200 }, "300": { dt: 110, ds: 310 }, "600": { dt: 110, ds: 310 } },
    "11": {
      "300": { dt: 170, ds: 390 }, "600": { dt: 190, ds: 410 },
      "1000": { dt: 230, ds: 450 }, "1500": { dt: 290, ds: 510 }, "2000": { dt: 330, ds: 550 },
    },
    "12": {
      "300": { dt: 170, ds: 410 }, "600": { dt: 190, ds: 430 },
      "1000": { dt: 230, ds: 470 }, "1500": { dt: 290, ds: 530 }, "2000": { dt: 330, ds: 570 },
    },
    "13": {
      "300": { dt: 190, ds: 450 }, "600": { dt: 230, ds: 490 },
      "1000": { dt: 290, ds: 550 }, "2000": { dt: 330, ds: 590 }, // REVISAR: sem linha de 1500 daN
    },
    "14": {
      "300": { dt: 190, ds: 470 }, "600": { dt: 230, ds: 510 },
      "1000": { dt: 290, ds: 570 }, "2000": { dt: 330, ds: 610 },
    },
    "15": {
      "300": { dt: 190, ds: 490 }, "600": { dt: 230, ds: 530 },
      "1000": { dt: 290, ds: 590 }, "2000": { dt: 230, ds: 610 }, // REVISAR: dt=230 destoa
    },
    "16": {
      "300": { dt: 190, ds: 510 }, "600": { dt: 230, ds: 550 },
      "1000": { dt: 290, ds: 610 }, "2000": { dt: 230, ds: 650 }, // REVISAR: dt=230 destoa
    },
    "17": {
      "300": { dt: 190, ds: 530 }, "600": { dt: 230, ds: 570 },
      "1000": { dt: 290, ds: 630 }, "2000": { dt: 230, ds: 670 }, // REVISAR: dt=230 destoa
    },
  },
};

const rad = (graus: number) => (graus * Math.PI) / 180;
const deg = (radianos: number) => (radianos * 180) / Math.PI;

// ---------------------------------------------------------------------------
// Alturas e engastamento (itens 6.2.1.4, 6.3.2, 6.8)
// ---------------------------------------------------------------------------

/** Altura livre (m) do poste = 0,9*L − 0,6 = L − E (usada na área Sp). */
export function alturaUtil(comprimento: number): number {
  return 0.9 * comprimento - 0.6;
}

/** Engastamento E (m) = 0,1*L + 0,6 (item 6.8). */
export function engastamento(comprimento: number): number {
  return 0.1 * comprimento + 0.6;
}

/**
 * Altura útil h (m) = L − E − 0,10: esforços referidos a 10 cm abaixo do topo,
 * como na NBR 8451 — escolha do projetista. (A GED-3648, itens 6.3.1/6.3.2,
 * usa 20 cm no Grupo CPFL: h = L − E − 0,20.) Ponto único de ajuste.
 */
export const DISTANCIA_TOPO_M = 0.1;

export function alturaUtilTopo(comprimento: number): number {
  return comprimento - engastamento(comprimento) - DISTANCIA_TOPO_M;
}

/** Dimensões (dt, ds em mm) do poste; lança erro se não cadastrado. */
export function getDimensoes(tipo: string, comprimento: number, resistencia: number): DimensaoPoste {
  const p = postes[tipo]?.[String(comprimento)]?.[String(resistencia)];
  if (!p) throw new Error(`poste não cadastrado: ${tipo}, ${comprimento} m, ${resistencia} daN`);
  return p;
}

// ---------------------------------------------------------------------------
// Ação do vento (itens 6.2.1.2 e 6.2.1.3)
// ---------------------------------------------------------------------------

/** Pressão do vento Pvp (daN/m²) = c · Vb². */
export function pressaoVento(tipo: string, Vb: number): number {
  const c = constantePvp[tipo];
  if (c === undefined) throw new Error(`tipo de poste inválido: ${tipo}`);
  return c * Vb ** 2;
}

/** Área da superfície do poste Sp (m²) = ½·(dt+ds)·h. dt/ds em mm. */
export function areaSuperficie(dtMm: number, dsMm: number, h: number): number {
  return 0.5 * (dtMm / 1000 + dsMm / 1000) * h;
}

/** Esforço do vento no poste Fp (daN) = Pvp · Sp. */
export function esforcoDoVento(tipo: string, Vb: number, dtMm: number, dsMm: number, h: number): number {
  return pressaoVento(tipo, Vb) * areaSuperficie(dtMm, dsMm, h);
}

/** Ponto de aplicação H (m) da resultante do vento no poste. */
export function pontoDeAplicacao(dtMm: number, dsMm: number, h: number): number {
  const dt = dtMm / 1000;
  const ds = dsMm / 1000;
  return (h * (2 * dt + ds)) / (3 * (dt + ds));
}

/** Diâmetro (mm) da bitola escolhida. */
export function getDiametroCondutor(tipoCabo: string, awg: string): number {
  const cabo = CONDUTORES[tipoCabo];
  if (!cabo) throw new Error(`tipo de cabo não cadastrado: ${tipoCabo}`);
  const b = cabo.bitolas.find((x) => x.awg === awg);
  if (!b) throw new Error(`bitola ${awg} não cadastrada no cabo ${tipoCabo}`);
  return b.diamMm;
}

/** Peso linear (kg/km) da bitola escolhida — usado no momento do peso próprio. */
export function getPesoCondutor(tipoCabo: string, awg: string): number {
  const cabo = CONDUTORES[tipoCabo];
  if (!cabo) throw new Error(`tipo de cabo não cadastrado: ${tipoCabo}`);
  const b = cabo.bitolas.find((x) => x.awg === awg);
  if (!b) throw new Error(`bitola ${awg} não cadastrada no cabo ${tipoCabo}`);
  return b.pesoKgKm;
}

/**
 * Coeficiente do cabo Cc (daN/m por condutor) = Pvp · d · 10⁻³, com
 * Pvp = 0,00471 · Vb² (item 6.2.1.3). O condutor é sempre uma superfície
 * CILÍNDRICA: a constante independe do tipo do poste (a de 0,00754 vale para a
 * face plana do poste duplo T, não para o cabo).
 */
export function coeficienteCabo(Vb: number, dMm: number): number {
  return pressaoVento("circular", Vb) * dMm * 0.001;
}

/** Força do vento sobre um condutor (daN) = Pvp·a·d·cos(α/2)·10⁻³ (cabo cilíndrico). */
export function esforcoVentoCondutores(
  Vb: number, a: number, tipoCabo: string, awg: string, alfa = 0,
): number {
  const d = getDiametroCondutor(tipoCabo, awg);
  return coeficienteCabo(Vb, d) * a * Math.cos(rad(alfa / 2));
}

/** Força total do vento sobre os cabos (daN) = Cc·a·cos(α/2)·nº fases. */
export function esforcoVentoCabosTotal(
  Vb: number, a: number, tipoCabo: string, awg: string, alfa = 0, nFases = 3,
): number {
  const d = getDiametroCondutor(tipoCabo, awg);
  return coeficienteCabo(Vb, d) * a * Math.cos(rad(alfa / 2)) * nFases;
}

/** Flecha final por balanço dos condutores (m) — item 6.2.1.5. */
export function flechaFinalBalanco(S: number, E: number, alfa = 0): number {
  return (1 / 0.368) * (S * Math.cos(rad(alfa / 2)) - 0.0076 * E) ** 2;
}

// ---------------------------------------------------------------------------
// Transferência de esforços e resultantes (item 6.3.2)
// ---------------------------------------------------------------------------

/** Esforço equivalente transferido a 10 cm do topo = F·altura/h. */
export function esforcoTransferidoTopo(F: number, alturaAplicacao: number, h: number): number {
  return (F * alturaAplicacao) / h;
}

export interface Carga {
  F: number;
  altura: number;
}

/** Força horizontal total referida a 10 cm do topo = F_prim + Σ(F·altura/h). */
export function forcaTotalTopo(Fprimaria: number, cargasAbaixo: Carga[], h: number): number {
  return cargasAbaixo.reduce((acc, c) => acc + esforcoTransferidoTopo(c.F, c.altura, h), Fprimaria);
}

/** Resultante de duas forças perpendiculares = √(fh²+fv²). */
export function resultantePerpendicular(fh: number, fv: number): number {
  return Math.hypot(fh, fv);
}

// ---------------------------------------------------------------------------
// Método do diagrama de momentos (item 6.3.3)
// ---------------------------------------------------------------------------

/** Momento de uma força = F·d (daN·m). */
export function momento(F: number, d: number): number {
  return F * d;
}

/** Esforços num poste estaiado: Fe = F·hf/he ; Fr = F − Fe. */
export function esforcoEstaiPoste(F: number, alturaForca: number, alturaEstai: number): { Fe: number; Fr: number } {
  const Fe = (F * alturaForca) / alturaEstai;
  return { Fe, Fr: F - Fe };
}

// ---------------------------------------------------------------------------
// Momentos resistentes NBR 8451 (item 6.3.3, Anexo 1)
// ---------------------------------------------------------------------------

/** Módulo de resistência de seção circular vazada = π(D⁴−d⁴)/(32D). */
export function moduloResistencia(D: number, d: number): number {
  return (Math.PI * (D ** 4 - d ** 4)) / (32 * D);
}

/** Momento resistente na base MB = Rn·h (daN·m). */
export function momentoResistenteBase(Rn: number, h: number): number {
  return Rn * h;
}

/** Momento resistente no topo MA = 0,9·MB·(WA/WB). */
export function momentoResistenteTopo(MB: number, WA: number, WB: number): number {
  return 0.9 * MB * (WA / WB);
}

/** Reta A: MyA = MA + (0,7·MB − MA)·(X/h). */
export function momentoResistenteMyA(MA: number, MB: number, X: number, h: number): number {
  return MA + (0.7 * MB - MA) * (X / h);
}

/** Reta B: MyB = MB·(X/h). */
export function momentoResistenteMyB(MB: number, X: number, h: number): number {
  return MB * (X / h);
}

/** Momento resistente da seção = máx(MyA, MyB). */
export function momentoResistenteSecao(MA: number, MB: number, X: number, h: number): number {
  return Math.max(momentoResistenteMyA(MA, MB, X, h), momentoResistenteMyB(MB, X, h));
}

/** Altura de cruzamento Xp onde MyA = MyB. */
export function alturaCruzamentoMomentos(WA: number, WB: number, h: number): number {
  const r = 0.9 * (WA / WB);
  return (r * h) / (0.3 + r);
}

export interface ResultadoMomentos {
  MB: number; MA: number; MyA: number; MyB: number; Mres: number; Xp: number;
}

/** Momentos resistentes de um poste do Anexo 1 na altura X. */
export function momentosResistentesPoste(designacao: string, X: number): ResultadoMomentos {
  const p = MOMENTOS_ANEXO1[designacao];
  if (!p) throw new Error(`poste não cadastrado no Anexo 1: ${designacao}`);
  const MB = momentoResistenteBase(p.Rn, p.h);
  const MA = momentoResistenteTopo(MB, p.WA, p.WB);
  return {
    MB, MA,
    MyA: momentoResistenteMyA(MA, MB, X, p.h),
    MyB: momentoResistenteMyB(MB, X, p.h),
    Mres: momentoResistenteSecao(MA, MB, X, p.h),
    Xp: alturaCruzamentoMomentos(p.WA, p.WB, p.h),
  };
}

// ---------------------------------------------------------------------------
// Cruzeta — momento fletor no centro (MA_CR)
// ---------------------------------------------------------------------------

/**
 * Variáveis da verificação da cruzeta. Pesos em daN, distâncias em m.
 *
 *   PCO  — peso da chave a óleo, chave tripolar p/ abertura em carga ou outro acessório
 *   Pc   — peso dos condutores mais acessórios de sustentação (por condutor)
 *   PE   — peso do eletricista (ver PARAMETROS.pesoEletricista)
 *   PCR  — METADE do peso próprio da cruzeta
 *   dCO  — distância do baricentro da chave/acessório ao eixo do poste
 *   LCR  — comprimento da cruzeta
 *   d1   — distância do ponto de fixação do condutor interno ao eixo do poste
 *   d2   — distância do ponto de fixação do condutor externo ao eixo do poste
 *   d3   — distância do ponto de fixação da mão francesa ao eixo do poste
 *   b, c — dimensões da seção transversal da cruzeta (m)
 *   RF   — resistência máxima à tração da mão francesa
 *
 * Só Pc, PE, PCR, LCR, d1 e d2 entram em MA_CR; os demais ficam declarados
 * para as verificações da chave, da mão francesa e da tensão σCR.
 */
export interface VariaveisCruzeta {
  Pc: number;
  PE: number;
  PCR: number;
  LCR: number;
  d1: number;
  d2: number;
  PCO?: number;
  dCO?: number;
  d3?: number;
  b?: number;
  c?: number;
  RF?: number;
}

/** PCR = metade do peso próprio da cruzeta (daN). */
export function metadePesoCruzeta(pesoCruzeta: number): number {
  return pesoCruzeta / 2;
}

/**
 * Pc (daN) = peso de um vão de condutor + acessórios de sustentação (isolador,
 * pino, amarração). Com g ≈ 10, 1 kg ≈ 1 daN: peso = kg/km · vão / 1000.
 */
export function pesoCondutorNoApoio(tipoCabo: string, awg: string, vao: number, acessorios = 0): number {
  return (getPesoCondutor(tipoCabo, awg) * vao) / 1000 + acessorios;
}

/**
 * Momento fletor máximo no centro da cruzeta (daN·m — a fonte grafa "daN/m"):
 *   MA_CR = (Pc + PE)·d2 + PCR·LCR/4 + Pc·d1
 * O eletricista fica no condutor externo (d2, braço maior); a meia cruzeta age
 * no seu centro de gravidade, a LCR/4 do eixo.
 */
export function momentoFletorCruzeta(v: VariaveisCruzeta): number {
  return (v.Pc + v.PE) * v.d2 + (v.PCR * v.LCR) / 4 + v.Pc * v.d1;
}

/** Esforço equivalente na ponta da cruzeta (daN) = MA_CR / (LCR/2) — braço em balanço. */
export function esforcoPontaCruzeta(MA_CR: number, LCR: number): number {
  return MA_CR / (LCR / 2);
}

// ---------------------------------------------------------------------------
// Redução de tração (item 6.4)
// ---------------------------------------------------------------------------

/** Redução de tração com flecha constante: T2 = T1·(V2/V1)². */
export function reducaoTracaoFlechaConstante(T1: number, V1: number, V2: number): number {
  return T1 * (V2 / V1) ** 2;
}

/** Redução de tração com vão constante: T2 = T1·F1/F2. */
export function reducaoTracaoVaoConstante(T1: number, F1: number, F2: number): number {
  return (T1 * F1) / F2;
}

// ---------------------------------------------------------------------------
// Vãos ancorados (item 6.5)
// ---------------------------------------------------------------------------

export function getPesoEspecifico(secao: string, tipo: string): number {
  const p = PESOS_ESPECIFICOS.find((x) => x.secao === secao && x.tipo === tipo);
  if (!p) throw new Error(`condutor não cadastrado: ${secao} ${tipo}`);
  return p.pesoKgM;
}

/** Flecha de vão ancorado no mesmo nível: F = P·V²/(8·T). */
export function flechaVaoAncorado(P: number, V: number, T: number): number {
  return (P * V ** 2) / (8 * T);
}

/** Tração de vão ancorado no mesmo nível: T = P·V²/(8·F). */
export function tracaoVaoAncorado(P: number, V: number, F: number): number {
  return (P * V ** 2) / (8 * F);
}

export interface ResultadoDesnivel {
  LA: number; LB: number; TA: number; TB: number;
}

/** Trações e distâncias de um vão ancorado em desnível (item 6.5). */
export function flechasTracoesDesnivel(P: number, vao: number, HA: number, HB: number): ResultadoDesnivel {
  if (HA === HB) throw new Error("H_A e H_B iguais: use a flecha de vão no mesmo nível");
  const disc = (2 * vao * HB) ** 2 - 4 * (HA - HB) * (vao ** 2 * HB);
  const LB = (2 * vao * HB - Math.sqrt(disc)) / (2 * (HB - HA));
  const LA = vao - LB;
  const TA = Math.hypot((P * LA ** 2) / (2 * HA), P * LA);
  const TB = Math.hypot((P * LB ** 2) / (2 * HB), P * LB);
  return { LA, LB, TA, TB };
}

// ---------------------------------------------------------------------------
// Arrancamento e compressão (item 6.9.3)
// ---------------------------------------------------------------------------

/** Esforço vertical de compressão Rnv = T·(h1/L1 + h2/L2). */
export function esforcoCompressaoVertical(T: number, h1: number, e1: number, h2: number, e2: number): number {
  return T * (h1 / Math.hypot(h1, e1) + h2 / Math.hypot(h2, e2));
}

/** Esforço horizontal longitudinal Rnh = T·(e1/L1 − e2/L2). */
export function esforcoHorizontalLongitudinal(T: number, h1: number, e1: number, h2: number, e2: number): number {
  return T * (e1 / Math.hypot(h1, e1) - e2 / Math.hypot(h2, e2));
}

// ---------------------------------------------------------------------------
// Auxiliares (Anexos 6 e 7)
// ---------------------------------------------------------------------------

/** Constante da resultante de forças iguais (Anexo 6) = 2·sen(α/2). */
export function constanteResultante(angulo: number): number {
  return 2 * Math.sin(rad(angulo / 2));
}

/** Resultante de forças iguais numa deflexão = T·nº·2·sen(α/2). */
export function resultanteForcasIguais(tracao: number, nCondutores: number, angulo: number): number {
  return tracao * nCondutores * constanteResultante(angulo);
}

/** Ângulo de deflexão medido em campo (graus) — Anexo 7. */
export function anguloDeCampo(AB: number, D = 10, metodo: "I" | "II" = "I"): number {
  const razao = AB / (2 * D);
  if (metodo === "I") return deg(2 * Math.asin(razao));
  return deg(2 * Math.acos(razao));
}
