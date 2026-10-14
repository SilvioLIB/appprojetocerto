/**
 * Ng — densidade de descargas atmosféricas para a terra (ABNT NBR 5419-2:2015).
 *
 * Porte fiel, para o cliente (sem backend), dos módulos Python do pacote
 * `clima/` do "Projeto Validador de Projeto":
 *
 *   ng_nbr5419.py         → Ng tabelado por MUNICÍPIO (Anexo da NBR 5419-2).
 *   ng_faixas_sturges.py  → classificação do Ng em 4 faixas de igual amplitude
 *                           (método de Sturges com k fixado em 4).
 *
 * Diferente do V0 (isopletas, campo contínuo → ver vento.ts), o Ng da Norma é
 * tabelado por município. A tabela dos 5.572 municípios e as faixas já
 * calculadas vivem em /public/clima/ng-municipios.json, gerado de
 * clima/ng_nbr5419_municipios.csv por web/scripts/gerar-ng-json.py — mantenha
 * os dois em sincronia.
 *
 * Como a abertura do projeto trabalha por coordenada, `municipioPorCoordenada`
 * faz o reverse-geocode (Nominatim / OpenStreetMap) do ponto para município+UF,
 * e daí o Ng sai do lookup. É um "melhor esforço": em falha, a interface cai
 * para a seleção manual de UF + município.
 */

import type { TemperaturaLocal } from "./temperatura";

/** Faixa (grau) de descarga atmosférica de um valor de Ng. */
export interface GrauNg {
  /** Índice 1..4 da faixa. */
  faixa: number;
  /** Rótulo do grau: "Baixo" | "Moderado" | "Alto" | "Muito alto". */
  nivel: string;
  /** Intervalo textual, ex.: "[8, 16)" (última faixa fechada: "[24, 32]"). */
  intervalo: string;
  /** Cor da faixa (verde → amarelo → laranja → vermelho). */
  cor: string;
  /** O próprio Ng classificado (descargas/km²/ano). */
  ng: number;
}

interface BandasNg {
  limites: number[];
  rotulos: string[];
  cores: string[];
}

interface TabelaNg {
  fonte: string;
  bandas: BandasNg;
  /** Por UF: lista de [nomeMunicipio, ng]. */
  municipios: Record<string, [string, number][]>;
}

const URL_TABELA = "/clima/ng-municipios.json";

/**
 * Normaliza um nome de município para casar apesar de acentos/pontuação:
 * minúsculas, sem acento, não-alfanumérico → espaço, espaços colapsados.
 * Espelha `_norm` de ng_nbr5419.py.
 */
export function normalizarNome(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tabela carregada uma única vez (promessa cacheada).
let _tabela: Promise<TabelaNg> | null = null;

/** Carrega (e cacheia) a tabela de Ng do asset estático. */
export function carregarTabelaNg(signal?: AbortSignal): Promise<TabelaNg> {
  if (!_tabela) {
    _tabela = fetch(URL_TABELA, { signal }).then((r) => {
      if (!r.ok) throw new Error(`Tabela de Ng respondeu ${r.status}`);
      return r.json() as Promise<TabelaNg>;
    });
    // Não cacheia uma falha: permite nova tentativa depois.
    _tabela.catch(() => {
      _tabela = null;
    });
  }
  return _tabela;
}

/**
 * Índice (0..k-1) da faixa de `ng`. Última faixa fechada no topo.
 * Espelha `classificar` de ng_faixas_sturges.py.
 */
function indiceFaixa(ng: number, limites: number[]): number {
  const k = limites.length - 1;
  for (let i = 0; i < k; i++) {
    if (ng < limites[i + 1] || (i === k - 1 && ng <= limites[k])) return i;
  }
  return k - 1;
}

/** Texto do intervalo, ex.: "[8, 16)". Última faixa fechada: "[24, 32]". */
function rotuloIntervalo(i: number, limites: number[]): string {
  const a = limites[i];
  const b = limites[i + 1];
  const fecha = i === limites.length - 2 ? "]" : ")";
  return `[${a}, ${b}${fecha}`;
}

/** Classifica um valor de Ng nas 4 faixas de Sturges. */
export function grauDeNg(ng: number, bandas: BandasNg): GrauNg {
  const { limites, rotulos, cores } = bandas;
  const i = indiceFaixa(ng, limites);
  return {
    faixa: i + 1,
    nivel: rotulos[i] ?? `Faixa ${i + 1}`,
    intervalo: rotuloIntervalo(i, limites),
    cor: cores[i] ?? "#888888",
    ng,
  };
}

/** Resultado do Ng de um município (com a faixa já classificada). */
export interface NgMunicipio {
  municipio: string;
  uf: string;
  grau: GrauNg;
}

/** Ng do município (lookup por nome normalizado + UF), ou null se não achar. */
export async function ngMunicipio(
  nome: string,
  uf: string,
  signal?: AbortSignal,
): Promise<NgMunicipio | null> {
  const tab = await carregarTabelaNg(signal);
  const lista = tab.municipios[uf.toUpperCase()];
  if (!lista) return null;
  const alvo = normalizarNome(nome);
  const achado = lista.find(([m]) => normalizarNome(m) === alvo);
  if (!achado) return null;
  return { municipio: achado[0], uf: uf.toUpperCase(), grau: grauDeNg(achado[1], tab.bandas) };
}

/** Lista as UFs disponíveis, em ordem. */
export async function listarUFs(signal?: AbortSignal): Promise<string[]> {
  const tab = await carregarTabelaNg(signal);
  return Object.keys(tab.municipios);
}

/** Lista os municípios de uma UF (nomes de exibição, já ordenados). */
export async function listarMunicipios(uf: string, signal?: AbortSignal): Promise<string[]> {
  const tab = await carregarTabelaNg(signal);
  return (tab.municipios[uf.toUpperCase()] ?? []).map(([m]) => m);
}

// Reverse-geocode público do OpenStreetMap (mesma base do OSRM da estimativa).
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";

/** Município + UF resolvidos de uma coordenada. */
export interface MunicipioCoord {
  municipio: string;
  uf: string;
}

/**
 * Reverse-geocode de (lat, lon) → município + UF, pela base aberta do
 * OpenStreetMap (Nominatim). Melhor esforço: devolve null em falha de rede,
 * fora do Brasil, ou quando não dá para extrair município/UF.
 */
export async function municipioPorCoordenada(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<MunicipioCoord | null> {
  const url =
    `${NOMINATIM}?format=jsonv2&zoom=10&addressdetails=1` +
    `&accept-language=pt-BR&lat=${lat}&lon=${lon}`;
  const resp = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error(`Nominatim respondeu ${resp.status}`);
  const dados: { address?: Record<string, string> } = await resp.json();
  const addr = dados.address;
  if (!addr) return null;

  // UF: código de "BR-PB" (ISO 3166-2, nível estado) é o mais confiável.
  const iso = addr["ISO3166-2-lvl4"];
  const uf = iso && iso.startsWith("BR-") ? iso.slice(3).toUpperCase() : null;
  // Nome do município: Nominatim varia entre city/town/village/municipality.
  const municipio =
    addr.city || addr.town || addr.municipality || addr.village || addr.county || null;

  if (!uf || !municipio) return null;
  return { municipio, uf };
}

/**
 * Ng na coordenada: reverse-geocode → município/UF → lookup na tabela.
 * Devolve também o município resolvido (útil para exibir/ajustar à mão).
 * Rejeita apenas em aborto; nos demais casos devolve o que conseguir.
 */
export interface NgCoordenada {
  /** Município/UF resolvidos pelo reverse-geocode (null se não resolveu). */
  local: MunicipioCoord | null;
  /** Ng do município (null se o geocode falhou ou o município não está na tabela). */
  ng: NgMunicipio | null;
}

export async function ngPorCoordenada(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<NgCoordenada> {
  const local = await municipioPorCoordenada(lat, lon, signal);
  if (!local) return { local: null, ng: null };
  const ng = await ngMunicipio(local.municipio, local.uf, signal);
  return { local, ng };
}

/** Clima amostrado numa das pontas do corredor (derivação ou entrega). */
export interface PontaClima {
  municipio: string;
  uf: string;
  ng: number;
  faixa: number;
  nivel: string;
  cor: string;
  /** V0 (m/s) das isopletas da NBR 6123 no ponto. */
  v0: number;
  /** Temperatura da localidade (Open-Meteo/ERA5), quando disponível. */
  temp?: TemperaturaLocal;
}

/**
 * "Contorno" climático da região do projeto: clima nas duas pontas do corredor
 * derivação → entrega (Ng da NBR 5419-2 + V0 da NBR 6123), sem varrer o estado
 * inteiro. Guardado no projeto como amarra informativa da obra.
 */
export interface ClimaRegiao {
  derivacao: PontaClima;
  entrega: PontaClima;
  /** Faixa dominante = a maior das duas pontas (pior caso). */
  ngMax: number;
  faixaMax: number;
  nivelMax: string;
  corMax: string;
  /** Faixa V0 (m/s) ao longo do corredor. */
  v0Min: number;
  v0Max: number;
  calculadoEm: string; // ISO
}
