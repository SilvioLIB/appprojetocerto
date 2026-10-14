/**
 * Espelho do projeto em @capacitor/preferences (SharedPreferences do Android),
 * só no APK. O zustand continua gravando no localStorage, com a mesma chave e
 * o mesmo formato; aqui copiamos a string persistida tal e qual. Se o WebView
 * perder o localStorage (limpeza de cache/armazenamento do WebView), o projeto
 * volta do espelho na próxima abertura. "Limpar dados" do app apaga os dois —
 * para isso existe o backup .json.
 */
import { ehNativo } from "@/lib/plataforma";
import { useProjetoV2 } from "@/lib/projeto-v2-store";

const ATRASO_MS = 400;

export function iniciarEspelho(): () => void {
  if (!ehNativo()) return () => {};
  const chave = useProjetoV2.persist.getOptions().name!;
  let cancelar: (() => void) | undefined;
  let cancelado = false;

  import("@capacitor/preferences").then(async ({ Preferences }) => {
    const local = localStorage.getItem(chave);
    if (local === null) {
      const { value } = await Preferences.get({ key: chave });
      if (value !== null) {
        localStorage.setItem(chave, value);
        await useProjetoV2.persist.rehydrate();
      }
    } else {
      await Preferences.set({ key: chave, value: local });
    }
    if (cancelado) return;

    // O persist grava no localStorage depois de notificar os assinantes:
    // lemos com um pequeno atraso (que também agrupa digitações seguidas).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const desassinar = useProjetoV2.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const valor = localStorage.getItem(chave);
        if (valor !== null) void Preferences.set({ key: chave, value: valor });
      }, ATRASO_MS);
    });
    cancelar = () => {
      clearTimeout(timer);
      desassinar();
    };
  });

  return () => {
    cancelado = true;
    cancelar?.();
  };
}
