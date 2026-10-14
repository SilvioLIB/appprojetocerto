"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { ajustarBarras } from "@/lib/nativo/barras";
import { iniciarEspelho } from "@/lib/nativo/espelho";
import { iniciarVoltar } from "@/lib/nativo/voltar";

/**
 * Liga os serviços nativos do APK que valem para o app inteiro (botão voltar,
 * espelho do projeto, barras do sistema no tema). Montado só em
 * app/layout.app.tsx; fora do Capacitor (ex.: out/ servido no navegador) cada
 * serviço é inerte.
 */
export function PonteNativa() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const desligar = [iniciarVoltar(), iniciarEspelho()];
    return () => desligar.forEach((f) => f());
  }, []);

  useEffect(() => {
    if (resolvedTheme) void ajustarBarras(resolvedTheme === "dark");
  }, [resolvedTheme]);

  return null;
}
