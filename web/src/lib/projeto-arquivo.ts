/**
 * Cópia de segurança do projeto guiado. O projeto vive só no localStorage do
 * navegador — trocar de aparelho, limpar dados do site ou usar aba anônima o
 * perde. Este módulo salva/abre o estado num arquivo .json.
 */
"use client";

import { salvarArquivo, type ResultadoSalvar } from "./nativo/arquivo";
import { useProjetoV2 } from "./projeto-v2-store";

const FORMATO = "validador-ged3648/projeto";
const VERSAO_ARQUIVO = 1;

interface ArquivoProjeto {
  formato: typeof FORMATO;
  versao: number;
  salvoEm: string;
  estado: Record<string, unknown>;
}

/** Nome de arquivo seguro a partir do nome da obra. */
function nomeArquivo(obra: string): string {
  const base =
    obra
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "projeto";
  const data = new Date().toISOString().slice(0, 10);
  return `${base}-${data}.json`;
}

/**
 * Salva o projeto atual como .json (funções do store ficam de fora): download
 * no site; no APK, grava em Documentos e abre o "Compartilhar".
 */
export function baixarProjeto(): Promise<ResultadoSalvar> {
  const estado = JSON.parse(JSON.stringify(useProjetoV2.getState())) as Record<string, unknown>;
  const arquivo: ArquivoProjeto = {
    formato: FORMATO,
    versao: VERSAO_ARQUIVO,
    salvoEm: new Date().toISOString(),
    estado,
  };
  return salvarArquivo(nomeArquivo(String(estado.obra ?? "")), JSON.stringify(arquivo, null, 2), "application/json");
}

/**
 * Lê um .json salvo por `baixarProjeto` e substitui o projeto atual.
 * Rejeita com mensagem pronta para o usuário quando o arquivo não serve.
 */
export async function abrirProjeto(arquivo: File): Promise<void> {
  let dados: unknown;
  try {
    dados = JSON.parse(await arquivo.text());
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  const d = dados as Partial<ArquivoProjeto>;
  if (d?.formato !== FORMATO || typeof d.estado !== "object" || d.estado === null) {
    throw new Error("Este arquivo não é uma cópia de projeto do validador.");
  }
  if ((d.versao ?? 0) > VERSAO_ARQUIVO) {
    throw new Error("A cópia foi salva por uma versão mais nova do validador.");
  }
  const e = d.estado;
  if (!Array.isArray(e.postes) || !["abertura", "postes", "concluido"].includes(String(e.fase))) {
    throw new Error("A cópia está incompleta: faltam a fase ou a lista de postes.");
  }
  // Só campos de dados — nunca sobrescreve as ações do store.
  const somenteDados = Object.fromEntries(Object.entries(e).filter(([, v]) => typeof v !== "function"));
  useProjetoV2.setState(somenteDados);
}
