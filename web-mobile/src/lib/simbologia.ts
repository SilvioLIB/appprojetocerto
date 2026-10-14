/**
 * Simbologia de projeto — DESENHO NDU 006.34 (Energisa).
 *
 * Catálogo COMPLETO dos símbolos da norma, base para identificar os elementos
 * de projeto. Imagens de referência em docs/simbologia-ndu-006-34/.
 *
 * Status:
 *   - "ativo"   → o elemento existe no código hoje (cálculo/planta); tem glifo
 *                 em components/simbologia/simbolo-ndu.tsx.
 *   - "standby" → catalogado, mas ainda sem correspondente no código.
 *
 * Para ativar um símbolo: troque o status para "ativo", preencha `vinculo`
 * (onde ele aparece no código) e desenhe o glifo em `GLIFOS` (simbolo-ndu.tsx).
 * Puramente descritivo — nada aqui entra no cálculo.
 */

export type CategoriaSimbolo =
  | "postes"
  | "condutores"
  | "equipamentos"
  | "textos"
  | "estais"
  | "chaves"
  | "iluminacao"
  | "transformadores";

export type SituacaoSimbolo = "existente" | "projetado";
export type StatusSimbolo = "ativo" | "standby";

export interface SimboloNDU {
  id: string;
  categoria: CategoriaSimbolo;
  /** Descrição como está na tabela da norma. */
  descricao: string;
  situacao: SituacaoSimbolo;
  status: StatusSimbolo;
  /** Onde o elemento aparece no código (só nos ativos). */
  vinculo?: string;
}

export const CATEGORIAS_SIMBOLO: Record<CategoriaSimbolo, string> = {
  postes: "Postes",
  condutores: "Condutores",
  equipamentos: "Equipamentos",
  textos: "Textos",
  estais: "Estais",
  chaves: "Chaves",
  iluminacao: "Iluminação",
  transformadores: "Transformadores",
};

export const REFERENCIA_SIMBOLOGIA = "DESENHO NDU 006.34 — Simbologia";

/** Par existente/projetado com o mesmo nome-base (o caso comum da norma). */
function par(
  categoria: CategoriaSimbolo,
  base: string,
  nome: string,
  ativo: { existente?: string; projetado?: string } = {},
): SimboloNDU[] {
  return (["existente", "projetado"] as const).map((situacao) => ({
    id: `${base}_${situacao}`,
    categoria,
    descricao: `${nome} ${situacao === "existente" ? "existente" : "projetado"}`,
    situacao,
    status: ativo[situacao] ? "ativo" : "standby",
    vinculo: ativo[situacao],
  }));
}

/** Só existente (ex.: poste de trilho, que não se projeta mais). */
function unico(
  categoria: CategoriaSimbolo,
  id: string,
  descricao: string,
  situacao: SituacaoSimbolo,
  vinculo?: string,
): SimboloNDU {
  return { id, categoria, descricao, situacao, status: vinculo ? "ativo" : "standby", vinculo };
}

export const SIMBOLOS_NDU: SimboloNDU[] = [
  // --- Postes ---
  ...par("postes", "poste_duplo_t", "Poste duplo T", {
    existente: "Derivação (poste 01) com tipo físico duplo T",
    projetado: "Poste dimensionado com tipo físico duplo T",
  }),
  ...par("postes", "poste_concreto_tubular", "Poste tubular de concreto", {
    existente: "Derivação (poste 01) com tipo físico circular",
    projetado: "Poste dimensionado com tipo físico circular",
  }),
  ...par("postes", "poste_madeira", "Poste de madeira"),
  ...par("postes", "poste_aco_tubular", "Poste tubular de aço"),
  ...par("postes", "poste_ornamental", "Poste ornamental"),
  unico("postes", "poste_trilho_existente", "Poste de trilho existente", "existente"),

  // --- Condutores ---
  {
    id: "rede_primaria_existente", categoria: "condutores", descricao: "Rede primária existente",
    situacao: "existente", status: "ativo", vinculo: "Rede existente na derivação (cabo, situação e vão)",
  },
  {
    id: "rede_primaria_projetada", categoria: "condutores", descricao: "Rede primária projetada",
    situacao: "projetado", status: "ativo", vinculo: "Condutor do projeto, travado na abertura",
  },
  { id: "rede_secundaria_existente", categoria: "condutores", descricao: "Rede secundária existente", situacao: "existente", status: "standby" },
  { id: "rede_secundaria_projetada", categoria: "condutores", descricao: "Rede secundária projetada", situacao: "projetado", status: "standby" },

  // --- Equipamentos ---
  ...par("equipamentos", "aterramento", "Aterramento"),
  ...par("equipamentos", "capacitor", "Capacitor"),
  ...par("equipamentos", "para_raios", "Para-raios"),
  ...par("equipamentos", "mufla", "Mufla"),
  ...par("equipamentos", "fly_tap", "Fly tap"),
  ...par("equipamentos", "seccionamento_aereo", "Seccionamento aéreo"),
  ...par("equipamentos", "regulador_tensao", "Regulador de tensão"),
  ...par("equipamentos", "religador_linha", "Religador de linha"),

  // --- Textos ---
  {
    id: "texto_existente", categoria: "textos", descricao: "Texto, descrição de redes e equipamentos existentes",
    situacao: "existente", status: "ativo", vinculo: "Descrição do cabo da rede existente na derivação",
  },
  {
    id: "texto_projetado", categoria: "textos", descricao: "Texto, descrição de redes e equipamentos projetados",
    situacao: "projetado", status: "ativo", vinculo: "Descrição do condutor do projeto (tipo e bitola)",
  },

  // --- Estais ---
  ...par("estais", "estai_ancora", "Estai de âncora", {
    projetado: "Recalcular com estai (altura he) no poste atual; marcado na planta",
  }),
  ...par("estais", "estai_poste_poste", "Estai de poste a poste"),
  ...par("estais", "estai_cruzeta_poste", "Estai de cruzeta a poste"),
  unico("estais", "estai_subsolo_projetado", "Estai de sub-solo projetado", "projetado"),
  unico("estais", "estai_base_concretada_projetado", "Estai base-concretada projetado", "projetado"),

  // --- Chaves ---
  ...par("chaves", "chave_fusivel", "Chave fusível"),
  ...par("chaves", "chave_seccionadora_unipolar", "Chave seccionadora unipolar"),
  ...par("chaves", "chave_fusivel_religadora", "Chave fusível religadora"),
  ...par("chaves", "chave_seccionadora_tripolar", "Chave seccionadora tripolar"),
  ...par("chaves", "chave_oleo", "Chave a óleo"),

  // --- Iluminação ---
  ...par("iluminacao", "rele_fotoeletrico", "Relé fotoelétrico"),
  ...par("iluminacao", "chave_comando_magnetica", "Chave de comando magnética"),
  ...par("iluminacao", "luminaria", "Luminária"),

  // --- Transformadores ---
  ...par("transformadores", "trafo_empresa", "Transformador da empresa", {
    projetado: "Estrutura “Postes com equipamentos” (transformador do catálogo)",
  }),
  ...par("transformadores", "trafo_particular", "Transformador particular"),
  ...par("transformadores", "trafo_empresa_exclusivo", "Transformador da empresa exclusivo"),
  ...par("transformadores", "trafo_particular_cabina", "Transformador particular em cabina"),
];

export const SIMBOLOS_ATIVOS = SIMBOLOS_NDU.filter((s) => s.status === "ativo");
export const SIMBOLOS_STANDBY = SIMBOLOS_NDU.filter((s) => s.status === "standby");

export function simboloPorId(id: string): SimboloNDU | undefined {
  return SIMBOLOS_NDU.find((s) => s.id === id);
}

/** Id do símbolo de poste para o tipo físico do catálogo (PRFV não tem símbolo na norma). */
export function simboloDoPoste(tipoFisico: string, existente: boolean): SimboloNDU | undefined {
  const base = tipoFisico === "duplo T" ? "poste_duplo_t" : tipoFisico === "circular" ? "poste_concreto_tubular" : null;
  return base ? simboloPorId(`${base}_${existente ? "existente" : "projetado"}`) : undefined;
}
