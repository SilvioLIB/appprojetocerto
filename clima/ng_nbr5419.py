# -*- coding: utf-8 -*-
"""
================================================================================
Ng - densidade de descargas atmosfericas para a terra (ABNT NBR 5419-2:2015)
================================================================================

Fornece o indice Ng (numero de descargas atmosfericas para a terra por km2 por
ano) POR MUNICIPIO, transcrito da tabela do Anexo da NBR 5419-2 (arquivo
ng_nbr5419_municipios.csv, colunas: municipio, uf, ng).

Diferente da temperatura (satelite) e do V0 (isopletas), o Ng na Norma e'
tabelado por MUNICIPIO -- entao aqui:
  * ng_municipio(nome, uf)         -> valor exato da cidade (lookup na tabela).
  * carregar_ng_estado(uf, cod)    -> casa a tabela com as malhas municipais do
                                      IBGE (poligono + centroide de cada cidade),
                                      para desenhar o mapa e amostrar em pontos.

Uso:
    import ng_nbr5419 as ng
    ng.ng_municipio("Campinas", "SP")     # -> 22
    munis = ng.carregar_ng_estado("SP", 35)   # lista p/ mapa/amostragem
--------------------------------------------------------------------------------
"""

import os
import csv
import unicodedata

import requests
import shapely
from shapely.geometry import shape

CSV_NG = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      "ng_nbr5419_municipios.csv")


def _norm(s):
    """minusculas, sem acento, sem pontuacao, espacos colapsados (p/ casar nomes)."""
    s = str(s).strip().lower()
    s = "".join(ch for ch in unicodedata.normalize("NFKD", s)
                if not unicodedata.combining(ch))
    s = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in s)
    return " ".join(s.split())


# ------------------------------------------------------------------------------
# Tabela Ng por municipio (carregada 1x)
# ------------------------------------------------------------------------------
_TAB = None


def _tabela():
    global _TAB
    if _TAB is not None:
        return _TAB
    _TAB = {}
    with open(CSV_NG, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            _TAB[(_norm(row["municipio"]), row["uf"].upper())] = int(row["ng"])
    return _TAB


def ng_municipio(nome, uf):
    """Ng (descargas/km2/ano) do municipio, ou None se nao encontrado."""
    return _tabela().get((_norm(nome), str(uf).upper()))


# ------------------------------------------------------------------------------
# Malhas municipais do IBGE + casamento com a tabela Ng
# ------------------------------------------------------------------------------
def carregar_ng_estado(uf, cod_ibge, log=print):
    """
    Devolve uma lista de municipios do estado, cada um como dict:
        {nome, cod, geom (shapely), ng, cx, cy}
    onde (cx, cy) e' o centroide (lon, lat). So inclui municipios cujo Ng foi
    encontrado na tabela da Norma.
    """
    uf = str(uf).upper()

    # 1) nome <-> codigo IBGE de cada municipio do estado (uma requisicao)
    r = requests.get(
        f"https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios",
        timeout=60)
    r.raise_for_status()
    nome_por_cod = {int(m["id"]): m["nome"] for m in r.json()}

    # 2) poligonos de TODOS os municipios do estado (uma requisicao)
    r2 = requests.get(
        f"https://servicodados.ibge.gov.br/api/v3/malhas/estados/{cod_ibge}",
        params={"formato": "application/vnd.geo+json",
                "intrarregiao": "municipio", "qualidade": "intermediaria"},
        timeout=150)
    r2.raise_for_status()
    feats = r2.json()["features"]

    out, sem_ng = [], 0
    for feat in feats:
        prop = feat.get("properties", {})
        cod = prop.get("codarea") or prop.get("CD_MUN") or prop.get("id")
        try:
            cod = int(cod)
        except (TypeError, ValueError):
            continue
        nome = nome_por_cod.get(cod)
        if not nome:
            continue
        ngv = ng_municipio(nome, uf)
        if ngv is None:
            sem_ng += 1
            continue
        geom = shape(feat["geometry"])
        cen = geom.centroid
        out.append({"nome": nome, "cod": cod, "geom": geom,
                    "ng": ngv, "cx": cen.x, "cy": cen.y})

    log(f"[Ng] {len(out)} municipios casados com a tabela NBR 5419-2"
        + (f" ({sem_ng} sem correspondencia)" if sem_ng else ""))
    if not out:
        raise RuntimeError(f"Nenhum Ng casado para a UF {uf}.")
    return out


if __name__ == "__main__":
    for nome, uf in [("Manaus", "AM"), ("Sao Paulo", "SP"),
                     ("Joao Pessoa", "PB"), ("Bage", "RS")]:
        print(f"{nome}/{uf}: Ng = {ng_municipio(nome, uf)}")
