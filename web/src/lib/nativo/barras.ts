/**
 * Barras do sistema (status e navegação) acompanhando o tema do app. No
 * Android 15+ o app é edge-to-edge: as barras são transparentes sobre o
 * cabeçalho e só a cor dos ícones importa. Em WebView/Android mais antigos o
 * Capacitor recua o conteúdo e a barra de status ganha a cor de fundo do tema.
 * No site é inerte (o navegador usa o themeColor do viewport).
 */
import { ehNativo } from "@/lib/plataforma";

/** Mesmos tons do themeColor em components/raiz-html.tsx. */
const FUNDO = { escuro: "#1c2029", claro: "#fafbfc" };

export async function ajustarBarras(escuro: boolean): Promise<void> {
  if (!ehNativo()) return;
  const { SystemBars, SystemBarsStyle } = await import("@capacitor/core");
  // Dark = ícones claros, para fundo escuro.
  await SystemBars.setStyle({ style: escuro ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
  const { StatusBar } = await import("@capacitor/status-bar");
  // Sem efeito (e às vezes rejeitado) quando o app é edge-to-edge.
  await StatusBar.setBackgroundColor({ color: escuro ? FUNDO.escuro : FUNDO.claro }).catch(() => {});
}
