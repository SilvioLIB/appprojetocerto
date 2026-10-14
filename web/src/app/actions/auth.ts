"use server";

import { redirect } from "next/navigation";

import { apagarSessao, criarSessao } from "@/lib/auth/session";
import { verificarCredenciais } from "@/lib/auth/users";

export interface EstadoLogin {
  erro?: string;
}

/** Server Action de login (usada com useActionState no formulário). */
export async function login(
  _estado: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "");
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const usuario = await verificarCredenciais(email, senha);
  if (!usuario) {
    // Mensagem genérica de propósito: não revela se o e-mail existe.
    return { erro: "E-mail ou senha inválidos." };
  }

  await criarSessao(usuario);

  // Só aceita destinos internos (evita open-redirect).
  const proximo = String(formData.get("proximo") ?? "");
  const destino = proximo.startsWith("/") && !proximo.startsWith("//") ? proximo : "/";
  redirect(destino);
}

/** Server Action de logout. */
export async function logout(): Promise<void> {
  await apagarSessao();
  redirect("/login");
}
