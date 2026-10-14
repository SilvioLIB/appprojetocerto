/**
 * Catálogo de transformadores de distribuição — usado no cálculo do
 * "Poste com transformador" (fluxo guiado v2).
 *
 * A escolha é afunilada por três chaves (flags), nesta ordem:
 *   1. fase   → monofásico | trifásico
 *   2. classe → classe de tensão (15 / 24,2 / 36,2 kV)
 *   3. kVA    → potência nominal
 *
 * Para cada transformador a tabela traz dimensões (mm) e massa (kg). No cálculo
 * do esforço só entram DIM. A e DIM. B (área frontal ao vento = A · B) e a massa
 * (peso). As demais dimensões da tabela original (C, L, D) são ignoradas de
 * propósito, conforme especificado.
 *
 * Valores transcritos das tabelas oficiais por classe de tensão, para as duas
 * fases (monofásico e trifásico). Observação: monofásico e trifásico têm
 * potências (kVA) diferentes; 24,2 kV e 36,2 kV compartilham as mesmas
 * dimensões (só a massa muda).
 */

export type FaseTransformador = "monofasico" | "trifasico";

/** Fases disponíveis (rótulos para a UI). */
export const FASES_TRAFO: { id: FaseTransformador; label: string }[] = [
  { id: "monofasico", label: "Monofásico" },
  { id: "trifasico", label: "Trifásico" },
];

/** Classes de tensão cadastradas (id estável + rótulo pt-BR). */
export const CLASSES_TENSAO_TRAFO: { id: string; label: string }[] = [
  { id: "15", label: "15 kV" },
  { id: "24.2", label: "24,2 kV" },
  { id: "36.2", label: "36,2 kV" },
];

/** Um transformador do catálogo. Só A, B e massa entram no cálculo. */
export interface TransformadorDim {
  kVA: number; // potência nominal
  A_mm: number; // DIM. A — lado da área frontal ao vento
  B_mm: number; // DIM. B — lado da área frontal ao vento
  massaKg: number; // massa estimada (vira força-peso no cálculo)
}

/**
 * TRANSFORMADORES[fase][classeId] → lista por potência.
 * Monofásico: transcrito das tabelas 15 / 24,2 / 36,2 kV.
 */
export const TRANSFORMADORES: Record<FaseTransformador, Record<string, TransformadorDim[]>> = {
  monofasico: {
    "15": [
      { kVA: 5, A_mm: 940, B_mm: 200, massaKg: 120 },
      { kVA: 10, A_mm: 970, B_mm: 200, massaKg: 155 },
      { kVA: 15, A_mm: 970, B_mm: 200, massaKg: 165 },
      { kVA: 25, A_mm: 970, B_mm: 200, massaKg: 235 },
      { kVA: 37.5, A_mm: 980, B_mm: 400, massaKg: 295 },
      { kVA: 50, A_mm: 980, B_mm: 400, massaKg: 375 },
      { kVA: 75, A_mm: 990, B_mm: 400, massaKg: 425 },
      { kVA: 100, A_mm: 1100, B_mm: 400, massaKg: 480 },
    ],
    "24.2": [
      { kVA: 5, A_mm: 950, B_mm: 200, massaKg: 130 },
      { kVA: 10, A_mm: 1030, B_mm: 200, massaKg: 165 },
      { kVA: 15, A_mm: 1090, B_mm: 200, massaKg: 190 },
      { kVA: 25, A_mm: 1100, B_mm: 200, massaKg: 250 },
      { kVA: 37.5, A_mm: 1130, B_mm: 200, massaKg: 305 },
      { kVA: 50, A_mm: 1250, B_mm: 400, massaKg: 390 },
      { kVA: 75, A_mm: 1270, B_mm: 400, massaKg: 450 },
      { kVA: 100, A_mm: 1320, B_mm: 400, massaKg: 510 },
    ],
    "36.2": [
      { kVA: 5, A_mm: 950, B_mm: 200, massaKg: 145 },
      { kVA: 10, A_mm: 1030, B_mm: 200, massaKg: 180 },
      { kVA: 15, A_mm: 1090, B_mm: 200, massaKg: 210 },
      { kVA: 25, A_mm: 1100, B_mm: 200, massaKg: 260 },
      { kVA: 37.5, A_mm: 1130, B_mm: 200, massaKg: 320 },
      { kVA: 50, A_mm: 1250, B_mm: 400, massaKg: 400 },
      { kVA: 75, A_mm: 1270, B_mm: 400, massaKg: 450 },
      { kVA: 100, A_mm: 1320, B_mm: 400, massaKg: 520 },
    ],
  },
  trifasico: {
    "15": [
      { kVA: 15, A_mm: 810, B_mm: 200, massaKg: 245 },
      { kVA: 30, A_mm: 820, B_mm: 200, massaKg: 290 },
      { kVA: 45, A_mm: 920, B_mm: 200, massaKg: 370 },
      { kVA: 75, A_mm: 1150, B_mm: 400, massaKg: 505 },
      { kVA: 112.5, A_mm: 1190, B_mm: 400, massaKg: 645 },
      { kVA: 150, A_mm: 1200, B_mm: 400, massaKg: 725 },
      { kVA: 225, A_mm: 1210, B_mm: 400, massaKg: 1025 },
      { kVA: 300, A_mm: 1270, B_mm: 400, massaKg: 1210 },
    ],
    "24.2": [
      { kVA: 15, A_mm: 950, B_mm: 200, massaKg: 255 },
      { kVA: 30, A_mm: 980, B_mm: 200, massaKg: 345 },
      { kVA: 45, A_mm: 1120, B_mm: 200, massaKg: 405 },
      { kVA: 75, A_mm: 1220, B_mm: 400, massaKg: 565 },
      { kVA: 112.5, A_mm: 1240, B_mm: 400, massaKg: 680 },
      { kVA: 150, A_mm: 1250, B_mm: 400, massaKg: 780 },
      { kVA: 225, A_mm: 1210, B_mm: 400, massaKg: 1150 },
      { kVA: 300, A_mm: 1270, B_mm: 400, massaKg: 1320 },
    ],
    "36.2": [
      { kVA: 15, A_mm: 950, B_mm: 200, massaKg: 270 },
      { kVA: 30, A_mm: 980, B_mm: 200, massaKg: 370 },
      { kVA: 45, A_mm: 1120, B_mm: 200, massaKg: 430 },
      { kVA: 75, A_mm: 1220, B_mm: 400, massaKg: 580 },
      { kVA: 112.5, A_mm: 1240, B_mm: 400, massaKg: 700 },
      { kVA: 150, A_mm: 1250, B_mm: 400, massaKg: 800 },
      { kVA: 225, A_mm: 1210, B_mm: 400, massaKg: 1150 },
      { kVA: 300, A_mm: 1270, B_mm: 400, massaKg: 1500 },
    ],
  },
};

/** Rótulo pt-BR da potência (5, 37,5, 100 …). */
export function rotuloKVA(kVA: number): string {
  return `${kVA.toString().replace(".", ",")} kVA`;
}

/** Rótulo da classe de tensão a partir do id. */
export function rotuloClasse(classeId: string): string {
  return CLASSES_TENSAO_TRAFO.find((c) => c.id === classeId)?.label ?? classeId;
}

/** Potências cadastradas para uma fase + classe (vazio se não houver). */
export function potenciasTrafo(fase: FaseTransformador, classeId: string): TransformadorDim[] {
  return TRANSFORMADORES[fase]?.[classeId] ?? [];
}

/** Acha o transformador exato (fase + classe + kVA), ou undefined. */
export function acharTransformador(
  fase: FaseTransformador,
  classeId: string,
  kVA: number,
): TransformadorDim | undefined {
  return potenciasTrafo(fase, classeId).find((t) => t.kVA === kVA);
}

// ---------------------------------------------------------------------------
// Especificação do poste com transformador (regra vigente)
// ---------------------------------------------------------------------------
/**
 * A partir da fase e da potência do transformador escolhido, o poste de suporte
 * é ESPECIFICADO diretamente (comprimento fixo + esforço mecânico nominal),
 * independentemente de o poste ser circular ou duplo T:
 *
 *   - Monofásico ......... 11 m · 300 daN (qualquer potência)
 *   - Trifásico ≤ 112,5 kVA .. 12 m · 600 daN
 *   - Trifásico > 112,5 kVA .. 12 m · 1000 daN
 *
 * Esta regra substitui, na versão atual, a verificação pelo método dos momentos
 * (mantida em standby no cálculo). O esforço aqui é a resistência nominal (Rn)
 * requerida do poste.
 */
export interface EspecificacaoTrafo {
  comprimentoM: number; // comprimento fixo do poste (m)
  esforcoDaN: number; // esforço mecânico / resistência nominal requerida (daN)
  criterio: string; // texto do critério aplicado (para o memorial e a UI)
}

/** Limite de potência (kVA) que separa as faixas de esforço no trifásico. */
export const LIMITE_KVA_TRIFASICO = 112.5;

/** Potência máxima (kVA) de transformador trifásico admitida em poste de PRFV. */
export const LIMITE_KVA_TRIFASICO_PRFV = 75;

/**
 * Especificação do poste de PRFV (protocolo próprio). Altura e esforço são
 * definidos direto pela fase e potência do transformador:
 *   - Monofásico ≤ 25 kVA .... 11 m · 600 daN
 *   - Monofásico ≥ 37,5 kVA .. 11 m · 1000 daN
 *   - Trifásico (só ≤ 75 kVA) .. 12 m · 1000 daN
 */
export function especificacaoTrafoPRFV(fase: FaseTransformador, kVA: number): EspecificacaoTrafo {
  if (fase === "monofasico") {
    if (kVA <= 25) {
      return {
        comprimentoM: 11,
        esforcoDaN: 600,
        criterio: "PRFV · monofásico ≤ 25 kVA → 11 m e 600 daN.",
      };
    }
    return {
      comprimentoM: 11,
      esforcoDaN: 1000,
      criterio: "PRFV · monofásico ≥ 37,5 kVA → 11 m e 1000 daN.",
    };
  }
  // Trifásico em PRFV: apenas ≤ 75 kVA (validado na entrada) → 12 m e 1000 daN.
  return {
    comprimentoM: 12,
    esforcoDaN: 1000,
    criterio: `PRFV · trifásico ≤ ${rotuloKVA(LIMITE_KVA_TRIFASICO_PRFV)} → 12 m e 1000 daN.`,
  };
}

/**
 * Especificação do poste (comprimento + esforço) para o transformador dado.
 * Quando `prfv` é verdadeiro, aplica o protocolo de PRFV.
 */
export function especificacaoTrafo(
  fase: FaseTransformador,
  kVA: number,
  prfv = false,
): EspecificacaoTrafo {
  if (prfv) return especificacaoTrafoPRFV(fase, kVA);
  if (fase === "monofasico") {
    return {
      comprimentoM: 11,
      esforcoDaN: 300,
      criterio: "Monofásico → 11 m e 300 daN (independe de circular ou duplo T).",
    };
  }
  if (kVA <= LIMITE_KVA_TRIFASICO) {
    return {
      comprimentoM: 12,
      esforcoDaN: 600,
      criterio: `Trifásico ≤ ${rotuloKVA(LIMITE_KVA_TRIFASICO)} → 12 m e 600 daN.`,
    };
  }
  return {
    comprimentoM: 12,
    esforcoDaN: 1000,
    criterio: `Trifásico > ${rotuloKVA(LIMITE_KVA_TRIFASICO)} → 12 m e 1000 daN.`,
  };
}
