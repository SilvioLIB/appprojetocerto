// Build do alvo app (APK Android): export estático em out/.
// Uso: npm run build:app
// Define NEXT_PUBLIC_PLATAFORMA=android e chama o `next build` — a config
// condicional está em next.config.ts. Funciona igual no Windows e no Linux.
import { spawnSync } from "node:child_process";
import { readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const r = spawnSync("npx next build", {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_PLATAFORMA: "android" },
});
if (r.status !== 0) process.exit(r.status ?? 1);

/**
 * Bug do Next 16 no Windows: os arquivos de prefetch de segmento deveriam sair
 * como `projeto/__next.projeto.__PAGE__.txt`, mas o caminho chega com "\" e
 * vira a pasta `projeto/__next.projeto/__PAGE__.txt`. O roteador pede o nome
 * achatado e recebe 404. Aqui achatamos: pasta `__next.X/Y/Z.txt` →
 * arquivo `__next.X.Y.Z.txt` ao lado. No Linux/macOS não há o que corrigir.
 */
function achatarSegmentos(dir) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (!statSync(caminho).isDirectory()) continue;
    if (nome.startsWith("__next.")) {
      for (const rel of listarArquivos(caminho)) {
        renameSync(join(caminho, rel), join(dir, `${nome}.${rel.replace(/[\\/]/g, ".")}`));
      }
      rmSync(caminho, { recursive: true });
    } else {
      achatarSegmentos(caminho);
    }
  }
}

function listarArquivos(dir, base = "") {
  return readdirSync(dir).flatMap((nome) => {
    const rel = base ? `${base}/${nome}` : nome;
    return statSync(join(dir, nome)).isDirectory() ? listarArquivos(join(dir, nome), rel) : [rel];
  });
}

achatarSegmentos(join(import.meta.dirname, "..", "out"));
