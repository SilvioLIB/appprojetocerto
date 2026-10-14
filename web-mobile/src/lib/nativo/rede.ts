/**
 * Situação da conexão. Web: navigator.onLine + eventos online/offline. APK:
 * @capacitor/network (mais confiável no WebView). Só informa — os fetch de
 * mapa, rota, cidades e clima seguem nos próprios módulos, que já têm
 * alternativa offline (ex.: geodésica × fator de sinuosidade).
 */
import { ehNativo } from "@/lib/plataforma";

export async function estaOnline(): Promise<boolean> {
  if (ehNativo()) {
    const { Network } = await import("@capacitor/network");
    return (await Network.getStatus()).connected;
  }
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/** Chama `aoMudar` a cada mudança de conexão. Devolve a função de cancelar. */
export function observarRede(aoMudar: (online: boolean) => void): () => void {
  if (ehNativo()) {
    let cancelado = false;
    let remover: (() => void) | undefined;
    import("@capacitor/network").then(async ({ Network }) => {
      const h = await Network.addListener("networkStatusChange", (s) => aoMudar(s.connected));
      if (cancelado) h.remove();
      else remover = () => h.remove();
    });
    return () => {
      cancelado = true;
      remover?.();
    };
  }
  const on = () => aoMudar(true);
  const off = () => aoMudar(false);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return () => {
    window.removeEventListener("online", on);
    window.removeEventListener("offline", off);
  };
}
