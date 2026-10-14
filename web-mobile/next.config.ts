import type { NextConfig } from "next";

/**
 * Dois alvos do mesmo código:
 * - web (padrão): servidor Next com portão de login, redirects e cabeçalhos.
 * - app (NEXT_PUBLIC_PLATAFORMA=android): export estático em `out/` para o
 *   Capacitor embalar no APK. Sem servidor → sem login, proxy, redirects,
 *   headers nem Server Actions.
 *
 * O que é exclusivo de cada alvo fica em arquivos de rota com sufixo:
 * `*.web.tsx` (/login, layout com sessão) e `*.app.tsx` (layout local).
 * `pageExtensions` faz o Next enxergar só os do alvo atual; os demais
 * (`page.tsx`, `layout.tsx`...) são comuns aos dois.
 *
 * Exceção: `src/proxy.ts` mantém o nome puro — o Turbopack identifica o proxy
 * pelo nome exato do arquivo (`proxy.web.ts` vira "middleware" legado). No
 * alvo app o próprio `output: "export"` desliga o proxy (aviso no build).
 */
const EH_APP = process.env.NEXT_PUBLIC_PLATAFORMA === "android";

/**
 * Origens externas por onde o site é acessado (proxy reverso da Cloudflare).
 * O Quick Tunnel (xxxx.trycloudflare.com) já vem liberado; com um túnel nomeado
 * num domínio próprio, defina DOMINIO_PUBLICO (ex.: "projeto.meudominio.com.br",
 * vários separados por vírgula) no .env.local antes do build.
 */
const ORIGENS_EXTERNAS = [
  "*.trycloudflare.com",
  ...(process.env.DOMINIO_PUBLICO ?? "").split(",").map((d) => d.trim()).filter(Boolean),
];
const EXTENSOES = ["tsx", "ts", "jsx", "js"];

/**
 * Cabeçalhos de segurança aplicados a todas as respostas. O app é privado
 * (portão de login) e não é embutido em outros sites.
 * - geolocation=(self): o botão "Usar minha localização" do projeto precisa dela.
 */
const CABECALHOS_SEGURANCA = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const configWeb: NextConfig = {
  pageExtensions: [...EXTENSOES.map((e) => `web.${e}`), ...EXTENSOES],
  poweredByHeader: false,
  // No `next dev`, libera o acesso pelo link do Cloudflare Quick Tunnel
  // (senão o Next bloqueia os assets de desenvolvimento vindos de outra origem).
  allowedDevOrigins: ORIGENS_EXTERNAS,
  experimental: {
    // Permite que o login (Server Action) funcione quando o site é acessado
    // através do Cloudflare Tunnel. Sem isto, o Next bloqueia o POST por
    // proteção anti-CSRF (origem difera do host). O curinga cobre a URL
    // aleatória do "quick tunnel" (xxxx.trycloudflare.com).
    serverActions: {
      allowedOrigins: ORIGENS_EXTERNAS,
    },
  },
  async redirects() {
    return [
      // O projeto guiado nasceu como "/v2"; links e favoritos antigos continuam valendo.
      { source: "/v2", destination: "/projeto", permanent: true },
      // A calculadora por categorias e o laudo (v1) saíram do site — ver /arquivo.
      { source: "/laudo", destination: "/projeto", permanent: false },
      { source: "/categoria/:id", destination: "/projeto", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS_SEGURANCA }];
  },
};

const configApp: NextConfig = {
  pageExtensions: [...EXTENSOES.map((e) => `app.${e}`), ...EXTENSOES],
  output: "export",
  // /projeto → out/projeto/index.html: o WebView do Capacitor resolve pastas.
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // Type-check sem os arquivos *.web.* (ex.: /login não é rota neste alvo).
  typescript: { tsconfigPath: "tsconfig.app.json" },
};

export default EH_APP ? configApp : configWeb;
