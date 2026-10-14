"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Check, Calculator } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  calcular, type Campo, type Operacao, type ResultadoCalculo, type ValorBruto,
} from "@/lib/operacoes";
import { CONDUTORES, postes } from "@/lib/validador";
import { ventoNoPonto } from "@/lib/vento";
import { useLaudo } from "@/lib/laudo-store";

type Emit = (valor: ValorBruto) => void;

/** Wrapper enxuto do Select do shadcn para {value, onChange, opções em string}. */
function SelectSimples({
  value, onChange, opcoes, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes: { label: string; valor: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={(v: string | null) => onChange(v ?? "")}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ComUnidade({ children, unidade }: { children: ReactNode; unidade?: string }) {
  if (!unidade) return <>{children}</>;
  return (
    <div className="relative flex items-center">
      {children}
      <span className="pointer-events-none absolute right-3 text-xs text-muted-foreground">{unidade}</span>
    </div>
  );
}

function CampoNumero({ campo, emit }: { campo: Campo; emit: Emit }) {
  const [val, setVal] = useState(campo.default !== undefined ? String(campo.default) : "");
  useEffect(() => { emit(val); }, [val, emit]);
  return (
    <ComUnidade unidade={campo.unidade}>
      <Input
        inputMode="decimal" placeholder="0" value={val}
        onChange={(e) => setVal(e.target.value)}
        className={campo.unidade ? "pr-12" : ""}
      />
    </ComUnidade>
  );
}

function CampoSelect({ campo, emit }: { campo: Campo; emit: Emit }) {
  const opcoes = (campo.opcoes ?? []).map((o) => ({ label: o.label, valor: String(o.valor) }));
  const [val, setVal] = useState(campo.default !== undefined ? String(campo.default) : opcoes[0]?.valor ?? "");
  useEffect(() => { emit(val); }, [val, emit]);
  return <SelectSimples value={val} onChange={setVal} opcoes={opcoes} />;
}

function CampoSelectOuNumero({ campo, emit }: { campo: Campo; emit: Emit }) {
  const opcoes = (campo.opcoes ?? []).map((o) => ({ label: o.label, valor: String(o.valor) }));
  const [sel, setSel] = useState(opcoes[0]?.valor ?? "__outro__");
  const [outro, setOutro] = useState("");
  const ehOutro = sel === "__outro__";
  useEffect(() => { emit(ehOutro ? outro : sel); }, [sel, outro, ehOutro, emit]);
  return (
    <div className="flex flex-col gap-2">
      <SelectSimples
        value={sel} onChange={setSel}
        opcoes={[...opcoes, { label: "Outro… (digitar)", valor: "__outro__" }]}
      />
      {ehOutro && (
        <ComUnidade unidade={campo.unidade}>
          <Input
            inputMode="decimal" placeholder="Valor" value={outro} autoFocus
            onChange={(e) => setOutro(e.target.value)}
            className={campo.unidade ? "pr-12" : ""}
          />
        </ComUnidade>
      )}
    </div>
  );
}

function CampoPoste({ emit }: { campo: Campo; emit: Emit }) {
  const tipos = useMemo(() => Object.keys(postes), []);
  const [tipo, setTipo] = useState(tipos[0]);
  const [comprimento, setComprimento] = useState("");
  const [resistencia, setResistencia] = useState("");

  const comprimentos = useMemo(() => Object.keys(postes[tipo] ?? {}), [tipo]);
  const compAtual = comprimentos.includes(comprimento) ? comprimento : comprimentos[0];
  const resistencias = useMemo(() => Object.keys(postes[tipo]?.[compAtual] ?? {}), [tipo, compAtual]);
  const resistAtual = resistencias.includes(resistencia) ? resistencia : resistencias[0];

  useEffect(() => {
    emit({ tipo, comprimento: compAtual, resistencia: resistAtual });
  }, [tipo, compAtual, resistAtual, emit]);

  return (
    <div className="flex flex-col gap-2">
      <SelectSimples value={tipo} onChange={setTipo} opcoes={tipos.map((t) => ({ label: t, valor: t }))} />
      <SelectSimples value={compAtual} onChange={setComprimento} opcoes={comprimentos.map((c) => ({ label: `${c} m`, valor: c }))} />
      <SelectSimples value={resistAtual} onChange={setResistencia} opcoes={resistencias.map((r) => ({ label: `${r} daN`, valor: r }))} />
    </div>
  );
}

function CampoCondutor({ emit }: { campo: Campo; emit: Emit }) {
  const cabos = useMemo(() => Object.keys(CONDUTORES), []);
  const [tipoCabo, setTipoCabo] = useState(cabos[0]);
  const [awg, setAwg] = useState("");

  const bitolas = useMemo(() => CONDUTORES[tipoCabo]?.bitolas ?? [], [tipoCabo]);
  const awgAtual = bitolas.some((b) => b.awg === awg) ? awg : bitolas[0]?.awg ?? "";

  useEffect(() => { emit({ tipoCabo, awg: awgAtual }); }, [tipoCabo, awgAtual, emit]);

  return (
    <div className="flex flex-col gap-2">
      <SelectSimples
        value={tipoCabo} onChange={setTipoCabo}
        opcoes={cabos.map((tc) => ({ label: `${tc} — ${CONDUTORES[tc].nome}`, valor: tc }))}
      />
      <SelectSimples
        value={awgAtual} onChange={setAwg}
        opcoes={bitolas.map((b) => ({ label: `${b.awg} (d=${b.diamMm} mm)`, valor: b.awg }))}
      />
    </div>
  );
}

function CampoCoordenada({ emit }: { campo: Campo; emit: Emit }) {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  useEffect(() => { emit({ lat, lon }); }, [lat, lon, emit]);

  const previa = useMemo(() => {
    const la = Number(lat.replace(",", ".").trim());
    const lo = Number(lon.replace(",", ".").trim());
    if (lat.trim() === "" || lon.trim() === "" || Number.isNaN(la) || Number.isNaN(lo)) return null;
    if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
    return ventoNoPonto(la, lo);
  }, [lat, lon]);

  const fmt = (x: number, casas: number) => x.toFixed(casas).replace(".", ",");

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ComUnidade unidade="lat">
          <Input inputMode="decimal" placeholder="Latitude (ex.: -7,115)" value={lat}
            onChange={(e) => setLat(e.target.value)} className="pr-10" />
        </ComUnidade>
        <ComUnidade unidade="lon">
          <Input inputMode="decimal" placeholder="Longitude (ex.: -34,863)" value={lon}
            onChange={(e) => setLon(e.target.value)} className="pr-10" />
        </ComUnidade>
      </div>
      {previa && (
        <div className="rounded-lg border border-sky-600/30 bg-sky-500/10 p-3 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-sky-700 dark:text-sky-300">{fmt(previa.v_kmh, 1)}</span>
            <span className="text-xs text-muted-foreground">km/h — velocidade do vento (v) aplicada ao cálculo</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            V0 = {fmt(previa.V0, 1)} m/s (isopletas NBR 6123) · Vk = V0 · 1,00 · 0,79 · 0,85 = {fmt(previa.Vk, 2)} m/s · v = Vk · 3,6
          </div>
        </div>
      )}
    </div>
  );
}

function CampoCargas({ emit }: { campo: Campo; emit: Emit }) {
  const [linhas, setLinhas] = useState<{ F: string; altura: string }[]>([{ F: "", altura: "" }]);
  useEffect(() => { emit(linhas); }, [linhas, emit]);

  const atualizar = (i: number, chave: "F" | "altura", valor: string) =>
    setLinhas((l) => l.map((x, j) => (j === i ? { ...x, [chave]: valor } : x)));

  return (
    <div className="flex flex-col gap-2">
      {linhas.map((linha, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input inputMode="decimal" placeholder="Força (daN)" value={linha.F} onChange={(e) => atualizar(i, "F", e.target.value)} />
          <Input inputMode="decimal" placeholder="Altura (m)" value={linha.altura} onChange={(e) => atualizar(i, "altura", e.target.value)} />
          <Button type="button" variant="outline" size="icon" aria-label="Remover carga"
            onClick={() => setLinhas((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : l))}>
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="self-start"
        onClick={() => setLinhas((l) => [...l, { F: "", altura: "" }])}>
        <Plus className="size-4" /> Adicionar carga
      </Button>
    </div>
  );
}

function CampoRenderer({ campo, emit }: { campo: Campo; emit: Emit }) {
  switch (campo.tipo) {
    case "select": return <CampoSelect campo={campo} emit={emit} />;
    case "select_ou_numero": return <CampoSelectOuNumero campo={campo} emit={emit} />;
    case "poste": return <CampoPoste campo={campo} emit={emit} />;
    case "condutor": return <CampoCondutor campo={campo} emit={emit} />;
    case "coordenada": return <CampoCoordenada campo={campo} emit={emit} />;
    case "cargas": return <CampoCargas campo={campo} emit={emit} />;
    default: return <CampoNumero campo={campo} emit={emit} />;
  }
}

export default function FormularioCalculo({ op }: { op: Operacao }) {
  const valoresRef = useRef<Record<string, ValorBruto>>({});
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [adicionado, setAdicionado] = useState(false);
  const adicionarItem = useLaudo((s) => s.adicionarItem);

  // emit estável por campo (evita churn de efeitos e não apaga o que os
  // campos-filho já registraram). Memoizado pela lista de campos; o componente
  // é remontado por operação (key no pai), então o valoresRef nasce limpo.
  const emits = useMemo(() => {
    const map: Record<string, Emit> = {};
    for (const campo of op.campos) {
      map[campo.nome] = (valor) => { valoresRef.current[campo.nome] = valor; };
    }
    return map;
  }, [op.campos]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAdicionado(false);
    try {
      setResultado(calcular(op, valoresRef.current));
    } catch (err) {
      setResultado(null);
      setErro(err instanceof Error ? err.message : "Erro no cálculo.");
    }
  };

  const aoAdicionar = () => {
    if (!resultado) return;
    adicionarItem({
      operacaoId: op.id, categoria: op.categoria, titulo: op.titulo,
      entradas: resultado.entradas, resultados: resultado.resultados,
    });
    setAdicionado(true);
    toast.success("Adicionado ao laudo", { description: op.titulo });
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {op.campos.map((campo) => (
          <div key={campo.nome} className={`flex flex-col gap-1.5 ${campo.tipo === "cargas" || campo.tipo === "poste" || campo.tipo === "condutor" || campo.tipo === "coordenada" ? "sm:col-span-2" : ""}`}>
            <Label>{campo.label}</Label>
            <CampoRenderer campo={campo} emit={emits[campo.nome]} />
            {campo.ajuda && <span className="text-xs text-muted-foreground">{campo.ajuda}</span>}
          </div>
        ))}
        <div className="sm:col-span-2">
          <Button type="submit"><Calculator className="size-4" /> Calcular</Button>
        </div>
      </form>

      {erro && (
        <div className="rounded-lg border-l-4 border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          ⚠️ {erro}
        </div>
      )}

      {resultado && (
        <div className="rounded-lg border-l-4 border-green-600 bg-card p-5 shadow-sm dark:border-green-500">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resultados</h3>
          <ul className="flex flex-col divide-y divide-dashed divide-border">
            {resultado.resultados.map((r, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="text-sm text-muted-foreground">{r.rotulo}</span>
                <span className={`tabular-nums font-semibold ${r.destaque ? "text-2xl text-green-600 dark:text-green-400" : ""}`}>
                  {r.valor}
                  {r.unidade && <span className="ml-1 text-sm font-normal text-muted-foreground">{r.unidade}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Button type="button" variant={adicionado ? "outline" : "default"} onClick={aoAdicionar} disabled={adicionado}>
              {adicionado ? <><Check className="size-4" /> Adicionado ao laudo</> : <><Plus className="size-4" /> Adicionar ao laudo</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
