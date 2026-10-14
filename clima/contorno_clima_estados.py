# -*- coding: utf-8 -*-
"""
================================================================================
Contornos climaticos por ESTADO brasileiro  (com INTERFACE de selecao)
================================================================================

Generalizacao do script original da Paraiba para QUALQUER estado do Brasil,
com uma interface grafica simples para escolher o estado e rodar a analise.

Para o estado escolhido, o programa:
  1. Baixa o CONTORNO geografico oficial (lon/lat) na API de malhas do IBGE.
  2. Baixa dados climaticos (temperatura do ar e velocidade do vento) por
     coordenadas usando API open source:
        - NASA POWER  (padrao, nao precisa de chave)  -> community "RE"
        - ERA5 / Copernicus CDS  (opcional, precisa de conta gratuita)
     Estados grandes sao baixados em blocos ("tiles") por causa do limite de
     area da API regional da NASA POWER; os blocos sao unidos automaticamente.
  3. Interpola os campos para uma grade fina DENTRO do estado.
  4. Calcula a MEDIA estadual de temperatura e de vento.
  5. Marca os SUB-CONTORNOS onde, ao mesmo tempo:
        temperatura  ABAIXO da media estadual   E
        velocidade do vento  ACIMA  da media estadual   (uniao desses locais)
  6. Exporta a figura (PNG), os sub-contornos em GeoJSON e os pontos-fonte
     qualificados em CSV -- nomes de arquivo por sigla do estado.

Contexto: prospeccao de recurso eolico (ventos fortes) em areas mais amenas.

Como usar:
  * Interface grafica (padrao):   python contorno_clima_estados.py
  * Linha de comando:             python contorno_clima_estados.py --uf CE
  * Menu no terminal:             python contorno_clima_estados.py --sem-interface

Dependencias (fonte NASA POWER, padrao):  requests numpy scipy matplotlib shapely
Opcional (fonte ERA5):                    cdsapi xarray netCDF4  + arquivo ~/.cdsapirc
Interface grafica:                        tkinter (ja vem com o Python padrao)
--------------------------------------------------------------------------------
"""

import os
import sys
import csv
import json
import math
import types
import argparse

import numpy as np
import requests
import shapely
from shapely.geometry import shape, mapping, Polygon
from scipy.interpolate import griddata
from scipy import ndimage

# FONTE DO VENTO: campo de V0 (velocidade basica de projeto) da ABNT NBR 6123:2023,
# reconstruido do mapa de isopletas (Figura 1). Substitui o vento medido da
# NASA POWER / ERA5, que dava a MEDIA anual (baixa demais para analise estrutural).
# INDICE Ng: densidade de descargas atmosfericas para a terra (ABNT NBR 5419-2),
# tabelado por municipio. Terceira camada, unificada com temperatura e V0.
# Imports resolvidos tanto como PACOTE (from clima import ...) quanto como
# SCRIPT standalone rodado de dentro da pasta clima/.
try:
    from . import isopletas_nbr6123 as iso
    from . import ng_nbr5419 as ng
except ImportError:
    import isopletas_nbr6123 as iso
    import ng_nbr5419 as ng

# Backend nao-interativo: gera a figura em arquivo sem depender de janela nem
# do thread principal (a interface roda a analise em segundo plano).
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from matplotlib.lines import Line2D

# Evita erros de acentuacao no console do Windows
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


# ==============================================================================
# ESTADOS BRASILEIROS  (sigla -> (nome, codigo IBGE))
# ==============================================================================
ESTADOS = {
    "RO": ("Rondonia", 11),            "AC": ("Acre", 12),
    "AM": ("Amazonas", 13),            "RR": ("Roraima", 14),
    "PA": ("Para", 15),                "AP": ("Amapa", 16),
    "TO": ("Tocantins", 17),           "MA": ("Maranhao", 21),
    "PI": ("Piaui", 22),               "CE": ("Ceara", 23),
    "RN": ("Rio Grande do Norte", 24), "PB": ("Paraiba", 25),
    "PE": ("Pernambuco", 26),          "AL": ("Alagoas", 27),
    "SE": ("Sergipe", 28),             "BA": ("Bahia", 29),
    "MG": ("Minas Gerais", 31),        "ES": ("Espirito Santo", 32),
    "RJ": ("Rio de Janeiro", 33),      "SP": ("Sao Paulo", 35),
    "PR": ("Parana", 41),              "SC": ("Santa Catarina", 42),
    "RS": ("Rio Grande do Sul", 43),   "MS": ("Mato Grosso do Sul", 50),
    "MT": ("Mato Grosso", 51),         "GO": ("Goias", 52),
    "DF": ("Distrito Federal", 53),
}

# Lista (sigla, nome) ordenada por nome, para preencher o menu/combobox.
ESTADOS_ORDENADOS = sorted(ESTADOS.items(), key=lambda kv: kv[1][0])


# ==============================================================================
# CONFIGURACAO (valores padrao; a interface permite alterar)
# ==============================================================================
FONTE          = "NASA_POWER"   # "NASA_POWER"  ou  "ERA5"
ALTURA_VENTO   = 50             # NASA POWER: 10 ou 50 m | ERA5: 10 ou 100 m
ANO_INI        = 2001           # periodo base da climatologia
ANO_FIM        = 2020
N_GRID         = 300            # resolucao da grade de interpolacao (N x N)
AREA_MIN_FRAC  = 0.002          # descarta "manchas" menores que 0.2% da area do estado
MAX_SPAN_TILE  = 8.0            # tamanho maximo (graus) de cada bloco da NASA POWER
MIN_SPAN_NASA  = 2.5            # NASA POWER regional exige >= 2 graus em cada dimensao

# Pasta onde a analise grava PNG/GeoJSON/CSV. Por padrao, "saidas/" ao lado
# deste modulo (nao suja a raiz do projeto). Pode ser trocada por outro caminho.
DIR_SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saidas")


# ==============================================================================
# 1) CONTORNO GEOGRAFICO DO ESTADO (coordenadas lon/lat)
# ==============================================================================
def carregar_contorno_estado(cod_ibge, uf=None, log=print):
    """Retorna a geometria (shapely) do estado (EPSG:4326) pelo codigo IBGE."""
    # 1a) tenta geobr (malha oficial), se estiver instalado
    try:
        import geobr
        est = geobr.read_state(code_state=cod_ibge).to_crs(4326)
        geom = est.geometry.union_all() if hasattr(est.geometry, "union_all") \
            else est.geometry.unary_union
        log("[contorno] fonte: geobr (IBGE)")
        return geom
    except Exception:
        pass

    # 1b) fallback: API de malhas do IBGE (GeoJSON) -> so precisa de requests+shapely
    url = f"https://servicodados.ibge.gov.br/api/v3/malhas/estados/{cod_ibge}"
    log(f"[contorno] baixando malha do IBGE: {url}")
    r = requests.get(url, params={"formato": "application/vnd.geo+json"}, timeout=90)
    r.raise_for_status()
    gj = r.json()
    geoms = [shape(f["geometry"]) for f in gj["features"]]
    geom = shapely.union_all(geoms)
    log("[contorno] fonte: API de malhas do IBGE")
    return geom


def iter_polygons(geom):
    """Itera sobre os poligonos de um Polygon/MultiPolygon."""
    if geom.geom_type == "Polygon":
        yield geom
    elif geom.geom_type == "MultiPolygon":
        yield from geom.geoms


def plotar_contorno(ax, geom, **kw):
    """Desenha o contorno (e ilhas) do estado usando so matplotlib."""
    for poly in iter_polygons(geom):
        x, y = poly.exterior.xy
        ax.plot(x, y, **kw)
        for ring in poly.interiors:
            xi, yi = ring.xy
            ax.plot(xi, yi, **kw)


# ==============================================================================
# 2a) DADOS CLIMATICOS -- NASA POWER  (API regional, sem chave)
# ==============================================================================
def _edges(a, b, passo):
    """Divide o intervalo [a, b] em pedacos iguais, cada um <= passo (graus)."""
    n = max(1, math.ceil((b - a) / passo))
    return [a + i * (b - a) / n for i in range(n + 1)]


def _expandir_min(bbox, min_span):
    """Expande a caixa (centrada) para ter no minimo 'min_span' graus em cada
    dimensao. A NASA POWER regional recusa areas com menos de 2 graus; pontos
    extras fora do estado sao ignorados pela mascara e ainda ajudam a
    interpolacao nas bordas."""
    minx, miny, maxx, maxy = bbox
    dx = min_span - (maxx - minx)
    if dx > 0:
        minx -= dx / 2; maxx += dx / 2
    dy = min_span - (maxy - miny)
    if dy > 0:
        miny -= dy / 2; maxy += dy / 2
    return (minx, miny, maxx, maxy)


def _tiles(bbox, max_span=MAX_SPAN_TILE, pad=0.1):
    """Gera sub-bounding-boxes (com leve sobreposicao) cobrindo o bbox.
    Necessario porque a API regional da NASA POWER tem limite de area."""
    minx, miny, maxx, maxy = bbox
    xs = _edges(minx, maxx, max_span)
    ys = _edges(miny, maxy, max_span)
    for x0, x1 in zip(xs[:-1], xs[1:]):
        for y0, y1 in zip(ys[:-1], ys[1:]):
            yield (x0 - pad, y0 - pad, x1 + pad, y1 + pad)


def _nasa_power_regional_um_parametro(par, bbox, ano_ini, ano_fim):
    """Baixa a media anual (ANN) de UM parametro em UM bloco (tile) da API
    regional da NASA POWER. A API regional aceita apenas 1 parametro por vez."""
    minx, miny, maxx, maxy = bbox
    url = "https://power.larc.nasa.gov/api/temporal/climatology/regional"
    params = {
        "parameters": par,
        "community": "RE",                           # Renewable Energy
        "latitude-min": round(miny, 4), "latitude-max": round(maxy, 4),
        "longitude-min": round(minx, 4), "longitude-max": round(maxx, 4),
        "start": ano_ini, "end": ano_fim,
        "format": "JSON",
    }
    r = requests.get(url, params=params, timeout=180)
    if r.status_code != 200:
        try:
            msg = r.json().get("messages", r.text)
        except Exception:
            msg = r.text
        raise RuntimeError(f"NASA POWER ({par}): {msg}")
    js = r.json()
    if "features" not in js:
        raise RuntimeError(f"Resposta inesperada da NASA POWER: {js.get('messages', js)}")
    valores = {}
    for feat in js["features"]:
        lon, lat = feat["geometry"]["coordinates"][:2]
        v = feat["properties"]["parameter"][par]["ANN"]   # media anual
        if v > -900:                                       # descarta -999 (fill value)
            valores[(round(lon, 4), round(lat, 4))] = v
    return valores


def _baixar_param_em_tiles(par, bbox, ano_ini, ano_fim, log=print):
    """Baixa UM parametro cobrindo todo o bbox, fatiando em blocos se preciso,
    e junta tudo num dicionario {(lon, lat): valor}."""
    tiles = list(_tiles(bbox))
    valores = {}
    for i, tb in enumerate(tiles, 1):
        if len(tiles) > 1:
            log(f"[NASA POWER] {par}: bloco {i}/{len(tiles)}")
        valores.update(_nasa_power_regional_um_parametro(par, tb, ano_ini, ano_fim))
    return valores


def dados_nasa_power(bbox, altura, ano_ini, ano_fim, log=print):
    """
    Baixa climatologia (media anual) de TEMPERATURA (T2M) na NASA POWER.
    O VENTO nao vem mais da NASA: agora e' o V0 de projeto da NBR 6123 (campo de
    isopletas, modulo isopletas_nbr6123), amostrado nas mesmas coordenadas.
    Retorna arrays: lon, lat, temperatura(C), V0(m/s) e um rotulo.
    Grade nativa ~0.5 x 0.625 graus (MERRA-2).
    """
    # --- VENTO NASA POWER DESATIVADO (agora usa V0 da NBR 6123) ---------------
    # if altura not in (10, 50):                        # NASA POWER: apenas WS10M/WS50M
    #     antigo, altura = altura, (10 if altura < 30 else 50)
    #     log(f"[NASA POWER] altura {antigo} m indisponivel; usando {altura} m.")
    # par_vento = f"WS{altura}M"                         # WS10M ou WS50M

    # estados pequenos (DF, SE, AL...) tem caixa < 2 graus: expande para o minimo
    minx, miny, maxx, maxy = bbox
    bbox = _expandir_min(bbox, MIN_SPAN_NASA)
    if bbox != (minx, miny, maxx, maxy):
        log(f"[NASA POWER] area pequena; expandida para >= {MIN_SPAN_NASA} graus.")

    log(f"[NASA POWER] baixando T2M ({ano_ini}-{ano_fim})...")
    temp_d = _baixar_param_em_tiles("T2M", bbox, ano_ini, ano_fim, log)
    # --- VENTO NASA POWER DESATIVADO -----------------------------------------
    # vento_d = _baixar_param_em_tiles(par_vento, bbox, ano_ini, ano_fim, log)

    lons, lats, temps = [], [], []
    for coord in sorted(temp_d.keys()):
        lons.append(coord[0]);   lats.append(coord[1])
        temps.append(temp_d[coord])
    lons = np.array(lons); lats = np.array(lats); temps = np.array(temps)

    # VENTO = V0 de projeto (NBR 6123, isopletas) no lugar do vento medido
    ventos = np.asarray(iso.v0_ponto(lons, lats), dtype=float)
    log(f"[NASA POWER] {len(lons)} pontos de grade (T2M) recebidos.")
    log("[vento] V0 de projeto (NBR 6123) amostrado nos pontos de grade.")
    return (lons, lats, temps, ventos,
            "NBR 6123 V0 (isopletas) + T2M NASA POWER")


# ==============================================================================
# 2b) DADOS CLIMATICOS -- ERA5 / Copernicus CDS  (opcional, precisa de conta)
# ==============================================================================
def dados_era5(bbox, altura, ano_ini, ano_fim, log=print):
    """
    Baixa medias mensais do ERA5 e tira a media -> climatologia.
    Requer: pip install cdsapi xarray netCDF4  e  ~/.cdsapirc com sua chave CDS.
    Grade 0.25 x 0.25 graus. Retorna lon, lat, temperatura(C), vento(m/s).
    """
    try:
        import cdsapi
        import xarray as xr
    except ImportError as e:
        raise SystemExit(
            "ERA5 requer 'cdsapi' e 'xarray'. Instale:\n"
            "    pip install cdsapi xarray netCDF4\n"
            "e configure ~/.cdsapirc (https://cds.climate.copernicus.eu)."
        ) from e

    minx, miny, maxx, maxy = bbox
    # --- VENTO ERA5 DESATIVADO (agora usa V0 da NBR 6123) --------------------
    # if altura >= 100:
    #     uvar, vvar, un, vn = ("100m_u_component_of_wind",
    #                           "100m_v_component_of_wind", "u100", "v100")
    #     altura = 100
    # else:
    #     uvar, vvar, un, vn = ("10m_u_component_of_wind",
    #                           "10m_v_component_of_wind", "u10", "v10")
    #     altura = 10

    area = [maxy + 0.25, minx - 0.25, miny - 0.25, maxx + 0.25]  # N, W, S, E
    arq = "era5_estado.nc"
    log(f"[ERA5] solicitando 2m_temperature ao CDS ({ano_ini}-{ano_fim})... (pode demorar)")

    c = cdsapi.Client()
    c.retrieve(
        "reanalysis-era5-single-levels-monthly-means",
        {
            "product_type": "monthly_averaged_reanalysis",
            # vento (u/v) DESATIVADO -> velocidade agora vem do V0 da NBR 6123
            "variable": ["2m_temperature"],
            "year": [str(a) for a in range(ano_ini, ano_fim + 1)],
            "month": [f"{m:02d}" for m in range(1, 13)],
            "time": "00:00",
            "area": area,
            "grid": [0.25, 0.25],
            "format": "netcdf",
        },
        arq,
    )

    ds = xr.open_dataset(arq).squeeze()
    tdim = "valid_time" if "valid_time" in ds.dims else \
           ("time" if "time" in ds.dims else None)
    if tdim:
        ds = ds.mean(dim=tdim)                        # media climatologica

    lonname = "longitude" if "longitude" in ds.coords else "lon"
    latname = "latitude" if "latitude" in ds.coords else "lat"

    t2m = ds["t2m"].values - 273.15                   # K -> C
    # --- VENTO ERA5 DESATIVADO ------------------------------------------------
    # ws = np.sqrt(ds[un].values ** 2 + ds[vn].values ** 2)
    LON, LAT = np.meshgrid(ds[lonname].values, ds[latname].values)
    lon = np.where(LON > 180, LON - 360, LON)         # normaliza para -180..180

    lon_f, lat_f = lon.ravel(), LAT.ravel()
    # VENTO = V0 de projeto (NBR 6123, isopletas) no lugar do vento medido
    ventos = np.asarray(iso.v0_ponto(lon_f, lat_f), dtype=float)
    log(f"[ERA5] grade {t2m.shape} recebida (temperatura). Vento = V0 NBR 6123.")
    return (lon_f, lat_f, t2m.ravel(), ventos,
            "NBR 6123 V0 (isopletas) + T2M ERA5")


# ==============================================================================
# 3) INTERPOLACAO robusta (cubica -> linear -> nearest para preencher NaN)
# ==============================================================================
def interpolar(lons, lats, vals, GX, GY):
    Z = None
    for metodo in ("cubic", "linear"):
        Z = griddata((lons, lats), vals, (GX, GY), method=metodo)
        if np.isfinite(Z).any():
            break
    Zn = griddata((lons, lats), vals, (GX, GY), method="nearest")
    return np.where(np.isnan(Z), Zn, Z)


# ==============================================================================
# NUCLEO DE CALCULO (sem figura/arquivos) -- reutilizavel por outros modulos
# ==============================================================================
def computar_campos(uf, fonte=FONTE, altura=ALTURA_VENTO,
                    ano_ini=ANO_INI, ano_fim=ANO_FIM, log=print,
                    incluir_ng=True):
    """
    Roda apenas o CALCULO para o estado 'uf' e devolve todos os campos num
    objeto (SimpleNamespace), sem desenhar figura nem salvar arquivos.
    Serve tanto para o grafico padrao quanto para sobrepor outros dados
    (ex.: pontos/ativos de uma rede) sem recalcular o clima.
    """
    uf = uf.strip().upper()
    if uf not in ESTADOS:
        raise ValueError(f"UF invalida: {uf!r}. Use uma de {', '.join(ESTADOS)}.")
    nome, cod_ibge = ESTADOS[uf]
    log(f"===== {uf} - {nome} (IBGE {cod_ibge}) =====")

    # ---- 1. Contorno do estado -------------------------------------------------
    estado = carregar_contorno_estado(cod_ibge, uf, log=log)
    minx, miny, maxx, maxy = estado.bounds
    bbox = (minx, miny, maxx, maxy)
    log(f"[bbox] lon {minx:.3f}..{maxx:.3f} | lat {miny:.3f}..{maxy:.3f}")

    # ---- 2. Dados climaticos ---------------------------------------------------
    if fonte == "NASA_POWER":
        lons, lats, temps, ventos, rotulo = dados_nasa_power(
            bbox, altura, ano_ini, ano_fim, log=log)
    elif fonte == "ERA5":
        lons, lats, temps, ventos, rotulo = dados_era5(
            bbox, altura, ano_ini, ano_fim, log=log)
    else:
        raise ValueError("fonte deve ser 'NASA_POWER' ou 'ERA5'.")

    if len(lons) < 4:
        raise RuntimeError("Poucos pontos de dados para interpolar.")

    # ---- 3. Grade fina + interpolacao -----------------------------------------
    gx = np.linspace(minx, maxx, N_GRID)
    gy = np.linspace(miny, maxy, N_GRID)
    GX, GY = np.meshgrid(gx, gy)

    Ti = interpolar(lons, lats, temps, GX, GY)     # temperatura interpolada
    Wi = interpolar(lons, lats, ventos, GX, GY)    # vento interpolado

    # mascara: pontos da grade que caem DENTRO do estado (vetorizado, shapely 2)
    pts = shapely.points(GX.ravel(), GY.ravel())
    mask = shapely.contains(estado, pts).reshape(GX.shape)

    # ---- 4. Medias estaduais ---------------------------------------------------
    Tm = float(np.nanmean(np.where(mask, Ti, np.nan)))
    Wm = float(np.nanmean(np.where(mask, Wi, np.nan)))
    log(f"[medias] Temperatura media do estado = {Tm:.2f} C")
    log(f"[medias] Vento medio do estado       = {Wm:.2f} m/s")

    # ---- 5. Condicao combinada + sub-contornos --------------------------------
    #   T abaixo da media  E  vento acima da media, dentro do estado
    cond = mask & (Ti < Tm) & (Wi > Wm)

    # componentes conectados; descarta manchas muito pequenas (ruido de interpolacao)
    lbl, n = ndimage.label(cond)
    min_cells = max(8, int(AREA_MIN_FRAC * mask.sum()))
    sizes = np.bincount(lbl.ravel())
    keep = np.array([k for k in range(1, n + 1) if sizes[k] >= min_cells])
    final = np.isin(lbl, keep) if keep.size else np.zeros_like(cond)
    log(f"[sub-contornos] {keep.size} regiao(oes) atende(m) aos dois criterios.")

    # pontos-fonte (dados reais) que qualificam, dentro do estado
    src_in = shapely.contains(estado, shapely.points(lons, lats))
    qual = src_in & (temps < Tm) & (ventos > Wm)

    # ---- 6. Ng: densidade de descargas atmosfericas (NBR 5419-2, por municipio)
    #   Campo por municipio (nearest = cada celula herda o Ng do municipio mais
    #   proximo). Robusto: se a rede falhar, segue sem Ng (nao quebra T/V0).
    #   incluir_ng=False pula a carga estadual (ex.: analise pontual que so
    #   precisa do Ng unitario de uma cidade via ng.ng_municipio).
    municipios_ng, Ngi, Ngm = None, None, float("nan")
    if incluir_ng:
        try:
            municipios_ng = ng.carregar_ng_estado(uf, cod_ibge, log=log)
            clon = np.array([m["cx"] for m in municipios_ng])
            clat = np.array([m["cy"] for m in municipios_ng])
            ngv = np.array([m["ng"] for m in municipios_ng], dtype=float)
            Ngi = griddata((clon, clat), ngv, (GX, GY), method="nearest")
            Ngm = float(np.nanmean(np.where(mask, Ngi, np.nan)))
            log(f"[medias] Ng medio do estado          = {Ngm:.1f} descargas/km2/ano")
        except Exception as e:
            municipios_ng, Ngi, Ngm = None, None, float("nan")
            log(f"[Ng] indisponivel ({type(e).__name__}: {e}); seguindo sem Ng.")

    return types.SimpleNamespace(
        uf=uf, nome=nome, cod_ibge=cod_ibge, estado=estado, bbox=bbox,
        lons=lons, lats=lats, temps=temps, ventos=ventos, rotulo=rotulo,
        GX=GX, GY=GY, Ti=Ti, Wi=Wi, mask=mask, Tm=Tm, Wm=Wm,
        cond=cond, final=final, keep=keep, qual=qual,
        municipios_ng=municipios_ng, Ngi=Ngi, Ngm=Ngm,
        fonte=fonte, altura=altura, ano_ini=ano_ini, ano_fim=ano_fim,
    )


# ==============================================================================
# PIPELINE PRINCIPAL (parametrizado por estado)
# ==============================================================================
def executar_analise(uf, fonte=FONTE, altura=ALTURA_VENTO,
                     ano_ini=ANO_INI, ano_fim=ANO_FIM, log=print):
    """
    Roda a analise completa para o estado 'uf' (sigla, ex.: 'CE').
    Retorna um dicionario com os caminhos de saida e as medias estaduais.
    Nao abre janelas: salva a figura em PNG (backend Agg).
    """
    # ---- 1-5. Calculo do clima (reaproveitavel) -------------------------------
    c = computar_campos(uf, fonte, altura, ano_ini, ano_fim, log=log)
    uf, nome = c.uf, c.nome
    estado = c.estado
    minx, miny, maxx, maxy = c.bbox
    lons, lats, temps, ventos, rotulo = c.lons, c.lats, c.temps, c.ventos, c.rotulo
    GX, GY, Ti, Wi = c.GX, c.GY, c.Ti, c.Wi
    mask, Tm, Wm = c.mask, c.Tm, c.Wm
    final, keep, qual = c.final, c.keep, c.qual
    municipios_ng, Ngi, Ngm = c.municipios_ng, c.Ngi, c.Ngm

    os.makedirs(DIR_SAIDA, exist_ok=True)
    arq_png     = os.path.join(DIR_SAIDA, f"subcontornos_{uf.lower()}.png")
    arq_geojson = os.path.join(DIR_SAIDA, f"subcontornos_{uf.lower()}.geojson")
    arq_csv     = os.path.join(DIR_SAIDA, f"pontos_qualificados_{uf.lower()}.csv")

    # ==========================================================================
    # 6) FIGURA (4 paineis: temperatura | V0 | Ng | intersecao)
    # ==========================================================================
    from matplotlib.collections import PatchCollection
    from matplotlib.patches import Polygon as MplPolygon

    fig, ((axa, axb), (axc, axd)) = plt.subplots(2, 2, figsize=(14, 13),
                                                 constrained_layout=True)

    Tmask = np.where(mask, Ti, np.nan)
    Wmask = np.where(mask, Wi, np.nan)

    def moldura(ax, titulo):
        plotar_contorno(ax, estado, color="k", lw=1.4)
        ax.set_xlim(minx - 0.1, maxx + 0.1)
        ax.set_ylim(miny - 0.1, maxy + 0.1)
        ax.set_xlabel("Longitude"); ax.set_ylabel("Latitude")
        ax.set_aspect("equal"); ax.set_title(titulo, fontsize=11)

    # -- Painel A: Temperatura + regiao ABAIXO da media -------------------------
    cfa = axa.contourf(GX, GY, Tmask, levels=14, cmap="coolwarm")
    axa.contour(GX, GY, Tmask, levels=[Tm], colors="k", linewidths=1.8)
    axa.contourf(GX, GY, (mask & (Ti < Tm)).astype(float),
                 levels=[0.5, 1.5], colors=["#1f4e79"], alpha=0.30)
    fig.colorbar(cfa, ax=axa, shrink=0.8, label="Temperatura (C)")
    moldura(axa, f"(a) Temperatura media\nazul = ABAIXO da media ({Tm:.1f} C)")

    # -- Painel B: V0 (vento de projeto) + regiao ACIMA da media ----------------
    #   Estados inteiramente dentro de uma faixa de isopleta tem V0 ~ constante:
    #   nesse caso o contourf so mostraria ruido numerico -> preenchimento chapado.
    Wrange = float(np.nanmax(Wmask) - np.nanmin(Wmask))
    if Wrange < 0.5:
        axb.contourf(GX, GY, np.where(mask, 1.0, np.nan),
                     levels=[0.5, 1.5], colors=["#2e7d32"], alpha=0.55)
        axb.text(0.5, 0.5, f"V0 ~ {Wm:.0f} m/s\n(uniforme no estado)",
                 transform=axb.transAxes, ha="center", va="center",
                 fontsize=12, color="#1b3d1b",
                 bbox=dict(boxstyle="round,pad=0.4", fc="white", alpha=0.8))
        moldura(axb, f"(b) V0 - vento de projeto (NBR 6123)\n"
                     f"uniforme = {Wm:.0f} m/s (uma faixa de isopleta)")
    else:
        cfb = axb.contourf(GX, GY, Wmask, levels=14, cmap="viridis")
        axb.contour(GX, GY, Wmask, levels=[Wm], colors="w", linewidths=1.8)
        axb.contourf(GX, GY, (mask & (Wi > Wm)).astype(float),
                     levels=[0.5, 1.5], colors=["#e07b00"], alpha=0.30)
        fig.colorbar(cfb, ax=axb, shrink=0.8, label="V0 - vento de projeto (m/s)")
        moldura(axb, f"(b) V0 - vento de projeto (NBR 6123)\n"
                     f"laranja = ACIMA da media ({Wm:.1f} m/s)")

    # -- Painel C: Ng - descargas atmosfericas por municipio (NBR 5419-2) --------
    if municipios_ng:
        patches, valores = [], []
        for m in municipios_ng:
            for poly in iter_polygons(m["geom"]):
                patches.append(MplPolygon(np.asarray(poly.exterior.coords)))
                valores.append(m["ng"])
        valores = np.array(valores, dtype=float)
        pc = PatchCollection(patches, cmap="YlOrRd")
        pc.set_array(valores)
        pc.set_clim(valores.min(), valores.max())
        pc.set_edgecolor("face")
        axc.add_collection(pc)
        # destaca municipios ACIMA da media estadual de Ng (borda escura)
        acima = [MplPolygon(np.asarray(p.exterior.coords))
                 for m in municipios_ng if m["ng"] > Ngm
                 for p in iter_polygons(m["geom"])]
        if acima:
            axc.add_collection(PatchCollection(
                acima, facecolor="none", edgecolor="#4d0000", linewidths=0.6))
        fig.colorbar(pc, ax=axc, shrink=0.8, label="Ng (descargas/km2/ano)")
        moldura(axc, f"(c) Ng - descargas atmosfericas (NBR 5419-2)\n"
                     f"borda escura = ACIMA da media ({Ngm:.1f})")
    else:
        moldura(axc, "(c) Ng - descargas atmosfericas (indisponivel)")
        axc.text(0.5, 0.5, "Ng indisponivel\n(sem rede?)", transform=axc.transAxes,
                 ha="center", va="center", fontsize=11, color="#7f0000")

    # -- Painel D: INTERSECAO (sub-contornos finais) ----------------------------
    axd.contour(GX, GY, Tmask, levels=[Tm], colors="navy",
                linestyles="--", linewidths=1.0)
    axd.contour(GX, GY, Wmask, levels=[Wm], colors="green",
                linestyles="--", linewidths=1.0)
    if final.any():
        axd.contourf(GX, GY, final.astype(float), levels=[0.5, 1.5],
                     colors=["#d62728"], alpha=0.45)
    csub = axd.contour(GX, GY, final.astype(float), levels=[0.5],
                       colors="#7f0000", linewidths=1.8)
    axd.scatter(lons[qual], lats[qual], s=45, c="k", marker="o",
                edgecolors="w", zorder=5)
    moldura(axd, "(d) SUB-CONTORNOS: T < media  E  V0 > media")

    axd.legend(handles=[
        Line2D([0], [0], color="navy", ls="--", label=f"Isoterma media ({Tm:.1f} C)"),
        Line2D([0], [0], color="green", ls="--", label=f"Iso-V0 media ({Wm:.1f} m/s)"),
        Patch(facecolor="#d62728", alpha=0.45, edgecolor="#7f0000",
              label="T abaixo E V0 acima"),
        Line2D([0], [0], marker="o", color="none", markerfacecolor="k",
               markeredgecolor="w", label="Pontos-fonte qualificados"),
    ], loc="lower left", fontsize=8, framealpha=0.9)

    ng_txt = f" | Ng medio {Ngm:.1f} descargas/km2/ano" if municipios_ng else ""
    fig.suptitle(
        f"{nome} ({uf}) - temperatura (satelite), V0 (NBR 6123) e Ng (NBR 5419-2)\n"
        f"Fonte: {rotulo}{ng_txt} | climatologia {ano_ini}-{ano_fim}",
        fontsize=13, fontweight="bold")

    fig.savefig(arq_png, dpi=150)
    plt.close(fig)                                     # libera memoria (varios estados)
    log(f"[saida] figura salva em: {arq_png}")

    # ==========================================================================
    # 7) EXPORTAR sub-contornos (coordenadas geograficas) e pontos qualificados
    # ==========================================================================
    # 7a) GeoJSON com os poligonos dos sub-contornos (lon/lat)
    feats = []
    for seg in csub.allsegs[0]:
        if len(seg) >= 4:
            poly = Polygon(seg)
            if poly.is_valid and poly.area > 0:
                feats.append({"type": "Feature",
                              "properties": {"uf": uf, "estado": nome},
                              "geometry": mapping(poly)})
    with open(arq_geojson, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f)
    log(f"[saida] {len(feats)} sub-contorno(s) em: {arq_geojson}")

    # 7b) CSV com os pontos-fonte que qualificam (com Ng amostrado por municipio)
    if municipios_ng and qual.any():
        _clon = np.array([m["cx"] for m in municipios_ng])
        _clat = np.array([m["cy"] for m in municipios_ng])
        _ngv = np.array([m["ng"] for m in municipios_ng], dtype=float)
        ng_q = griddata((_clon, _clat), _ngv,
                        (lons[qual], lats[qual]), method="nearest")
    else:
        ng_q = np.full(int(qual.sum()), np.nan)

    with open(arq_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["lon", "lat", "temperatura_C", "V0_projeto_m_s",
                    "ng_descargas_km2_ano"])
        for lo, la, t, v, g in zip(lons[qual], lats[qual], temps[qual],
                                   ventos[qual], ng_q):
            gtxt = "" if np.isnan(g) else f"{g:.0f}"
            w.writerow([f"{lo:.4f}", f"{la:.4f}", f"{t:.2f}", f"{v:.2f}", gtxt])
    log(f"[saida] {int(qual.sum())} ponto(s) qualificado(s) em: {arq_csv}")

    return {
        "uf": uf, "nome": nome, "png": arq_png, "geojson": arq_geojson,
        "csv": arq_csv, "temp_media": Tm, "vento_medio": Wm, "ng_medio": Ngm,
        "n_regioes": int(keep.size), "n_pontos": int(qual.sum()),
    }


# ==============================================================================
# UTILITARIO: abrir arquivo no visualizador padrao do sistema
# ==============================================================================
def abrir_arquivo(path):
    try:
        path = os.path.abspath(path)
        if sys.platform.startswith("win"):
            os.startfile(path)                         # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            import subprocess; subprocess.Popen(["open", path])
        else:
            import subprocess; subprocess.Popen(["xdg-open", path])
    except Exception:
        pass


# ==============================================================================
# INTERFACE GRAFICA (Tkinter)
# ==============================================================================
def iniciar_gui():
    """Abre a janela de selecao de estado e parametros. Roda a analise em uma
    thread separada para nao travar a interface, mostrando o progresso."""
    import tkinter as tk
    from tkinter import ttk, messagebox
    import threading
    import queue

    root = tk.Tk()
    root.title("Contornos climaticos por estado - CEAR/UFPB")
    root.minsize(560, 520)

    fila = queue.Queue()                               # comunicacao thread -> GUI
    estado_rodando = {"ativo": False}

    # ------------------------------------------------------------------ cabecalho
    frm = ttk.Frame(root, padding=14)
    frm.grid(row=0, column=0, sticky="nsew")
    root.columnconfigure(0, weight=1); root.rowconfigure(0, weight=1)
    frm.columnconfigure(1, weight=1)

    ttk.Label(frm, text="Analise de recurso eolico em areas amenas",
              font=("Segoe UI", 12, "bold")).grid(
        row=0, column=0, columnspan=2, sticky="w", pady=(0, 2))
    ttk.Label(frm, text="Locais com temperatura ABAIXO da media do estado E "
                        "vento ACIMA da media do estado.",
              foreground="#555").grid(
        row=1, column=0, columnspan=2, sticky="w", pady=(0, 12))

    # ------------------------------------------------------------------ Estado
    ttk.Label(frm, text="Estado:").grid(row=2, column=0, sticky="w", pady=4)
    valores_uf = [f"{uf} - {nome}" for uf, (nome, _) in ESTADOS_ORDENADOS]
    cb_estado = ttk.Combobox(frm, values=valores_uf, state="readonly")
    cb_estado.grid(row=2, column=1, sticky="ew", pady=4)
    # seleciona a Paraiba por padrao
    idx_pb = next((i for i, (uf, _) in enumerate(ESTADOS_ORDENADOS) if uf == "PB"), 0)
    cb_estado.current(idx_pb)

    # ------------------------------------------------------------------ Fonte
    ttk.Label(frm, text="Fonte de dados:").grid(row=3, column=0, sticky="w", pady=4)
    cb_fonte = ttk.Combobox(frm, values=["NASA_POWER", "ERA5"], state="readonly")
    cb_fonte.grid(row=3, column=1, sticky="ew", pady=4)
    cb_fonte.current(0)

    # ------------------------------------------------------------------ Altura
    ttk.Label(frm, text="Altura do vento (m):").grid(row=4, column=0, sticky="w", pady=4)
    cb_altura = ttk.Combobox(frm, values=["10", "50", "100"], state="readonly")
    cb_altura.grid(row=4, column=1, sticky="ew", pady=4)
    cb_altura.set("50")

    # ------------------------------------------------------------------ Periodo
    ttk.Label(frm, text="Periodo (ano inicial / final):").grid(
        row=5, column=0, sticky="w", pady=4)
    per = ttk.Frame(frm); per.grid(row=5, column=1, sticky="ew", pady=4)
    sp_ini = ttk.Spinbox(per, from_=1981, to=2024, width=7)
    sp_ini.set(str(ANO_INI)); sp_ini.pack(side="left")
    ttk.Label(per, text="  ate  ").pack(side="left")
    sp_fim = ttk.Spinbox(per, from_=1981, to=2024, width=7)
    sp_fim.set(str(ANO_FIM)); sp_fim.pack(side="left")

    # ------------------------------------------------------------------ Botao
    btn = ttk.Button(frm, text="Rodar analise")
    btn.grid(row=6, column=0, columnspan=2, sticky="ew", pady=(12, 8))

    # ------------------------------------------------------------------ Log
    ttk.Label(frm, text="Progresso:").grid(row=7, column=0, sticky="w")
    txt = tk.Text(frm, height=12, wrap="word", state="disabled",
                  background="#111", foreground="#e0e0e0", insertbackground="#e0e0e0")
    txt.grid(row=8, column=0, columnspan=2, sticky="nsew", pady=(2, 0))
    frm.rowconfigure(8, weight=1)
    sb = ttk.Scrollbar(frm, command=txt.yview)
    sb.grid(row=8, column=2, sticky="ns", pady=(2, 0))
    txt.configure(yscrollcommand=sb.set)

    def escrever(msg):
        txt.configure(state="normal")
        txt.insert("end", msg + "\n")
        txt.see("end")
        txt.configure(state="disabled")

    # ------------------------------------------------------- thread de trabalho
    def log_thread(msg):
        fila.put(("log", str(msg)))

    def trabalhar(params):
        try:
            res = executar_analise(log=log_thread, **params)
            fila.put(("done", res))
        except Exception as e:
            fila.put(("erro", f"{type(e).__name__}: {e}"))

    def rodar():
        if estado_rodando["ativo"]:
            return
        sel = cb_estado.get().split(" - ")[0]          # "CE - Ceara" -> "CE"
        try:
            ini = int(sp_ini.get()); fim = int(sp_fim.get())
        except ValueError:
            messagebox.showerror("Periodo invalido", "Informe anos validos.")
            return
        if ini > fim:
            messagebox.showerror("Periodo invalido",
                                 "O ano inicial deve ser <= ao ano final.")
            return
        params = {
            "uf": sel,
            "fonte": cb_fonte.get(),
            "altura": int(cb_altura.get()),
            "ano_ini": ini,
            "ano_fim": fim,
        }
        estado_rodando["ativo"] = True
        btn.configure(state="disabled", text="Rodando... (pode levar 1-2 min)")
        txt.configure(state="normal"); txt.delete("1.0", "end")
        txt.configure(state="disabled")
        threading.Thread(target=trabalhar, args=(params,), daemon=True).start()

    btn.configure(command=rodar)

    def finalizar():
        estado_rodando["ativo"] = False
        btn.configure(state="normal", text="Rodar analise")

    def poll():
        while not fila.empty():
            tipo, payload = fila.get()
            if tipo == "log":
                escrever(payload)
            elif tipo == "done":
                escrever("")
                escrever(f"CONCLUIDO - {payload['nome']} ({payload['uf']})")
                _ngtxt = (f" | Ng medio: {payload['ng_medio']:.1f} descargas/km2/ano"
                          if payload.get('ng_medio') == payload.get('ng_medio')  # nao-NaN
                          else "")
                escrever(f"  Temp. media: {payload['temp_media']:.2f} C | "
                         f"V0 medio: {payload['vento_medio']:.2f} m/s" + _ngtxt)
                escrever(f"  {payload['n_regioes']} sub-regiao(oes), "
                         f"{payload['n_pontos']} ponto(s) qualificado(s).")
                escrever(f"  PNG: {payload['png']}")
                escrever(f"  GeoJSON: {payload['geojson']}")
                escrever(f"  CSV: {payload['csv']}")
                abrir_arquivo(payload["png"])
                finalizar()
            elif tipo == "erro":
                escrever("")
                escrever("ERRO: " + payload)
                messagebox.showerror("Erro na analise", payload)
                finalizar()
        root.after(120, poll)

    root.after(120, poll)
    root.mainloop()


# ==============================================================================
# MENU NO TERMINAL (fallback se o Tkinter nao estiver disponivel)
# ==============================================================================
def menu_terminal():
    print("\n=== Contornos climaticos por estado ===")
    for i, (uf, (nome, _)) in enumerate(ESTADOS_ORDENADOS, 1):
        print(f"  {i:2d}. {uf} - {nome}")
    escolha = input("\nEscolha o numero do estado: ").strip()
    try:
        uf = ESTADOS_ORDENADOS[int(escolha) - 1][0]
    except (ValueError, IndexError):
        print("Escolha invalida.")
        return
    res = executar_analise(uf)
    abrir_arquivo(res["png"])


# ==============================================================================
# ENTRADA PRINCIPAL
# ==============================================================================
def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Contornos climaticos por estado brasileiro: locais com "
                    "temperatura abaixo da media E vento acima da media do estado.")
    ap.add_argument("--uf", help="Sigla do estado (ex.: PB, CE, BA). "
                                 "Se omitido, abre a interface grafica.")
    ap.add_argument("--fonte", default=FONTE, choices=["NASA_POWER", "ERA5"])
    ap.add_argument("--altura", type=int, default=ALTURA_VENTO,
                    help="Altura do vento em metros (NASA: 10/50 | ERA5: 10/100).")
    ap.add_argument("--ini", type=int, default=ANO_INI, help="Ano inicial.")
    ap.add_argument("--fim", type=int, default=ANO_FIM, help="Ano final.")
    ap.add_argument("--sem-interface", action="store_true",
                    help="Nao abrir a janela; usar menu no terminal.")
    args = ap.parse_args(argv)

    # Modo linha de comando: --uf informado -> roda direto (sem janela)
    if args.uf:
        uf = args.uf.strip().upper()
        if uf not in ESTADOS:
            ap.error(f"UF invalida: {uf!r}. Use uma de: {', '.join(sorted(ESTADOS))}.")
        res = executar_analise(uf, args.fonte, args.altura, args.ini, args.fim)
        abrir_arquivo(res["png"])
        return

    # Sem --uf: tenta a interface grafica; se faltar Tkinter, cai no menu.
    if not args.sem_interface:
        try:
            iniciar_gui()
            return
        except Exception as e:
            print(f"[interface grafica indisponivel: {e}] usando o menu do terminal.")
    menu_terminal()


if __name__ == "__main__":
    main()
