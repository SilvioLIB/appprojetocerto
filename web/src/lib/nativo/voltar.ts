/**
 * Botão "voltar" do Android. Ordem: fecha seletor/diálogo aberto → tratadores
 * das telas, do mais recente ao mais antigo (memorial → postes; estrutura
 * escolhida → escolha da estrutura) → volta no histórico → na tela inicial,
 * confirma antes de sair. Um tratador devolve true quando consumiu o toque.
 * No site é inerte.
 */
import { EH_APP, ehNativo } from "@/lib/plataforma";

type Tratador = () => boolean;

const pilha: Tratador[] = [];

/** Registra um tratador. Devolve a função que o remove. */
export function registrarVoltar(tratador: Tratador): () => void {
  pilha.push(tratador);
  return () => {
    const i = pilha.lastIndexOf(tratador);
    if (i >= 0) pilha.splice(i, 1);
  };
}

/** Seletores e diálogos (Base UI) fecham com Escape — o voltar faz o mesmo. */
function fecharSobreposicao(): boolean {
  const aberta = document.querySelector('[data-slot="select-content"][data-open], [role="dialog"][data-open]');
  if (!aberta) return false;
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
  return true;
}

/** "sair" quando nada mais na tela consumiu o voltar. */
function tratarVoltar(): "tratado" | "historico" | "sair" {
  if (fecharSobreposicao()) return "tratado";
  for (let i = pilha.length - 1; i >= 0; i--) if (pilha[i]()) return "tratado";
  if (window.location.pathname !== "/" && window.history.length > 1) {
    window.history.back();
    return "historico";
  }
  return "sair";
}

/** Liga o botão físico/gesto de voltar (só no APK). Devolve o desligar. */
export function iniciarVoltar(): () => void {
  if (!ehNativo()) {
    // Build do app aberto no navegador (out/ servido localmente): gancho para
    // testar a cadeia do voltar sem aparelho. No site (EH_APP falso) não existe.
    if (EH_APP) (window as unknown as { __testeVoltar?: typeof tratarVoltar }).__testeVoltar = tratarVoltar;
    return () => {};
  }
  let remover: (() => void) | undefined;
  let cancelado = false;
  import("@capacitor/app").then(async ({ App }) => {
    const h = await App.addListener("backButton", () => {
      if (tratarVoltar() !== "sair") return;
      if (window.confirm("Sair do Projeto Certo? O projeto continua salvo no aparelho.")) void App.exitApp();
    });
    if (cancelado) h.remove();
    else remover = () => h.remove();
  });
  return () => {
    cancelado = true;
    remover?.();
  };
}
