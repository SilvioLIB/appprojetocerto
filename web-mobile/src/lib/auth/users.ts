import "server-only";

import bcrypt from "bcryptjs";

/**
 * Papéis do sistema (do mais para o menos privilegiado).
 * - dono   : administra tudo, gerencia usuários, vê todos os laudos.
 * - editor : usa o validador e cria/salva os próprios laudos.
 * - leitor : apenas visualiza (revisor/cliente).
 */
export const PAPEIS = ["dono", "editor", "leitor"] as const;
export type Papel = (typeof PAPEIS)[number];

export interface Usuario {
  email: string;
  papel: Papel;
}

/** Registro interno da allowlist (inclui o hash da senha). */
interface UsuarioComHash extends Usuario {
  senhaHash: string;
}

/**
 * A "base" de usuários é uma allowlist mantida em variável de ambiente,
 * então NÃO há banco de dados. O senhaHash é o hash bcrypt em base64 (o Next
 * expande "$" em valores de .env, o que corromperia o hash cru). Formato de
 * APP_USERS (array JSON em uma linha):
 *
 *   [
 *     { "email": "voce@dominio.com", "papel": "dono",   "senhaHash": "<base64>" },
 *     { "email": "eng@dominio.com",  "papel": "editor", "senhaHash": "<base64>" }
 *   ]
 *
 * Gere cada entrada (com o hash já em base64) com:  npm run criar-usuario
 */
function carregarAllowlist(): UsuarioComHash[] {
  const bruto = process.env.APP_USERS;
  if (!bruto) {
    console.warn(
      "[auth] APP_USERS não definido — nenhum usuário poderá entrar. Configure .env.local."
    );
    return [];
  }

  let dados: unknown;
  try {
    dados = JSON.parse(bruto);
  } catch {
    throw new Error("[auth] APP_USERS não é um JSON válido.");
  }
  if (!Array.isArray(dados)) {
    throw new Error("[auth] APP_USERS deve ser um array JSON.");
  }

  return dados.map((item, i) => {
    const u = item as Record<string, unknown>;
    const email = typeof u.email === "string" ? u.email.trim().toLowerCase() : "";
    const senhaHash = typeof u.senhaHash === "string" ? u.senhaHash : "";
    const papel = u.papel as Papel;
    if (!email || !senhaHash || !PAPEIS.includes(papel)) {
      throw new Error(`[auth] Usuário ${i} em APP_USERS está incompleto ou tem papel inválido.`);
    }
    return { email, papel, senhaHash };
  });
}

/**
 * Verifica e-mail + senha contra a allowlist.
 * Retorna o usuário (sem o hash) em caso de sucesso, ou null.
 * O trabalho de bcrypt é sempre feito para não vazar, por tempo de resposta,
 * se o e-mail existe ou não.
 */
export async function verificarCredenciais(
  email: string,
  senha: string
): Promise<Usuario | null> {
  const alvo = email.trim().toLowerCase();
  const usuarios = carregarAllowlist();
  const encontrado = usuarios.find((u) => u.email === alvo);

  // O senhaHash é bcrypt em base64: decodifica para o hash cru antes de comparar.
  // Hash "isca" (base64) mantém o tempo de resposta constante quando o e-mail não existe.
  const hashB64 =
    encontrado?.senhaHash ??
    Buffer.from("$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidin", "utf8").toString("base64");
  const hash = Buffer.from(hashB64, "base64").toString("utf8");
  const ok = await bcrypt.compare(senha, hash);

  if (!encontrado || !ok) return null;
  return { email: encontrado.email, papel: encontrado.papel };
}
