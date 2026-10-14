import { SignJWT, jwtVerify } from "jose";

import type { Papel } from "./users";

/**
 * Cripto de sessão isolada aqui (sem `server-only` e sem `next/headers`)
 * para poder ser importada tanto pelas Server Actions (runtime Node) quanto
 * pelo `proxy.ts` (runtime Edge). Usa `jose`, que roda em ambos.
 */

export interface SessaoPayload {
  email: string;
  papel: Papel;
  /** epoch em ms de expiração */
  expiraEm: number;
  [key: string]: unknown;
}

/** Duração da sessão: 7 dias. */
export const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;

/** Nome do cookie de sessão. */
export const COOKIE_SESSAO = "sessao";

function chave(): Uint8Array {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo || segredo.length < 32) {
    throw new Error(
      "[auth] SESSION_SECRET ausente ou curto (mínimo 32 caracteres). Configure .env.local."
    );
  }
  return new TextEncoder().encode(segredo);
}

export async function encriptar(payload: SessaoPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(payload.expiraEm))
    .sign(chave());
}

export async function decriptar(token: string | undefined): Promise<SessaoPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    return payload as SessaoPayload;
  } catch {
    // Token inválido, expirado ou adulterado.
    return null;
  }
}
