import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { COOKIE_SESSAO, decriptar } from "@/lib/auth/crypto";

/**
 * Portão de acesso (Next 16 chama isto de "proxy"; era o antigo middleware).
 * Roda no servidor ANTES de qualquer rota renderizar. Faz uma checagem
 * "otimista": só valida a assinatura/expiração do cookie de sessão (via jose,
 * edge-safe) — sem banco de dados. A autorização fina por papel é feita nos
 * Server Components/Actions com a DAL (getUsuarioAtual/temPapel).
 *
 * Efeito prático: quem acessa de fora sem sessão válida é mandado para /login.
 */

/** Rotas acessíveis sem estar logado. */
const ROTAS_PUBLICAS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ehPublica = ROTAS_PUBLICAS.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );

  const token = request.cookies.get(COOKIE_SESSAO)?.value;
  const sessao = await decriptar(token);
  const logado = sessao !== null && sessao.expiraEm > Date.now();

  // Não logado tentando acessar rota protegida → manda para o login,
  // guardando o destino para retornar depois.
  if (!logado && !ehPublica) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("proximo", pathname);
    return NextResponse.redirect(url);
  }

  // Já logado tentando ver o /login → manda para a home.
  if (logado && ehPublica) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Roda em tudo, menos assets estáticos e a rota de API interna do Next.
   * Sem isto, o portão bloquearia CSS/JS/imagens (e robots/manifest, que
   * precisam responder mesmo sem login).
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|apple-icon|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
