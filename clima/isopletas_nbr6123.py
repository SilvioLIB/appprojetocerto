# -*- coding: utf-8 -*-
"""
================================================================================
Campo espacial de V0 (velocidade basica do vento) - ABNT NBR 6123:2023, Figura 1
================================================================================

Reconstroi um campo continuo de V0(lon, lat) a partir do MAPA DE ISOPLETAS
(Figura 1 da Norma) e das ESTACOES METEOROLOGICAS do Anexo C.

V0 = maxima velocidade media sobre 3 s, a 10 m acima do terreno, em campo aberto
e plano, excedida em media uma vez em 50 anos (rajada de projeto). Varia de
30 m/s (plato Norte/Central) a 50 m/s (extremo Sul do RS).

COMO FOI MONTADO
  - As COORDENADAS de cada ponto de controle vem da Tabela C.1 (Anexo C) da
    NBR 6123:2023 -- valores EXATOS, transcritos da Norma.
  - O V0 de cada ponto foi LIDO da Figura 1 (posicao do ponto entre as
    isopletas de 30/35/40/45/50 m/s). Valores intermediarios (ex.: 43, 46)
    sao ESTIMATIVAS visuais da posicao dentro da faixa -> CONFERIR na Figura 1
    para trabalho definitivo de engenharia.
  - Alguns pontos SINTETICOS (marcados fonte="isopleta") ancoram regioes sem
    estacao proxima (nucleo de 50 m/s no extremo Sul, borda oeste do RS).

Uso rapido:
    import isopletas_nbr6123 as iso
    v0 = iso.v0_ponto(-51.2, -30.0)        # Porto Alegre ~ 45 m/s
    campo = iso.v0_grade(GX, GY)           # array 2D no mesmo shape da grade

A tabela PONTOS e' EDITAVEL: ajuste um V0 e o campo inteiro se atualiza.
--------------------------------------------------------------------------------
"""

import numpy as np

try:
    from scipy.interpolate import RBFInterpolator
    _TEM_RBF = True
except Exception:                                    # scipy antigo
    from scipy.interpolate import griddata
    _TEM_RBF = False

# faixa fisica valida do V0 na Figura 1 (m/s)
V0_MIN, V0_MAX = 30.0, 50.0

# ------------------------------------------------------------------------------
# PONTOS DE CONTROLE  ->  (lon, lat, V0, rotulo, fonte)
#   fonte = "estacao"  : coordenada da Tabela C.1 (Anexo C), V0 lido da Figura 1
#   fonte = "isopleta" : ponto sintetico para ancorar a forma das isopletas
# ------------------------------------------------------------------------------
PONTOS = [
    # -- Norte / Centro: plato de 30 m/s ---------------------------------------
    (-50.533,   2.067, 30, "Amapa",          "estacao"),
    (-48.483,  -1.383, 30, "Belem",          "estacao"),
    (-44.233,  -2.583, 30, "Sao Luiz",       "estacao"),
    (-54.717,  -2.433, 30, "Santarem",       "estacao"),
    (-59.983,  -3.150, 30, "Manaus",         "estacao"),
    (-57.733,  -6.267, 30, "Jacareacanga",   "estacao"),
    (-54.900,  -9.367, 30, "Cachimbo",       "estacao"),
    (-63.900,  -8.767, 30, "Porto Velho",    "estacao"),
    (-67.783,  -9.967, 31, "Rio Branco",     "estacao"),
    (-60.133, -12.733, 30, "Vilhena",        "estacao"),
    (-48.417, -10.700, 30, "Porto Nacional", "estacao"),
    (-47.433,  -7.333, 30, "Carolina",       "estacao"),
    (-42.817,  -5.083, 30, "Teresina",       "estacao"),
    (-41.750,  -2.900, 30, "Parnaiba",       "estacao"),
    (-43.417, -13.267, 30, "Lapa (Bom Jesus)", "estacao"),
    (-40.500,  -9.400, 30, "Petrolina",      "estacao"),
    # -- Nordeste (litoral e faixa de 30) --------------------------------------
    (-38.533,  -3.783, 30, "Fortaleza",      "estacao"),
    (-35.250,  -5.917, 30, "Natal",          "estacao"),
    (-34.917,  -8.133, 30, "Recife",         "estacao"),
    (-35.783,  -9.517, 30, "Maceio",         "estacao"),
    (-38.333, -12.900, 33, "Salvador",       "estacao"),
    (-39.250, -17.633, 33, "Caravelas",      "estacao"),
    # -- extremo Norte: lingua de 35 (Roraima) ---------------------------------
    (-60.700,   2.833, 33, "Boa Vista",      "estacao"),
    (-61.000,   3.500, 35, "Roraima N",      "isopleta"),
    # -- Centro-Oeste / Sudeste interior: transicao 30->35->40 -----------------
    (-56.100, -15.650, 31, "Cuiaba",         "estacao"),
    (-47.917, -15.867, 35, "Brasilia",       "estacao"),
    (-48.950, -16.367, 34, "Anapolis",       "estacao"),
    (-49.217, -16.633, 34, "Goiania",        "estacao"),
    (-48.233, -18.917, 35, "Uberlandia",     "estacao"),
    (-43.950, -19.850, 35, "Belo Horizonte", "estacao"),
    (-54.667, -20.467, 38, "Campo Grande",   "estacao"),
    # -- Sudeste: maximo local ~45 (regiao de Campinas/SP) ---------------------
    (-47.133, -23.000, 45, "Campinas",       "estacao"),
    (-47.350, -21.983, 43, "Pirassununga",   "estacao"),
    (-46.467, -23.433, 43, "Cumbica",        "estacao"),
    (-46.650, -23.617, 43, "SP Congonhas",   "estacao"),
    (-46.300, -23.933, 40, "Santos",         "estacao"),
    (-51.133, -23.333, 42, "Londrina",       "estacao"),
    # -- litoral RJ/ES: faixa de 35 --------------------------------------------
    (-43.367, -22.867, 35, "Afonsos",        "estacao"),
    (-43.167, -22.900, 35, "Rio (S.Dumont)", "estacao"),
    (-43.717, -22.933, 35, "Santa Cruz",     "estacao"),
    (-40.283, -20.267, 35, "Vitoria",        "estacao"),
    # -- Sul: subida 40 -> 45 -> 48 --------------------------------------------
    (-49.183, -25.517, 40, "Curitiba",       "estacao"),
    (-54.583, -25.517, 44, "Foz do Iguacu",  "estacao"),
    (-55.700, -22.550, 45, "Ponta Pora",     "estacao"),
    (-48.550, -27.667, 43, "Florianopolis",  "estacao"),
    (-51.167, -30.000, 45, "Porto Alegre",   "estacao"),
    (-53.700, -29.717, 46, "Santa Maria",    "estacao"),
    (-57.033, -29.783, 46, "Uruguaiana",     "estacao"),
    (-54.117, -31.383, 48, "Bage",           "estacao"),
    # -- nucleo de 50 no extremo Sul do RS (sintetico, borda da Figura 1) ------
    (-53.400, -33.600, 50, "Extremo Sul",    "isopleta"),
    (-52.800, -33.300, 50, "Litoral Sul RS", "isopleta"),
    (-56.000, -30.600, 48, "Oeste RS",       "isopleta"),
]


def _arrays():
    """Devolve (XY Nx2, V0 N) dos pontos de controle."""
    xy = np.array([[p[0], p[1]] for p in PONTOS], dtype=float)
    v0 = np.array([p[2] for p in PONTOS], dtype=float)
    return xy, v0


_INTERP = None


def _interpolador():
    """Constroi (uma vez) o interpolador RBF do campo de V0."""
    global _INTERP
    if _INTERP is not None:
        return _INTERP
    xy, v0 = _arrays()
    if _TEM_RBF:
        # thin-plate suave; smoothing pequeno evita ondulacoes entre pontos densos
        _INTERP = RBFInterpolator(xy, v0, kernel="thin_plate_spline",
                                  smoothing=1.0)
    else:
        _INTERP = None                                # usa griddata direto
    return _INTERP


def v0_grade(GX, GY):
    """V0 (m/s) interpolado numa grade 2D (mesmo shape de GX/GY)."""
    GX = np.asarray(GX, dtype=float)
    GY = np.asarray(GY, dtype=float)
    pts = np.column_stack([GX.ravel(), GY.ravel()])
    if _TEM_RBF:
        z = _interpolador()(pts)
    else:
        from scipy.interpolate import griddata
        xy, v0 = _arrays()
        z = griddata(xy, v0, pts, method="cubic")
        nn = griddata(xy, v0, pts, method="nearest")
        z = np.where(np.isnan(z), nn, z)
    z = np.clip(z, V0_MIN, V0_MAX)
    return z.reshape(GX.shape)


def v0_ponto(lon, lat):
    """V0 (m/s) num ponto (ou arrays de pontos)."""
    lon = np.atleast_1d(np.asarray(lon, dtype=float))
    lat = np.atleast_1d(np.asarray(lat, dtype=float))
    z = v0_grade(lon, lat)
    return float(z[0]) if z.size == 1 else z


if __name__ == "__main__":
    # sanity-check rapido
    for nome, lo, la in [("Porto Alegre", -51.2, -30.0),
                         ("Manaus", -60.0, -3.1),
                         ("Campinas", -47.1, -23.0),
                         ("Recife", -34.9, -8.1),
                         ("Bage", -54.1, -31.4)]:
        print(f"{nome:15s} V0 = {v0_ponto(lo, la):.1f} m/s")
