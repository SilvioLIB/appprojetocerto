/**
 * Estado do projeto guiado (v2): amarras fixadas na abertura (projetista,
 * obra, vento pela coordenada e condutor) e a sequência de postes
 * dimensionados. Persistido em localStorage — recarregar a página não perde
 * o projeto em andamento.
 */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { VentoResultado } from "./vento";
import type { DistanciaLinha } from "./distancia";
import type { ClimaRegiao } from "./ng";
import {
  TEMP_PROJETO_PADRAO,
  dimensionarPoste,
  trechosDaLinha,
  type EntradaPoste,
  type MemoriaCalculo,
} from "./dimensionamento";
import { PLANTA_PADRAO, type PlantaPoste } from "./planta-rede";

/** Limite interno de postes por projeto (não exibido ao usuário). */
export const MAX_POSTES = 20;

export type FaseProjeto = "abertura" | "postes" | "concluido";

export interface CondutorProjeto {
  tipoCabo: string;
  awg: string;
  d: number; // mm
  /** Temperatura de projeto (°C) da tabela de tração, fixada na abertura. */
  tempC: number;
}

export interface PosteProjeto {
  id: string;
  entrada: EntradaPoste;
  memoria: MemoriaCalculo;
  criadoEm: string; // ISO
  /**
   * Escolhas visuais da planta da rede (giro do poste e lado da curva). Fora de
   * `entrada` de propósito: o cálculo nunca as enxerga. Ausente em projetos
   * salvos antes da planta — vale PLANTA_PADRAO.
   */
  planta?: PlantaPoste;
}

interface ProjetoV2State {
  fase: FaseProjeto;

  /** Modo desenvolvedor: destrava o vento e a navegação entre etapas. */
  dev: boolean;

  // Rascunho da abertura (editável enquanto o projeto não inicia)
  projetista: string;
  obra: string;
  coordLat: string;
  coordLon: string;
  tipoCabo: string;
  awg: string;
  /** Temperatura de projeto (°C) digitada na abertura — string para o input. */
  temperaturaProjeto: string;
  /** Coordenadas do ponto de derivação e do ponto de entrega da carga. */
  derivLat: string;
  derivLon: string;
  entregaLat: string;
  entregaLon: string;
  /**
   * Fator de sinuosidade da extensão da linha (multiplica a reta quando a rota
   * do OSRM não está disponível). Guardado como string para o input.
   */
  fatorSinuosidade: string;
  /** Vão médio pretendido (m), base do estimador de quantidade de postes. */
  vaoMedio: string;
  /** Extensão estimada da linha (derivação → entrega). Calculada sob demanda. */
  extensaoLinha: DistanciaLinha | null;
  /**
   * Contorno climático da região (Ng da NBR 5419-2 + V0 da NBR 6123) nas pontas
   * do corredor derivação → entrega. Calculado sob demanda na abertura.
   */
  climaRegiao: ClimaRegiao | null;
  /**
   * Passo de amarração (m): a cada tanto de vão acumulado nos postes já
   * cadastrados, o próximo poste é sinalizado como de amarração. 0 = desabilitado.
   * Por enquanto só configurável no modo desenvolvedor, na abertura do projeto.
   */
  passoAmarracao: number;

  // Amarras congeladas ao iniciar o projeto
  vento: VentoResultado | null;
  condutor: CondutorProjeto | null;
  iniciadoEm: string | null; // ISO

  postes: PosteProjeto[];

  /**
   * Poste já dimensionado reaberto para edição (id), ou null quando a tela
   * dimensiona o próximo poste da linha. Não é persistido.
   */
  editandoId: string | null;
  /** A edição foi aberta a partir do memorial: salvar/cancelar volta para lá. */
  edicaoDoMemorial: boolean;

  setAbertura: (
    dados: Partial<
      Pick<
        ProjetoV2State,
        | "projetista"
        | "obra"
        | "coordLat"
        | "coordLon"
        | "tipoCabo"
        | "awg"
        | "temperaturaProjeto"
        | "passoAmarracao"
        | "derivLat"
        | "derivLon"
        | "entregaLat"
        | "entregaLon"
        | "fatorSinuosidade"
        | "vaoMedio"
      >
    >,
  ) => void;
  /** Guarda (ou limpa) a extensão estimada da linha. */
  setExtensaoLinha: (extensao: DistanciaLinha | null) => void;
  /** Guarda (ou limpa) o contorno climático da região. */
  setClimaRegiao: (clima: ClimaRegiao | null) => void;
  iniciar: (vento: VentoResultado, condutor: CondutorProjeto) => void;
  adicionarPoste: (entrada: EntradaPoste, memoria: MemoriaCalculo, planta?: PlantaPoste) => void;
  removerPoste: (id: string) => void;
  /** Reabre um poste já dimensionado na tela de dimensionamento. */
  editarPoste: (id: string) => void;
  /** Sai da edição sem gravar — a tela volta ao próximo poste da linha. */
  cancelarEdicao: () => void;
  /** Grava o poste editado no mesmo lugar da linha e recalcula a linha inteira. */
  substituirPoste: (id: string, entrada: EntradaPoste, memoria: MemoriaCalculo, planta?: PlantaPoste) => void;
  /** Ajusta as escolhas visuais da planta de um poste (não recalcula nada). */
  ajustarPlanta: (id: string, patch: Partial<PlantaPoste>) => void;
  concluir: () => void;
  reabrir: () => void;
  novoProjeto: () => void;

  // --- Modo desenvolvedor ---
  toggleDev: () => void;
  /** Navega direto para uma fase, sem apagar o projeto (ir e voltar). */
  irParaFase: (fase: FaseProjeto) => void;
  /**
   * Troca o vento travado do projeto e recalcula TODOS os postes já
   * dimensionados com a nova velocidade. Usado para testar cenários de vento.
   */
  setVento: (vento: VentoResultado) => void;
}

/**
 * Recalcula os postes com o vento e o condutor (com a temperatura de projeto)
 * dados, cada um com os seus trechos de tração na linha. Poste salvo sem algum dado que o cálculo exige
 * (ex.: tração de cabo fora da tabela) mantém a memória anterior.
 */
function recalcular(
  postes: PosteProjeto[],
  vento: VentoResultado | null,
  condutor: CondutorProjeto | null,
): PosteProjeto[] {
  if (!vento || !condutor) return postes;
  const trechos = trechosDaLinha(postes.map((p) => p.entrada));
  return postes.map((p, i) => {
    try {
      return { ...p, memoria: dimensionarPoste(vento.v_kmh, condutor.tipoCabo, condutor.awg, p.entrada, condutor.tempC, trechos[i]) };
    } catch {
      return p;
    }
  });
}

/**
 * A tração tabelada depende do vão regulador do trecho: incluir ou tirar um
 * poste muda os trechos, então a linha inteira é recalculada.
 */
function aposMudarLinha(s: ProjetoV2State, postes: PosteProjeto[]): PosteProjeto[] {
  return recalcular(postes, s.vento, s.condutor);
}

function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const estadoInicial = {
  fase: "abertura" as FaseProjeto,
  dev: false,
  projetista: "",
  obra: "",
  coordLat: "",
  coordLon: "",
  tipoCabo: "",
  awg: "",
  temperaturaProjeto: "",
  derivLat: "",
  derivLon: "",
  entregaLat: "",
  entregaLon: "",
  fatorSinuosidade: "1,3",
  vaoMedio: "",
  extensaoLinha: null,
  climaRegiao: null,
  passoAmarracao: 0,
  vento: null,
  condutor: null,
  iniciadoEm: null,
  postes: [],
  editandoId: null as string | null,
  edicaoDoMemorial: false,
};

export const useProjetoV2 = create<ProjetoV2State>()(
  persist(
    (set, get) => ({
      ...estadoInicial,

      setAbertura: (dados) => set(dados),

      setExtensaoLinha: (extensao) => set({ extensaoLinha: extensao }),

      setClimaRegiao: (clima) => set({ climaRegiao: clima }),

      // Reiniciar com postes já cadastrados (modo dev: voltar à abertura e trocar
      // cabo, temperatura ou vento) recalcula a linha inteira com as novas amarras.
      iniciar: (vento, condutor) =>
        set((s) => ({
          fase: "postes",
          vento,
          condutor,
          iniciadoEm: new Date().toISOString(),
          postes: recalcular(s.postes, vento, condutor),
        })),

      adicionarPoste: (entrada, memoria, planta) => {
        if (get().postes.length >= MAX_POSTES) return;
        set((s) => ({
          postes: aposMudarLinha(s, [
            ...s.postes,
            { id: novoId(), entrada, memoria, criadoEm: new Date().toISOString(), planta },
          ]),
        }));
      },

      removerPoste: (id) =>
        set((s) => ({
          postes: aposMudarLinha(s, s.postes.filter((p) => p.id !== id)),
          ...(s.editandoId === id
            ? { editandoId: null, edicaoDoMemorial: false, fase: s.edicaoDoMemorial ? ("concluido" as const) : s.fase }
            : {}),
        })),

      // Editar volta à etapa dos postes (também a partir do memorial).
      editarPoste: (id) => {
        const s = get();
        if (!s.postes.some((p) => p.id === id)) return;
        // Trocar de um poste em edição para outro preserva a origem da edição.
        const doMemorial = s.editandoId ? s.edicaoDoMemorial : s.fase === "concluido";
        set({ editandoId: id, fase: "postes", edicaoDoMemorial: doMemorial });
      },

      cancelarEdicao: () =>
        set((s) => ({
          editandoId: null,
          edicaoDoMemorial: false,
          fase: s.edicaoDoMemorial ? "concluido" : s.fase,
        })),

      substituirPoste: (id, entrada, memoria, planta) =>
        set((s) => ({
          postes: aposMudarLinha(
            s,
            s.postes.map((p) => (p.id === id ? { ...p, entrada, memoria, planta: planta ?? p.planta } : p)),
          ),
          editandoId: null,
          edicaoDoMemorial: false,
          fase: s.edicaoDoMemorial ? "concluido" : s.fase,
        })),

      ajustarPlanta: (id, patch) =>
        set((s) => ({
          postes: s.postes.map((p) =>
            p.id === id ? { ...p, planta: { ...PLANTA_PADRAO, ...p.planta, ...patch } } : p,
          ),
        })),

      concluir: () => set({ fase: "concluido" }),

      reabrir: () => set({ fase: "postes" }),

      // Um projeto novo não desliga o modo dev (preferência da sessão).
      novoProjeto: () => set((s) => ({ ...estadoInicial, dev: s.dev })),

      // --- Modo desenvolvedor ---
      toggleDev: () => set((s) => ({ dev: !s.dev })),

      irParaFase: (fase) => set({ fase, editandoId: null, edicaoDoMemorial: false }),

      setVento: (vento) =>
        set((s) => ({ vento, postes: recalcular(s.postes, vento, s.condutor) })),
    }),
    {
      name: "projeto-v2-ged3648",
      // v2: a tração passou a vir das tabelas de montagem, na temperatura de
      // projeto fixada na abertura (antes: seletor de motor). Projetos salvos
      // antes herdam a temperatura do motor antigo e têm os postes recalculados.
      version: 2,
      // A edição em curso é estado de tela: recarregar volta ao próximo poste.
      partialize: (s) => {
        const { editandoId: _editando, edicaoDoMemorial: _doMemorial, ...resto } = s;
        void _editando;
        void _doMemorial;
        return resto;
      },
      migrate: (salvo, versao) => {
        const s = salvo as ProjetoV2State & { motorTracao?: { tempC?: number } };
        if (versao < 2 && s) {
          const tempC = s.motorTracao?.tempC ?? TEMP_PROJETO_PADRAO;
          delete s.motorTracao;
          const condutor = s.condutor ? { ...s.condutor, tempC: s.condutor.tempC ?? tempC } : null;
          return {
            ...s,
            temperaturaProjeto: s.temperaturaProjeto ?? String(tempC).replace(".", ","),
            condutor,
            postes: recalcular(s.postes ?? [], s.vento, condutor),
          };
        }
        return s;
      },
      // A memória de cálculo salva pode ser de uma versão anterior do cálculo:
      // ao carregar, a linha inteira é recalculada com as regras vigentes.
      merge: (salvo, atual) => {
        const s = { ...atual, ...(salvo as Partial<ProjetoV2State>) };
        return { ...s, postes: recalcular(s.postes ?? [], s.vento, s.condutor) };
      },
    },
  ),
);
