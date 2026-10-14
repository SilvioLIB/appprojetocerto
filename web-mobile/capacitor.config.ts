import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

import { SITE } from "./src/lib/site";

/**
 * APK Android: o Capacitor embala o export estático (`npm run build:app` → out/)
 * num WebView. Ver docs/android/PLANO.md.
 */
const config: CapacitorConfig = {
  appId: "br.com.projetocerto.app",
  appName: SITE.nome,
  webDir: "out",
  // Identificação exigida pelas políticas do OpenStreetMap (Nominatim e tiles):
  // vai no User-Agent de toda requisição do WebView — fetch e <img> dos tiles.
  // As APIs usadas (Nominatim, OSRM, Open-Meteo, tiles) respondem CORS "*",
  // então o fetch comum funciona a partir de https://localhost sem CapacitorHttp.
  appendUserAgent: `ProjetoCerto/${SITE.versao} (Android; br.com.projetocerto.app)`,
  plugins: {
    // Teclado redimensiona o body: a barra fixa da abertura fica acima dele.
    Keyboard: { resize: KeyboardResize.Body },
    SystemBars: { insetsHandling: "css" },
  },
};

export default config;
