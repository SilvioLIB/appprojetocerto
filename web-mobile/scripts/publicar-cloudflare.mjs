// Publica a versão mobile TEMPORARIAMENTE pela Cloudflare (Quick Tunnel):
//   1. confere o .env.local (portão de login) e faz o build de produção se faltar;
//   2. sobe `next start` na porta 3001 (o validador original segue livre na 3000);
//   3. abre um túnel `cloudflared` e mostra o link https://xxxx.trycloudflare.com.
// O link vale enquanto esta janela ficar aberta (Ctrl+C encerra os dois).
//
// Uso:  npm run publicar            (build só se ainda não houver)
//       npm run publicar -- --build (força um build novo antes)
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(import.meta.dirname, "..");
const PORTA = process.env.PORT ?? "3001";
const forcarBuild = process.argv.includes("--build");

function sair(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// 1) Portão de login: sem segredo/usuários o site abriria quebrado (ou sem trava).
const env = join(RAIZ, ".env.local");
if (!existsSync(env)) sair("Falta web-mobile/.env.local (copie de .env.local.example e preencha — ver SEGURANCA.md).");
const conteudo = readFileSync(env, "utf8");
if (!/^SESSION_SECRET=.{32,}/m.test(conteudo)) sair("SESSION_SECRET ausente ou curto no .env.local (npm run gerar-segredo).");
if (!/^APP_USERS=\[/m.test(conteudo)) sair("APP_USERS ausente no .env.local (npm run criar-usuario -- <email> <senha> <papel>).");
if (/^COOKIE_INSEGURO=1/m.test(conteudo)) sair("Desative COOKIE_INSEGURO no .env.local antes de expor na internet.");

// cloudflared instalado?
const cf = spawnSync("cloudflared", ["--version"], { shell: true, encoding: "utf8" });
if (cf.status !== 0) sair("cloudflared não encontrado. Instale: winget install --id Cloudflare.cloudflared");

// 2) Build de produção (o alvo web, com portão de login).
if (forcarBuild || !existsSync(join(RAIZ, ".next", "BUILD_ID"))) {
  console.log("▸ Gerando o build de produção…");
  const b = spawnSync("npx next build", { cwd: RAIZ, stdio: "inherit", shell: true, env: { ...process.env, NEXT_PUBLIC_PLATAFORMA: "" } });
  if (b.status !== 0) sair("O build falhou — corrija os erros acima e rode de novo.");
}

const filhos = [];
function encerrar() {
  for (const f of filhos) {
    if (f.exitCode !== null || !f.pid) continue;
    // No Windows o shell intermediário não repassa o sinal: derruba a árvore toda.
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(f.pid), "/T", "/F"], { stdio: "ignore" });
    else f.kill();
  }
  process.exit(0);
}
process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);

console.log(`▸ Iniciando o servidor em http://localhost:${PORTA} …`);
const servidor = spawn(`npx next start -p ${PORTA}`, { cwd: RAIZ, shell: true, stdio: ["ignore", "inherit", "inherit"] });
filhos.push(servidor);
servidor.on("exit", (c) => {
  console.error(`\n✖ O servidor parou (código ${c}).`);
  encerrar();
});

// 3) Túnel. O cloudflared escreve o link no stderr.
console.log("▸ Abrindo o túnel da Cloudflare…");
const tunel = spawn(`cloudflared tunnel --no-autoupdate --url http://localhost:${PORTA}`, {
  cwd: RAIZ,
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});
filhos.push(tunel);
let mostrado = false;
const procurarLink = (buf) => {
  const texto = buf.toString();
  const link = texto.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0];
  if (link && !mostrado) {
    mostrado = true;
    console.log(
      [
        "",
        "  ┌──────────────────────────────────────────────────────────────",
        `  │  Projeto Certo (mobile) no ar:  ${link}`,
        "  │  Abra no celular/tablet. O acesso continua pelo login (APP_USERS).",
        "  │  No celular: menu do navegador → \"Adicionar à tela inicial\".",
        "  │  O link morre ao fechar esta janela (Ctrl+C).",
        "  └──────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  }
  // Repassa só os erros do cloudflared (o resto é log de conexão).
  for (const linha of texto.split("\n")) if (/\sERR\s/.test(linha)) console.error(linha);
};
tunel.stdout.on("data", procurarLink);
tunel.stderr.on("data", procurarLink);
tunel.on("exit", (c) => {
  console.error(`\n✖ O túnel fechou (código ${c}).`);
  encerrar();
});
