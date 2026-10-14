/**
 * Dimensionamento sequencial de postes — fluxo guiado (v2).
 *
 * Com as amarras do projeto fixadas (velocidade do vento pela coordenada e
 * condutor únicos para toda a obra), cada poste é dimensionado combinando:
 *
 *   1. Ação do vento sobre o próprio poste (item 6.2.1.2): Fp = Pvp · Sp,
 *      aplicada no centroide do trapézio e transferida para 10 cm do topo
 *      (item 6.3.2): Fp,topo = Fp · H / h.
 *   2. Ação do vento sobre os condutores (item 6.2.1.3):
 *      Fc = Cc · a · cos(α/2) · nº de fases, já referida ao topo. O cabo é
 *      cilíndrico: Cc usa sempre Pvp = 0,00471·v², qualquer que seja o poste.
 *   3. Tração de projeto dos condutores (POR CONDUTOR; no poste,
 *      T = T_condutor · nº de fases): tabelas de tração de montagem (vão ×
 *      temperatura de projeto, sem vento — `tracao-tabelada.ts`); cabos sem
 *      tabela (CAL) usam TRACOES_PROJETO ou a tração informada. Somada ao vento
 *      no poste e nos cabos como manda a GED-3648 (item 6.2.1.1):
 *      - deflexão (α > 0): resultante R = T · 2·sen(α/2), na bissetriz — mesma
 *        direção do vento transversal, então F = vento + R;
 *      - derivação: F = vento + T, soma direta (critério do projetista);
 *      - fim de linha: a tração T fica sem
 *        contrapeso. Como no Exemplo 1 do item 6.3.2, verificam-se as duas
 *        situações e vale a MAIOR: (1) vento perpendicular à tração,
 *        F = √(T² + vento²), com o vento nos cabos sobre metade do vão (item
 *        6.2.1.3); (2) vento no sentido da tração, F = T + vento no poste;
 *      - alinhamento (α = 0): as trações dos dois lados se anulam — só vento.
 *
 * O esforço total F é comparado com a resistência nominal (Rn) do poste
 * escolhido no catálogo.
 */
import {
  alturaUtil,
  alturaUtilTopo,
  areaCruzeta,
  areaSuperficie,
  coeficienteCabo,
  engastamento,
  esforcoEstaiPoste,
  esforcoTransferidoTopo,
  getDiametroCondutor,
  getDimensoes,
  getPesoCondutor,
  momentoResistenteBase,
  momentoResistenteMyA,
  pontoDeAplicacao,
  postes,
  pressaoVento,
  resultanteForcasIguais,
  resultantePerpendicular,
  tracaoProjetoFeixe,
} from "./validador";
import type { CruzetaPeso } from "./validador";
import { especificacaoTrafo, type EspecificacaoTrafo, type FaseTransformador } from "./transformadores";
import { tracaoTabelada, type TracaoTabelada } from "./tracao-tabelada";

/** Temperatura de projeto usada quando o projeto salvo não tem uma (°C). */
export const TEMP_PROJETO_PADRAO = 25;

/**
 * Vão regulador (m) de um trecho entre ancoragens: ar = √(Σa³ / Σa). A tração
 * de todo o trecho é a da tabela nesse vão.
 */
export function vaoRegulador(vaos: number[]): number {
  const soma = vaos.reduce((acc, a) => acc + a, 0);
  const somaCubos = vaos.reduce((acc, a) => acc + a ** 3, 0);
  return Math.sqrt(somaCubos / soma);
}

/** Limiar de utilização padrão (%) quando o projetista não define outro. */
export const LIMIAR_PADRAO = 100;

/**
 * Aceleração da gravidade adotada (m/s²) para converter a massa (kg) do
 * transformador em força-peso: peso[daN] = massa[kg] · g / 10.
 * Adotado g ≈ 10 → peso[daN] = massa (força-peso em daN igual ao número da
 * massa em kg; 1 kgf ≈ 1 daN). Ponto único de ajuste — para o valor físico,
 * usar 9,80665.
 */
export const G_M_S2 = 10;
/** Fator kg-massa → força-peso em daN (g / 10). Com g ≈ 10, vale 1. */
const KG_PARA_DAN = G_M_S2 / 10;

/**
 * Altura de fixação do transformador acima do solo (m). A verificação do poste
 * com transformador (método dos momentos) avalia a seção a essa altura; como o
 * x da reta A é medido do topo, x = altura livre − ALTURA_TRAFO_M. Ponto único
 * de ajuste, caso a altura padrão de fixação mude.
 */
export const ALTURA_TRAFO_M = 7;

/**
 * Distâncias horizontais (m) dos condutores ao eixo do poste, usadas no momento
 * do peso próprio dos cabos (MR). Adotadas fixas: d1 = 0,90 m, d2 = 0,30 m,
 * d3 = 0,60 m. Entram tantas quantas forem as fases do poste (1 → só d1;
 * 2 → d1, d2; 3 → d1, d2, d3). Ponto único de ajuste.
 */
export const DISTANCIAS_CONDUTOR_M = [0.9, 0.3, 0.6];

/**
 * Braço do peso da cruzeta (dcp) = metade do comprimento + 5% do comprimento
 * total = 0,55 · L. Ex.: cruzeta de 2000 mm → 0,55 · 2 = 1,10 m.
 */
export const FATOR_DCP = 0.55;

/**
 * Peso do isolador (kg) por classe de tensão da linha — usado no MF. Flag
 * própria (15 / 25 / 35 kV), independente da classe do transformador
 * (15 / 24,2 / 36,2 kV), conforme informado pelo usuário.
 */
export const ISOLADORES_MF: { classe: string; label: string; pesoKg: number }[] = [
  { classe: "15", label: "15 kV", pesoKg: 1.85 },
  { classe: "25", label: "25 kV", pesoKg: 2.85 },
  { classe: "35", label: "35 kV", pesoKg: 3.45 },
];

/** Peso do isolador (kg) da classe escolhida; `null` se não cadastrada. */
export function pesoIsoladorMF(classe: string | undefined): number | null {
  return ISOLADORES_MF.find((i) => i.classe === classe)?.pesoKg ?? null;
}

/**
 * MA — momento resistente no topo (daN·m) — adotado na verificação do poste com
 * transformador, SOMENTE para postes de concreto DUPLO T. Os valores foram
 * informados em ordem crescente de esforço: para cada altura, o poste de menor
 * Rn recebe 400, o seguinte 600 e todos os demais 900. Postes duplo T de 13 m
 * ou mais seguem a mesma sequência. Postes circulares não têm tabela — nesses
 * casos o MA é informado à mão pelo projetista.
 */
const MA_TRAFO_DUPLO_T = [400, 600, 900];

/**
 * MA da tabela para um poste duplo T (altura + Rn). `null` quando o poste não é
 * duplo T ou a combinação não está no catálogo — aí o MA vem do projetista.
 */
export function maTransformadorDuploT(
  tipoFisico: string,
  comprimento: number,
  resistencia: number,
): number | null {
  if (tipoFisico !== "duplo T") return null;
  const classes = Object.keys(postes["duplo T"]?.[String(comprimento)] ?? {})
    .map(Number)
    .sort((a, b) => a - b);
  const i = classes.indexOf(resistencia);
  if (i < 0) return null;
  return MA_TRAFO_DUPLO_T[Math.min(i, MA_TRAFO_DUPLO_T.length - 1)];
}

// ---------------------------------------------------------------------------
// Poste de amarração (estabilizador geral da rede)
// ---------------------------------------------------------------------------
/**
 * O poste de amarração é um poste âncora que alivia os esforços mecânicos da
 * rede. Seu esforço não é calculado pelo vento: é TABELADO pela bitola do cabo
 * do projeto — cabos abaixo de 4/0 usam 600 daN; 4/0 ou acima, 1000 daN.
 */
export const ESFORCO_AMARRACAO_ABAIXO_4_0 = 600; // daN — cabo < 4/0
export const ESFORCO_AMARRACAO_4_0_ACIMA = 1000; // daN — cabo ≥ 4/0

/** Área (kcmil) da bitola 4/0 AWG — limiar da tabela de esforço de amarração. */
export const KCMIL_4_0 = 211.6;

/**
 * Áreas (kcmil) das bitolas AWG do catálogo, para ordená-las por seção e
 * compará-las ao 4/0. Bitolas já expressas em MCM/kcmil ("266.8", "336.4")
 * dispensam a tabela — o próprio número é a área.
 */
const AWG_KCMIL: Record<string, number> = {
  "2": 66.36, "1": 83.69, "1/0": 105.6, "2/0": 133.1, "3/0": 167.8, "4/0": 211.6,
};

/** Converte a bitola (AWG "4/0" ou kcmil "336.4") em área em kcmil. */
export function bitolaEmKcmil(awg: string): number {
  const s = awg.trim();
  const conhecida = AWG_KCMIL[s];
  if (conhecida !== undefined) return conhecida;
  const n = Number(s.replace(",", "."));
  return Number.isNaN(n) ? 0 : n; // "266.8", "336.4" → já em kcmil
}

/** Esforço tabelado do poste de amarração (daN) para a bitola do projeto. */
export function esforcoAmarracao(awg: string): number {
  return bitolaEmKcmil(awg) >= KCMIL_4_0
    ? ESFORCO_AMARRACAO_4_0_ACIMA
    : ESFORCO_AMARRACAO_ABAIXO_4_0;
}

/** Especificação do poste de amarração — esforço tabelado + altura herdada. */
export interface EspecAmarracao {
  esforcoDaN: number; // 600 (< 4/0) ou 1000 (≥ 4/0)
  comprimentoM: number; // altura, herdada dos postes da linha
  cabo: string; // rótulo do cabo do projeto (tipo + bitola)
  abaixo4_0: boolean; // true: bitola abaixo de 4/0 (→ 600 daN)
  criterio: string; // texto do critério aplicado (memorial e UI)
}

/** Monta a especificação do poste de amarração para o cabo do projeto. */
export function especificacaoAmarracao(
  tipoCabo: string,
  awg: string,
  comprimentoM: number,
): EspecAmarracao {
  const abaixo = bitolaEmKcmil(awg) < KCMIL_4_0;
  const esforcoDaN = abaixo ? ESFORCO_AMARRACAO_ABAIXO_4_0 : ESFORCO_AMARRACAO_4_0_ACIMA;
  return {
    esforcoDaN,
    comprimentoM,
    cabo: `${tipoCabo} ${awg}`,
    abaixo4_0: abaixo,
    criterio: abaixo
      ? `Cabo ${tipoCabo} ${awg} (abaixo de 4/0) → poste de amarração de ${ESFORCO_AMARRACAO_ABAIXO_4_0} daN.`
      : `Cabo ${tipoCabo} ${awg} (4/0 ou acima) → poste de amarração de ${ESFORCO_AMARRACAO_4_0_ACIMA} daN.`,
  };
}

// ---------------------------------------------------------------------------
// Tipos de estrutura do poste
// ---------------------------------------------------------------------------
/**
 * Cada tipo pode acrescentar esforços ao poste (todos referidos ao topo e
 * somados ao Ftotal):
 *   - Derivação: poste implantado (esforço informado) ou novo (vento calculado),
 *     sempre somando o vento na cruzeta, mais a tração do cabo do projeto
 *     somada direto (F = vento + T).
 *   - Poste com transformador: soma o esforço do transformador informado.
 *   - Circuito duplo: soma o vento no condutor do circuito extra + a cruzeta.
 *   - Passagem, Com ângulo e Cruzamento: só o poste + condutores (modelo base).
 */
export const ESTRUTURAS = [
  { id: "derivacao", label: "Derivação", descricao: "A rede se ramifica em outro circuito neste poste." },
  { id: "transformador", label: "Postes com equipamentos", descricao: "Sustenta um transformador de distribuição." },
  { id: "passagem", label: "Passagem", descricao: "Poste de alinhamento, sem mudança de direção." },
  { id: "angulo", label: "Com ângulo", descricao: "A linha muda de direção neste poste." },
  { id: "circuito_duplo", label: "Circuito duplo", descricao: "Dois circuitos no poste — condutor extra e cruzeta." },
  { id: "cruzamento", label: "Cruzamento", descricao: "Cruza outra linha, via ou travessia." },
  { id: "amarracao", label: "Amarração", descricao: "Poste âncora — estabiliza a rede e alivia os esforços mecânicos." },
  { id: "fim_linha", label: "Fim de linha", descricao: "Último poste — a linha termina aqui e a tração dos cabos fica sem contrapeso." },
] as const;

export type EstruturaId = (typeof ESTRUTURAS)[number]["id"];

/** Ids antigos → atuais (compatibilidade com projetos já salvos). */
const ESTRUTURA_LEGADA: Record<string, EstruturaId> = { circuito_unico: "circuito_duplo" };

export function estruturaPorId(id: string) {
  const alvo = ESTRUTURA_LEGADA[id] ?? id;
  return ESTRUTURAS.find((e) => e.id === alvo) ?? ESTRUTURAS[0];
}

// ---------------------------------------------------------------------------
// Tração de projeto dos condutores
// ---------------------------------------------------------------------------
/**
 * Como a tração de projeto entra no poste:
 *   "fim"      → derivação e fim de linha: T sem contrapeso, ao longo da linha;
 *   "deflexao" → passagem, com ângulo e circuito duplo com α > 0: T · 2·sen(α/2);
 *   null       → alinhamento (α = 0) — as trações se anulam —, ou poste especificado.
 */
export type ModoTracao = "fim" | "deflexao";

/**
 * Chave geral da tração de projeto. Com false, o esforço do poste é só o vento.
 */
export const TRACAO_NO_CALCULO = true;

export function modoTracao(estrutura: EstruturaId, alfa: number): ModoTracao | null {
  if (!TRACAO_NO_CALCULO) return null;
  if (estrutura === "derivacao" || estrutura === "fim_linha") return "fim";
  if ((estrutura === "passagem" || estrutura === "angulo" || estrutura === "circuito_duplo") && alfa > 0) return "deflexao";
  return null;
}

/**
 * Poste que fecha um trecho de tração: fim de linha, amarração, derivação e,
 * quando ancorados, ângulo e circuito duplo. As pontas da linha também fecham.
 */
export function ehAncoragem(e: Pick<EntradaPoste, "estrutura" | "ancorado">): boolean {
  if (e.estrutura === "fim_linha" || e.estrutura === "amarracao" || e.estrutura === "derivacao") return true;
  return (e.estrutura === "angulo" || e.estrutura === "circuito_duplo") && e.ancorado === true;
}

/** Trecho da linha entre ancoragens e seu vão regulador. */
export interface TrechoTracao {
  de: number; // índice do poste que abre o trecho
  ate: number; // índice do poste que fecha o trecho
  vaos: (number | null)[]; // m — vãos à ré dos postes de+1 … ate (null = não informado)
  /** m — √(Σa³/Σa); null quando falta algum vão à ré. */
  ar: number | null;
}

/**
 * Trechos de tração de cada poste da linha: um para os postes do meio do
 * trecho, dois para as ancoragens internas (o de ré e o de vante). Uma linha de
 * um poste só não tem trecho.
 */
export function trechosDaLinha(entradas: Pick<EntradaPoste, "estrutura" | "ancorado" | "vaoRe">[]): TrechoTracao[][] {
  const trechos: TrechoTracao[] = [];
  let de = 0;
  for (let i = 1; i < entradas.length; i++) {
    if (i < entradas.length - 1 && !ehAncoragem(entradas[i])) continue;
    const vaos = entradas.slice(de + 1, i + 1).map((e) => (typeof e.vaoRe === "number" && e.vaoRe > 0 ? e.vaoRe : null));
    const completos = vaos.filter((a): a is number => a !== null);
    trechos.push({ de, ate: i, vaos, ar: completos.length === vaos.length ? vaoRegulador(completos) : null });
    de = i;
  }
  return entradas.map((_, i) => trechos.filter((t) => t.de <= i && i <= t.ate));
}

/** Parcela da tração no poste (nula quando a tração não entra). */
export interface TracaoPoste {
  modo: ModoTracao;
  /**
   * Tração de projeto POR CONDUTOR (por fase) do circuito principal (daN) — das
   * tabelas de montagem ou, para cabo sem tabela, da tabela fixa / informada.
   */
  Tcondutor: number;
  fonte: "tabelada" | "tabela" | "informada";
  /** Memória da tabela de montagem (fonte "tabelada"); nula nas demais. */
  tabelada: TracaoTabelada | null;
  /**
   * Trechos de tração do poste. A tração sai do vão regulador do trecho; na
   * ancoragem entre dois trechos, do que dá a maior. Sem trecho completo, do
   * vão do próprio poste.
   */
  trechos: TrechoTracao[];
  /** Tração dos nFases condutores do poste = Tcondutor · nFases (daN). */
  T: number;
  /** Resultante do circuito principal: T·2·sen(α/2) (deflexão) ou T (fim). */
  R: number;
  /**
   * Início/fim de linha (item 6.3.2, Exemplo 1): situação 1 = vento
   * perpendicular à tração, √(T² + vento²); situação 2 = vento no sentido da
   * tração, T + vento no poste. Vale a maior. Nulos na deflexão.
   */
  situacao1: number | null;
  situacao2: number | null;
  governa: 1 | 2 | null;
  /** Circuito duplo: tração dos condutores extras e sua resultante (deflexão). */
  Textra: number | null;
  Rextra: number | null;
  fonteExtra: TracaoPoste["fonte"] | null;
  tabeladaExtra: TracaoTabelada | null;
  /** Soma das resultantes de tração (daN). */
  Rtotal: number;
  /**
   * Derivação: F = vento + T (soma direta). Nos demais, false.
   */
  somaDireta: boolean;
}

// ---------------------------------------------------------------------------
// Derivação: verificação do poste existente
// ---------------------------------------------------------------------------
/**
 * A derivação é sempre o poste 01 da nova rede: um poste EXISTENTE da rede de
 * onde ela sai. O projetista informa o poste (tipo, altura, Rn), a rede que já
 * passa nele e o lado de esforço usado; o cálculo diz se o poste suporta a
 * nova rede e, se não, o que fazer.
 *
 * Geometria (vista de topo): eixo x ao longo da rede existente — no fim de
 * linha, no sentido do vão existente. A derivação sai no ângulo θ desse eixo.
 *   - Tração existente: passagem → se anula; ângulo α → T·2·sen(α/2) na
 *     bissetriz (eixo y); fim de linha → T inteira no eixo x.
 *   - Tração nova: T da nova rede, sem contrapeso, na direção θ. Na passagem e
 *     no ângulo o lado da derivação não é conhecido: adota-se o mais
 *     desfavorável (θ dobrado para 0–90°, do lado da bissetriz).
 *   - Vento: varre-se a direção φ do vento (passo de 1°). Poste e cruzeta
 *     recebem o vento inteiro; cada feixe, a parcela |sen(φ − ψ)| do seu vento
 *     transversal (ψ = direção da linha). Vale a maior |R_tração + vento(φ)|.
 * Capacidade: duplo T — lado maior = Rn, lado menor = Rn/2; circular — Rn.
 */
export type SituacaoRedeExistente = "passagem" | "angulo" | "fim_linha";

export const SITUACOES_REDE_EXISTENTE: { id: SituacaoRedeExistente; label: string; descricao: string }[] = [
  { id: "passagem", label: "Passagem", descricao: "A rede existente segue reta — sua tração se anula." },
  { id: "angulo", label: "Com ângulo", descricao: "A rede existente muda de direção neste poste." },
  { id: "fim_linha", label: "Fim de linha", descricao: "A rede existente termina neste poste." },
];

/** Rede existente no poste de derivação (dados informados pelo projetista). */
export interface RedeExistente {
  tipoCabo: string;
  awg: string;
  nFases: number;
  situacao: SituacaoRedeExistente;
  alfa: number; // graus — deflexão da rede existente (só "angulo")
  vao: number; // m — vão médio da rede existente
  anguloDerivacao: number; // graus — θ entre a derivação e a rede existente
  lado: "maior" | "menor"; // lado de esforço do poste usado para derivar
  /** Tração por condutor (daN) do cabo existente, quando ele não tem tabela. */
  tracaoInformada?: number;
}

/** O que fazer quando o poste existente não suporta a derivação (em ordem). */
export interface SolucoesDerivacao {
  /** Lado menor escolhido, mas o lado maior (Rn) atende: girar o poste. */
  girar: boolean;
  /** Estai de contraposição: faixa de altura (m) que deixa |Fr| ≤ capacidade. */
  estai: { heMin: number; heMax: number } | null;
  /** Menor poste do catálogo, mesmo tipo e altura, que atende. */
  posteSugerido: { resistencia: number; lado: "maior" | "menor" } | null;
}

export interface VerificacaoDerivacao {
  rede: RedeExistente;
  // Tração da rede existente
  TcondExistente: number; // daN por condutor
  fonteExistente: TracaoPoste["fonte"];
  tabeladaExistente: TracaoTabelada | null;
  Texistente: number; // daN — × nº de fases
  Rexistente: number; // daN — parcela que fica no poste (0 na passagem)
  // Tração da nova rede (cabo do projeto)
  TcondNova: number;
  fonteNova: TracaoPoste["fonte"];
  tabeladaNova: TracaoTabelada | null;
  trechos: TrechoTracao[];
  Tnova: number; // daN — × nº de fases
  Rtracao: number; // daN — |soma vetorial das trações|
  // Vento (todos no topo)
  FpTopo: number;
  Fcruzeta: number;
  dExistente: number; // mm
  FcExistente: number; // daN — feixe existente, transversal à rede existente
  FcNova: number; // daN — feixe novo (metade do vão), transversal à derivação
  phiCritico: number; // graus — direção do vento que governa (a partir do eixo x)
  F: number; // daN — esforço resultante no topo
  // Verificação
  circular: boolean;
  capacidade: number; // daN — Rn ou Rn/2 conforme o lado
  atende: boolean;
  solucoes: SolucoesDerivacao;
}

/** Capacidade do poste no lado escolhido (circular não tem lado). */
export function capacidadeLado(tipoFisico: string, Rn: number, lado: "maior" | "menor"): number {
  return tipoFisico === "circular" || lado === "maior" ? Rn : Rn / 2;
}

/**
 * Esforço resultante no poste de derivação: soma vetorial das trações com o
 * vento na direção mais desfavorável. Ângulos em graus.
 */
export function esforcoDerivacao(p: {
  situacao: SituacaoRedeExistente;
  Rexistente: number;
  Tnova: number;
  theta: number;
  FpTopo: number;
  Fcruzeta: number;
  FcExistente: number;
  FcNova: number;
}): { Rtracao: number; F: number; phiCritico: number } {
  const rad = Math.PI / 180;
  // Passagem/ângulo: lado desconhecido → θ dobrado para 0–90° (pior caso).
  const th = p.situacao === "fim_linha" ? p.theta : Math.min(p.theta, 180 - p.theta);
  const ex = p.situacao === "fim_linha" ? [p.Rexistente, 0] : [0, p.Rexistente];
  const Rx = ex[0] + p.Tnova * Math.cos(th * rad);
  const Ry = ex[1] + p.Tnova * Math.sin(th * rad);
  let F = -Infinity;
  let phiCritico = 0;
  for (let phi = 0; phi < 360; phi++) {
    const W =
      p.FpTopo + p.Fcruzeta +
      p.FcExistente * Math.abs(Math.sin(phi * rad)) +
      p.FcNova * Math.abs(Math.sin((phi - th) * rad));
    const f = Math.hypot(Rx + W * Math.cos(phi * rad), Ry + W * Math.sin(phi * rad));
    if (f > F) {
      F = f;
      phiCritico = phi;
    }
  }
  return { Rtracao: Math.hypot(Rx, Ry), F, phiCritico };
}

// ---------------------------------------------------------------------------
// Entrada e memória de cálculo de um poste
// ---------------------------------------------------------------------------

/** Cruzeta escolhida (Derivação e Circuito duplo) — dimensões da face ao vento. */
export interface CruzetaSel {
  material: string; // chave de CRUZETAS_DIM
  formato: string;
  Lmm: number; // comprimento (mm)
  cmm: number; // altura da face ao vento (mm)
}

/** Condutor do circuito extra (Circuito duplo). */
export interface CircuitoExtra {
  tipoCabo: string;
  awg: string;
  nFases: number;
}

/**
 * Transformador escolhido (Poste com transformador) — seleção afunilada
 * fase → classe de tensão → potência. A, B e massa vêm do catálogo e são
 * congeladas na entrada do poste para o cálculo do esforço resultante.
 */
export interface TransformadorSel {
  fase: FaseTransformador;
  classe: string; // id da classe de tensão (ex.: "15", "24.2", "36.2")
  kVA: number;
  A_mm: number; // DIM. A — lado da área frontal ao vento
  B_mm: number; // DIM. B — lado da área frontal ao vento
  massaKg: number; // massa estimada (vira força-peso)
  /** Poste de PRFV: altura e esforço seguem o protocolo próprio de PRFV. */
  prfv?: boolean;
}

export interface EntradaPoste {
  estrutura: EstruturaId;
  /** Tipo físico do poste: "circular" | "duplo T" (chaves de `postes`). */
  tipoFisico: string;
  comprimento: number; // m
  resistencia: number; // daN — resistência nominal Rn do catálogo
  vao: number; // m — vão médio (a)
  /**
   * Vão à ré (m): distância até o poste anterior da linha. Com os demais vãos do
   * trecho entre ancoragens, dá o vão regulador da tração tabelada.
   * Ausente no primeiro poste e nos postes salvos antes do campo.
   */
  vaoRe?: number;
  /** Ângulo e circuito duplo: estrutura ancorada — fecha o trecho de tração. */
  ancorado?: boolean;
  alfa: number; // graus — ângulo de deflexão (0 = alinhamento reto)
  nFases: number; // 1 | 2 | 3
  /** Limiar de utilização (%) aceito pelo projetista para este poste. */
  limiarPct: number;
  /** Altura do estai (m). Presente = poste estaiado (item 6.3.3). */
  estaiHe?: number;

  // --- Origem da linha (só o primeiro poste) ---
  /** Poste 01: parte de uma derivação já existente? */
  derivacaoExistente?: boolean;
  /** Poste 01: esforço nominal (daN) do poste de origem de onde a linha deriva. */
  esforcoOrigemDerivacao?: number;
  /**
   * Poste 01: lado do poste de origem em que a linha deriva. O lado de MAIOR
   * esforço vale a resistência nominal do poste de origem; o de MENOR esforço,
   * a metade. Esse lado é a base da rede — o poste de derivação não pode ter
   * esforço inferior a ele.
   */
  ladoOrigemDerivacao?: "maior" | "menor";

  // --- Especificações por tipo de estrutura (só as que se aplicam) ---
  /**
   * Derivação (poste 01): rede existente no poste. Presente = verificação do
   * poste existente; o poste (tipo, altura, Rn) é o existente e vão/nFases são
   * os da nova rede. Ausente = derivação salva no modelo antigo.
   */
  redeExistente?: RedeExistente;
  /** Derivação: poste já implantado? (informa o esforço em vez de calcular o vento no poste). */
  derivImplantado?: boolean;
  /** Derivação implantada: esforço do poste informado pelo projetista (daN). */
  esforcoPosteInformado?: number;
  /** Transformador: seleção guiada (fase → classe → potência) do catálogo. */
  transformador?: TransformadorSel;
  /**
   * Transformador: momento resistente no topo MA (daN·m). Para postes duplo T
   * vem da tabela (`maTransformadorDuploT`); para circulares, informado à mão.
   */
  trafoMA?: number;
  /** Transformador: braço horizontal (b + d) do peso do trafo (m). */
  trafoBD?: number;
  /** Transformador: cruzeta escolhida (peso próprio p/ os momentos MR e MF). */
  trafoCruzeta?: CruzetaPeso;
  /** Transformador: classe de tensão do isolador (id em ISOLADORES_MF) — p/ MF. */
  trafoClasseIsolador?: string;
  /** Transformador: peso da chave (kg) — p/ MF. */
  trafoPchave?: number;
  /** Circuito duplo: condutor do circuito extra. */
  circuitoExtra?: CircuitoExtra;
  /** Cruzeta (Derivação e Circuito duplo). */
  cruzeta?: CruzetaSel;
  /**
   * Tração de projeto por condutor (daN) informada pelo projetista —
   * só quando o cabo do projeto não está em TRACOES_PROJETO.
   */
  tracaoInformada?: number;
  /** Idem, para o cabo do circuito extra (Circuito duplo). */
  tracaoExtraInformada?: number;
}

/**
 * Verificação do poste com transformador pelo método dos momentos (NBR 8451,
 * item 6.3.3). O momento resistente da seção segue a reta A (MyA); o momento
 * solicitante é o do peso do transformador no seu braço (MT), somado ao momento
 * do peso próprio dos condutores e da cruzeta (MR) e ao do vento nos condutores
 * (MF) — MF ainda 0. O poste é adequado quando Mposte > M7m; senão, subir a
 * resistência do poste.
 */
export interface MomentoTransformador {
  h: number; // m — altura livre (0,9·L − 0,6)
  MB: number; // daN·m — momento na base Me = Rn·h
  Mb: number; // daN·m — 0,7·MB
  MA: number; // daN·m — momento resistente no topo
  maTabelado: boolean; // true: MA veio da tabela duplo T; false: informado à mão
  x: number; // m — seção avaliada, medida do topo = h − 7
  Mposte: number; // daN·m — momento resistente na seção (reta A)
  peso: number; // daN — força-peso do transformador (massa · g)
  bd: number; // m — braço horizontal (b + d)
  MT: number; // daN·m — momento do transformador = peso · (b + d)
  // MF = peso dos isoladores + chave (por fase) + 2·cruzeta (item detalhado):
  MF: number; // daN·m — Σ((Pi+pchave)·dᵢ) + 2·Pcr·dcp
  Pi: number; // daN — peso do isolador (por classe de tensão)
  pchave: number; // daN — peso da chave
  mfIsoladores: number; // daN·m — Σ((Pi+pchave)·dᵢ)
  mfCruzeta: number; // daN·m — 2·Pcr·dcp
  // MR = peso próprio dos condutores + da cruzeta (item detalhado):
  MR: number; // daN·m — Σ(2·A·dᵢ) + Pcr·dcp
  A: number; // daN — peso de um vão de condutor (vão · peso/m)
  nCondutores: number; // nº de parcelas de condutor (= nº de fases)
  distancias: number[]; // m — dᵢ usadas (as nFases primeiras de [0,9; 0,3; 0,6])
  mrCondutores: number; // daN·m — Σ(2·A·dᵢ)
  Pcr: number; // daN — peso da cruzeta
  dcp: number; // m — braço do peso da cruzeta (0,55·L)
  mrCruzeta: number; // daN·m — Pcr · dcp
  M7m: number; // daN·m — momento solicitante = MT + MF + MR
  aprovado: boolean; // Mposte > M7m
}

export interface MemoriaCalculo {
  dt: number; // mm
  ds: number; // mm
  engaste: number; // m
  hLivre: number; // m — altura livre (área do poste)
  hTopo: number; // m — altura útil a 10 cm do topo (L − E − 0,10)
  Pvp: number; // daN/m²
  Sp: number; // m²
  Fp: number; // daN — vento no poste
  H: number; // m — ponto de aplicação de Fp
  FpTopo: number; // daN — Fp transferido a 10 cm do topo
  d: number; // mm — diâmetro do condutor
  Cc: number; // daN/m por condutor
  Fv: number; // daN — vento por condutor
  Fc: number; // daN — vento no feixe (nº fases)

  // Composição do esforço por tipo de estrutura (todos referidos ao topo)
  esforcoPoste: number; // daN — contribuição base do poste (Fc+FpTopo, ou informado)
  posteInformado: boolean; // true: esforcoPoste veio do projetista (derivação implantada)
  Fcruzeta: number | null; // daN — vento na cruzeta
  cruzetaArea: number | null; // m² — face da cruzeta ao vento
  // Poste com transformador (regra vigente): o poste é especificado direto pela
  // fase + potência (comprimento fixo + esforço mecânico). Nulo quando não é
  // poste de transformador.
  especTrafo: EspecificacaoTrafo | null;
  // Poste de amarração (estabilizador da rede): esforço tabelado pela bitola do
  // cabo do projeto (600 / 1000 daN) e altura herdada dos postes da linha. Nulo
  // quando o poste não é de amarração.
  especAmarracao: EspecAmarracao | null;
  // Poste com transformador (STANDBY): verificação pelo método dos momentos,
  // desativada na versão atual — permanece nula enquanto a regra de
  // especificação acima estiver em vigor.
  momentoTrafo: MomentoTransformador | null;
  Fextra: number | null; // daN — vento no condutor do circuito extra
  dExtra: number | null; // mm — diâmetro do condutor extra
  CcExtra: number | null; // daN/m — coeficiente do condutor extra

  // Soma das ações de vento no topo (poste + condutores + cruzeta + extra).
  Fvento: number; // daN
  // Tração de projeto dos condutores — nula no alinhamento (α = 0) e nos
  // postes especificados. Ftotal = Fvento + Rtotal (deflexão) ou
  // √(Fvento² + Rtotal²) (início/fim de linha).
  tracao: TracaoPoste | null;
  // Derivação (poste existente): verificação completa; nula nos demais postes.
  derivacao: VerificacaoDerivacao | null;

  Ftotal: number; // daN — soma de todas as contribuições
  utilizacao: number; // Ftotal / Rn (esforço bruto do poste)

  // Limiar do projetista e esforço que efetivamente governa a aprovação
  limiarPct: number; // % — limiar ecoado
  esforcoEfetivo: number; // daN — Ftotal, ou |Fr| quando estaiado
  utilizacaoEfetiva: number; // esforcoEfetivo / Rn

  // Lados do poste (esforço direcional). O Rn do catálogo é o esforço do lado de
  // MAIOR esforço; o lado de MENOR esforço vale a metade (Rn/2). O esforço
  // calculado é o mínimo requerido e define de que lado o poste precisa ficar —
  // orientando ao projetista o sentido de posicionamento.
  ladoMaior: number; // daN — Rn (lado de maior esforço)
  ladoMenor: number; // daN — Rn/2 (lado de menor esforço)
  /**
   * Lado exigido pelo esforço efetivo:
   *   "menor"  → cabe no lado de menor esforço (posição livre);
   *   "maior"  → só cabe no lado de maior esforço (posicionar esse lado p/ a resultante);
   *   "excede" → nem o lado de maior esforço atende (subir a classe).
   * Null quando não se aplica (poste especificado por transformador).
   */
  ladoRequerido: "menor" | "maior" | "excede" | null;

  // Origem da linha (só o primeiro poste, quando deriva de poste existente).
  // A base da rede é o lado do poste de origem escolhido: o de MAIOR esforço
  // vale a resistência nominal informada; o de MENOR, a metade. O poste de
  // derivação precisa ter esforço ≥ a essa base.
  baseOrigemDerivacao: number | null; // daN — esforço do lado de origem
  ladoOrigemDerivacao: "maior" | "menor" | null; // lado escolhido na origem
  atendeOrigemDerivacao: boolean | null; // resistência do poste ≥ base?

  // Estai (item 6.3.3) — nulos quando o poste não é estaiado
  estaiado: boolean;
  estaiHe: number | null; // m — altura do estai
  Fe: number | null; // daN — força absorvida pelo estai
  Fr: number | null; // daN — reação residual na base (com sinal)

  aprovado: boolean; // utilizacaoEfetiva ≤ limiar
}

/**
 * Executa o dimensionamento de um poste com as amarras do projeto. `tempC` é a
 * temperatura de projeto da tabela de tração; `trechos` são os trechos de
 * tração do poste na linha (`trechosDaLinha`).
 */
export function dimensionarPoste(
  vKmh: number,
  tipoCabo: string,
  awg: string,
  e: EntradaPoste,
  tempC: number = TEMP_PROJETO_PADRAO,
  trechos: TrechoTracao[] = [],
): MemoriaCalculo {
  const { dt, ds } = getDimensoes(e.tipoFisico, e.comprimento, e.resistencia);
  const hLivre = alturaUtil(e.comprimento);
  const hTopo = alturaUtilTopo(e.comprimento);

  const Pvp = pressaoVento(e.tipoFisico, vKmh);
  const Sp = areaSuperficie(dt, ds, hLivre);
  const Fp = Pvp * Sp;
  const H = pontoDeAplicacao(dt, ds, hLivre);
  const FpTopo = esforcoTransferidoTopo(Fp, H, hTopo);

  const cosMeioAlfa = Math.cos(((e.alfa / 2) * Math.PI) / 180);
  // Derivação no modelo novo: tração e vento têm cálculo próprio (vetorial).
  const novaDerivacao = e.estrutura === "derivacao" && !!e.redeExistente;
  const modo = novaDerivacao ? null : modoTracao(e.estrutura, e.alfa);
  // Item 6.2.1.3: o vento nos cabos se divide entre os postes adjacentes — no
  // início/fim de linha só há um vão, então entra metade dele.
  const vaoVento = e.estrutura === "derivacao" || e.estrutura === "fim_linha" ? e.vao / 2 : e.vao;

  const d = getDiametroCondutor(tipoCabo, awg);
  const Cc = coeficienteCabo(vKmh, d); // cabo cilíndrico — independe do poste
  const Fv = Cc * vaoVento * cosMeioAlfa;
  const Fc = Fv * e.nFases;

  // Contribuição base do poste: vento no poste + condutores do circuito
  // principal, OU o esforço informado quando a derivação já está implantada.
  const posteInformado =
    e.estrutura === "derivacao" &&
    e.derivImplantado === true &&
    typeof e.esforcoPosteInformado === "number";
  const esforcoPoste = posteInformado ? (e.esforcoPosteInformado as number) : Fc + FpTopo;

  // Cruzeta (Derivação e Circuito duplo): vento na face da cruzeta, no topo.
  let Fcruzeta: number | null = null;
  let cruzetaArea: number | null = null;
  if ((e.estrutura === "derivacao" || e.estrutura === "circuito_duplo") && e.cruzeta) {
    cruzetaArea = areaCruzeta(e.cruzeta.Lmm, e.cruzeta.cmm);
    Fcruzeta = Pvp * cruzetaArea;
  }

  // Poste com transformador (regra vigente): o poste é especificado direto pela
  // fase e potência do transformador — comprimento fixo (11 m mono / 12 m tri) e
  // esforço mecânico (300 / 600 / 1000 daN). Não há verificação de vento nem de
  // momentos; a especificação É o resultado.
  let especTrafo: EspecificacaoTrafo | null = null;
  if (e.estrutura === "transformador" && e.transformador) {
    especTrafo = especificacaoTrafo(
      e.transformador.fase,
      e.transformador.kVA,
      e.transformador.prfv,
    );
  }

  // Poste de amarração (estabilizador da rede): o esforço é tabelado pela bitola
  // do cabo do projeto (600 daN abaixo de 4/0; 1000 daN a partir de 4/0) e a
  // altura é herdada dos postes da linha. Não há verificação de vento — a
  // especificação É o resultado.
  let especAmarracao: EspecAmarracao | null = null;
  if (e.estrutura === "amarracao") {
    especAmarracao = especificacaoAmarracao(tipoCabo, awg, e.comprimento);
  }

  // Poste com transformador (STANDBY): método dos momentos (item 6.3.3). Mantido
  // aqui, porém desativado — só volta a rodar se as entradas do método (trafoMA,
  // trafoBD, trafoCruzeta, trafoClasseIsolador, trafoPchave) voltarem a ser
  // fornecidas. Com a regra de especificação em vigor, elas não são coletadas,
  // então momentoTrafo permanece nulo.
  let momentoTrafo: MomentoTransformador | null = null;
  // MA: da tabela quando o poste é duplo T; senão, o valor informado à mão.
  const maTabela = maTransformadorDuploT(e.tipoFisico, e.comprimento, e.resistencia);
  const maTrafo = maTabela ?? e.trafoMA;
  const piTrafo = pesoIsoladorMF(e.trafoClasseIsolador);
  if (
    e.estrutura === "transformador" &&
    e.transformador &&
    typeof maTrafo === "number" &&
    typeof e.trafoBD === "number" &&
    e.trafoCruzeta &&
    piTrafo !== null &&
    typeof e.trafoPchave === "number"
  ) {
    const h = hLivre; // altura livre 0,9·L − 0,6
    const MB = momentoResistenteBase(e.resistencia, h); // Me = Rn·h
    const Mb = 0.7 * MB;
    const MA = maTrafo;
    const x = h - ALTURA_TRAFO_M; // seção a 7 m do solo, medida do topo
    const Mposte = momentoResistenteMyA(MA, MB, x, h); // MA + (0,7·MB − MA)·x/h
    const peso = e.transformador.massaKg * KG_PARA_DAN; // força-peso (daN)
    const bd = e.trafoBD;
    const MT = peso * bd; // momento do transformador (daN·m)

    // Distâncias e cruzeta são compartilhadas por MR e MF.
    const distancias = DISTANCIAS_CONDUTOR_M.slice(0, e.nFases);
    const Pcr = e.trafoCruzeta.pesoKg * KG_PARA_DAN; // peso da cruzeta (daN)
    const dcp = (FATOR_DCP * e.trafoCruzeta.comprimentoMm) / 1000; // 0,55·L (m)

    // MR — peso próprio: condutores (2·A·dᵢ por fase) + cruzeta (Pcr·dcp).
    const pesoM = getPesoCondutor(tipoCabo, awg) / 1000; // kg/m
    const A = e.vao * pesoM * KG_PARA_DAN; // peso de um vão (daN)
    const mrCondutores = distancias.reduce((acc, di) => acc + 2 * A * di, 0);
    const mrCruzeta = Pcr * dcp;
    const MR = mrCondutores + mrCruzeta;

    // MF — isolador + chave por fase ((Pi+pchave)·dᵢ) + 2·cruzeta (2·Pcr·dcp).
    const Pi = piTrafo * KG_PARA_DAN; // peso do isolador (daN)
    const pchave = e.trafoPchave * KG_PARA_DAN; // peso da chave (daN)
    const mfIsoladores = distancias.reduce((acc, di) => acc + (Pi + pchave) * di, 0);
    const mfCruzeta = 2 * Pcr * dcp;
    const MF = mfIsoladores + mfCruzeta;

    const M7m = MT + MF + MR;
    momentoTrafo = {
      h, MB, Mb, MA, maTabelado: maTabela !== null,
      x, Mposte, peso, bd, MT,
      MF, Pi, pchave, mfIsoladores, mfCruzeta,
      MR, A, nCondutores: distancias.length, distancias, mrCondutores, Pcr, dcp, mrCruzeta,
      M7m, aprovado: Mposte > M7m,
    };
  }

  // Circuito duplo: vento no condutor do circuito extra (mesmo vão e ângulo).
  let Fextra: number | null = null;
  let dExtra: number | null = null;
  let CcExtra: number | null = null;
  if (e.estrutura === "circuito_duplo" && e.circuitoExtra) {
    dExtra = getDiametroCondutor(e.circuitoExtra.tipoCabo, e.circuitoExtra.awg);
    CcExtra = coeficienteCabo(vKmh, dExtra);
    Fextra = CcExtra * e.vao * cosMeioAlfa * e.circuitoExtra.nFases;
  }

  const Fvento = esforcoPoste + (Fcruzeta ?? 0) + (Fextra ?? 0);

  // Tração de projeto POR CONDUTOR (por fase); no poste entra multiplicada pelo
  // nº de fases. Tabela de montagem no vão regulador de cada trecho completo do
  // poste (vale o de maior tração) ou, sem nenhum, no vão do próprio poste.
  const tracaoDoCabo = (
    cabo: string,
    bitola: string,
    informada: number | undefined,
    rotulo: string,
    vaosFixos?: number[],
  ): { Tcondutor: number; fonte: TracaoPoste["fonte"]; tabelada: TracaoTabelada | null } => {
    const reguladores = trechos.flatMap((t) => (t.ar === null ? [] : [t.ar]));
    let tb: TracaoTabelada | null = null;
    for (const vao of vaosFixos ?? (reguladores.length ? reguladores : [e.vao])) {
      const x = tracaoTabelada(cabo, bitola, vao, tempC);
      if (x && (!tb || x.Tprojeto > tb.Tprojeto)) tb = x;
    }
    if (tb) return { Tcondutor: tb.Tprojeto, fonte: "tabelada", tabelada: tb };
    // Cabo sem tabela de montagem (CAL): tabela fixa ou tração informada.
    const tab = tracaoProjetoFeixe(cabo, bitola);
    const T3 = tab ?? informada;
    if (typeof T3 !== "number" || !(T3 > 0)) {
      throw new Error(`Tração de projeto ${rotulo}(${cabo} ${bitola}) não tabelada — informe a tração por condutor (daN).`);
    }
    return { Tcondutor: T3, fonte: tab !== null ? "tabela" : "informada", tabelada: null };
  };

  // Derivação: vento + tração somados direto (critério do projetista).
  const somaDireta = e.estrutura === "derivacao";

  let tracao: TracaoPoste | null = null;
  if (modo) {
    const principal = tracaoDoCabo(tipoCabo, awg, e.tracaoInformada, "");
    const Tcondutor = principal.Tcondutor;
    const porCondutor = Tcondutor;
    const T = porCondutor * e.nFases;
    const R = modo === "deflexao" && !somaDireta ? resultanteForcasIguais(porCondutor, e.nFases, e.alfa) : T;

    // Circuito duplo em deflexão: o circuito extra também puxa pela bissetriz.
    let Textra: number | null = null;
    let Rextra: number | null = null;
    let fonteExtra: TracaoPoste["fonte"] | null = null;
    let tabeladaExtra: TracaoTabelada | null = null;
    if (modo === "deflexao" && e.estrutura === "circuito_duplo" && e.circuitoExtra) {
      const x = tracaoDoCabo(e.circuitoExtra.tipoCabo, e.circuitoExtra.awg, e.tracaoExtraInformada, "do circuito extra ");
      Textra = x.Tcondutor * e.circuitoExtra.nFases;
      Rextra = resultanteForcasIguais(x.Tcondutor, e.circuitoExtra.nFases, e.alfa);
      fonteExtra = x.fonte;
      tabeladaExtra = x.tabelada;
    }

    const Rtotal = R + (Rextra ?? 0);
    // Início/fim de linha: as duas situações do Exemplo 1 (item 6.3.2).
    let situacao1: number | null = null;
    let situacao2: number | null = null;
    let governa: 1 | 2 | null = null;
    if (modo === "fim" && !somaDireta) {
      situacao1 = resultantePerpendicular(Rtotal, Fvento);
      // No sentido da tração o vento não atua sobre os cabos, só sobre o poste
      // (ou o esforço informado do poste já implantado).
      situacao2 = Rtotal + (posteInformado ? esforcoPoste : FpTopo);
      governa = situacao2 >= situacao1 ? 2 : 1;
    }

    tracao = {
      modo, Tcondutor, fonte: principal.fonte, tabelada: principal.tabelada,
      trechos,
      T, R, situacao1, situacao2, governa, Textra, Rextra, fonteExtra, tabeladaExtra,
      Rtotal, somaDireta,
    };
  }

  // Derivação (poste existente): trações das duas redes + vento, vetorialmente.
  let derivacao: VerificacaoDerivacao | null = null;
  if (novaDerivacao) {
    const rede = e.redeExistente as RedeExistente;
    const ex = tracaoDoCabo(rede.tipoCabo, rede.awg, rede.tracaoInformada, "da rede existente ", [rede.vao]);
    const Texistente = ex.Tcondutor * rede.nFases;
    const Rexistente =
      rede.situacao === "passagem" ? 0
        : rede.situacao === "angulo" ? resultanteForcasIguais(ex.Tcondutor, rede.nFases, rede.alfa)
          : Texistente;
    const nova = tracaoDoCabo(tipoCabo, awg, e.tracaoInformada, "");
    const Tnova = nova.Tcondutor * e.nFases;

    const dExistente = getDiametroCondutor(rede.tipoCabo, rede.awg);
    const vaoEx = rede.situacao === "fim_linha" ? rede.vao / 2 : rede.vao;
    const alfaEx = rede.situacao === "angulo" ? rede.alfa : 0;
    const FcExistente =
      coeficienteCabo(vKmh, dExistente) * vaoEx * Math.cos(((alfaEx / 2) * Math.PI) / 180) * rede.nFases;

    // F para um poste da mesma altura com o vento no poste FpTopoPoste (muda com as
    // dimensões — usado também para testar as classes do catálogo).
    const esforcoCom = (FpTopoPoste: number) =>
      esforcoDerivacao({
        situacao: rede.situacao, Rexistente, Tnova, theta: rede.anguloDerivacao,
        FpTopo: FpTopoPoste, Fcruzeta: Fcruzeta ?? 0, FcExistente, FcNova: Fc,
      });
    const r = esforcoCom(FpTopo);
    const circular = e.tipoFisico === "circular";
    const capacidade = capacidadeLado(e.tipoFisico, e.resistencia, rede.lado);

    // Soluções (só quando não atende), na ordem: girar, estai, trocar o poste.
    const atende = r.F <= capacidade;
    let solucoes: SolucoesDerivacao = { girar: false, estai: null, posteSugerido: null };
    if (!atende) {
      const classes = Object.keys(postes[e.tipoFisico]?.[String(e.comprimento)] ?? {})
        .map(Number)
        .sort((a, b) => a - b);
      const FpTopoDe = (Rn: number) => {
        const dim = getDimensoes(e.tipoFisico, e.comprimento, Rn);
        const H = pontoDeAplicacao(dim.dt, dim.ds, hLivre);
        return esforcoTransferidoTopo(Pvp * areaSuperficie(dim.dt, dim.ds, hLivre), H, hTopo);
      };
      const achar = (lado: "maior" | "menor") => {
        const rn = classes.find((c) => capacidadeLado(e.tipoFisico, c, lado) >= esforcoCom(FpTopoDe(c)).F);
        return rn === undefined ? null : { resistencia: rn, lado };
      };
      solucoes = {
        girar: !circular && rede.lado === "menor" && r.F <= e.resistencia,
        // |F·(1 − h/he)| ≤ C  →  he ≥ h·F/(F + C); acima de h o estai não sobe.
        estai: { heMin: (hTopo * r.F) / (r.F + capacidade), heMax: hTopo },
        posteSugerido: achar(rede.lado) ?? (rede.lado === "menor" && !circular ? achar("maior") : null),
      };
    }

    derivacao = {
      rede,
      TcondExistente: ex.Tcondutor, fonteExistente: ex.fonte, tabeladaExistente: ex.tabelada,
      Texistente, Rexistente,
      TcondNova: nova.Tcondutor, fonteNova: nova.fonte, tabeladaNova: nova.tabelada, trechos,
      Tnova, Rtracao: r.Rtracao,
      FpTopo, Fcruzeta: Fcruzeta ?? 0, dExistente, FcExistente, FcNova: Fc,
      phiCritico: r.phiCritico, F: r.F,
      circular, capacidade, atende, solucoes,
    };
  }

  // Deflexão: a resultante da tração está na bissetriz, como o vento transversal
  // → soma direta. Início/fim de linha: a maior das duas situações.
  const Ftotal = derivacao ? derivacao.F : !tracao
    ? Fvento
    : tracao.modo === "deflexao" || tracao.somaDireta
      ? Fvento + tracao.Rtotal
      : Math.max(tracao.situacao1 ?? 0, tracao.situacao2 ?? 0);
  const utilizacao = Ftotal / e.resistencia;

  // Estai (item 6.3.3): fixado a `estaiHe` do solo, absorve Fe = F·h/he e o
  // poste passa a ser avaliado pela reação residual na base |Fr| = |F − Fe|.
  const temEstai = typeof e.estaiHe === "number" && e.estaiHe > 0;
  let Fe: number | null = null;
  let Fr: number | null = null;
  let esforcoEfetivo = Ftotal;
  if (temEstai) {
    const r = esforcoEstaiPoste(Ftotal, hTopo, e.estaiHe as number);
    Fe = r.Fe;
    Fr = r.Fr;
    esforcoEfetivo = Math.abs(r.Fr);
  }

  const limiarPct = e.limiarPct > 0 ? e.limiarPct : LIMIAR_PADRAO;
  let utilizacaoEfetiva = esforcoEfetivo / e.resistencia;
  let aprovado = utilizacaoEfetiva <= limiarPct / 100;

  // Lados do poste: Rn é o lado de maior esforço; o menor vale Rn/2. O esforço
  // efetivo (mínimo requerido) determina de que lado o poste precisa trabalhar.
  const ladoMaior = e.resistencia;
  const ladoMenor = e.resistencia / 2;
  let ladoRequerido: "menor" | "maior" | "excede" | null =
    esforcoEfetivo <= ladoMenor ? "menor" : esforcoEfetivo <= ladoMaior ? "maior" : "excede";
  // Postes especificados (transformador por fase+potência; amarração por bitola):
  // o esforço é escolhido para atender e não há verificação de vento. A
  // "utilização" não se aplica e a estrutura é adequada por especificação.
  if (derivacao) {
    // Derivação: vale o lado escolhido pelo projetista (Rn ou Rn/2).
    utilizacaoEfetiva = esforcoEfetivo / derivacao.capacidade;
    aprovado = utilizacaoEfetiva <= 1;
    ladoRequerido = null;
  } else if (especTrafo || especAmarracao) {
    utilizacaoEfetiva = 0;
    aprovado = true;
    ladoRequerido = null; // especificado: não há esforço calculado a orientar
  } else if (momentoTrafo) {
    // STANDBY — método dos momentos (desativado; ver acima).
    utilizacaoEfetiva =
      momentoTrafo.Mposte > 0 ? momentoTrafo.M7m / momentoTrafo.Mposte : Infinity;
    aprovado = momentoTrafo.aprovado;
  }

  // Origem da linha: quando o primeiro poste deriva de um poste já existente, a
  // base da rede é o lado escolhido do poste de origem (maior = Rn informado;
  // menor = Rn/2). O poste de derivação não pode ter esforço inferior a ela.
  let baseOrigemDerivacao: number | null = null;
  let ladoOrigemDerivacao: "maior" | "menor" | null = null;
  let atendeOrigemDerivacao: boolean | null = null;
  if (e.derivacaoExistente && typeof e.esforcoOrigemDerivacao === "number") {
    ladoOrigemDerivacao = e.ladoOrigemDerivacao ?? "maior";
    baseOrigemDerivacao =
      ladoOrigemDerivacao === "menor" ? e.esforcoOrigemDerivacao / 2 : e.esforcoOrigemDerivacao;
    atendeOrigemDerivacao = e.resistencia >= baseOrigemDerivacao;
  }

  return {
    dt, ds,
    engaste: engastamento(e.comprimento),
    hLivre, hTopo,
    Pvp, Sp, Fp, H, FpTopo,
    d, Cc, Fv, Fc,
    esforcoPoste, posteInformado,
    Fcruzeta, cruzetaArea,
    especTrafo,
    especAmarracao,
    momentoTrafo,
    Fextra, dExtra, CcExtra,
    Fvento, tracao, derivacao,
    Ftotal, utilizacao,
    limiarPct,
    esforcoEfetivo, utilizacaoEfetiva,
    ladoMaior, ladoMenor, ladoRequerido,
    baseOrigemDerivacao, ladoOrigemDerivacao, atendeOrigemDerivacao,
    estaiado: temEstai,
    estaiHe: temEstai ? (e.estaiHe as number) : null,
    Fe, Fr,
    aprovado,
  };
}

/** Formata número no padrão pt-BR (vírgula decimal). */
export function fmt(x: number, casas = 2): string {
  return x.toFixed(casas).replace(".", ",");
}

/** Orientação de posicionamento do poste conforme o lado exigido pelo esforço. */
export interface OrientacaoLado {
  titulo: string;
  descricao: string;
  /** Semáforo: verde (folga), âmbar (exige sentido), vermelho (não atende). */
  cor: "verde" | "ambar" | "vermelho";
  /** Resumo curto para a tabela do memorial. */
  resumo: string;
}

/**
 * Traduz o lado exigido (ladoRequerido) em orientação para o projetista.
 * Null quando não se aplica (poste especificado por transformador).
 */
export function orientacaoLado(m: MemoriaCalculo): OrientacaoLado | null {
  // `== null` cobre null E undefined — postes já salvos por versões antigas do
  // store não têm os campos de lado; nesses casos não há orientação a mostrar.
  if (m.ladoRequerido == null || m.ladoMaior == null || m.ladoMenor == null) return null;
  const menor = fmt(m.ladoMenor, 0);
  const maior = fmt(m.ladoMaior, 0);
  const esf = fmt(m.esforcoEfetivo, 0);
  if (m.ladoRequerido === "menor") {
    return {
      titulo: "Cabe no lado de menor esforço",
      descricao:
        `O esforço (${esf} daN) fica dentro do lado de menor esforço (${menor} daN). ` +
        `O poste pode ser posicionado em qualquer sentido.`,
      cor: "verde",
      resumo: `lado menor (${menor} daN) — sentido livre`,
    };
  }
  if (m.ladoRequerido === "maior") {
    return {
      titulo: "Exige o lado de maior esforço",
      descricao:
        `O esforço (${esf} daN) passa do lado de menor esforço (${menor} daN) e só é atendido ` +
        `pelo lado de maior esforço (${maior} daN). Posicione o poste com o lado de maior esforço ` +
        `voltado para a direção da resultante.`,
      cor: "ambar",
      resumo: `lado maior (${maior} daN) — sentido definido`,
    };
  }
  return {
    titulo: "Nenhum lado atende",
    descricao:
      `O esforço (${esf} daN) excede o lado de maior esforço (${maior} daN). ` +
      `Suba a classe do poste ou adicione estai.`,
    cor: "vermelho",
    resumo: `excede o lado maior (${maior} daN)`,
  };
}
