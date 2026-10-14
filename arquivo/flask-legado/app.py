"""Servidor web (Flask) para o validador de cálculo mecânico (GED-3648).

Arquitetura:
    - `validador.py` é a ÚNICA fonte de verdade dos cálculos e dos catálogos.
    - Este módulo expõe:
        GET  /                -> página única (SPA) com o formulário dinâmico
        GET  /api/operacoes   -> esquema das operações + catálogos (JSON)
        POST /api/calcular    -> executa uma operação e devolve os resultados

O front-end monta os formulários a partir do esquema: campos cujos valores já
existem no código viram listas (dropdowns); o restante fica como campo aberto.

Execução local:
    python app.py
    (para produção use um WSGI, ex.: gunicorn app:app)
"""

from flask import Flask, jsonify, render_template, request

import validador as v

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Formatação de números no padrão pt-BR (vírgula decimal)
# ---------------------------------------------------------------------------
def fmt(x, casas=2):
    return f"{x:.{casas}f}".replace(".", ",")


def res(rotulo, valor, unidade="", destaque=False):
    """Monta um item de resultado para o front-end."""
    return {"rotulo": rotulo, "valor": valor, "unidade": unidade, "destaque": destaque}


# ---------------------------------------------------------------------------
# Catálogos (listas de valores já definidos no código)
# ---------------------------------------------------------------------------
def _opcoes_vb():
    return [{"label": f"São Paulo — {v.VELOCIDADES_VENTO['SP']} km/h",
             "valor": v.VELOCIDADES_VENTO["SP"]},
            {"label": f"Rio Grande do Sul — {v.VELOCIDADES_VENTO['RS']} km/h",
             "valor": v.VELOCIDADES_VENTO["RS"]}]


def _opcoes(lista, sufixo="", formato=str):
    return [{"label": f"{formato(x)}{sufixo}", "valor": x} for x in lista]


def _opcoes_tipo_poste():
    return [{"label": t, "valor": t} for t in v.constante_pvp]


def _opcoes_angulo():
    ops = [{"label": "0° (alinhamento reto)", "valor": 0}]
    ops += [{"label": f"{a}°", "valor": a} for a in v.PARAMETROS["angulo_deflexao"]]
    return ops


def _opcoes_peso():
    ops = []
    for (sec, tp), d in v.PESOS_ESPECIFICOS.items():
        ops.append({"label": f"{sec} {tp} — {fmt(d['peso_kg_m'], 4)} kg/m",
                    "valor": d["peso_kg_m"]})
    return ops


def _opcoes_tracao():
    """Trações de projeto tabeladas (daN). Mesma lista usada para a tração de
    projeto (T) e para o esforço da rede primária. O valor do cálculo é o daN;
    o cabo é apenas informativo. "Outro…" permite um valor livre."""
    return [{"label": f"{t['label']} — {t['tracao_daN']} daN", "valor": t["tracao_daN"]}
            for t in v.TRACOES_PROJETO]


def catalogos():
    """Estruturas usadas pelos campos em cascata (poste e condutor)."""
    condutores = {}
    for tc, dados in v.CONDUTORES.items():
        condutores[tc] = {
            "nome": dados["nome"],
            "bitolas": [{"awg": b["awg"], "d": b["diam_mm"]} for b in dados["bitolas"]],
        }
    return {"postes": v.postes, "condutores": condutores}


# ---------------------------------------------------------------------------
# Atalhos para especificações de campos
# ---------------------------------------------------------------------------
def campo_num(nome, label, unidade="", passo="any", default=None, ajuda=""):
    return {"nome": nome, "label": label, "tipo": "number", "unidade": unidade,
            "passo": passo, "default": default, "ajuda": ajuda}


def campo_lista(nome, label, opcoes, unidade="", default=None, ajuda=""):
    """Dropdown fechado (apenas valores do catálogo)."""
    return {"nome": nome, "label": label, "tipo": "select", "opcoes": opcoes,
            "unidade": unidade, "default": default, "ajuda": ajuda}


def campo_lista_ou_num(nome, label, opcoes, unidade="", ajuda=""):
    """Dropdown com valores do catálogo + opção "Outro…" para campo aberto."""
    return {"nome": nome, "label": label, "tipo": "select_ou_numero",
            "opcoes": opcoes, "unidade": unidade, "ajuda": ajuda}


def campo_poste(nome="poste", label="Poste (catálogo)"):
    return {"nome": nome, "label": label, "tipo": "poste"}


def campo_condutor(nome="condutor", label="Condutor (catálogo)"):
    return {"nome": nome, "label": label, "tipo": "condutor"}


# ---------------------------------------------------------------------------
# Funções de cálculo (cada uma recebe o dict `p` já convertido)
# ---------------------------------------------------------------------------
def calc_pressao_vento(p):
    Pvp = v.pressão_vento(p["tipo"], p["vb"])
    return [res("Pressão do vento (Pvp)", fmt(Pvp, 3), "daN/m²", True)]


def calc_area(p):
    Sp = v.area_superficie(p["dt"], p["ds"], p["h"])
    return [res("Área da superfície (Sp)", fmt(Sp, 3), "m²", True)]


def calc_fp(p):
    tipo = p["poste"]["tipo"]
    dt, ds = p["poste"]["dt"], p["poste"]["ds"]
    h = v.altura_util(p["poste"]["comprimento"])
    Fp = v.esforço_do_vento(tipo, p["vb"], dt, ds, h)
    return [res("dt / ds", f"{fmt(dt,0)} / {fmt(ds,0)}", "mm"),
            res("Altura livre (h)", fmt(h, 2), "m"),
            res("Esforço do vento (Fp)", fmt(Fp, 2), "daN", True)]


def calc_ponto(p):
    dt, ds = p["poste"]["dt"], p["poste"]["ds"]
    h = v.altura_util(p["poste"]["comprimento"])
    H = v.ponto_de_aplicacao(dt, ds, h)
    return [res("Altura livre (h)", fmt(h, 2), "m"),
            res("Ponto de aplicação (H)", fmt(H, 2), "m", True)]


def calc_cc(p):
    d = p["condutor"]["d"]
    Cc = v.coeficiente_cabo(p["vb"], d, p["tipo"])
    return [res("Diâmetro (d)", fmt(d, 2), "mm"),
            res("Coeficiente do cabo (Cc)", fmt(Cc, 3), "daN/m por condutor", True)]


def calc_vento_cabos(p):
    tc, awg = p["condutor"]["tipo_cabo"], p["condutor"]["awg"]
    Fv = v.esforço_vento_condutores(p["tipo"], p["vb"], p["a"], tc, awg, p["alfa"])
    Fc = v.esforco_vento_cabos_total(p["tipo"], p["vb"], p["a"], tc, awg,
                                     p["alfa"], int(p["n_fases"]))
    return [res("Força por condutor (Fv)", fmt(Fv, 2), "daN/cond."),
            res(f"Força total ({int(p['n_fases'])} fases)", fmt(Fc, 2), "daN", True)]


def calc_engastamento(p):
    L = p["L"]
    return [res("Engastamento (E)", fmt(v.engastamento(L), 2), "m", True),
            res("Altura livre (L−E)", fmt(v.altura_util(L), 2), "m"),
            res("Altura útil 10 cm (L−E−0,10)", fmt(v.altura_util_topo(L), 2), "m")]


def calc_balanco(p):
    f = v.flecha_final_balanco(p["S"], p["E"], p["alfa"])
    return [res("Flecha final por balanço (f)", fmt(f, 3), "m", True)]


def calc_transferencia(p):
    h = v.altura_util_topo(p["L"])
    cargas = [(c["F"], c["altura"]) for c in p["cargas"]]
    FT = v.forca_total_topo(p["fp_prim"], cargas, h)
    return [res("Altura útil (h)", fmt(h, 2), "m"),
            res("Força total no topo (F_T)", fmt(FT, 2), "daN", True)]


def calc_resultante_perp(p):
    R = v.resultante_perpendicular(p["fh"], p["fv"])
    return [res("Resultante (R)", fmt(R, 2), "daN", True)]


def calc_estai(p):
    Fe, Fr = v.esforco_estai_poste(p["F"], p["hf"], p["he"])
    return [res("Força no estai (Fe)", fmt(Fe, 2), "daN", True),
            res("Reação no solo (Fr)", fmt(Fr, 2), "daN")]


def calc_momentos(p):
    m = v.momentos_resistentes_poste(p["designacao"], p["X"])
    return [res("Momento na base (MB)", fmt(m["MB"], 0), "daN·m"),
            res("Momento no topo (MA)", fmt(m["MA"], 0), "daN·m"),
            res("MyA", fmt(m["MyA"], 0), "daN·m"),
            res("MyB", fmt(m["MyB"], 0), "daN·m"),
            res("Momento resistente da seção", fmt(m["Mres"], 0), "daN·m", True),
            res("Altura de cruzamento (Xp)", fmt(m["Xp"], 2), "m")]


def calc_reducao_flecha(p):
    T2 = v.reducao_tracao_flecha_constante(p["T1"], p["V1"], p["V2"])
    return [res("Nova tração de projeto (T2)", fmt(T2, 2), "daN", True)]


def calc_reducao_vao(p):
    T2 = v.reducao_tracao_vao_constante(p["T1"], p["F1"], p["F2"])
    return [res("Nova tração de projeto (T2)", fmt(T2, 2), "daN", True)]


def calc_vao_flecha(p):
    f = v.flecha_vao_ancorado(p["P"], p["V"], p["T"])
    return [res("Flecha (F)", fmt(f, 3), "m", True)]


def calc_vao_tracao(p):
    T = v.tracao_vao_ancorado(p["P"], p["V"], p["F"])
    return [res("Tração (T)", fmt(T, 2), "daN", True)]


def calc_vao_desnivel(p):
    LA, LB, TA, TB = v.flechas_tracoes_desnivel(p["P"], p["vao"], p["HA"], p["HB"])
    return [res("Distância L_A", fmt(LA, 2), "m"),
            res("Distância L_B", fmt(LB, 2), "m"),
            res("Tração no ponto A (T_A)", fmt(TA, 2), "daN", True),
            res("Tração no ponto B (T_B)", fmt(TB, 2), "daN", True)]


def calc_compressao(p):
    Rnv = v.esforco_compressao_vertical(p["T"], p["h1"], p["e1"], p["h2"], p["e2"])
    return [res("Esforço vertical de compressão (Rnv)", fmt(Rnv, 2), "daN", True)]


def calc_horizontal(p):
    Rnh = v.esforco_horizontal_longitudinal(p["T"], p["h1"], p["e1"], p["h2"], p["e2"])
    return [res("Esforço horizontal longitudinal (Rnh)", fmt(Rnh, 2), "daN", True)]


def calc_resultante_iguais(p):
    c = v.constante_resultante(p["ang"])
    R = v.resultante_forcas_iguais(p["T"], int(p["n"]), p["ang"])
    return [res("Constante (Anexo 6)", fmt(c, 4), ""),
            res("Resultante", fmt(R, 2), "daN", True)]


def calc_angulo(p):
    ang = v.angulo_de_campo(p["AB"], p["D"], p["metodo"])
    return [res("Ângulo de deflexão", fmt(ang, 2), "°", True)]


# ---------------------------------------------------------------------------
# Registro de operações (esquema que dirige o front-end)
# ---------------------------------------------------------------------------
def build_operacoes():
    return [
        # ---- Ação do vento ----
        {"id": "pressao_vento", "grupo": "Ação do vento", "titulo": "Pressão do vento (Pvp)",
         "descricao": "Pvp = c · Vb² (item 6.2.1.2).", "calc": calc_pressao_vento,
         "campos": [campo_lista("tipo", "Tipo de poste", _opcoes_tipo_poste(), default="circular"),
                    campo_lista_ou_num("vb", "Velocidade do vento (Vb)", _opcoes_vb(), "km/h")]},

        {"id": "area", "grupo": "Ação do vento", "titulo": "Área da superfície do poste (Sp)",
         "descricao": "Sp = ½ · (dt + ds) · h (item 6.2.1.2).", "calc": calc_area,
         "campos": [campo_num("dt", "Dimensão no topo (dt)", "mm"),
                    campo_num("ds", "Dimensão no solo (ds)", "mm"),
                    campo_num("h", "Altura livre (h)", "m")]},

        {"id": "fp", "grupo": "Ação do vento", "titulo": "Esforço do vento no poste (Fp)",
         "descricao": "Fp = Pvp · Sp (item 6.2.1.2).", "calc": calc_fp,
         "campos": [campo_poste(),
                    campo_lista_ou_num("vb", "Velocidade do vento (Vb)", _opcoes_vb(), "km/h")]},

        {"id": "ponto", "grupo": "Ação do vento", "titulo": "Ponto de aplicação da resultante (H)",
         "descricao": "H = h · (2·dt + ds) / (3·(dt + ds)) (item 6.2.1.2).", "calc": calc_ponto,
         "campos": [campo_poste()]},

        {"id": "cc", "grupo": "Ação do vento", "titulo": "Coeficiente do cabo (Cc)",
         "descricao": "Cc = Pvp · d · 10⁻³ (item 6.2.1.3).", "calc": calc_cc,
         "campos": [campo_lista("tipo", "Tipo de poste", _opcoes_tipo_poste(), default="circular"),
                    campo_lista_ou_num("vb", "Velocidade do vento (Vb)", _opcoes_vb(), "km/h"),
                    campo_condutor()]},

        {"id": "vento_cabos", "grupo": "Ação do vento", "titulo": "Esforço do vento nos condutores (Fv/Fc)",
         "descricao": "Fc = Cc · a · cos(α/2) · nº fases (item 6.2.1.3).", "calc": calc_vento_cabos,
         "campos": [campo_lista("tipo", "Tipo de poste", _opcoes_tipo_poste(), default="circular"),
                    campo_lista_ou_num("vb", "Velocidade do vento (Vb)", _opcoes_vb(), "km/h"),
                    campo_lista_ou_num("a", "Vão médio (a)", _opcoes(v.PARAMETROS["vao_mecanico"], " m"), "m"),
                    campo_condutor(),
                    campo_lista_ou_num("alfa", "Ângulo de deflexão (α)", _opcoes_angulo(), "°"),
                    campo_lista("n_fases", "Número de fases", _opcoes([1, 2, 3]), default=3)]},

        # ---- Dimensionamento do poste ----
        {"id": "engastamento", "grupo": "Dimensionamento do poste", "titulo": "Engastamento e alturas",
         "descricao": "E = 0,1·L + 0,6 ; h = L − E − 0,10 (itens 6.3.2 e 6.8).", "calc": calc_engastamento,
         "campos": [campo_num("L", "Comprimento nominal (L)", "m")]},

        {"id": "balanco", "grupo": "Dimensionamento do poste", "titulo": "Vão máximo por balanço (flecha)",
         "descricao": "f = (S·cos(α/2) − 0,0076·E)² / 0,368 (item 6.2.1.5).", "calc": calc_balanco,
         "campos": [campo_num("S", "Espaçamento entre condutores (S)", "m"),
                    campo_lista_ou_num("E", "Tensão de operação (E)", _opcoes(v.TENSOES_OPERACAO, " kV"), "kV"),
                    campo_lista_ou_num("alfa", "Ângulo de deflexão (α)", _opcoes_angulo(), "°")]},

        # ---- Transferência e momentos ----
        {"id": "transferencia", "grupo": "Transferência e momentos", "titulo": "Transferência de esforços a 10 cm do topo",
         "descricao": "F_T = F_prim + Σ (F·altura / h) (item 6.3.2).", "calc": calc_transferencia,
         "campos": [campo_num("L", "Comprimento do poste (L)", "m", ajuda="usado em h = L − E − 0,10"),
                    campo_num("fp_prim", "Esforço da rede primária (já a 10 cm do topo)", "daN"),
                    {"nome": "cargas", "label": "Cargas abaixo do topo (F, altura)", "tipo": "cargas"}]},

        {"id": "resultante_perp", "grupo": "Transferência e momentos", "titulo": "Resultante de forças perpendiculares",
         "descricao": "R = √(Fh² + Fv²) (item 6.3.2).", "calc": calc_resultante_perp,
         "campos": [campo_num("fh", "Força horizontal (Fh)", "daN"),
                    campo_num("fv", "Força perpendicular (Fv)", "daN")]},

        {"id": "estai", "grupo": "Transferência e momentos", "titulo": "Esforços num poste estaiado",
         "descricao": "Fe = F·hf/he ; Fr = F − Fe (item 6.3.3).", "calc": calc_estai,
         "campos": [campo_num("F", "Força aplicada (F)", "daN"),
                    campo_num("hf", "Altura da força (hf)", "m"),
                    campo_num("he", "Altura do estai (he)", "m")]},

        {"id": "momentos", "grupo": "Transferência e momentos", "titulo": "Momentos resistentes (NBR 8451 / Anexo 1)",
         "descricao": "MB = Rn·h ; MA = 0,9·MB·(WA/WB) ; máx(MyA, MyB).", "calc": calc_momentos,
         "campos": [campo_lista("designacao", "Poste (Anexo 1)", _opcoes(list(v.MOMENTOS_ANEXO1))),
                    campo_num("X", "Altura da seção (X)", "m")]},

        # ---- Redução de tração e flechas ----
        {"id": "reducao_flecha", "grupo": "Redução de tração e flechas", "titulo": "Redução de tração — flecha constante",
         "descricao": "T2 = T1 · (V2/V1)² (item 6.4.1).", "calc": calc_reducao_flecha,
         "campos": [campo_num("T1", "Tração original (T1)", "daN"),
                    campo_num("V1", "Vão médio original (V1)", "m"),
                    campo_num("V2", "Novo vão médio (V2)", "m")]},

        {"id": "reducao_vao", "grupo": "Redução de tração e flechas", "titulo": "Redução de tração — vão constante",
         "descricao": "T2 = T1 · F1/F2 (item 6.4.2).", "calc": calc_reducao_vao,
         "campos": [campo_num("T1", "Tração original (T1)", "daN"),
                    campo_num("F1", "Flecha original (F1)", "m"),
                    campo_num("F2", "Nova flecha (F2)", "m")]},

        {"id": "vao_flecha", "grupo": "Redução de tração e flechas", "titulo": "Vão ancorado (nível) — flecha",
         "descricao": "F = P · V² / (8·T) (item 6.5).", "calc": calc_vao_flecha,
         "campos": [campo_lista_ou_num("P", "Peso específico (P)", _opcoes_peso(), "kg/m"),
                    campo_num("V", "Largura do vão (V)", "m"),
                    campo_num("T", "Tração aplicada (T)", "daN")]},

        {"id": "vao_tracao", "grupo": "Redução de tração e flechas", "titulo": "Vão ancorado (nível) — tração",
         "descricao": "T = P · V² / (8·F) (item 6.5).", "calc": calc_vao_tracao,
         "campos": [campo_lista_ou_num("P", "Peso específico (P)", _opcoes_peso(), "kg/m"),
                    campo_num("V", "Largura do vão (V)", "m"),
                    campo_num("F", "Flecha (F)", "m")]},

        {"id": "vao_desnivel", "grupo": "Redução de tração e flechas", "titulo": "Vão ancorado em desnível",
         "descricao": "Trações e distâncias para apoios em alturas diferentes (item 6.5).", "calc": calc_vao_desnivel,
         "campos": [campo_lista_ou_num("P", "Peso específico (P)", _opcoes_peso(), "kg/m"),
                    campo_num("vao", "Largura do vão", "m"),
                    campo_num("HA", "Altura do apoio A (H_A)", "m"),
                    campo_num("HB", "Altura do apoio B (H_B)", "m")]},

        # ---- Arrancamento e compressão ----
        {"id": "compressao", "grupo": "Arrancamento e compressão", "titulo": "Esforço vertical de compressão (Rnv)",
         "descricao": "Rnv = T·(h1/L1 + h2/L2), L = √(h²+e²) (item 6.9.3).", "calc": calc_compressao,
         "campos": [campo_lista_ou_num("T", "Tração por condutor (T)", _opcoes_tracao(), "daN"),
                    campo_num("h1", "Desnível lance 1 (h1)", "m"),
                    campo_num("e1", "Vão lance 1 (e1)", "m"),
                    campo_num("h2", "Desnível lance 2 (h2)", "m"),
                    campo_num("e2", "Vão lance 2 (e2)", "m")]},

        {"id": "horizontal", "grupo": "Arrancamento e compressão", "titulo": "Esforço horizontal longitudinal (Rnh)",
         "descricao": "Rnh = T·(e1/L1 − e2/L2) (item 6.9.3).", "calc": calc_horizontal,
         "campos": [campo_lista_ou_num("T", "Tração por condutor (T)", _opcoes_tracao(), "daN"),
                    campo_num("h1", "Desnível lance 1 (h1)", "m"),
                    campo_num("e1", "Vão lance 1 (e1)", "m"),
                    campo_num("h2", "Desnível lance 2 (h2)", "m"),
                    campo_num("e2", "Vão lance 2 (e2)", "m")]},

        # ---- Auxiliares ----
        {"id": "resultante_iguais", "grupo": "Auxiliares", "titulo": "Resultante de forças iguais (Anexo 6)",
         "descricao": "R = T · nº · 2·sen(α/2).", "calc": calc_resultante_iguais,
         "campos": [campo_num("T", "Tração por condutor (T)", "daN"),
                    campo_lista("n", "Número de condutores", _opcoes([1, 2, 3]), default=3),
                    campo_lista_ou_num("ang", "Ângulo de deflexão", _opcoes_angulo(), "°")]},

        {"id": "angulo", "grupo": "Auxiliares", "titulo": "Ângulo de deflexão em campo (Anexo 7)",
         "descricao": "Método I: θ = 2·asen(AB/2D); Método II: θ = 2·acos(AB/2D).", "calc": calc_angulo,
         "campos": [campo_num("AB", "Distância medida (AB)", "m"),
                    campo_num("D", "Distância sobre cada linha (D)", "m", default=10),
                    campo_lista("metodo", "Método", [{"label": "Método I (mais preciso)", "valor": "I"},
                                                     {"label": "Método II", "valor": "II"}], default="I")]},
    ]


OPERACOES = build_operacoes()
OPERACOES_POR_ID = {op["id"]: op for op in OPERACOES}


# ---------------------------------------------------------------------------
# Conversão dos valores recebidos conforme o tipo de cada campo
# ---------------------------------------------------------------------------
def _to_float(valor, label):
    try:
        return float(str(valor).replace(",", ".").strip())
    except (TypeError, ValueError):
        raise ValueError(f"Valor numérico inválido no campo '{label}'.")


def converter_valores(op, valores):
    """Converte os valores brutos do formulário para os tipos que o cálculo espera."""
    p = {}
    for campo in op["campos"]:
        nome, tipo, label = campo["nome"], campo["tipo"], campo["label"]
        bruto = valores.get(nome)

        if tipo == "poste":
            if not bruto:
                raise ValueError("Selecione o poste no catálogo.")
            t = bruto.get("tipo")
            comp = int(bruto.get("comprimento"))
            resist = int(bruto.get("resistencia"))
            dt, ds = v.get_dimensões(t, comp, resist)
            p[nome] = {"tipo": t, "comprimento": comp, "resistencia": resist,
                       "dt": dt, "ds": ds}

        elif tipo == "condutor":
            if not bruto:
                raise ValueError("Selecione o condutor no catálogo.")
            tc, awg = bruto.get("tipo_cabo"), bruto.get("awg")
            p[nome] = {"tipo_cabo": tc, "awg": awg,
                       "d": v.get_diametro_condutor(tc, awg)}

        elif tipo == "cargas":
            cargas = []
            for item in (bruto or []):
                F = item.get("F")
                alt = item.get("altura")
                if F in (None, "") or alt in (None, ""):
                    continue
                cargas.append({"F": _to_float(F, "Força da carga"),
                               "altura": _to_float(alt, "Altura da carga")})
            p[nome] = cargas

        elif tipo == "select":
            if bruto in (None, ""):
                raise ValueError(f"Selecione uma opção em '{label}'.")
            p[nome] = bruto

        else:  # number / select_ou_numero
            if bruto in (None, ""):
                raise ValueError(f"Preencha o campo '{label}'.")
            p[nome] = _to_float(bruto, label)
    return p


# ---------------------------------------------------------------------------
# Rotas
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/operacoes")
def api_operacoes():
    # Envia o esquema sem as funções (não serializáveis).
    esquema = [{k: op[k] for k in ("id", "grupo", "titulo", "descricao", "campos")}
               for op in OPERACOES]
    return jsonify({"operacoes": esquema, "catalogos": catalogos()})


@app.route("/api/calcular", methods=["POST"])
def api_calcular():
    dados = request.get_json(silent=True) or {}
    op_id = dados.get("operacao")
    valores = dados.get("valores", {})

    op = OPERACOES_POR_ID.get(op_id)
    if op is None:
        return jsonify({"erro": "Operação desconhecida."}), 400

    try:
        p = converter_valores(op, valores)
        resultados = op["calc"](p)
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except ZeroDivisionError:
        return jsonify({"erro": "Divisão por zero — verifique os valores informados."}), 400
    except Exception as e:  # pragma: no cover - salvaguarda genérica
        return jsonify({"erro": f"Erro inesperado no cálculo: {e}"}), 400

    return jsonify({"resultados": resultados})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
