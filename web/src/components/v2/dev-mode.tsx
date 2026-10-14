"use client";

import { useState } from "react";
import { FlaskConical, MapPin, RefreshCw, Wind } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjetoV2, type FaseProjeto } from "@/lib/projeto-v2-store";
import { ventoDeVelocidade, ventoNoPonto, type VentoResultado } from "@/lib/vento";
import { dimensionarPoste, fmt, trechosDaLinha } from "@/lib/dimensionamento";
import { ComUnidade, paraNumero } from "./campos";

/** Botão que liga/desliga o modo desenvolvedor (persistido no projeto). */
export function DevToggle() {
  const dev = useProjetoV2((s) => s.dev);
  const toggleDev = useProjetoV2((s) => s.toggleDev);
  return (
    <button
      type="button"
      onClick={toggleDev}
      aria-pressed={dev}
      title="Destrava o vento e a navegação entre etapas para testar cenários"
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
        dev
          ? "border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      <FlaskConical className="size-3.5" />
      Modo dev {dev ? "ligado" : "desligado"}
    </button>
  );
}

const FASES: { id: FaseProjeto; rotulo: string }[] = [
  { id: "abertura", rotulo: "Abertura" },
  { id: "postes", rotulo: "Postes" },
  { id: "concluido", rotulo: "Memorial" },
];

/**
 * Barra do modo desenvolvedor: navegação livre entre as etapas e edição do
 * vento travado (por coordenada ou km/h forçado), recalculando todos os postes.
 */
export function DevBar() {
  const s = useProjetoV2();

  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [kmh, setKmh] = useState("");

  // Espelha os campos com o vento vigente sempre que ele muda — ajuste de
  // estado durante o render (padrão do React), sem setState em efeito.
  const [ventoEspelhado, setVentoEspelhado] = useState<VentoResultado | null>(null);
  if (s.vento !== ventoEspelhado) {
    setVentoEspelhado(s.vento);
    if (s.vento) {
      setLat(String(s.vento.latitude).replace(".", ","));
      setLon(String(s.vento.longitude).replace(".", ","));
      setKmh(fmt(s.vento.v_kmh, 1));
    }
  }

  if (!s.dev) return null;

  const podeFase = (f: FaseProjeto) => {
    if (f === "abertura") return true;
    if (f === "postes") return !!s.vento && !!s.condutor;
    return s.postes.length > 0; // memorial
  };

  const recalculadosMsg = () =>
    s.postes.length > 0 ? ` — ${s.postes.length} poste(s) recalculado(s)` : "";

  const aplicarCoordenada = () => {
    const la = paraNumero(lat);
    const lo = paraNumero(lon);
    const valida =
      !Number.isNaN(la) && !Number.isNaN(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
    if (!valida) {
      toast.error("Coordenada inválida (lat −90…90, lon −180…180).");
      return;
    }
    const v = ventoNoPonto(la, lo);
    s.setAbertura({ coordLat: lat, coordLon: lon });
    s.setVento(v);
    toast.success(`Vento → ${fmt(v.v_kmh, 1)} km/h pela coordenada${recalculadosMsg()}`);
  };

  const aplicarKmh = () => {
    const v_kmh = paraNumero(kmh);
    if (Number.isNaN(v_kmh) || v_kmh <= 0) {
      toast.error("Informe uma velocidade em km/h maior que zero.");
      return;
    }
    // Mantém a coordenada vigente só como referência no memorial.
    const base = s.vento;
    const v = ventoDeVelocidade(v_kmh, base?.latitude ?? 0, base?.longitude ?? 0);
    s.setVento(v);
    toast.success(`Vento forçado → ${fmt(v.v_kmh, 1)} km/h${recalculadosMsg()}`);
  };

  return (
    <div className="mt-3 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/[0.06] p-3 print:hidden">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-amber-700 uppercase dark:text-amber-300">
        <FlaskConical className="size-3.5" /> Modo desenvolvedor
      </div>

      {/* Navegação livre entre etapas */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Ir para:</span>
        {FASES.map((f) => {
          const ativo = s.fase === f.id;
          const habil = podeFase(f.id);
          return (
            <button
              key={f.id}
              type="button"
              disabled={!habil}
              onClick={() => s.irParaFase(f.id)}
              aria-pressed={ativo}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 ${
                ativo
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              {f.rotulo}
            </button>
          );
        })}
      </div>

      {/* Edição do vento — só quando já existe vento travado */}
      {s.vento && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="size-3" /> Latitude
              </label>
              <ComUnidade unidade="lat">
                <Input
                  inputMode="decimal"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="h-8 w-32 pr-9 text-sm"
                />
              </ComUnidade>
            </div>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="size-3" /> Longitude
              </label>
              <ComUnidade unidade="lon">
                <Input
                  inputMode="decimal"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  className="h-8 w-32 pr-9 text-sm"
                />
              </ComUnidade>
            </div>
            <Button size="sm" variant="outline" className="h-8" onClick={aplicarCoordenada}>
              <RefreshCw className="size-3.5" /> Recalcular pela coordenada
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2 md:border-l md:border-amber-500/30 md:pl-3">
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Wind className="size-3" /> Forçar velocidade
              </label>
              <ComUnidade unidade="km/h">
                <Input
                  inputMode="decimal"
                  value={kmh}
                  onChange={(e) => setKmh(e.target.value)}
                  className="h-8 w-28 pr-12 text-sm"
                />
              </ComUnidade>
            </div>
            <Button size="sm" variant="outline" className="h-8" onClick={aplicarKmh}>
              <Wind className="size-3.5" /> Aplicar
            </Button>
          </div>
        </div>
      )}

      <p className="mt-2.5 text-[11px] text-muted-foreground">
        Alterar o vento recalcula na hora todos os postes já dimensionados. Ferramenta de teste —
        não altera o cálculo em si.
      </p>

      {/* === TESTE: varredura de 3 ventos (comente a linha abaixo para desabilitar) === */}
      <VarreduraVentosDev />
      {/* === FIM TESTE varredura de 3 ventos === */}
    </div>
  );
}

/* ==========================================================================
 * BLOCO DE TESTE — Varredura de 3 ventos
 * --------------------------------------------------------------------------
 * Roda 3 cálculos mudando SÓ o vento: para cada velocidade informada abaixo,
 * recalcula os postes já dimensionados com as demais variáveis exatamente como
 * estão (mesmo condutor e mesma entrada de cada poste) e devolve o esforço de
 * cada poste em cada vento. É puramente informativo — NÃO altera o vento do
 * projeto nem os postes salvos (não chama setVento).
 *
 * Para DESABILITAR: comente a linha `<VarreduraVentosDev />` acima (ou este
 * componente inteiro). Nada mais no arquivo depende dele.
 * ========================================================================== */
// Nome de cada um dos 3 slots de vento (rótulo do campo e cabeçalho da tabela).
const NOMES_VENTOS = ["Norma", "KPMG", "Isopleta modificado"] as const;

function VarreduraVentosDev() {
  const s = useProjetoV2();

  // Os 3 slots de vento (km/h) que o próprio usuário preenche.
  const [ventos, setVentos] = useState<[string, string, string]>(["", "", ""]);
  // Resultado: para cada vento válido, o esforço (Ftotal) de cada poste.
  const [resultado, setResultado] = useState<
    { v_kmh: number; postes: { rotulo: string; Ftotal: number; utilPct: number; aprovado: boolean }[] }[] | null
  >(null);
  const [erro, setErro] = useState<string | null>(null);

  const setSlot = (i: number, v: string) =>
    setVentos((atual) => {
      const novo = [...atual] as [string, string, string];
      novo[i] = v;
      setResultado(null);
      setErro(null);
      return novo;
    });

  const calcular = () => {
    if (!s.condutor) {
      setErro("Inicie o projeto (condutor travado) antes de rodar a varredura.");
      return;
    }
    if (s.postes.length === 0) {
      setErro("Dimensione ao menos um poste para comparar os ventos.");
      return;
    }
    const valores = ventos.map(paraNumero);
    if (valores.some((v) => Number.isNaN(v) || v <= 0)) {
      setErro("Preencha os 3 ventos com velocidades em km/h maiores que zero.");
      return;
    }

    const condutor = s.condutor;
    const trechos = trechosDaLinha(s.postes.map((p) => p.entrada));
    const linhas = valores.map((v_kmh) => ({
      v_kmh,
      postes: s.postes.map((p, idx) => {
        const m = dimensionarPoste(v_kmh, condutor.tipoCabo, condutor.awg, p.entrada, condutor.tempC, trechos[idx]);
        return {
          rotulo: `Poste ${String(idx + 1).padStart(2, "0")}`,
          Ftotal: m.Ftotal,
          utilPct: m.utilizacaoEfetiva * 100,
          aprovado: m.aprovado,
        };
      }),
    }));
    setResultado(linhas);
    setErro(null);
    toast.success(`Varredura calculada para ${valores.length} ventos`);
  };

  return (
    <div className="mt-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/[0.04] p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-amber-700 uppercase dark:text-amber-300">
        <FlaskConical className="size-3.5" /> Teste — 3 ventos, 3 esforços
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Informe 3 velocidades; o esforço de cada poste é recalculado só com o vento mudando (demais
        variáveis estáticas). Não altera o vento nem os postes do projeto.
      </p>

      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Wind className="size-3" /> {NOMES_VENTOS[i]}
            </label>
            <ComUnidade unidade="km/h">
              <Input
                inputMode="decimal"
                value={ventos[i]}
                onChange={(e) => setSlot(i, e.target.value)}
                className="h-8 w-28 pr-12 text-sm"
              />
            </ComUnidade>
          </div>
        ))}
        <Button size="sm" variant="outline" className="h-8" onClick={calcular}>
          <FlaskConical className="size-3.5" /> Calcular projeto (3 ventos)
        </Button>
      </div>

      {erro && <p className="mt-2 text-[11px] font-medium text-destructive">{erro}</p>}

      {resultado && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-xs tabular-nums">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Poste</th>
                {resultado.map((r, i) => (
                  <th key={i} className="py-1 pr-3 font-medium">
                    {NOMES_VENTOS[i]} · {fmt(r.v_kmh, 1)} km/h
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultado[0].postes.map((_, idxPoste) => (
                <tr key={idxPoste} className="border-t border-dashed border-border">
                  <td className="py-1 pr-3 text-muted-foreground">{resultado[0].postes[idxPoste].rotulo}</td>
                  {resultado.map((r, i) => {
                    const cel = r.postes[idxPoste];
                    return (
                      <td key={i} className="py-1 pr-3">
                        <span
                          className={`font-semibold ${
                            cel.aprovado ? "text-green-700 dark:text-green-400" : "text-destructive"
                          }`}
                        >
                          {fmt(cel.Ftotal, 2)} daN
                        </span>
                        <span className="ml-1 text-muted-foreground">({fmt(cel.utilPct, 0)}%)</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Esforço total no topo (F) por poste em cada vento; entre parênteses, a utilização F/Rn.
          </p>
        </div>
      )}
    </div>
  );
}
