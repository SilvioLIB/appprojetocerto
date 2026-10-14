/**
 * Registro de operações de cálculo e categorias.
 *
 * Cada operação declara seus campos (o front monta o formulário a partir disso)
 * e uma função `calc` que recebe os valores já convertidos/validados. Campos com
 * valores tabelados na norma viram listas; o restante fica como campo aberto.
 */
import type { LucideIcon } from "lucide-react";
import { Wind, Ruler, Scale3d, Cable, MoveVertical, Compass } from "lucide-react";

import * as v from "./validador";
import type { Carga } from "./validador";
import { ventoNoPonto, type VentoResultado } from "./vento";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type CampoTipo = "number" | "select" | "select_ou_numero" | "poste" | "condutor" | "cargas" | "coordenada";

export interface Opcao {
  label: string;
  valor: string | number;
}

export interface Campo {
  nome: string;
  label: string;
  tipo: CampoTipo;
  opcoes?: Opcao[];
  unidade?: string;
  default?: string | number;
  ajuda?: string;
}

export interface Resultado {
  rotulo: string;
  valor: string;
  unidade?: string;
  destaque?: boolean;
}

export interface Entrada {
  label: string;
  valor: string;
}

export interface PosteResolvido {
  tipo: string;
  comprimento: number;
  resistencia: number;
  dt: number;
  ds: number;
}

export interface CondutorResolvido {
  tipoCabo: string;
  awg: string;
  d: number;
}

/** Contexto tipado com os valores já resolvidos do formulário. */
export class Ctx {
  constructor(private map: Map<string, unknown>) {}
  num(n: string): number { return this.map.get(n) as number; }
  str(n: string): string { return this.map.get(n) as string; }
  poste(n: string): PosteResolvido { return this.map.get(n) as PosteResolvido; }
  condutor(n: string): CondutorResolvido { return this.map.get(n) as CondutorResolvido; }
  cargas(n: string): Carga[] { return this.map.get(n) as Carga[]; }
  vento(n: string): VentoResultado { return this.map.get(n) as VentoResultado; }
}

export interface Operacao {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  campos: Campo[];
  calc: (c: Ctx) => Resultado[];
}

export interface Categoria {
  id: string;
  titulo: string;
  descricao: string;
  icon: LucideIcon;
}

// ---------------------------------------------------------------------------
// Categorias (cartões da tela inicial)
// ---------------------------------------------------------------------------
export const CATEGORIAS: Categoria[] = [
  { id: "vento", titulo: "Ação do vento", icon: Wind,
    descricao: "Velocidade do vento por coordenada (NBR 6123): pressão, área do poste, esforço no poste e nos condutores." },
  { id: "dimensionamento", titulo: "Dimensionamento do poste", icon: Ruler,
    descricao: "Engastamento, alturas e vão máximo por balanço dos condutores." },
  { id: "momentos", titulo: "Transferência e momentos", icon: Scale3d,
    descricao: "Transferência a 10 cm do topo, resultantes, estai e momentos NBR 8451." },
  { id: "tracao", titulo: "Redução de tração e flechas", icon: Cable,
    descricao: "Redução de tração e flechas/trações em vãos ancorados." },
  { id: "esforcos", titulo: "Arrancamento e compressão", icon: MoveVertical,
    descricao: "Esforços vertical (Rnv) e horizontal (Rnh) por desnível." },
  { id: "auxiliares", titulo: "Auxiliares", icon: Compass,
    descricao: "Resultante de forças iguais (Anexo 6) e ângulo em campo (Anexo 7)." },
];

// ---------------------------------------------------------------------------
// Helpers de formatação e de opções
// ---------------------------------------------------------------------------
export function fmt(x: number, casas = 2): string {
  return x.toFixed(casas).replace(".", ",");
}

const opTipoPoste: Opcao[] = Object.keys(v.constantePvp).map((t) => ({ label: t, valor: t }));
const opAngulo: Opcao[] = [
  { label: "0° (alinhamento reto)", valor: 0 },
  ...v.PARAMETROS.anguloDeflexao.map((a) => ({ label: `${a}°`, valor: a })),
];
const opVao: Opcao[] = v.PARAMETROS.vaoMecanico.map((a) => ({ label: `${a} m`, valor: a }));
const opTensao: Opcao[] = v.TENSOES_OPERACAO.map((e) => ({ label: `${e} kV`, valor: e }));
const opFases: Opcao[] = [
  { label: "1 (monofásico)", valor: 1 },
  { label: "2 (bifásico)", valor: 2 },
  { label: "3 (trifásico)", valor: 3 },
];
const opPeso: Opcao[] = v.PESOS_ESPECIFICOS.map((p) => ({
  label: `${p.secao} ${p.tipo} — ${fmt(p.pesoKgM, 4)} kg/m`, valor: p.pesoKgM,
}));
// Trações de projeto tabeladas (daN) — mesma lista para tração de projeto (T) e
// para o esforço da rede primária. O valor usado no cálculo é o daN; o cabo é
// apenas informativo. Digitar "Outro…" permite um valor livre.
const opTracao: Opcao[] = v.TRACOES_PROJETO.map((t) => ({
  label: `${t.label} — ${t.tracaoDaN} daN`, valor: t.tracaoDaN,
}));
const opMomentos: Opcao[] = Object.keys(v.MOMENTOS_ANEXO1).map((k) => ({ label: k, valor: k }));
// Comprimentos nominais (m) disponíveis no catálogo de postes — união dos tipos,
// derivada de v.postes para não sair de sincronia com o cadastro.
const opComprimentoPoste: Opcao[] = Array.from(
  new Set(Object.values(v.postes).flatMap((porComprimento) => Object.keys(porComprimento))),
)
  .map(Number)
  .sort((a, b) => a - b)
  .map((m) => ({ label: `${m} m`, valor: m }));

// Atalhos de campo
const num = (nome: string, label: string, unidade = "", extra: Partial<Campo> = {}): Campo =>
  ({ nome, label, tipo: "number", unidade, ...extra });
const lista = (nome: string, label: string, opcoes: Opcao[], extra: Partial<Campo> = {}): Campo =>
  ({ nome, label, tipo: "select", opcoes, ...extra });
const listaOuNum = (nome: string, label: string, opcoes: Opcao[], unidade = ""): Campo =>
  ({ nome, label, tipo: "select_ou_numero", opcoes, unidade });
const poste = (): Campo => ({ nome: "poste", label: "Poste (catálogo)", tipo: "poste" });
const condutor = (): Campo => ({ nome: "condutor", label: "Condutor (catálogo)", tipo: "condutor" });
const coordenada = (nome = "coord"): Campo => ({
  nome, label: "Local do ponto da rede (coordenada)", tipo: "coordenada",
  ajuda: "V0 das isopletas da NBR 6123 pela coordenada; S1=1,00 · S2=0,79 · S3=0,85 (fixos). v = Vk · 3,6.",
});

const R = (rotulo: string, valor: string, unidade = "", destaque = false): Resultado =>
  ({ rotulo, valor, unidade, destaque });

/** Linhas de detalhamento do vento de projeto (NBR 6123) para o resultado/laudo. */
const linhasVento = (vt: VentoResultado): Resultado[] => [
  R("V0 (isopletas NBR 6123)", fmt(vt.V0, 2), "m/s"),
  R("Vk = V0 · 1,00 · 0,79 · 0,85", fmt(vt.Vk, 2), "m/s"),
  R("Velocidade do vento (v = Vk · 3,6)", fmt(vt.v_kmh, 1), "km/h"),
];

// ---------------------------------------------------------------------------
// Operações
// ---------------------------------------------------------------------------
export const OPERACOES: Operacao[] = [
  // ---- Ação do vento ----
  {
    id: "pressao_vento", categoria: "vento", titulo: "Pressão do vento (Pvp)",
    descricao: "Pvp = c · v² (item 6.2.1.2). v vem da coordenada (NBR 6123).",
    campos: [lista("tipo", "Tipo de poste", opTipoPoste, { default: "circular" }),
             coordenada()],
    calc: (c) => {
      const vt = c.vento("coord");
      return [...linhasVento(vt),
              R("Pressão do vento (Pvp)", fmt(v.pressaoVento(c.str("tipo"), vt.v_kmh), 3), "daN/m²", true)];
    },
  },
  {
    id: "area", categoria: "vento", titulo: "Área da superfície do poste (Sp)",
    descricao: "Sp = ½ · (dt + ds) · h (item 6.2.1.2). dt/ds do catálogo; h = altura livre.",
    campos: [poste()],
    calc: (c) => {
      const p = c.poste("poste");
      const h = v.alturaUtil(p.comprimento);
      return [R("Dimensão no topo (dt)", fmt(p.dt, 0), "mm"),
              R("Dimensão no solo (ds)", fmt(p.ds, 0), "mm"),
              R("Altura livre (h)", fmt(h, 2), "m"),
              R("Área da superfície (Sp)", fmt(v.areaSuperficie(p.dt, p.ds, h), 3), "m²", true)];
    },
  },
  {
    id: "fp", categoria: "vento", titulo: "Esforço do vento no poste (Fp)",
    descricao: "Fp = Pvp · Sp (item 6.2.1.2). v vem da coordenada (NBR 6123).",
    campos: [poste(), coordenada()],
    calc: (c) => {
      const p = c.poste("poste");
      const vt = c.vento("coord");
      const h = v.alturaUtil(p.comprimento);
      const Fp = v.esforcoDoVento(p.tipo, vt.v_kmh, p.dt, p.ds, h);
      return [...linhasVento(vt),
              R("dt / ds", `${fmt(p.dt, 0)} / ${fmt(p.ds, 0)}`, "mm"),
              R("Altura livre (h)", fmt(h, 2), "m"),
              R("Esforço do vento (Fp)", fmt(Fp, 2), "daN", true)];
    },
  },
  {
    id: "ponto", categoria: "vento", titulo: "Ponto de aplicação da resultante (H)",
    descricao: "H = h · (2·dt + ds) / (3·(dt + ds)) (item 6.2.1.2).",
    campos: [poste()],
    calc: (c) => {
      const p = c.poste("poste");
      const h = v.alturaUtil(p.comprimento);
      return [R("Dimensão no topo (dt)", fmt(p.dt, 0), "mm"),
              R("Dimensão no solo (ds)", fmt(p.ds, 0), "mm"),
              R("Altura livre (h)", fmt(h, 2), "m"),
              R("Ponto de aplicação (H)", fmt(v.pontoDeAplicacao(p.dt, p.ds, h), 2), "m", true)];
    },
  },
  {
    id: "cc", categoria: "vento", titulo: "Coeficiente do cabo (Cc)",
    descricao: "Cc = Pvp · d · 10⁻³ (item 6.2.1.3). v vem da coordenada (NBR 6123).",
    campos: [lista("tipo", "Tipo de poste", opTipoPoste, { default: "circular" }),
             coordenada(), condutor()],
    calc: (c) => {
      const cond = c.condutor("condutor");
      const vt = c.vento("coord");
      return [...linhasVento(vt),
              R("Diâmetro (d)", fmt(cond.d, 2), "mm"),
              R("Coeficiente do cabo (Cc)", fmt(v.coeficienteCabo(vt.v_kmh, cond.d, c.str("tipo")), 3), "daN/m por condutor", true)];
    },
  },
  {
    id: "vento_cabos", categoria: "vento", titulo: "Esforço do vento nos condutores (Fv/Fc)",
    descricao: "Fc = Cc · a · cos(α/2) · nº fases (item 6.2.1.3). v vem da coordenada (NBR 6123).",
    campos: [lista("tipo", "Tipo de poste", opTipoPoste, { default: "circular" }),
             coordenada(),
             listaOuNum("a", "Vão médio (a)", opVao, "m"), condutor(),
             listaOuNum("alfa", "Ângulo de deflexão (α)", opAngulo, "°"),
             lista("n_fases", "Número de fases", opFases, { default: 3 })],
    calc: (c) => {
      const cond = c.condutor("condutor");
      const vt = c.vento("coord");
      const n = c.num("n_fases");
      const Fv = v.esforcoVentoCondutores(c.str("tipo"), vt.v_kmh, c.num("a"), cond.tipoCabo, cond.awg, c.num("alfa"));
      const Fc = v.esforcoVentoCabosTotal(c.str("tipo"), vt.v_kmh, c.num("a"), cond.tipoCabo, cond.awg, c.num("alfa"), n);
      return [...linhasVento(vt),
              R("Força por condutor (Fv)", fmt(Fv, 2), "daN/cond."),
              R(`Força total (${n} fases)`, fmt(Fc, 2), "daN", true)];
    },
  },

  // ---- Dimensionamento do poste ----
  {
    id: "engastamento", categoria: "dimensionamento", titulo: "Engastamento e alturas",
    descricao: "E = 0,1·L + 0,6 ; h = L − E − 0,10 (itens 6.3.2 e 6.8).",
    campos: [lista("L", "Comprimento nominal (L)", opComprimentoPoste)],
    calc: (c) => {
      const L = c.num("L");
      return [R("Engastamento (E)", fmt(v.engastamento(L), 2), "m", true),
              R("Altura livre (L−E)", fmt(v.alturaUtil(L), 2), "m"),
              R("Altura útil 10 cm (L−E−0,10)", fmt(v.alturaUtilTopo(L), 2), "m")];
    },
  },
  {
    id: "balanco", categoria: "dimensionamento", titulo: "Vão máximo por balanço (flecha)",
    descricao: "f = (S·cos(α/2) − 0,0076·E)² / 0,368 (item 6.2.1.5). S = espaçamento mínimo tabelado pela tensão (NT 11836).",
    campos: [listaOuNum("E", "Tensão de operação (E)", opTensao, "kV"),
             listaOuNum("alfa", "Ângulo de deflexão (α)", opAngulo, "°")],
    calc: (c) => {
      const E = c.num("E");
      const Smm = v.espacamentoMinimoMm(E);
      const S = Smm / 1000;
      return [R("Espaçamento mínimo (S)", `${fmt(Smm, 0)} mm = ${fmt(S, 3)} m`),
              R("Flecha final por balanço (f)", fmt(v.flechaFinalBalanco(S, E, c.num("alfa")), 3), "m", true)];
    },
  },

  // ---- Transferência e momentos ----
  {
    id: "transferencia", categoria: "momentos", titulo: "Transferência de esforços a 10 cm do topo",
    descricao: "F_T = F_prim + Σ (F·altura / h) (item 6.3.2).",
    campos: [lista("L", "Comprimento do poste (L)", opComprimentoPoste, { ajuda: "usado em h = L − E − 0,10" }),
             listaOuNum("fp_prim", "Esforço da rede primária (já a 10 cm do topo)", opTracao, "daN"),
             { nome: "cargas", label: "Cargas abaixo do topo (F, altura)", tipo: "cargas" }],
    calc: (c) => {
      const h = v.alturaUtilTopo(c.num("L"));
      const FT = v.forcaTotalTopo(c.num("fp_prim"), c.cargas("cargas"), h);
      return [R("Altura útil (h)", fmt(h, 2), "m"),
              R("Força total no topo (F_T)", fmt(FT, 2), "daN", true)];
    },
  },
  {
    id: "resultante_perp", categoria: "momentos", titulo: "Resultante de forças perpendiculares",
    descricao: "R = √(Fh² + Fv²) (item 6.3.2).",
    campos: [num("fh", "Força horizontal (Fh)", "daN"), num("fv", "Força perpendicular (Fv)", "daN")],
    calc: (c) => [R("Resultante (R)", fmt(v.resultantePerpendicular(c.num("fh"), c.num("fv")), 2), "daN", true)],
  },
  {
    id: "estai", categoria: "momentos", titulo: "Esforços num poste estaiado",
    descricao: "Fe = F·hf/he ; Fr = F − Fe (item 6.3.3).",
    campos: [num("F", "Força aplicada (F)", "daN"), num("hf", "Altura da força (hf)", "m"),
             num("he", "Altura do estai (he)", "m")],
    calc: (c) => {
      const r = v.esforcoEstaiPoste(c.num("F"), c.num("hf"), c.num("he"));
      return [R("Força no estai (Fe)", fmt(r.Fe, 2), "daN", true),
              R("Reação no solo (Fr)", fmt(r.Fr, 2), "daN")];
    },
  },
  {
    id: "momentos", categoria: "momentos", titulo: "Momentos resistentes (NBR 8451 / Anexo 1)",
    descricao: "MB = Rn·h ; MA = 0,9·MB·(WA/WB) ; máx(MyA, MyB).",
    campos: [lista("designacao", "Poste (Anexo 1)", opMomentos), num("X", "Altura da seção (X)", "m")],
    calc: (c) => {
      const m = v.momentosResistentesPoste(c.str("designacao"), c.num("X"));
      return [R("Momento na base (MB)", fmt(m.MB, 0), "daN·m"),
              R("Momento no topo (MA)", fmt(m.MA, 0), "daN·m"),
              R("MyA", fmt(m.MyA, 0), "daN·m"), R("MyB", fmt(m.MyB, 0), "daN·m"),
              R("Momento resistente da seção", fmt(m.Mres, 0), "daN·m", true),
              R("Altura de cruzamento (Xp)", fmt(m.Xp, 2), "m")];
    },
  },

  // ---- Redução de tração e flechas ----
  {
    id: "reducao_flecha", categoria: "tracao", titulo: "Redução de tração — flecha constante",
    descricao: "T2 = T1 · (V2/V1)² (item 6.4.1).",
    campos: [listaOuNum("T1", "Tração original (T1)", opTracao, "daN"), num("V1", "Vão médio original (V1)", "m"),
             num("V2", "Novo vão médio (V2)", "m")],
    calc: (c) => [R("Nova tração de projeto (T2)", fmt(v.reducaoTracaoFlechaConstante(c.num("T1"), c.num("V1"), c.num("V2")), 2), "daN", true)],
  },
  {
    id: "reducao_vao", categoria: "tracao", titulo: "Redução de tração — vão constante",
    descricao: "T2 = T1 · F1/F2 (item 6.4.2).",
    campos: [listaOuNum("T1", "Tração original (T1)", opTracao, "daN"), num("F1", "Flecha original (F1)", "m"),
             num("F2", "Nova flecha (F2)", "m")],
    calc: (c) => [R("Nova tração de projeto (T2)", fmt(v.reducaoTracaoVaoConstante(c.num("T1"), c.num("F1"), c.num("F2")), 2), "daN", true)],
  },
  {
    id: "vao_flecha", categoria: "tracao", titulo: "Vão ancorado (nível) — flecha",
    descricao: "F = P · V² / (8·T) (item 6.5).",
    campos: [listaOuNum("P", "Peso específico (P)", opPeso, "kg/m"), num("V", "Largura do vão (V)", "m"),
             listaOuNum("T", "Tração aplicada (T)", opTracao, "daN")],
    calc: (c) => [R("Flecha (F)", fmt(v.flechaVaoAncorado(c.num("P"), c.num("V"), c.num("T")), 3), "m", true)],
  },
  {
    id: "vao_tracao", categoria: "tracao", titulo: "Vão ancorado (nível) — tração",
    descricao: "T = P · V² / (8·F) (item 6.5).",
    campos: [listaOuNum("P", "Peso específico (P)", opPeso, "kg/m"), num("V", "Largura do vão (V)", "m"),
             num("F", "Flecha (F)", "m")],
    calc: (c) => [R("Tração (T)", fmt(v.tracaoVaoAncorado(c.num("P"), c.num("V"), c.num("F")), 2), "daN", true)],
  },
  {
    id: "vao_desnivel", categoria: "tracao", titulo: "Vão ancorado em desnível",
    descricao: "Trações e distâncias para apoios em alturas diferentes (item 6.5).",
    campos: [listaOuNum("P", "Peso específico (P)", opPeso, "kg/m"), num("vao", "Largura do vão", "m"),
             num("HA", "Altura do apoio A (H_A)", "m"), num("HB", "Altura do apoio B (H_B)", "m")],
    calc: (c) => {
      const r = v.flechasTracoesDesnivel(c.num("P"), c.num("vao"), c.num("HA"), c.num("HB"));
      return [R("Distância L_A", fmt(r.LA, 2), "m"), R("Distância L_B", fmt(r.LB, 2), "m"),
              R("Tração no ponto A (T_A)", fmt(r.TA, 2), "daN", true),
              R("Tração no ponto B (T_B)", fmt(r.TB, 2), "daN", true)];
    },
  },

  // ---- Arrancamento e compressão ----
  {
    id: "compressao", categoria: "esforcos", titulo: "Esforço vertical de compressão (Rnv)",
    descricao: "Rnv = T·(h1/L1 + h2/L2), L = √(h²+e²) (item 6.9.3).",
    campos: [listaOuNum("T", "Tração por condutor (T)", opTracao, "daN"), num("h1", "Desnível lance 1 (h1)", "m"),
             num("e1", "Vão lance 1 (e1)", "m"), num("h2", "Desnível lance 2 (h2)", "m"),
             num("e2", "Vão lance 2 (e2)", "m")],
    calc: (c) => [R("Esforço vertical de compressão (Rnv)", fmt(v.esforcoCompressaoVertical(c.num("T"), c.num("h1"), c.num("e1"), c.num("h2"), c.num("e2")), 2), "daN", true)],
  },
  {
    id: "horizontal", categoria: "esforcos", titulo: "Esforço horizontal longitudinal (Rnh)",
    descricao: "Rnh = T·(e1/L1 − e2/L2) (item 6.9.3).",
    campos: [listaOuNum("T", "Tração por condutor (T)", opTracao, "daN"), num("h1", "Desnível lance 1 (h1)", "m"),
             num("e1", "Vão lance 1 (e1)", "m"), num("h2", "Desnível lance 2 (h2)", "m"),
             num("e2", "Vão lance 2 (e2)", "m")],
    calc: (c) => [R("Esforço horizontal longitudinal (Rnh)", fmt(v.esforcoHorizontalLongitudinal(c.num("T"), c.num("h1"), c.num("e1"), c.num("h2"), c.num("e2")), 2), "daN", true)],
  },

  // ---- Auxiliares ----
  {
    id: "resultante_iguais", categoria: "auxiliares", titulo: "Resultante de forças iguais (Anexo 6)",
    descricao: "R = T · nº · 2·sen(α/2).",
    campos: [listaOuNum("T", "Tração por condutor (T)", opTracao, "daN"), lista("n", "Número de condutores", opFases, { default: 3 }),
             listaOuNum("ang", "Ângulo de deflexão", opAngulo, "°")],
    calc: (c) => {
      const ang = c.num("ang");
      return [R("Constante (Anexo 6)", fmt(v.constanteResultante(ang), 4), ""),
              R("Resultante", fmt(v.resultanteForcasIguais(c.num("T"), c.num("n"), ang), 2), "daN", true)];
    },
  },
  {
    id: "angulo", categoria: "auxiliares", titulo: "Ângulo de deflexão em campo (Anexo 7)",
    descricao: "Método I: θ = 2·asen(AB/2D); Método II: θ = 2·acos(AB/2D).",
    campos: [num("AB", "Distância medida (AB)", "m"), num("D", "Distância sobre cada linha (D)", "m", { default: 10 }),
             lista("metodo", "Método", [{ label: "Método I (mais preciso)", valor: "I" }, { label: "Método II", valor: "II" }], { default: "I" })],
    calc: (c) => [R("Ângulo de deflexão", fmt(v.anguloDeCampo(c.num("AB"), c.num("D"), c.str("metodo") as "I" | "II"), 2), "°", true)],
  },
];

export const OPERACOES_POR_ID: Record<string, Operacao> = Object.fromEntries(
  OPERACOES.map((op) => [op.id, op]),
);

export function operacoesDaCategoria(categoriaId: string): Operacao[] {
  return OPERACOES.filter((op) => op.categoria === categoriaId);
}

export function categoriaPorId(id: string): Categoria | undefined {
  return CATEGORIAS.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Conversão/validação dos valores do formulário e execução do cálculo
// ---------------------------------------------------------------------------
const paraNumero = (valor: unknown, label: string): number => {
  const n = Number(String(valor ?? "").replace(",", ".").trim());
  if (String(valor ?? "").trim() === "" || Number.isNaN(n)) {
    throw new Error(`Valor numérico inválido no campo '${label}'.`);
  }
  return n;
};

export interface ValorPoste { tipo?: string; comprimento?: string; resistencia?: string; }
export interface ValorCondutor { tipoCabo?: string; awg?: string; }
export interface ValorCarga { F?: string; altura?: string; }
export interface ValorCoordenada { lat?: string; lon?: string; }
export type ValorBruto = string | ValorPoste | ValorCondutor | ValorCarga[] | ValorCoordenada | undefined;

export interface ResultadoCalculo {
  entradas: Entrada[];
  resultados: Resultado[];
}

/** Converte os valores brutos do formulário, valida e executa o cálculo. */
export function calcular(op: Operacao, valores: Record<string, ValorBruto>): ResultadoCalculo {
  const map = new Map<string, unknown>();
  const entradas: Entrada[] = [];

  for (const campo of op.campos) {
    const bruto = valores[campo.nome];

    if (campo.tipo === "poste") {
      const b = (bruto ?? {}) as ValorPoste;
      if (!b.tipo || !b.comprimento || !b.resistencia) throw new Error("Selecione o poste no catálogo.");
      const dim = v.getDimensoes(b.tipo, Number(b.comprimento), Number(b.resistencia));
      map.set(campo.nome, { tipo: b.tipo, comprimento: Number(b.comprimento), resistencia: Number(b.resistencia), dt: dim.dt, ds: dim.ds });
      entradas.push({ label: campo.label, valor: `${b.tipo} ${b.comprimento} m / ${b.resistencia} daN` });

    } else if (campo.tipo === "coordenada") {
      const b = (bruto ?? {}) as ValorCoordenada;
      const lat = paraNumero(b.lat, "Latitude");
      const lon = paraNumero(b.lon, "Longitude");
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        throw new Error("Coordenada fora da faixa (latitude −90…90, longitude −180…180).");
      }
      const vt = ventoNoPonto(lat, lon);
      map.set(campo.nome, vt);
      entradas.push({
        label: campo.label,
        valor: `(${fmt(vt.latitude, 5)}, ${fmt(vt.longitude, 5)}) → v = ${fmt(vt.v_kmh, 1)} km/h (V0 ${fmt(vt.V0, 1)} m/s · S2 0,79 · S3 0,85 — NBR 6123)`,
      });

    } else if (campo.tipo === "condutor") {
      const b = (bruto ?? {}) as ValorCondutor;
      if (!b.tipoCabo || !b.awg) throw new Error("Selecione o condutor no catálogo.");
      map.set(campo.nome, { tipoCabo: b.tipoCabo, awg: b.awg, d: v.getDiametroCondutor(b.tipoCabo, b.awg) });
      entradas.push({ label: campo.label, valor: `${b.tipoCabo} ${b.awg}` });

    } else if (campo.tipo === "cargas") {
      const arr = (bruto as ValorCarga[] | undefined) ?? [];
      const cargas: Carga[] = [];
      for (const item of arr) {
        if (!item?.F || !item?.altura) continue;
        cargas.push({ F: paraNumero(item.F, "Força da carga"), altura: paraNumero(item.altura, "Altura da carga") });
      }
      map.set(campo.nome, cargas);
      entradas.push({ label: campo.label, valor: cargas.map((k) => `${fmt(k.F, 0)} daN @ ${fmt(k.altura, 2)} m`).join("; ") || "—" });

    } else if (campo.tipo === "select") {
      const s = bruto as string | undefined;
      if (s === undefined || s === "") throw new Error(`Selecione uma opção em '${campo.label}'.`);
      map.set(campo.nome, s);
      const op0 = campo.opcoes?.find((o) => String(o.valor) === s);
      entradas.push({ label: campo.label, valor: op0?.label ?? s });

    } else {
      // number / select_ou_numero
      const s = bruto as string | undefined;
      if (s === undefined || s === "") throw new Error(`Preencha o campo '${campo.label}'.`);
      map.set(campo.nome, paraNumero(s, campo.label));
      // Se o valor corresponder a uma opção tabelada, registra o rótulo (ex.: o
      // nome do cabo) no laudo; caso contrário, mostra o valor digitado + unidade.
      const op0 = campo.opcoes?.find((o) => String(o.valor) === s);
      entradas.push({ label: campo.label, valor: op0 ? op0.label : `${s}${campo.unidade ? " " + campo.unidade : ""}` });
    }
  }

  return { entradas, resultados: op.calc(new Ctx(map)) };
}
