// Servidor de desenvolvimento SEM o portão de login, só para conferir o visual
// no navegador (celular/tablet) sem credenciais. Usa o alvo "app" (usuário
// local fixo, sem proxy/servidor de sessão). NUNCA exponha este modo pelo túnel.
// Uso: node scripts/dev-sem-login.mjs [porta]
import { spawn } from "node:child_process";

const porta = process.argv[2] ?? "3002";
const filho = spawn(`npx next dev -p ${porta}`, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_PLATAFORMA: "android" },
});
filho.on("exit", (c) => process.exit(c ?? 0));
