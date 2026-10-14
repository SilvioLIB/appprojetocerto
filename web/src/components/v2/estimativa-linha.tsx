"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Map as MapIcon, MapPin, Route, Ruler, UtilityPole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjetoV2 } from "@/lib/projeto-v2-store";
import { fmt } from "@/lib/dimensionamento";
import {
  estimarDistanciaLinha,
  estimarNumeroPostes,
  normalizarFatorSinuosidade,
  FATOR_SINUOSIDADE_MIN,
  FATOR_SINUOSIDADE_MAX,
  FATOR_SINUOSIDADE_PADRAO,
  VAO_MEDIO_MIN_M,
  VAO_MEDIO_MAX_M,
  type Coordenada,
} from "@/lib/distancia";
import { CampoCoordenada, ComUnidade, paraNumero } from "./campos";
import { MapaTrajeto } from "./mapa-trajeto";
import { UsarLocalizacao } from "./usar-localizacao";

/** Valida um par lat/lon vindo de strings; devolve a coordenada ou null. */
function coordValida(latS: string, lonS: string): Coordenada | null {
  const lat = paraNumero(latS);
  const lon = paraNumero(lonS);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/**
 * Estima a extensão da linha entre o ponto de derivação e o ponto de entrega
 * da carga, roteando pela base aberta do OpenStreetMap (OSRM) com queda para a
 * distância geodésica. Optativo: não trava o início do projeto.
 */
export function EstimativaLinha() {
  const s = useProjetoV2();
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Aborta uma consulta pendente ao desmontar o componente.
  useEffect(() => () => abortRef.current?.abort(), []);

  const deriv = coordValida(s.derivLat, s.derivLon);
  const entrega = coordValida(s.entregaLat, s.entregaLon);
  const pronto = deriv !== null && entrega !== null;
  const res = s.extensaoLinha;

  const fatorNum = paraNumero(s.fatorSinuosidade);
  const fatorValido =
    !Number.isNaN(fatorNum) && fatorNum >= FATOR_SINUOSIDADE_MIN && fatorNum <= FATOR_SINUOSIDADE_MAX;

  // Vão médio e a estimativa de postes derivada dele + da distância já calculada.
  const vaoNum = paraNumero(s.vaoMedio);
  const vaoPreenchido = s.vaoMedio.trim() !== "";
  const vaoValido = !Number.isNaN(vaoNum) && vaoNum >= VAO_MEDIO_MIN_M && vaoNum <= VAO_MEDIO_MAX_M;
  const postes = res && vaoValido ? estimarNumeroPostes(res.distanciaKm, vaoNum) : null;

  // Edita um campo de coordenada/fator e invalida o resultado anterior
  // (que ficaria referente a coordenadas antigas).
  const editar = (
    campo: "derivLat" | "derivLon" | "entregaLat" | "entregaLon" | "fatorSinuosidade",
    valor: string,
  ) => {
    s.setAbertura({ [campo]: valor });
    if (s.extensaoLinha) s.setExtensaoLinha(null);
    // Coordenadas do corredor mudaram: o contorno climático anterior fica obsoleto.
    if (campo !== "fatorSinuosidade" && s.climaRegiao) s.setClimaRegiao(null);
    if (erro) setErro(null);
  };

  // Preenche o par lat/lon de um ponto com a localização do aparelho.
  const localizar = (ponto: "deriv" | "entrega") => (lat: string, lon: string) => {
    s.setAbertura(ponto === "deriv" ? { derivLat: lat, derivLon: lon } : { entregaLat: lat, entregaLon: lon });
    if (s.extensaoLinha) s.setExtensaoLinha(null);
    if (s.climaRegiao) s.setClimaRegiao(null);
    if (erro) setErro(null);
  };

  // O vão médio não depende da distância: mexer nele NÃO invalida a extensão.
  const editarVaoMedio = (valor: string) => s.setAbertura({ vaoMedio: valor });

  const calcular = async () => {
    if (!deriv || !entrega) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setCalculando(true);
    setErro(null);
    try {
      const r = await estimarDistanciaLinha(deriv, entrega, {
        signal: ac.signal,
        fatorSinuosidade: normalizarFatorSinuosidade(fatorNum),
      });
      if (!ac.signal.aborted) s.setExtensaoLinha(r);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErro("Não foi possível estimar a distância agora. Tente novamente.");
    } finally {
      if (!ac.signal.aborted) setCalculando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-primary" /> Ponto de derivação
          </Label>
          <div className="grid grid-cols-2 gap-2 max-sm:pointer-coarse:grid-cols-1">
            <CampoCoordenada
              unidade="lat"
              placeholder="Latitude"
              value={s.derivLat}
              onChange={(v) => editar("derivLat", v)}
            />
            <CampoCoordenada
              unidade="lon"
              placeholder="Longitude"
              value={s.derivLon}
              onChange={(v) => editar("derivLon", v)}
            />
          </div>
          <UsarLocalizacao onLocalizar={localizar("deriv")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Ponto de entrega da carga
          </Label>
          <div className="grid grid-cols-2 gap-2 max-sm:pointer-coarse:grid-cols-1">
            <CampoCoordenada
              unidade="lat"
              placeholder="Latitude"
              value={s.entregaLat}
              onChange={(v) => editar("entregaLat", v)}
            />
            <CampoCoordenada
              unidade="lon"
              placeholder="Longitude"
              value={s.entregaLon}
              onChange={(v) => editar("entregaLon", v)}
            />
          </div>
          <UsarLocalizacao onLocalizar={localizar("entrega")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="v2-fator-sinuosidade">Fator de sinuosidade</Label>
        <ComUnidade unidade="×">
          <Input
            id="v2-fator-sinuosidade"
            inputMode="decimal"
            placeholder={FATOR_SINUOSIDADE_PADRAO.toLocaleString("pt-BR")}
            value={s.fatorSinuosidade}
            onChange={(e) => editar("fatorSinuosidade", e.target.value)}
            aria-invalid={!fatorValido}
            className="pr-9"
          />
        </ComUnidade>
        <span className="text-xs text-muted-foreground">
          Multiplica a linha reta {fatorValido ? "" : `(${FATOR_SINUOSIDADE_MIN.toLocaleString("pt-BR")}–${FATOR_SINUOSIDADE_MAX.toLocaleString("pt-BR")}) `}
          só quando a rota (OpenStreetMap/OSRM) está indisponível. Padrão{" "}
          {FATOR_SINUOSIDADE_PADRAO.toLocaleString("pt-BR")}.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" disabled={!pronto || !fatorValido || calculando} onClick={calcular}>
          {calculando ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Ruler data-icon="inline-start" />
          )}
          {calculando ? "Estimando…" : "Estimar distância"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!pronto}
          onClick={() => setMostrarMapa((v) => !v)}
        >
          <MapIcon data-icon="inline-start" />
          {mostrarMapa ? "Ocultar mapa" : "Ver trajeto no mapa"}
        </Button>
        {!pronto && (
          <span className="text-xs text-muted-foreground">
            Preencha as duas coordenadas em graus decimais (ex.: -7,115 / -34,863).
          </span>
        )}
        {pronto && !fatorValido && (
          <span className="text-xs text-destructive">
            Fator entre {FATOR_SINUOSIDADE_MIN.toLocaleString("pt-BR")} e{" "}
            {FATOR_SINUOSIDADE_MAX.toLocaleString("pt-BR")}.
          </span>
        )}
        {erro && <span className="text-xs text-destructive">{erro}</span>}
      </div>

      {mostrarMapa && pronto && deriv && entrega && (
        <MapaTrajeto derivacao={deriv} entrega={entrega} />
      )}

      {res && (
        <div className="rounded-lg border border-emerald-600/30 bg-emerald-500/10 p-3 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
              {fmt(res.distanciaKm, 2)}
            </span>
            <span className="text-xs text-muted-foreground">
              km — extensão estimada da linha (derivação → entrega)
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Route className="size-3.5 shrink-0" />
            <span>
              Linha reta (geodésica): {fmt(res.retaKm, 2)} km · {res.observacao}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="v2-vao-medio" className="flex items-center gap-1.5">
          <UtilityPole className="size-3.5 text-primary" /> Vão médio pretendido
        </Label>
        <ComUnidade unidade="m">
          <Input
            id="v2-vao-medio"
            inputMode="decimal"
            placeholder="ex.: 40"
            value={s.vaoMedio}
            onChange={(e) => editarVaoMedio(e.target.value)}
            aria-invalid={vaoPreenchido && !vaoValido}
            className="pr-9"
          />
        </ComUnidade>
        <span className="text-xs text-muted-foreground">
          Distância média entre postes ({VAO_MEDIO_MIN_M}–{VAO_MEDIO_MAX_M} m) para estimar a
          quantidade de postes da linha.
        </span>
        {vaoPreenchido && !vaoValido && (
          <span className="text-xs text-destructive">
            Vão entre {VAO_MEDIO_MIN_M} e {VAO_MEDIO_MAX_M} m.
          </span>
        )}
      </div>

      {postes && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-primary tabular-nums">
              {postes.numeroPostes}
            </span>
            <span className="text-xs text-muted-foreground">postes — estimativa média</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <UtilityPole className="size-3.5 shrink-0" />
            <span>
              {fmt(postes.distanciaKm, 2)} km ÷ {fmt(postes.vaoMedioM, 0)} m ≈ {postes.numeroVaos}{" "}
              vãos → {postes.numeroPostes} postes (vãos + 1, contando as duas extremidades).
            </span>
          </div>
        </div>
      )}
      {vaoValido && !res && (
        <span className="text-xs text-muted-foreground">
          Estime a distância acima para ver a quantidade de postes.
        </span>
      )}
    </div>
  );
}
