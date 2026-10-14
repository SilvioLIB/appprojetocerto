"""Validador de esforços em postes (circular e duplo T) e catálogo de materiais.

Baseado na Norma Técnica CPFL GED-3648 "Projeto de Rede de Distribuição -
Cálculo Mecânico" (v2.9). As funções reproduzem as expressões matemáticas da
norma; os dados pré-definidos (dimensões de postes, condutores, momentos do
Anexo 1, pesos específicos, etc.) vêm das tabelas do próprio documento.

Nomenclatura:
    Fp   - Esforço devido à pressão do vento no poste (daN)
    Fv/Fc- Esforço do vento sobre os condutores (daN)
    Pvp  - Pressão devida à ação do vento (a constante depende do tipo de poste)
    Cc   - Coeficiente do cabo (daN/m por condutor) = Pvp * d * 1e-3
    Vb   - Velocidade básica do vento (km/h) — ver VELOCIDADES_VENTO.
           A constante 0,00471 (superfícies cilíndricas) é calibrada para km/h.
    Sp   - Área da superfície do poste (m²)
    dt   - Dimensão do poste no topo (mm)
    ds   - Dimensão do poste na linha do solo (mm)
    L    - Comprimento nominal do poste (m)
    E    - Engastamento do poste (m) = 0,1*L + 0,6
    h    - Altura livre/útil do poste (m); para transferência de esforços a
           10 cm do topo usa-se h = L - E - 0,10 (ver altura_util_topo)
    MB   - Momento resistente na base/engastamento (daN·m)
    MA   - Momento resistente a 10 cm do topo (daN·m)
    Rnv  - Esforço resultante vertical/compressão (daN)
    Rnh  - Esforço resultante horizontal longitudinal (daN)
"""

import math
from collections import namedtuple

# Opção de seleção: rótulo exibível + valor numérico associado.
OP = namedtuple("OP", ["label", "valor"])

# Parâmetros gerais de projeto
PARAMETROS = {
    # Vão mecânico (m)
    "vao_mecanico": [70, 80, 90, 100, 110, 120, 130, 140, 150, 160,
                     170, 180, 190, 200, 300, 400, 500],
    # Ângulo de deflexão α (graus) — passo de 5°
    "angulo_deflexao": list(range(5, 91, 5)),
    # Peso do eletricista (kg) — carga de montagem (kgf ≈ daN)
    "peso_eletricista": [70, 80, 90, 100],
}

# E — tensão de operação (kV)
TENSOES_OPERACAO = [13.8, 24.2, 36.2]

# Velocidade básica de vento (Vb) adotada por região, em km/h (item 6.1.1).
# A constante 0,00471 usada na pressão do vento é calibrada para Vb em km/h.
#   São Paulo ......... 94 km/h  (26 m/s, categoria B de terreno)
#   Rio Grande do Sul . 117 km/h (32,4 m/s, categoria A de terreno, +8%)
VELOCIDADES_VENTO = {
    "SP": 94,
    "RS": 117,
}

# S — espaçamento mínimo entre condutores (m)
# TODO: adicionar os valores de S (a preencher). Está por tensão porque o
#       espaçamento costuma variar com o nível de tensão; ajuste a estrutura
#       (ex.: um único valor) se no seu caso S não depender de E.
ESPACAMENTO_MINIMO = {
    13.8: None,   # TODO: S (m) para 13,8 kV
    24.2: None,   # TODO: S (m) para 24,2 kV
    36.2: None,   # TODO: S (m) para 36,2 kV
}

ENGASTAMENTO_PROFUNDIDADE = [
    OP("Poste 9 m — engastamento 1,50 m", 1.50),
    OP("Poste 10 m — engastamento 1,60 m", 1.60),
    OP("Poste 11 m — engastamento 1,70 m", 1.70),
    OP("Poste 12 m — engastamento 1,80 m", 1.80),
    OP("Poste 13 m — engastamento 1,90 m", 1.90),
]
CONDUTORES = {
    "CA": {
        "nome": "Cabo de alumínio nu (CA)",
        "bitolas": [
            {"awg": "2",     "diam_mm": 7.41,  "peso_kg_km": 92.5},
            {"awg": "1/0",   "diam_mm": 9.36,  "peso_kg_km": 147.6},
            {"awg": "2/0",   "diam_mm": 10.50, "peso_kg_km": 185.7},
            {"awg": "3/0",   "diam_mm": 11.79, "peso_kg_km": 234.1},
            {"awg": "4/0",   "diam_mm": 13.26, "peso_kg_km": 296.1},
            {"awg": "266.8", "diam_mm": 14.88, "peso_kg_km": 372.9},
            {"awg": "336.4", "diam_mm": 16.90, "peso_kg_km": 470},
        ],
    },
    "CAL": {
        "nome": "Cabo de alumínio-liga (CAL 6201)",
        "bitolas": [
            {"awg": "2",     "diam_mm": 7.41,  "peso_kg_km": 92},
            {"awg": "1/0",   "diam_mm": 9.36,  "peso_kg_km": 146.8},
            {"awg": "4/0",   "diam_mm": 13.26, "peso_kg_km": 294.7},
            {"awg": "336.4", "diam_mm": 16.90, "peso_kg_km": 487.3},
        ],
    },
    "CAA": {
        "nome": "Cabo de alumínio nu com alma de aço (CAA)",
        "bitolas": [
            {"awg": "2",     "diam_mm": 8.01,  "peso_kg_km": 135.8},
            {"awg": "1/0",   "diam_mm": 10.11, "peso_kg_km": 216.2},
            {"awg": "2/0",   "diam_mm": 11.34, "peso_kg_km": 272},
            {"awg": "3/0",   "diam_mm": 12.75, "peso_kg_km": 343.9},
            {"awg": "4/0",   "diam_mm": 14.31, "peso_kg_km": 433.2},
            {"awg": "266.8", "diam_mm": 16.28, "peso_kg_km": 545.3},
            {"awg": "336.4", "diam_mm": 18.31, "peso_kg_km": 689.9},
        ],
    },
}

# Pesos específicos e trações de ruptura dos condutores nus (item 6.5).
# Usados no cálculo de flechas/trações de vãos ancorados. Chave: (seção, tipo).
PESOS_ESPECIFICOS = {
    ("02",    "CA"):  {"peso_kg_m": 0.0918, "ruptura_daN": 564},
    ("1/0",   "CA"):  {"peso_kg_m": 0.1465, "ruptura_daN": 844},
    ("4/0",   "CA"):  {"peso_kg_m": 0.2941, "ruptura_daN": 1622},
    ("336.4", "CA"):  {"peso_kg_m": 0.4691, "ruptura_daN": 2656},
    ("477",   "CA"):  {"peso_kg_m": 0.6635, "ruptura_daN": 3665},
    ("04",    "CAA"): {"peso_kg_m": 0.0856, "ruptura_daN": 812},
    ("02",    "CAA"): {"peso_kg_m": 0.1358, "ruptura_daN": 1246},
    ("1/0",   "CAA"): {"peso_kg_m": 0.2163, "ruptura_daN": 1904},
    ("4/0",   "CAA"): {"peso_kg_m": 0.4332, "ruptura_daN": 3644},
    ("336.4", "CAA"): {"peso_kg_m": 0.6884, "ruptura_daN": 6181},
    ("477",   "CAA"): {"peso_kg_m": 0.9758, "ruptura_daN": 8538},
}

# Trações de projeto por feixe trifásico (daN). Usadas tanto como tração de
# projeto (T) quanto como esforço da rede primária transferido a 10 cm do topo.
# O rótulo do cabo é apenas informativo/correlativo; o cálculo usa "tracao_daN".
TRACOES_PROJETO = [
    {"label": "3 × 2 AWG CA (*)",                  "tracao_daN": 267},
    {"label": "3 × 1/0 AWG CA",                    "tracao_daN": 426},
    {"label": "3 × 2/0 AWG CA",                    "tracao_daN": 507},
    {"label": "3 × 4/0 AWG CA",                    "tracao_daN": 852},
    {"label": "3 × 336,4 MCM CA",                  "tracao_daN": 1356},
    {"label": "3 × 4 AWG CAA/CAL",                 "tracao_daN": 325},
    {"label": "3 × 2 AWG CAA/CAL",                 "tracao_daN": 454},
    {"label": "3 × 1/0 AWG CAA/CAL",               "tracao_daN": 605},
    {"label": "3 × 4/0 AWG CAA/CAL",               "tracao_daN": 1212},
    {"label": "3 × 336,4 MCM CAA/CAL",             "tracao_daN": 1517},
    {"label": "3 × 4/0 AWG CAA (*) tração reduzida",   "tracao_daN": 800},
    {"label": "3 × 336,4 MCM (*) tração reduzida", "tracao_daN": 860},
]

# Momentos fletores de postes de concreto circulares (Anexo 1).
# WA e WB são os módulos de resistência à flexão (cm³) no topo e na base,
# fornecidos pelo fabricante. h = L - E - 0,10 (altura útil). Rn = resistência
# nominal (daN). Chave: "comprimento/resistência".
MOMENTOS_ANEXO1 = {
    "9/2":   {"Rn": 200,  "h": 7.3,  "WA": 223, "WB": 1583},
    "9/4":   {"Rn": 400,  "h": 7.3,  "WA": 337, "WB": 1977},
    "9/6":   {"Rn": 600,  "h": 7.3,  "WA": 476, "WB": 2308},
    "11/2":  {"Rn": 200,  "h": 9.1,  "WA": 223, "WB": 2108},
    "11/4":  {"Rn": 400,  "h": 9.1,  "WA": 337, "WB": 2591},
    "11/6":  {"Rn": 600,  "h": 9.1,  "WA": 476, "WB": 2968},
    "11/10": {"Rn": 1000, "h": 9.1,  "WA": 859, "WB": 4032},
    "12/4":  {"Rn": 400,  "h": 10.0, "WA": 337, "WB": 2929},
    "12/6":  {"Rn": 600,  "h": 10.0, "WA": 476, "WB": 3329},
    "12/10": {"Rn": 1000, "h": 10.0, "WA": 859, "WB": 4471},
    "13/6":  {"Rn": 600,  "h": 10.9, "WA": 476, "WB": 3712},
    "13/10": {"Rn": 1000, "h": 10.9, "WA": 859, "WB": 4933},
}

CRUZETAS = {
    "concreto": {
        "nome": "Cruzeta de concreto",
        "pesos_kg": [20, 30, 40, 50, 60],
    },
    "PRFV": {
        "nome": "Cruzeta de PRFV (fibra de vidro)",
        "pesos_kg": [7, 8, 9, 10, 11, 12.5],
    },
    "aco": {
        "nome": "Cruzeta de aço",
        "pesos_kg": [10, 12, 13, 15],
    },
}
CRUZETAS_DIM = {
    "PRFV": {
        "nome": "PRFV (fibra de vidro)",
        "modelos": [
            {"formato": "Tipo L",     "L_mm": 1700, "b_mm": 90,  "c_mm": 90},
            {"formato": "Tipo T",     "L_mm": 1900, "b_mm": 90,  "c_mm": 90},
            {"formato": "Retangular", "L_mm": 3000, "b_mm": 90,  "c_mm": 112.5},
            {"formato": "Retangular", "L_mm": 3500, "b_mm": 90,  "c_mm": 112.5},
            {"formato": "Retangular", "L_mm": 5000, "b_mm": 120, "c_mm": 140},
        ],
    },
    "PEAD": {
        "nome": "PEAD (polietileno)",
        "modelos": [
            {"formato": "Tipo L",     "L_mm": 1700, "b_mm": 90,  "c_mm": 90},
            {"formato": "Tipo T",     "L_mm": 1900, "b_mm": 120, "c_mm": 140},
            {"formato": "Retangular", "L_mm": 2400, "b_mm": 90,  "c_mm": 112.5},
            {"formato": "Tipo T",     "L_mm": 2400, "b_mm": 90,  "c_mm": 90},
            {"formato": "Retangular", "L_mm": 3000, "b_mm": 90,  "c_mm": 112.5},
            {"formato": "Retangular", "L_mm": 3500, "b_mm": 90,  "c_mm": 112.5},
            {"formato": "Retangular", "L_mm": 5000, "b_mm": 120, "c_mm": 140},
        ],
    },
    "concreto": {
        "nome": "Concreto",
        "modelos": [
            {"formato": "Tipo L",     "L_mm": 1700, "b_mm": 90,  "c_mm": 90},
            {"formato": "Tipo L",     "L_mm": 1900, "b_mm": 90,  "c_mm": 90},
            {"formato": "Quadrada",   "L_mm": 2000, "b_mm": 90,  "c_mm": 90},
            {"formato": "Tipo L",     "L_mm": 2000, "b_mm": 120, "c_mm": 90},
            {"formato": "Retangular", "L_mm": 2400, "b_mm": 90,  "c_mm": 115},
            {"formato": "Tipo L",     "L_mm": 2400, "b_mm": 90,  "c_mm": 100},
        ],
    },
    "aco_galv": {
        "nome": "Aço galvanizado",
        "modelos": [
            {"formato": "Retangular", "L_mm": 2400, "b_mm": 90,  "c_mm": 90},
            {"formato": "Retangular", "L_mm": 3000, "b_mm": 90,  "c_mm": 110},
            {"formato": "Retangular", "L_mm": 5000, "b_mm": 120, "c_mm": 140},
        ],
    },
}


constante_pvp = {
    "circular": 0.00471,
    "duplo T": 0.00754,
}
postes = {
    "circular": {
        10: {
            300: {"dt": 170, "ds": 370},
            600: {"dt": 190, "ds": 390},
        },
        11: {
            300: {"dt": 170, "ds": 390},
            600: {"dt": 190, "ds": 410},
            1000: {"dt": 230, "ds": 450},
            1500: {"dt": 290, "ds": 510},
            2000: {"dt": 330, "ds": 550},
        },
        12: {
            300: {"dt": 170, "ds": 410},
            600: {"dt": 190, "ds": 430},
            1000: {"dt": 230, "ds": 470},
            1500: {"dt": 290, "ds": 530},
            2000: {"dt": 330, "ds": 570},
        },
        13: {
            600: {"dt": 190, "ds": 450},
            1000: {"dt": 230, "ds": 490},
            1500: {"dt": 290, "ds": 550},
            2000: {"dt": 330, "ds": 590},
        },
        14: {
            600: {"dt": 190, "ds": 470},
            1000: {"dt": 230, "ds": 510},
            1500: {"dt": 290, "ds": 570},
            2000: {"dt": 330, "ds": 610},
        },
        15: {
            600: {"dt": 190, "ds": 490},
            1000: {"dt": 230, "ds": 530},
            1500: {"dt": 290, "ds": 590},
            2000: {"dt": 330, "ds": 630},
        },
        16: {
            600: {"dt": 190, "ds": 510},
            1000: {"dt": 230, "ds": 550},
            1500: {"dt": 290, "ds": 610},
            2000: {"dt": 330, "ds": 650},
        },
        17: {
            600: {"dt": 190, "ds": 530},
            1000: {"dt": 230, "ds": 570},
            1500: {"dt": 290, "ds": 630},
            2000: {"dt": 330, "ds": 670},
        },
    },
    "duplo T": {
        9: {
            300: {"dt": 110, "ds": 290},
            600: {"dt": 110, "ds": 290},
        },
        10: {
            150: {"dt": 100, "ds": 200},
            300: {"dt": 110, "ds": 310},
            600: {"dt": 110, "ds": 310},
        },
        11: {
            300: {"dt": 170, "ds": 390},
            600: {"dt": 190, "ds": 410},
            1000: {"dt": 230, "ds": 450},
            1500: {"dt": 290, "ds": 510},
            2000: {"dt": 330, "ds": 550},
        },
        12: {
            300: {"dt": 170, "ds": 410},
            600: {"dt": 190, "ds": 430},
            1000: {"dt": 230, "ds": 470},
            1500: {"dt": 290, "ds": 530},
            2000: {"dt": 330, "ds": 570},
        },
        13: {
            300: {"dt": 190, "ds": 450},
            600: {"dt": 230, "ds": 490},
            1000: {"dt": 290, "ds": 550},
            2000: {"dt": 330, "ds": 590},  # REVISAR: bloco 13 m sem linha de 1500 daN
        },
        14: {
            300: {"dt": 190, "ds": 470},
            600: {"dt": 230, "ds": 510},
            1000: {"dt": 290, "ds": 570},
            2000: {"dt": 330, "ds": 610},
        },
        15: {
            300: {"dt": 190, "ds": 490},
            600: {"dt": 230, "ds": 530},
            1000: {"dt": 290, "ds": 590},
            2000: {"dt": 230, "ds": 610},  # REVISAR: dt=230 destoa (demais 2000 daN usam 330); ds pode ser 630
        },
        16: {
            300: {"dt": 190, "ds": 510},
            600: {"dt": 230, "ds": 550},
            1000: {"dt": 290, "ds": 610},
            2000: {"dt": 230, "ds": 650},  # REVISAR: dt=230 destoa (demais 2000 daN usam 330)
        },
        17: {
            300: {"dt": 190, "ds": 530},
            600: {"dt": 230, "ds": 570},
            1000: {"dt": 290, "ds": 630},
            2000: {"dt": 230, "ds": 670},  # REVISAR: dt=230 destoa (demais 2000 daN usam 330)
        },
    },
}


def altura_util(comprimento):
    """Altura útil (m) do poste a partir do comprimento total (m).

    Engastamento usual (NBR 8451): comprimento/10 + 0,60 m, logo
    altura_util = comprimento - (0,1*comprimento + 0,6) = 0,9*comprimento - 0,6.
    """
    return 0.9 * comprimento - 0.6


def get_dimensões(tipo, comprimento, resistencia):
    """Retorna (dt, ds) em mm do poste; ValueError se não cadastrado."""
    try:
        poste = postes[tipo][comprimento][resistencia]
        return poste["dt"], poste["ds"]
    except KeyError:
        raise ValueError(
            f"poste não cadastrado: {tipo}, {comprimento} m, {resistencia} daN"
        ) from None


def pressão_vento(tipo, Vb):
    """Pvp = constante do tipo * Vb**2."""
    c = constante_pvp[tipo]
    return c * Vb ** 2


def area_superficie(dt_mm, ds_mm, h):
    """Área do trapézio da face do poste (m²)."""
    dt = dt_mm / 1000
    ds = ds_mm / 1000
    return 0.5 * (dt + ds) * h


def esforço_do_vento(tipo, Vb, dt_mm, ds_mm, h):
    """Esforço do vento (daN) = Pvp * Sp."""
    Pvp = pressão_vento(tipo, Vb)
    Sp = area_superficie(dt_mm, ds_mm, h)
    return Pvp * Sp


def ponto_de_aplicacao(dt_mm, ds_mm, h):
    """Altura (m) do ponto de aplicação da resultante do vento, medida da base."""
    dt = dt_mm / 1000
    ds = ds_mm / 1000
    return h * (2 * dt + ds) / (3 * (dt + ds))


def get_diametro_condutor(tipo_cabo, awg):
    """Retorna o diâmetro (mm) da bitola escolhida do condutor.

    tipo_cabo: chave de CONDUTORES ("CA", "CAL", "CAA").
    awg:       rótulo da bitola dentro daquele cabo (ex.: "4/0", "336.4").
    """
    try:
        bitolas = CONDUTORES[tipo_cabo]["bitolas"]
    except KeyError:
        raise ValueError(f"tipo de cabo não cadastrado: {tipo_cabo}") from None
    for bitola in bitolas:
        if bitola["awg"] == awg:
            return bitola["diam_mm"]
    raise ValueError(f"bitola {awg} não cadastrada no cabo {tipo_cabo}")


def esforço_vento_condutores(tipo, Vb, a, tipo_cabo, awg, alfa=0.0):
    """Força do vento sobre os condutores (daN).

    Fv = Pvp * a * d * cos(alfa/2) * 0,001

        Pvp  - pressão do vento           -> pressão_vento(tipo, Vb)
        a    - vão mecânico (m)           -> PARAMETROS["vao_mecanico"]
        d    - diâmetro do condutor (mm)  -> CONDUTORES[tipo_cabo] / bitola (awg)
        alfa - ângulo de deflexão (graus) -> PARAMETROS["angulo_deflexao"]
                                             (0 = alinhamento reto -> cos = 1)
    """
    Pvp = pressão_vento(tipo, Vb)
    d = get_diametro_condutor(tipo_cabo, awg)
    return Pvp * a * d * math.cos(math.radians(alfa / 2)) * 0.001


def flecha_final_balanco(S, E, alfa=0.0):
    """Flecha final da rede (m) devida ao balanço dos condutores nus (item 6.2.1.5).

    Passo para o vão máximo por balanço dos condutores.
        f = (S*cos(alfa/2) - 0,0076*E)**2 / 0,368
        S    - espaçamento mínimo entre condutores (m) -> ESPACAMENTO_MINIMO
        E    - tensão de operação (kV)                 -> TENSOES_OPERACAO
        alfa - ângulo de deflexão da linha (graus); 0 = alinhamento reto (cos = 1)

    Com alfa = 0 recai na forma sem deflexão: f = (S - 0,0076*E)**2 / 0,368.
    """
    return (1 / 0.368) * (S * math.cos(math.radians(alfa / 2)) - 0.0076 * E) ** 2


# ---------------------------------------------------------------------------
# Engastamento e alturas (itens 6.2.1.4, 6.3.2 e 6.8)
# ---------------------------------------------------------------------------
def engastamento(comprimento):
    """Comprimento de engastamento E (m) do poste no solo (item 6.8).

    E = 0,1 * L + 0,6, onde L é o comprimento nominal do poste (m).
    """
    return 0.1 * comprimento + 0.6


def altura_util_topo(comprimento):
    """Altura útil h (m) para transferência de esforços a 10 cm do topo (item 6.3.2).

    h = L - E - 0,10, onde E = engastamento(L). É a altura, medida do nível do
    solo, do ponto de aplicação dos esforços (10 cm abaixo do topo).
    Usada nos cálculos de transferência de esforços e de momentos resistentes.
    Difere de altura_util(L) = L - E (altura livre, usada na área do poste Sp).
    """
    return comprimento - engastamento(comprimento) - 0.10


# ---------------------------------------------------------------------------
# Ação do vento sobre os cabos — coeficiente do cabo (item 6.2.1.3)
# ---------------------------------------------------------------------------
def coeficiente_cabo(Vb, d_mm, tipo="circular"):
    """Coeficiente do cabo Cc (daN/m por condutor).

    Cc = Pvp * d * 10**-3 = (0,00471 * Vb**2) * d * 10**-3
        Vb - velocidade básica do vento (km/h) -> VELOCIDADES_VENTO
        d  - diâmetro do condutor (mm)
    Para redes trifásicas, multiplicar Cc por 3 (ver esforco_vento_cabos_total).
    """
    return pressão_vento(tipo, Vb) * d_mm * 0.001


def esforco_vento_cabos_total(tipo, Vb, a, tipo_cabo, awg, alfa=0.0, n_fases=3):
    """Esforço total do vento sobre os cabos (daN), somando todas as fases.

    Fc_total = Cc * a * cos(alfa/2) * n_fases
        a       - vão médio (m); em fim de linha usar metade do vão médio
        n_fases - número de condutores (3 = trifásico, 2 = bifásico, 1 = mono)
    Equivale a esforço_vento_condutores(...) * n_fases.
    """
    d = get_diametro_condutor(tipo_cabo, awg)
    Cc = coeficiente_cabo(Vb, d, tipo)
    return Cc * a * math.cos(math.radians(alfa / 2)) * n_fases


# ---------------------------------------------------------------------------
# Transferência de esforços a 10 cm do topo e resultantes (item 6.3.2)
# ---------------------------------------------------------------------------
def esforco_transferido_topo(F, altura_aplicacao, h):
    """Esforço equivalente (daN) transferido para 10 cm do topo (item 6.3.2).

    Mantém o momento em relação à base:  F_topo = F * altura_aplicacao / h
        F                - força aplicada (daN)
        altura_aplicacao - altura de aplicação da força medida do solo (m)
        h                - altura útil do poste (m) -> altura_util_topo(L)
    A rede primária já está a 10 cm do topo, portanto não precisa ser transferida.
    """
    return F * altura_aplicacao / h


def forca_total_topo(F_primaria, cargas_abaixo, h):
    """Força horizontal total (daN) referida a 10 cm do topo (item 6.3.2).

    F_T = F_primaria + Σ (F_i * altura_i / h)
        F_primaria    - esforço da rede primária (já a 10 cm do topo), daN
        cargas_abaixo - lista de (F_i, altura_i) das cargas aplicadas abaixo do
                        topo (rede secundária, cabo telefônico, TV a cabo, etc.)
        h             - altura útil do poste (m) -> altura_util_topo(L)
    """
    total = F_primaria
    for F, altura in cargas_abaixo:
        total += esforco_transferido_topo(F, altura, h)
    return total


def resultante_perpendicular(fh, fv):
    """Resultante (daN) de duas forças perpendiculares: R = sqrt(fh**2 + fv**2).

    Ex.: combinar a força horizontal (trações + transferidos) com a força de
    vento atuando em plano perpendicular (item 6.3.2, Situação 1).
    """
    return math.hypot(fh, fv)


# ---------------------------------------------------------------------------
# Método do diagrama de momentos (item 6.3.3)
# ---------------------------------------------------------------------------
def momento(F, d):
    """Momento de uma força em relação a um ponto: M = F * d (daN·m)."""
    return F * d


def esforco_estai_poste(F, altura_forca, altura_estai):
    """Esforços num poste estaiado (item 6.3.3).

    Considerando o equilíbrio (ΣM = 0 e ΣF = 0) de um poste com uma força
    horizontal F aplicada a 'altura_forca' e um estai fixado a 'altura_estai':
        Fe = F * altura_forca / altura_estai   (força absorvida pelo estai)
        Fr = F - Fe                            (reação horizontal no solo/base)
    Retorna (Fe, Fr) em daN. Fr negativo indica sentido oposto ao da força F.
    """
    Fe = F * altura_forca / altura_estai
    Fr = F - Fe
    return Fe, Fr


# ---------------------------------------------------------------------------
# Momentos resistentes de postes de concreto — NBR 8451 (item 6.3.3, Anexo 1)
# ---------------------------------------------------------------------------
def modulo_resistencia(D, d):
    """Módulo de resistência à flexão de seção circular vazada (item 6.3.3).

    W = pi * (D**4 - d**4) / (32 * D)
        D - diâmetro externo
        d - diâmetro interno
    (D e d na mesma unidade; W resulta em unidade**3.)
    """
    return math.pi * (D ** 4 - d ** 4) / (32 * D)


def momento_resistente_base(Rn, h):
    """Momento resistente no engastamento MB (daN·m): MB = Rn * h.

    Rn - resistência nominal do poste (daN); h - altura útil (m).
    """
    return Rn * h


def momento_resistente_topo(MB, WA, WB):
    """Momento resistente a 10 cm do topo MA (daN·m): MA = 0,9 * MB * (WA/WB).

    WA e WB são os módulos de resistência no topo e na base (Anexo 1).
    """
    return 0.9 * MB * (WA / WB)


def momento_resistente_MyA(MA, MB, X, h):
    """Reta A da curva de momentos resistentes (daN·m).

    MyA = MA + (0,7*MB - MA) * (X / h)
        X - altura do ponto de aplicação dos esforços até a seção considerada (m)
        h - altura útil do poste (m)
    """
    return MA + (0.7 * MB - MA) * (X / h)


def momento_resistente_MyB(MB, X, h):
    """Reta B da curva de momentos resistentes (daN·m): MyB = MB * (X / h)."""
    return MB * (X / h)


def momento_resistente_secao(MA, MB, X, h):
    """Momento resistente da seção (daN·m): o maior entre MyA e MyB (item 6.3.3)."""
    return max(momento_resistente_MyA(MA, MB, X, h),
               momento_resistente_MyB(MB, X, h))


def altura_cruzamento_momentos(WA, WB, h):
    """Altura Xp (m) onde as retas de momento se cruzam, MyA = MyB (Anexo 1).

    Xp = (0,9 * (WA/WB) * h) / (0,3 + 0,9 * (WA/WB))
    """
    r = 0.9 * (WA / WB)
    return (r * h) / (0.3 + r)


def momentos_resistentes_poste(designacao, X):
    """Momentos resistentes de um poste do Anexo 1 na altura X (m).

    designacao - chave de MOMENTOS_ANEXO1 (ex.: "12/6").
    Retorna dict com MB, MA, MyA, MyB, Mres (maior) e Xp.
    """
    try:
        p = MOMENTOS_ANEXO1[designacao]
    except KeyError:
        raise ValueError(f"poste não cadastrado no Anexo 1: {designacao}") from None
    h = p["h"]
    MB = momento_resistente_base(p["Rn"], h)
    MA = momento_resistente_topo(MB, p["WA"], p["WB"])
    return {
        "MB": MB,
        "MA": MA,
        "MyA": momento_resistente_MyA(MA, MB, X, h),
        "MyB": momento_resistente_MyB(MB, X, h),
        "Mres": momento_resistente_secao(MA, MB, X, h),
        "Xp": altura_cruzamento_momentos(p["WA"], p["WB"], h),
    }


# ---------------------------------------------------------------------------
# Redução de tração nos condutores (item 6.4)
# ---------------------------------------------------------------------------
def reducao_tracao_flecha_constante(T1, V1, V2):
    """Nova tração de projeto com flecha constante (item 6.4.1).

    T1/T2 = (V1/V2)**2  ->  T2 = T1 * (V2/V1)**2
        T1 - tração de projeto original (daN)
        V1 - vão médio para a tração original (m)
        V2 - vão médio para a nova tração (m)
    """
    return T1 * (V2 / V1) ** 2


def reducao_tracao_vao_constante(T1, F1, F2):
    """Nova tração de projeto com vão médio constante (item 6.4.2).

    T1/T2 = F2/F1  ->  T2 = T1 * F1 / F2
        T1 - tração de projeto original (daN)
        F1 - flecha de projeto original (m)
        F2 - flecha para o novo traçado (m)
    A tração varia na proporção inversa da flecha.
    """
    return T1 * F1 / F2


# ---------------------------------------------------------------------------
# Flechas e trações para vãos ancorados (item 6.5)
# ---------------------------------------------------------------------------
def get_peso_especifico(secao, tipo):
    """Peso específico (kg/m) do condutor -> PESOS_ESPECIFICOS[(secao, tipo)]."""
    try:
        return PESOS_ESPECIFICOS[(secao, tipo)]["peso_kg_m"]
    except KeyError:
        raise ValueError(f"condutor não cadastrado: {secao} {tipo}") from None


def get_ruptura(secao, tipo):
    """Tração de ruptura (daN) do condutor -> PESOS_ESPECIFICOS[(secao, tipo)]."""
    try:
        return PESOS_ESPECIFICOS[(secao, tipo)]["ruptura_daN"]
    except KeyError:
        raise ValueError(f"condutor não cadastrado: {secao} {tipo}") from None


def flecha_vao_ancorado(P, V, T):
    """Flecha (m) de um vão ancorado no mesmo nível (item 6.5).

    F = P * V**2 / (8 * T)
        P - peso específico do cabo (kg/m) -> get_peso_especifico
        V - largura do vão (m)
        T - tração aplicada (daN)
    """
    return P * V ** 2 / (8 * T)


def tracao_vao_ancorado(P, V, F):
    """Tração (daN) de um vão ancorado no mesmo nível (inverso do item 6.5).

    T = P * V**2 / (8 * F)
    """
    return P * V ** 2 / (8 * F)


def flechas_tracoes_desnivel(P, vao, H_A, H_B):
    """Trações e distâncias de um vão ancorado em desnível (item 6.5).

    Para apoios A e B em alturas H_A e H_B (m), retorna (L_A, L_B, T_A, T_B):
        L_B = [2*vao*H_B - sqrt((2*vao*H_B)**2 - 4*(H_A-H_B)*(vao**2*H_B))]
              / (2*(H_B - H_A))
        L_A = vao - L_B
        T_A = sqrt((P*L_A**2/(2*H_A))**2 + (P*L_A)**2)
        T_B = sqrt((P*L_B**2/(2*H_B))**2 + (P*L_B)**2)
        P - peso específico do cabo (kg/m); vao - largura do vão (m)
    Requer H_A != H_B (para o mesmo nível usar flecha_vao_ancorado).
    """
    if H_A == H_B:
        raise ValueError("H_A e H_B iguais: use flecha_vao_ancorado (mesmo nível)")
    disc = (2 * vao * H_B) ** 2 - 4 * (H_A - H_B) * (vao ** 2 * H_B)
    L_B = (2 * vao * H_B - math.sqrt(disc)) / (2 * (H_B - H_A))
    L_A = vao - L_B
    T_A = math.hypot(P * L_A ** 2 / (2 * H_A), P * L_A)
    T_B = math.hypot(P * L_B ** 2 / (2 * H_B), P * L_B)
    return L_A, L_B, T_A, T_B


# ---------------------------------------------------------------------------
# Esforços de arrancamento e compressão (item 6.9.3)
# ---------------------------------------------------------------------------
def esforco_compressao_vertical(T, h1, e1, h2, e2):
    """Esforço vertical de compressão no poste Rnv (daN) (item 6.9.3).

    Rnv = T * ( h1/sqrt(h1**2 + e1**2) + h2/sqrt(h2**2 + e2**2) )
        T      - tração de projeto do condutor (daN), por condutor
        h1, h2 - desníveis verticais dos lances adjacentes (m)
        e1, e2 - vãos horizontais dos lances adjacentes (m)
    """
    return T * (h1 / math.hypot(h1, e1) + h2 / math.hypot(h2, e2))


def esforco_horizontal_longitudinal(T, h1, e1, h2, e2):
    """Esforço horizontal longitudinal Rnh (daN) por desnível (item 6.9.3).

    Rnh = T * ( e1/sqrt(h1**2 + e1**2) - e2/sqrt(h2**2 + e2**2) )
        T      - tração de projeto do condutor (daN), por condutor
        h1, h2 - desníveis verticais dos lances adjacentes (m)
        e1, e2 - vãos horizontais dos lances adjacentes (m)
    Se L2 > L1 o valor fica negativo, indicando esforço no sentido de Rh1.
    Nota: a norma limita o ângulo máximo dos lances em 35°.
    """
    return T * (e1 / math.hypot(h1, e1) - e2 / math.hypot(h2, e2))


# ---------------------------------------------------------------------------
# Resultante de forças iguais — Anexo 6
# ---------------------------------------------------------------------------
def constante_resultante(angulo):
    """Constante da resultante de forças iguais (Anexo 6): 2 * sin(angulo/2).

    angulo - ângulo de deflexão da linha (graus).
    Ex.: 60° -> 1,0000; 90° -> 1,4142; 180° -> 2,0000.
    """
    return 2 * math.sin(math.radians(angulo / 2))


def resultante_forcas_iguais(tracao, n_condutores, angulo):
    """Resultante do esforço de tração numa deflexão (daN) (Anexo 6).

    R = tracao * n_condutores * constante_resultante(angulo)
        tracao       - tração de projeto por condutor (daN)
        n_condutores - número de condutores
        angulo       - ângulo de deflexão da linha (graus)
    Ex.: CAA TP=220, 3 condutores, 16° -> 220*3*0,2784 ≈ 183 daN.
    """
    return tracao * n_condutores * constante_resultante(angulo)


# ---------------------------------------------------------------------------
# Determinação de ângulos em campo — Anexo 7
# ---------------------------------------------------------------------------
def angulo_de_campo(AB, D=10.0, metodo="I"):
    """Ângulo de deflexão (graus) a partir da distância medida em campo (Anexo 7).

    Medindo-se um ponto a uma distância D (m) sobre cada linha a partir do
    vértice e a distância AB (m) entre esses pontos:
        Método I  (default): AB = 2*D*sin(angulo/2)  -> angulo = 2*asin(AB/(2D))
        Método II:           AB = 2*D*cos(angulo/2)  -> angulo = 2*acos(AB/(2D))
    A norma recomenda o Método I por ser mais preciso. D padrão = 10 m.
    """
    razao = AB / (2 * D)
    if metodo == "I":
        return math.degrees(2 * math.asin(razao))
    elif metodo == "II":
        return math.degrees(2 * math.acos(razao))
    raise ValueError(f"método inválido: {metodo!r} (use 'I' ou 'II')")


if __name__ == "__main__":
    tipo = "circular"
    comprimento = 11              # m
    resistencia = 300             # daN
    Vb = VELOCIDADES_VENTO["SP"]  # km/h (São Paulo = 94; RS = 117)

    dt_mm, ds_mm = get_dimensões(tipo, comprimento, resistencia)
    h = altura_util(comprimento)
    Fp = esforço_do_vento(tipo, Vb, dt_mm, ds_mm, h)
    y = ponto_de_aplicacao(dt_mm, ds_mm, h)

    print(f"Poste {tipo} {comprimento} m / {resistencia} daN  (Vb={Vb} km/h)")
    print(f"  dt={dt_mm} mm  ds={ds_mm} mm  altura livre={h:.2f} m")
    print(f"  Engastamento (E)      = {engastamento(comprimento):.2f} m")
    print(f"  Altura útil (10cm)    = {altura_util_topo(comprimento):.2f} m")
    print(f"  Esforço do vento (Fp) = {Fp:.2f} daN")
    print(f"  Ponto de aplicação    = {y:.2f} m")

    # Exemplo: força do vento sobre os condutores
    a = 100           # vão mecânico (m)
    tipo_cabo = "CA"  # tipo de cabo escolhido em CONDUTORES
    awg = "4/0"       # bitola escolhida dentro do cabo
    alfa = 0          # ângulo de deflexão (graus); 0 = alinhamento reto
    Fv = esforço_vento_condutores(tipo, Vb, a, tipo_cabo, awg, alfa)
    d = get_diametro_condutor(tipo_cabo, awg)
    Cc = coeficiente_cabo(Vb, d, tipo)
    Fc = esforco_vento_cabos_total(tipo, Vb, a, tipo_cabo, awg, alfa, n_fases=3)
    print(f"Condutor {tipo_cabo} {awg} (d={d} mm), vão {a} m, alfa={alfa}°")
    print(f"  Coeficiente do cabo   = {Cc:.3f} daN/m")
    print(f"  Força do vento (Fv)   = {Fv:.2f} daN/condutor")
    print(f"  Força do vento (3f)   = {Fc:.2f} daN")

    # Exemplo: transferência de esforços a 10 cm do topo e resultante (item 6.3.2)
    h_util = altura_util_topo(12)                       # poste de 12 m
    F_H = forca_total_topo(3 * 96, [(336, 7.0), (90, 5.0)], h_util)
    F_V = 185                                           # vento (perpendicular)
    F_T = resultante_perpendicular(F_H, F_V)
    print(f"Transferência a 10cm do topo (poste 12 m, h={h_util:.1f} m)")
    print(f"  F_H={F_H:.0f} daN  F_V={F_V} daN  ->  F_T={F_T:.0f} daN")

    # Exemplo: momentos resistentes de um poste 12/600 (Anexo 1)
    m = momentos_resistentes_poste("12/6", X=4.0)
    print("Momentos resistentes 12/6 em X=4,0 m:")
    print(f"  MB={m['MB']:.0f}  MA={m['MA']:.0f}  Mres={m['Mres']:.0f} daN·m  Xp={m['Xp']:.2f} m")

    # Exemplo: flecha de vão ancorado (item 6.5)
    P = get_peso_especifico("4/0", "CA")
    flecha = flecha_vao_ancorado(P, 100, 194)
    print(f"Vão ancorado 4/0 CA (P={P} kg/m, V=100 m, T=194 daN)")
    print(f"  Flecha = {flecha:.2f} m")

    # Exemplo: resultante de forças iguais numa deflexão (Anexo 6)
    R = resultante_forcas_iguais(220, 3, 16)
    print(f"Resultante 3x CAA TP=220 daN a 16° = {R:.0f} daN")

    # Exemplo: flecha final por balanço dos condutores nus
    E = 13.8                    # tensão de operação (kV) -> TENSOES_OPERACAO
    S = ESPACAMENTO_MINIMO[E]   # None até você adicionar o valor de S
    if S is not None:
        f = flecha_final_balanco(S, E)
        print(f"Balanço condutores: E={E} kV, S={S} m")
        print(f"  Flecha final (f)      = {f:.3f} m")
    else:
        print("Balanço condutores: defina S em ESPACAMENTO_MINIMO para calcular a flecha.")
