/**
 * Entrega de um arquivo gerado pelo app ao usuário. Web: download do navegador
 * (Blob + <a download>). APK: grava em Documentos/Projeto Certo e abre o
 * "Compartilhar" do Android (WhatsApp, Drive, e-mail…), já que o WebView não
 * baixa arquivos. Os componentes chamam só `salvarArquivo`.
 */
import { ehNativo } from "@/lib/plataforma";

/** "baixado" (web) ou "compartilhado" (APK, folha de compartilhar aberta). */
export type ResultadoSalvar = "baixado" | "compartilhado";

const PASTA_APP = "Projeto Certo";

export async function salvarArquivo(nome: string, conteudo: string, tipo: string): Promise<ResultadoSalvar> {
  if (ehNativo()) {
    await salvarNativo(nome, conteudo);
    return "compartilhado";
  }
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
  return "baixado";
}

async function salvarNativo(nome: string, conteudo: string): Promise<void> {
  const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const arquivo = { path: `${PASTA_APP}/${nome}`, data: conteudo, encoding: Encoding.UTF8, recursive: true };
  let uri: string;
  try {
    // Documentos públicos: a cópia fica visível no gerenciador de arquivos.
    ({ uri } = await Filesystem.writeFile({ ...arquivo, directory: Directory.Documents }));
  } catch {
    // Sem acesso a Documentos (permissão negada no Android ≤ 9): cache do app,
    // que basta para compartilhar.
    ({ uri } = await Filesystem.writeFile({ ...arquivo, directory: Directory.Cache }));
  }
  try {
    await Share.share({ title: nome, files: [uri], dialogTitle: "Guardar ou enviar a cópia" });
  } catch (e) {
    // Fechar a folha de compartilhar sem escolher não é erro.
    if (!(e instanceof Error && /cancel/i.test(e.message))) throw e;
  }
}
