/**
 * Alvo de build e ambiente de execução.
 *
 * - EH_APP: build do APK Android (NEXT_PUBLIC_PLATAFORMA=android). A variável é
 *   inlinada pelo Next no build, então `if (EH_APP)` some do bundle web.
 * - ehNativo(): está rodando de fato dentro do Capacitor (WebView do APK).
 *   Pode ser falso num build app servido por um servidor estático (testes).
 */
import { Capacitor } from "@capacitor/core";

import type { Usuario } from "@/lib/auth/users";

export const EH_APP = process.env.NEXT_PUBLIC_PLATAFORMA === "android";

export function ehNativo(): boolean {
  return EH_APP && Capacitor.isNativePlatform();
}

/**
 * O APK não tem portão de login (não há servidor dentro dele): quem tem o app
 * usa. Este usuário local fixo só existe para a navegação aparecer.
 */
export const USUARIO_LOCAL: Usuario = { email: "local", papel: "dono" };
