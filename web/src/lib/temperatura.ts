/**
 * Temperatura da localidade por coordenada (lat, lon).
 *
 * Mesma ideia do Ng (ver ng.ts): uma amarra climática informativa da obra,
 * amostrada nas pontas do corredor derivação → entrega. Aqui a fonte é o
 * Open-Meteo (reanálise ERA5) — API pública, sem chave e com CORS, roda no
 * cliente como o OSRM/Nominatim já usados no projeto.
 *
 * Baixa as máximas e mínimas DIÁRIAS de uma janela de anos completos e reduz a:
 *   - média das máximas diárias e média das mínimas diárias (clima típico);
 *   - máxima absoluta e mínima absoluta observadas na janela (extremos).
 *
 * "Melhor esforço": em falha de rede ou resposta vazia, devolve null (a
 * interface segue sem a temperatura). Rejeita apenas em aborto.
 */

// Anos completos usados na climatologia (janela recente).
const ANOS_JANELA = 10;
// Arquivo público de reanálise (ERA5) do Open-Meteo.
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
// Tempo máximo por tentativa (ms). O backend de reanálise às vezes responde
// devagar na primeira chamada (cold start); sem um teto, o fetch fica pendurado
// e a temperatura "some" sem explicação.
const TIMEOUT_MS = 12_000;
// Tentativas totais (1 repetição). Uma primeira chamada lenta/fria costuma
// resolver rápido na segunda.
const TENTATIVAS = 2;

/**
 * fetch com teto de tempo por tentativa, respeitando também o `signal` externo.
 * Um estouro de tempo aborta só a tentativa (não é o aborto externo do usuário).
 */
async function fetchComTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const interno = new AbortController();
  const timer = setTimeout(() => interno.abort(new DOMException("timeout", "TimeoutError")), TIMEOUT_MS);
  const aoAbortar = () => interno.abort(signal?.reason);
  signal?.addEventListener("abort", aoAbortar, { once: true });
  try {
    return await fetch(url, { signal: interno.signal, headers: { Accept: "application/json" } });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", aoAbortar);
  }
}

/** Temperaturas resumidas de uma localidade (°C) numa janela de anos. */
export interface TemperaturaLocal {
  /** Média das máximas diárias (°C). */
  maxMedia: number;
  /** Média das mínimas diárias (°C). */
  minMedia: number;
  /** Maior máxima diária observada na janela (°C). */
  maxAbs: number;
  /** Menor mínima diária observada na janela (°C). */
  minAbs: number;
  /** Primeiro e último ano da janela climatológica. */
  anoIni: number;
  anoFim: number;
}

/** Média aritmética de uma lista não vazia. */
function media(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

/** Extremo de uma lista sem estourar a pilha com spread em milhares de itens. */
function extremo(xs: number[], tipo: "max" | "min"): number {
  let r = xs[0];
  for (const v of xs) r = tipo === "max" ? Math.max(r, v) : Math.min(r, v);
  return r;
}

/**
 * Temperatura na coordenada: máximas/mínimas diárias dos últimos `ANOS_JANELA`
 * anos completos reduzidas a médias e extremos. Null se a série vier vazia.
 */
export async function temperaturaPorCoordenada(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<TemperaturaLocal | null> {
  const anoFim = new Date().getFullYear() - 1; // último ano completo
  const anoIni = anoFim - (ANOS_JANELA - 1);
  const url =
    `${ARCHIVE}?latitude=${lat}&longitude=${lon}` +
    `&start_date=${anoIni}-01-01&end_date=${anoFim}-12-31` +
    `&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;

  // Uma repetição: a primeira chamada ao arquivo ERA5 pode vir fria/lenta e
  // estourar o timeout; a seguinte costuma responder em ~1 s.
  let resp: Response | null = null;
  let ultimoErro: unknown = null;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      resp = await fetchComTimeout(url, signal);
      break;
    } catch (e) {
      // Aborto do usuário (externo) propaga; timeout interno só encerra a tentativa.
      if (signal?.aborted) throw e;
      ultimoErro = e;
    }
  }
  if (!resp) throw ultimoErro instanceof Error ? ultimoErro : new Error("Open-Meteo indisponível");
  if (!resp.ok) throw new Error(`Open-Meteo respondeu ${resp.status}`);
  const dados: { daily?: { temperature_2m_max?: (number | null)[]; temperature_2m_min?: (number | null)[] } } =
    await resp.json();

  const num = (x: number | null): x is number => typeof x === "number" && Number.isFinite(x);
  const maxs = (dados.daily?.temperature_2m_max ?? []).filter(num);
  const mins = (dados.daily?.temperature_2m_min ?? []).filter(num);
  if (maxs.length === 0 || mins.length === 0) return null;

  const um = (x: number) => Number(x.toFixed(1));
  return {
    maxMedia: um(media(maxs)),
    minMedia: um(media(mins)),
    maxAbs: um(extremo(maxs, "max")),
    minAbs: um(extremo(mins, "min")),
    anoIni,
    anoFim,
  };
}
