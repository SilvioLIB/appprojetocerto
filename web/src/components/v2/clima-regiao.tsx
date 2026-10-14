"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPin, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useProjetoV2 } from "@/lib/projeto-v2-store";
import { v0Ponto } from "@/lib/vento";
import {
  listarMunicipios,
  listarUFs,
  ngMunicipio,
  ngPorCoordenada,
  type ClimaRegiao,
  type PontaClima,
} from "@/lib/ng";
import { temperaturaPorCoordenada, type TemperaturaLocal } from "@/lib/temperatura";
import { SelectSimples, paraNumero } from "./campos";
import type { Coordenada } from "@/lib/distancia";
import { ResumoClima } from "./clima-resumo";

/** Valida um par lat/lon vindo de strings; devolve a coordenada ou null. */
function coordValida(latS: string, lonS: string): Coordenada | null {
  const lat = paraNumero(latS);
  const lon = paraNumero(lonS);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/** Monta uma ponta do corredor a partir do Ng (município), V0 e temperatura. */
function pontaDe(
  municipio: string,
  uf: string,
  ng: { ng: number; faixa: number; nivel: string; cor: string },
  coord: Coordenada,
  temp?: TemperaturaLocal,
): PontaClima {
  return {
    municipio,
    uf,
    ng: ng.ng,
    faixa: ng.faixa,
    nivel: ng.nivel,
    cor: ng.cor,
    v0: Number(v0Ponto(coord.lat, coord.lon).toFixed(2)),
    temp,
  };
}

/**
 * Temperatura na coordenada tolerante a falhas: rejeita só em aborto e, em
 * qualquer outro erro (rede/serviço/série vazia), devolve o MOTIVO em vez de
 * derrubar a consulta do Ng — assim a falha fica diagnosticável na interface.
 */
async function tempSegura(
  coord: Coordenada,
  signal: AbortSignal,
): Promise<{ temp?: TemperaturaLocal; erro?: string }> {
  try {
    const t = await temperaturaPorCoordenada(coord.lat, coord.lon, signal);
    if (!t) return { erro: "série vazia para a coordenada" };
    return { temp: t };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // TypeError puro (sem status) num fetch de origem cruzada quase sempre é
    // bloqueio de rede/CORS pelo navegador (extensão, firewall, proxy).
    if (e instanceof TypeError) return { erro: `rede bloqueada (${e.message})` };
    return { erro: e instanceof Error ? e.message : "falha desconhecida" };
  }
}

/** Contorno da região a partir das duas pontas (faixa dominante = pior caso). */
function montarClima(d: PontaClima, e: PontaClima): ClimaRegiao {
  const pior = d.ng >= e.ng ? d : e;
  return {
    derivacao: d,
    entrega: e,
    ngMax: pior.ng,
    faixaMax: pior.faixa,
    nivelMax: pior.nivel,
    corMax: pior.cor,
    v0Min: Math.min(d.v0, e.v0),
    v0Max: Math.max(d.v0, e.v0),
    calculadoEm: new Date().toISOString(),
  };
}

/** Estado da seleção manual de uma ponta (quando o geocode não resolveu). */
interface Manual {
  uf: string;
  municipio: string;
}

/**
 * Contorno climático da região do projeto: Ng (descargas atmosféricas,
 * NBR 5419-2) e V0 (vento, NBR 6123) nas duas pontas do corredor derivação →
 * entrega. Reverse-geocode pela base aberta do OpenStreetMap (Nominatim); em
 * falha, cai para a escolha manual de UF + município. Optativo: não trava o
 * início do projeto.
 */
export function ClimaRegiaoSecao() {
  const s = useProjetoV2();
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Motivo da última falha de temperatura (diagnóstico exibido no resumo).
  const [tempErro, setTempErro] = useState<string | null>(null);
  const [ufs, setUfs] = useState<string[]>([]);
  const [manualDeriv, setManualDeriv] = useState<Manual | null>(null);
  const [manualEntrega, setManualEntrega] = useState<Manual | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Pontas já resolvidas por geocode, aguardando a(s) escolha(s) manual(is).
  const pendente = useRef<{ deriv: PontaClima | null; entrega: PontaClima | null }>({
    deriv: null,
    entrega: null,
  });
  // Temperaturas amostradas na última consulta (reaproveitadas na escolha manual).
  const temps = useRef<{ deriv?: TemperaturaLocal; entrega?: TemperaturaLocal }>({});

  useEffect(() => () => abortRef.current?.abort(), []);

  const deriv = coordValida(s.derivLat, s.derivLon);
  const entrega = coordValida(s.entregaLat, s.entregaLon);
  const pronto = deriv !== null && entrega !== null;
  const clima = s.climaRegiao;

  // Carrega a lista de UFs só quando alguma ponta exigir escolha manual.
  useEffect(() => {
    if ((manualDeriv || manualEntrega) && ufs.length === 0) {
      listarUFs().then(setUfs).catch(() => setUfs([]));
    }
  }, [manualDeriv, manualEntrega, ufs.length]);

  const consultar = async () => {
    if (!deriv || !entrega) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setConsultando(true);
    setErro(null);
    setTempErro(null);
    setManualDeriv(null);
    setManualEntrega(null);
    s.setClimaRegiao(null);
    temps.current = {};
    try {
      const [rd, re, tdR, teR] = await Promise.all([
        ngPorCoordenada(deriv.lat, deriv.lon, ac.signal),
        ngPorCoordenada(entrega.lat, entrega.lon, ac.signal),
        tempSegura(deriv, ac.signal),
        tempSegura(entrega, ac.signal),
      ]);
      if (ac.signal.aborted) return;
      const td = tdR.temp;
      const te = teR.temp;
      temps.current = { deriv: td, entrega: te };
      // Se nenhuma ponta trouxe temperatura, guarda o motivo (rede/CORS/série).
      setTempErro(!td && !te ? (tdR.erro ?? teR.erro ?? "falha desconhecida") : null);

      const dPonta = rd.ng
        ? pontaDe(rd.ng.municipio, rd.ng.uf, rd.ng.grau, deriv, td)
        : null;
      const ePonta = re.ng
        ? pontaDe(re.ng.municipio, re.ng.uf, re.ng.grau, entrega, te)
        : null;

      if (dPonta && ePonta) {
        s.setClimaRegiao(montarClima(dPonta, ePonta));
      } else {
        // Prefill a escolha manual com a UF que o geocode conseguiu resolver.
        if (!dPonta) setManualDeriv({ uf: rd.local?.uf ?? "", municipio: "" });
        else s.setClimaRegiao(null);
        if (!ePonta) setManualEntrega({ uf: re.local?.uf ?? "", municipio: "" });
        // Guarda a ponta que resolveu, para completar com a manual depois.
        pendente.current = { deriv: dPonta, entrega: ePonta };
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErro("Não foi possível consultar o clima da região agora. Tente novamente ou escolha o município à mão.");
      setManualDeriv({ uf: "", municipio: "" });
      setManualEntrega({ uf: "", municipio: "" });
    } finally {
      if (!ac.signal.aborted) setConsultando(false);
    }
  };

  // Resolve uma ponta pela escolha manual (UF + município) e tenta fechar o contorno.
  const escolherManual = async (qual: "deriv" | "entrega", municipio: string) => {
    const manual = qual === "deriv" ? manualDeriv : manualEntrega;
    const coord = qual === "deriv" ? deriv : entrega;
    if (!manual || !manual.uf || !coord) return;
    const achado = await ngMunicipio(municipio, manual.uf);
    if (!achado) return;
    const ponta = pontaDe(achado.municipio, achado.uf, achado.grau, coord, temps.current[qual]);
    if (qual === "deriv") {
      pendente.current.deriv = ponta;
      setManualDeriv({ ...manual, municipio });
    } else {
      pendente.current.entrega = ponta;
      setManualEntrega({ ...manual, municipio });
    }
    const { deriv: dP, entrega: eP } = pendente.current;
    if (dP && eP) s.setClimaRegiao(montarClima(dP, eP));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!pronto || consultando}
          onClick={consultar}
        >
          {consultando ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Zap data-icon="inline-start" />
          )}
          {consultando ? "Consultando…" : "Consultar clima da região"}
        </Button>
        {!pronto && (
          <span className="text-xs text-muted-foreground">
            Preencha as coordenadas de derivação e entrega na seção acima.
          </span>
        )}
        {erro && <span className="text-xs text-destructive">{erro}</span>}
      </div>

      {(manualDeriv || manualEntrega) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {manualDeriv && (
            <PickerManual
              titulo="Ponto de derivação"
              ufs={ufs}
              manual={manualDeriv}
              onUF={(uf) => setManualDeriv({ uf, municipio: "" })}
              onMunicipio={(m) => escolherManual("deriv", m)}
            />
          )}
          {manualEntrega && (
            <PickerManual
              titulo="Ponto de entrega"
              ufs={ufs}
              manual={manualEntrega}
              onUF={(uf) => setManualEntrega({ uf, municipio: "" })}
              onMunicipio={(m) => escolherManual("entrega", m)}
            />
          )}
        </div>
      )}

      {clima && <ResumoClima clima={clima} motivoFalhaTemp={tempErro} />}
    </div>
  );
}

/** Seleção manual de UF + município de uma ponta (fallback do geocode). */
function PickerManual({
  titulo,
  ufs,
  manual,
  onUF,
  onMunicipio,
}: {
  titulo: string;
  ufs: string[];
  manual: Manual;
  onUF: (uf: string) => void;
  onMunicipio: (municipio: string) => void;
}) {
  const [municipios, setMunicipios] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    // Resolve assíncrono mesmo sem UF ([]), para não chamar setState de forma
    // síncrona dentro do effect (react-hooks/set-state-in-effect).
    Promise.resolve(manual.uf ? listarMunicipios(manual.uf) : [])
      .then((ms) => {
        if (vivo) setMunicipios(ms);
      })
      .catch(() => {
        if (vivo) setMunicipios([]);
      });
    return () => {
      vivo = false;
    };
  }, [manual.uf]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-foreground/10 bg-muted/30 p-3">
      <span className="flex items-center gap-1.5 text-xs font-medium">
        <MapPin className="size-3.5 text-muted-foreground" /> {titulo} — escolha à mão
      </span>
      <div className="grid grid-cols-[5rem_1fr] gap-2">
        <SelectSimples
          value={manual.uf}
          onChange={onUF}
          placeholder="UF"
          opcoes={ufs.map((uf) => ({ label: uf, valor: uf }))}
        />
        <SelectSimples
          value={manual.municipio}
          onChange={onMunicipio}
          placeholder={manual.uf ? "Município" : "Escolha a UF primeiro"}
          opcoes={municipios.map((m) => ({ label: m, valor: m }))}
        />
      </div>
    </div>
  );
}

