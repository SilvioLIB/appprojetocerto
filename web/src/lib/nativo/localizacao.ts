/**
 * Posição atual do aparelho. Web: Geolocation API do navegador. APK: plugin
 * @capacitor/geolocation (pede a permissão nativa de localização).
 * Os componentes chamam só `obterPosicao` — nunca `navigator.geolocation`.
 */
import { EH_APP, ehNativo } from "@/lib/plataforma";

export interface Posicao {
  lat: number;
  lon: number;
  /** Raio de incerteza (m). */
  precisao: number;
}

/** Falha com mensagem pronta para mostrar ao usuário. */
export class ErroLocalizacao extends Error {}

const ONDE_LIBERAR = EH_APP ? "nas configurações do aparelho (Apps › Projeto Certo › Permissões)" : "nas configurações do navegador";

const MENSAGENS = {
  negada: `Permissão de localização negada. Libere o acesso ${ONDE_LIBERAR}.`,
  indisponivel: "Localização indisponível. Verifique se o GPS/localização do aparelho está ligado.",
  tempo: "O aparelho demorou a responder. Tente novamente (ao ar livre o GPS fixa mais rápido).",
  outro: "Não foi possível obter a localização.",
};

const OPCOES = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

export async function obterPosicao(): Promise<Posicao> {
  if (ehNativo()) return obterNativa();
  return obterWeb();
}

async function obterNativa(): Promise<Posicao> {
  const { Geolocation } = await import("@capacitor/geolocation");
  let permissao;
  try {
    permissao = await Geolocation.checkPermissions();
    if (permissao.location !== "granted") permissao = await Geolocation.requestPermissions({ permissions: ["location"] });
  } catch {
    // Lança quando o serviço de localização do aparelho está desligado.
    throw new ErroLocalizacao(MENSAGENS.indisponivel);
  }
  if (permissao.location !== "granted") throw new ErroLocalizacao(MENSAGENS.negada);
  try {
    const pos = await Geolocation.getCurrentPosition(OPCOES);
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, precisao: pos.coords.accuracy };
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : "";
    throw new ErroLocalizacao(
      msg.includes("timeout") ? MENSAGENS.tempo : msg.includes("disabled") || msg.includes("unavailable") ? MENSAGENS.indisponivel : MENSAGENS.outro,
    );
  }
}

function obterWeb(): Promise<Posicao> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.reject(new ErroLocalizacao("Este navegador não oferece localização."));
  }
  // Geolocation só funciona em contexto seguro (HTTPS ou localhost).
  if (!window.isSecureContext) {
    return Promise.reject(
      new ErroLocalizacao("A localização exige conexão segura (HTTPS). Acesse o sistema pelo endereço https."),
    );
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, precisao: pos.coords.accuracy }),
      (e) => {
        const chave =
          e.code === e.PERMISSION_DENIED ? "negada" : e.code === e.POSITION_UNAVAILABLE ? "indisponivel" : e.code === e.TIMEOUT ? "tempo" : "outro";
        reject(new ErroLocalizacao(MENSAGENS[chave]));
      },
      OPCOES,
    );
  });
}
