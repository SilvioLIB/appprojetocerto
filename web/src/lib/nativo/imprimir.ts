/**
 * Impressão / "Salvar como PDF" da página atual. Web: window.print(). APK: o
 * window.print() é inerte no WebView, então o plugin local "Imprimir"
 * (android/.../ImprimirPlugin.java) entrega o WebView ao PrintManager do
 * Android — o mesmo @media print de globals.css vale nos dois.
 */
import { registerPlugin } from "@capacitor/core";

import { ehNativo } from "@/lib/plataforma";

interface ImprimirPlugin {
  imprimir(opcoes: { titulo: string }): Promise<void>;
}

const Imprimir = registerPlugin<ImprimirPlugin>("Imprimir");

/** `titulo` vira o nome sugerido do PDF no APK. */
export async function imprimir(titulo: string = document.title): Promise<void> {
  if (ehNativo()) {
    await Imprimir.imprimir({ titulo });
    return;
  }
  window.print();
}
