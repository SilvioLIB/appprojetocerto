/**
 * Estado do laudo: acumula os cálculos feitos na sessão e os dados do projeto.
 * Persistido em localStorage; exportável/importável como JSON (salvar/reabrir).
 */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Entrada, Resultado } from "./operacoes";

export interface ItemLaudo {
  id: string;
  operacaoId: string;
  categoria: string;
  titulo: string;
  entradas: Entrada[];
  resultados: Resultado[];
  criadoEm: string; // ISO
}

export interface DadosProjeto {
  obra: string;
  responsavel: string;
  local: string;
  data: string;
  observacoes: string;
}

export interface ProjetoExportado {
  versao: 1;
  projeto: DadosProjeto;
  itens: ItemLaudo[];
  exportadoEm: string;
}

interface LaudoState {
  projeto: DadosProjeto;
  itens: ItemLaudo[];
  setProjeto: (dados: Partial<DadosProjeto>) => void;
  adicionarItem: (item: Omit<ItemLaudo, "id" | "criadoEm">) => void;
  removerItem: (id: string) => void;
  limpar: () => void;
  carregarProjeto: (dados: ProjetoExportado) => void;
  exportar: () => ProjetoExportado;
}

const projetoVazio: DadosProjeto = {
  obra: "",
  responsavel: "",
  local: "",
  data: "",
  observacoes: "",
};

function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useLaudo = create<LaudoState>()(
  persist(
    (set, get) => ({
      projeto: projetoVazio,
      itens: [],
      setProjeto: (dados) => set((s) => ({ projeto: { ...s.projeto, ...dados } })),
      adicionarItem: (item) =>
        set((s) => ({ itens: [...s.itens, { ...item, id: novoId(), criadoEm: new Date().toISOString() }] })),
      removerItem: (id) => set((s) => ({ itens: s.itens.filter((i) => i.id !== id) })),
      limpar: () => set({ projeto: projetoVazio, itens: [] }),
      carregarProjeto: (dados) =>
        set({ projeto: { ...projetoVazio, ...dados.projeto }, itens: dados.itens ?? [] }),
      exportar: () => ({
        versao: 1,
        projeto: get().projeto,
        itens: get().itens,
        exportadoEm: new Date().toISOString(),
      }),
    }),
    { name: "laudo-ged3648" },
  ),
);
