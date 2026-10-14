"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

import { estaOnline, observarRede } from "@/lib/nativo/rede";

/**
 * Faixa discreta quando o aparelho fica sem internet (APK, uso em campo).
 * Diz o que deixa de funcionar e o que continua — o cálculo é todo local.
 */
export function AvisoOffline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let vivo = true;
    void estaOnline().then((v) => vivo && setOnline(v));
    const parar = observarRede(setOnline);
    return () => {
      vivo = false;
      parar();
    };
  }, []);

  if (online) return null;
  return (
    <div role="status" className="border-b border-amber-600/30 bg-amber-500/10 print:hidden">
      <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-xs leading-snug text-amber-900 dark:text-amber-200">
        <WifiOff className="mt-px size-3.5 shrink-0" />
        <span>
          <strong className="font-semibold">Sem internet.</strong> Mapa, rota, cidades do corredor e clima ficam
          indisponíveis; o cálculo dos postes e o memorial seguem normalmente.
        </span>
      </p>
    </div>
  );
}
