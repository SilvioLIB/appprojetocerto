"use client";

import { useSyncExternalStore } from "react";

const semAssinatura = () => () => {};

/**
 * true somente após montar no cliente — evita mismatch com estado persistido.
 * Usa useSyncExternalStore (snapshot false no servidor, true no cliente) em vez
 * de setState em efeito: sem render em cascata e hidratação consistente.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    semAssinatura,
    () => true, // cliente
    () => false, // servidor
  );
}
