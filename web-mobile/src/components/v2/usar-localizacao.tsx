"use client";

import { useState } from "react";
import { Crosshair, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErroLocalizacao, obterPosicao } from "@/lib/nativo/localizacao";

/** Graus decimais no padrão dos campos (vírgula decimal, 6 casas ≈ 0,1 m). */
function paraCampo(v: number): string {
  return v.toFixed(6).replace(".", ",");
}

/**
 * Preenche um par lat/lon com a posição atual do aparelho (GPS do celular ou
 * localização do computador) via `obterPosicao` (navegador ou APK). Alternativa a
 * digitar: os campos continuam editáveis depois de preenchidos.
 */
export function UsarLocalizacao({
  onLocalizar,
  rotulo = "Usar minha localização",
}: {
  onLocalizar: (lat: string, lon: string) => void;
  rotulo?: string;
}) {
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [precisao, setPrecisao] = useState<number | null>(null);

  const localizar = async () => {
    setErro(null);
    setPrecisao(null);
    setBuscando(true);
    try {
      const pos = await obterPosicao();
      setPrecisao(pos.precisao);
      onLocalizar(paraCampo(pos.lat), paraCampo(pos.lon));
    } catch (e) {
      setErro(e instanceof ErroLocalizacao ? e.message : "Não foi possível obter a localização.");
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Button type="button" variant="outline" size="sm" disabled={buscando} onClick={localizar}>
        {buscando ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <Crosshair data-icon="inline-start" />
        )}
        {buscando ? "Localizando…" : rotulo}
      </Button>
      {precisao !== null && !erro && (
        <span className="text-xs text-muted-foreground">
          Precisão ≈ ±{Math.round(precisao).toLocaleString("pt-BR")} m
          {precisao > 100 && " — baixa; confira ou digite a coordenada"}
        </span>
      )}
      {erro && <span className="text-xs text-destructive">{erro}</span>}
    </div>
  );
}
