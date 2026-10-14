# -*- coding: utf-8 -*-
"""
Pacote `clima` -- ferramentas de descargas atmosfericas (Ng) e contorno
climatico por estado, portadas do projeto "Redes resilientes" (CEAR/UFPB) e
adaptadas para uso generico (SEM dependencia de cadastro de transformadores).

Conteudo
--------
  * ng_nbr5419         -> Ng (descargas atmosfericas/km2/ano) por municipio,
                          tabela da ABNT NBR 5419-2  [ng_municipio, carregar_ng_estado]
  * ng_faixas_sturges  -> classificacao do Ng em 4 faixas (metodo de Sturges)
                          [grau_de_ng, limites_padrao, construir_faixas]
  * isopletas_nbr6123  -> campo de V0 (vento de projeto, ABNT NBR 6123) [v0_ponto]
  * contorno_clima_estados -> analise climatica por estado (Temp + V0 + Ng),
                          gera mapa/GeoJSON/CSV [computar_campos, executar_analise, ESTADOS]

API rapida (Ng -- so precisa do CSV, sem rede):
    from clima import ng_municipio, grau_de_ng
    ng  = ng_municipio("Joao Pessoa", "PB")   # -> valor tabelado da cidade
    cls = grau_de_ng(ng)                       # -> {'faixa':1,'nivel':'Baixo',...}

API pesada (contorno de estado -- baixa dados IBGE + NASA POWER, ~1-2 min):
    from clima import executar_analise
    res = executar_analise("PB")               # PNG/GeoJSON/CSV em clima/saidas/

Dependencias:
    Ng:        (nenhuma alem do stdlib para o lookup; carregar_ng_estado usa
               requests + shapely)
    Contorno:  requests numpy scipy matplotlib shapely
"""

# ---- API leve de Ng (lookup por municipio) -------------------------------
# ng_faixas_sturges usa apenas o stdlib -> sempre disponivel.
from .ng_faixas_sturges import (
    grau_de_ng,
    limites_padrao,
    construir_faixas,
    classificar,
    ROTULOS,
    CORES,
)

# ng_nbr5419 importa requests+shapely no topo; se faltarem, o lookup simples
# (ng_municipio) ainda assim e' exposto degradando o resto.
try:
    from .ng_nbr5419 import ng_municipio, carregar_ng_estado
    _TEM_NG = True
except Exception as _e:              # pragma: no cover
    _TEM_NG = False
    _ERRO_NG = _e

    def ng_municipio(*a, **k):
        raise ImportError(f"ng_nbr5419 indisponivel: {_ERRO_NG}")

    def carregar_ng_estado(*a, **k):
        raise ImportError(f"ng_nbr5419 indisponivel: {_ERRO_NG}")

# ---- API do vento de projeto V0 (NBR 6123) --------------------------------
try:
    from .isopletas_nbr6123 import v0_ponto, v0_grade
    _TEM_V0 = True
except Exception as _e:              # pragma: no cover
    _TEM_V0 = False

# ---- API pesada do contorno climatico por estado --------------------------
# Puxa matplotlib/scipy/shapely; se faltarem, o pacote ainda carrega e as
# funcoes de Ng continuam utilizaveis.
try:
    from .contorno_clima_estados import (
        computar_campos,
        executar_analise,
        ESTADOS,
        ESTADOS_ORDENADOS,
    )
    _TEM_CONTORNO = True
except Exception as _e:              # pragma: no cover
    _TEM_CONTORNO = False
    _ERRO_CONTORNO = _e

__all__ = [
    "ng_municipio", "carregar_ng_estado",
    "grau_de_ng", "limites_padrao", "construir_faixas", "classificar",
    "ROTULOS", "CORES",
    "v0_ponto", "v0_grade",
    "computar_campos", "executar_analise", "ESTADOS", "ESTADOS_ORDENADOS",
]
