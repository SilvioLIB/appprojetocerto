// Servidor estático mínimo para conferir o build do app (out/) no navegador,
// do jeito que o WebView do Capacitor resolve: /projeto/ → projeto/index.html.
// Uso: npm run build:app && node scripts/servir-out.mjs [porta]
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const RAIZ = join(import.meta.dirname, "..", "out");
const PORTA = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  let arquivo = normalize(join(RAIZ, caminho));
  if (!arquivo.startsWith(RAIZ)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(arquivo) && statSync(arquivo).isDirectory()) arquivo = join(arquivo, "index.html");
  const achou = existsSync(arquivo);
  if (!achou) arquivo = join(RAIZ, "404.html");
  res.writeHead(achou ? 200 : 404, { "Content-Type": TIPOS[extname(arquivo)] ?? "application/octet-stream" });
  createReadStream(arquivo).pipe(res);
}).listen(PORTA, () => console.log(`out/ em http://localhost:${PORTA}`));
