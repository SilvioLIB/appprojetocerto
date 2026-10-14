import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { COOKIE_SESSAO, DURACAO_SESSAO_MS, decriptar, encriptar } from "./crypto";
import type { Papel, Usuario } from "./users";

/**
 * DAL (Data Access Layer) de autenticação — a única forma dos Server
 * Components e Server Actions descobrirem quem está logado.
 */

/** Cria o cookie de sessão para o usuário autenticado. */
export async function criarSessao(usuario: Usuario): Promise<void> {
  const expiraEm = Date.now() + DURACAO_SESSAO_MS;
  const token = await encriptar({ email: usuario.email, papel: usuario.papel, expiraEm });
  // Em produção o cookie exige HTTPS (Secure). Se você serve por HTTP dentro de
  // uma rede já criptografada (ex.: Tailscale/WireGuard), defina COOKIE_INSEGURO=1
  // para permitir o cookie em http — caso contrário o login não persiste.
  const exigirHttps = process.env.NODE_ENV === "production" && process.env.COOKIE_INSEGURO !== "1";
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: exigirHttps,
    sameSite: "lax",
    expires: new Date(expiraEm),
    path: "/",
  });
}

/** Remove o cookie de sessão (logout). */
export async function apagarSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_SESSAO);
}

/**
 * Retorna o usuário logado, ou null. Memoizado por requisição via `cache()`
 * para não decriptar o mesmo cookie várias vezes no mesmo render.
 */
export const getUsuarioAtual = cache(async (): Promise<Usuario | null> => {
  const jar = await cookies();
  const sessao = await decriptar(jar.get(COOKIE_SESSAO)?.value);
  if (!sessao) return null;
  return { email: sessao.email, papel: sessao.papel };
});

/** Hierarquia de papéis para checagens de autorização. */
const NIVEL: Record<Papel, number> = { leitor: 1, editor: 2, dono: 3 };

/** True se o usuário tem pelo menos o papel exigido. */
export function temPapel(usuario: Usuario | null, minimo: Papel): boolean {
  if (!usuario) return false;
  return NIVEL[usuario.papel] >= NIVEL[minimo];
}
