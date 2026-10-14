/**
 * Estimativa da EXTENSÃO de uma linha de distribuição entre dois pontos:
 * do ponto de DERIVAÇÃO (onde a linha sai da rede existente) até o ponto de
 * ENTREGA da carga (unidade consumidora).
 *
 * Fonte da distância "de arruamento": OSRM (Open Source Routing Machine)
 * roteando sobre a base geográfica aberta do OpenStreetMap — servidor público
 * `router.project-osrm.org`. Como a rede de distribuição acompanha o traçado
 * das ruas, a rota rodoviária é um proxy razoável do comprimento da linha.
 *
 * Sem rede (offline) ou em falha do serviço, a função cai para a distância
 * geodésica (grande círculo, Haversine) multiplicada por um fator de
 * sinuosidade — assim o usuário nunca fica sem uma estimativa.
 *
 * Tudo roda no cliente (sem backend próprio): o OSRM público responde com CORS.
 */

/** Coordenada geográfica em graus decimais. */
export interface Coordenada {
  lat: number;
  lon: number;
}

/** De onde veio a distância adotada. */
export type FonteDistancia = "osrm" | "geodesica";

export interface DistanciaLinha {
  derivacao: Coordenada;
  entrega: Coordenada;
  /** Distância em linha reta (geodésica, Haversine), em km. */
  retaKm: number;
  /** Extensão adotada da linha, em km. */
  distanciaKm: number;
  /** Fonte da extensão adotada. */
  fonte: FonteDistancia;
  /** Fator de sinuosidade aplicado quando a fonte é a geodésica. */
  fatorSinuosidade?: number;
  /** Texto curto explicando a fonte (para exibir na interface). */
  observacao: string;
}

// Raio médio da Terra (IUGG), em km — usado no Haversine.
const RAIO_TERRA_KM = 6371.0088;

/** Faixa aceitável para o vão médio informado pelo usuário (m). */
export const VAO_MEDIO_MIN_M = 10;
export const VAO_MEDIO_MAX_M = 500;

export interface EstimativaPostes {
  /** Extensão da linha usada na conta (km). */
  distanciaKm: number;
  /** Vão médio adotado (m). */
  vaoMedioM: number;
  /** Número de vãos = extensão ÷ vão médio, arredondado para cima. */
  numeroVaos: number;
  /** Número de postes = vãos + 1 (inclui as duas extremidades da linha). */
  numeroPostes: number;
}

/**
 * Estima a quantidade média de postes de uma linha a partir da sua extensão e
 * do vão médio pretendido. A linha com N vãos tem N+1 postes (as duas pontas
 * contam). O vão médio é arredondado para cima em número de vãos, para que
 * nenhum vão real ultrapasse o vão médio pretendido.
 */
export function estimarNumeroPostes(distanciaKm: number, vaoMedioM: number): EstimativaPostes {
  const distanciaM = Math.max(0, distanciaKm) * 1000;
  const vao = Math.max(1, vaoMedioM); // evita divisão por zero
  const numeroVaos = Math.max(1, Math.ceil(distanciaM / vao));
  return {
    distanciaKm,
    vaoMedioM,
    numeroVaos,
    numeroPostes: numeroVaos + 1,
  };
}

/**
 * Fator de sinuosidade PADRÃO aplicado à reta quando não há rota disponível.
 * Uma linha que acompanha o arruamento costuma ser ~30% mais longa que a reta.
 * Pode ser sobrescrito por poste/projeto via `estimarDistanciaLinha`.
 */
export const FATOR_SINUOSIDADE_PADRAO = 1.3;

/** Faixa aceitável para o fator de sinuosidade informado pelo usuário. */
export const FATOR_SINUOSIDADE_MIN = 1.0;
export const FATOR_SINUOSIDADE_MAX = 3.0;

/** Mantém o fator dentro da faixa; volta ao padrão se não for um número. */
export function normalizarFatorSinuosidade(fator: number): number {
  if (!Number.isFinite(fator)) return FATOR_SINUOSIDADE_PADRAO;
  return Math.min(Math.max(fator, FATOR_SINUOSIDADE_MIN), FATOR_SINUOSIDADE_MAX);
}

// Servidor público do OSRM (perfil "driving") sobre dados do OpenStreetMap.
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

const grausParaRad = (x: number): number => (x * Math.PI) / 180;

/** Distância geodésica (grande círculo) entre duas coordenadas, em km. */
export function distanciaGeodesicaKm(a: Coordenada, b: Coordenada): number {
  const dLat = grausParaRad(b.lat - a.lat);
  const dLon = grausParaRad(b.lon - a.lon);
  const lat1 = grausParaRad(a.lat);
  const lat2 = grausParaRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Comprimento da rota rodoviária entre dois pontos (OpenStreetMap/OSRM), em km.
 * Lança em caso de rede indisponível, erro HTTP ou ausência de rota.
 */
async function rotaOsrmKm(a: Coordenada, b: Coordenada, signal?: AbortSignal): Promise<number> {
  // O OSRM espera as coordenadas na ordem lon,lat.
  const coords = `${a.lon},${a.lat};${b.lon},${b.lat}`;
  const url = `${OSRM_BASE}/${coords}?overview=false&alternatives=false&steps=false`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`OSRM respondeu ${resp.status}`);
  const dados: { code?: string; routes?: { distance: number }[] } = await resp.json();
  const rota = dados.routes?.[0];
  if (dados.code !== "Ok" || !rota) {
    throw new Error(`OSRM não encontrou rota (${dados.code ?? "sem código"})`);
  }
  return rota.distance / 1000; // metros → km
}

/**
 * Traçado (polilinha) da rota entre dois pontos pela base do OpenStreetMap
 * (OSRM), como lista de coordenadas na ordem do percurso. Usado só para a
 * VISUALIZAÇÃO em mapa — a extensão em km sai de `estimarDistanciaLinha`.
 *
 * Devolve null (sem lançar, exceto em aborto) quando não há rota ou a rede
 * falha; nesse caso a interface desenha a reta entre os dois pontos.
 */
export async function rotaGeometria(
  a: Coordenada,
  b: Coordenada,
  signal?: AbortSignal,
): Promise<Coordenada[] | null> {
  const coords = `${a.lon},${a.lat};${b.lon},${b.lat}`;
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&alternatives=false&steps=false`;
  try {
    const resp = await fetch(url, { signal });
    if (!resp.ok) return null;
    const dados: {
      code?: string;
      routes?: { geometry?: { coordinates?: [number, number][] } }[];
    } = await resp.json();
    const linha = dados.routes?.[0]?.geometry?.coordinates;
    if (dados.code !== "Ok" || !linha || linha.length === 0) return null;
    // GeoJSON traz [lon, lat]; convertemos para {lat, lon}.
    return linha.map(([lon, lat]) => ({ lat, lon }));
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return null;
  }
}

/**
 * Estima a extensão da linha entre o ponto de derivação e o ponto de entrega.
 * Tenta a rota pelo arruamento (OpenStreetMap/OSRM); em falha, usa a geodésica
 * com fator de sinuosidade. Só rejeita se a requisição for abortada (AbortSignal).
 */
export async function estimarDistanciaLinha(
  derivacao: Coordenada,
  entrega: Coordenada,
  opcoes: { signal?: AbortSignal; fatorSinuosidade?: number } = {},
): Promise<DistanciaLinha> {
  const retaKm = distanciaGeodesicaKm(derivacao, entrega);
  // O fator só entra na queda geodésica; a rota do OSRM já reflete a sinuosidade real.
  const fator = normalizarFatorSinuosidade(opcoes.fatorSinuosidade ?? FATOR_SINUOSIDADE_PADRAO);
  try {
    const rotaKm = await rotaOsrmKm(derivacao, entrega, opcoes.signal);
    return {
      derivacao,
      entrega,
      retaKm,
      distanciaKm: rotaKm,
      fonte: "osrm",
      observacao: "Traçado pelo arruamento (OpenStreetMap / OSRM).",
    };
  } catch (e) {
    // Abortos são intencionais (nova consulta ou desmontagem): propaga.
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return {
      derivacao,
      entrega,
      retaKm,
      distanciaKm: retaKm * fator,
      fonte: "geodesica",
      fatorSinuosidade: fator,
      observacao: `Rota indisponível — reta × ${fator.toLocaleString("pt-BR")} (sinuosidade estimada).`,
    };
  }
}
