"""Interface de terminal para o validador de cálculo mecânico (GED-3648).

Menu interativo que lista as opções de cálculo disponíveis e chama as
funções de `validador.py`. Execute com:  python menu.py
"""

import sys

import validador as v

# Console UTF-8 quando o terminal suportar (Windows Terminal, VS Code, etc.).
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


# ---------------------------------------------------------------------------
# Leitura de entradas (aceita vírgula decimal e trata Enter/EOF)
# ---------------------------------------------------------------------------
def _num(txt):
    return float(txt.replace(",", ".").strip())


def ler_float(msg, default=None):
    while True:
        raw = input(msg).strip()
        if raw == "" and default is not None:
            return default
        try:
            return _num(raw)
        except ValueError:
            print("  valor inválido, tente novamente.")


def ler_int(msg, default=None):
    while True:
        raw = input(msg).strip()
        if raw == "" and default is not None:
            return default
        try:
            return int(raw)
        except ValueError:
            print("  valor inválido, tente novamente.")


def ler_str(msg, opcoes=None, default=None):
    while True:
        raw = input(msg).strip()
        if raw == "" and default is not None:
            return default
        if opcoes is None or raw in opcoes:
            return raw
        print(f"  opção inválida (use: {', '.join(opcoes)})")


def ler_tipo_poste():
    return ler_str("Tipo de poste [circular/duplo T] (circular): ",
                   opcoes=list(v.constante_pvp), default="circular")


def ler_vb():
    print(f"  Vb por região: SP={v.VELOCIDADES_VENTO['SP']} km/h, "
          f"RS={v.VELOCIDADES_VENTO['RS']} km/h")
    return ler_float("Velocidade básica do vento Vb (km/h): ")


# ---------------------------------------------------------------------------
# Handlers de cada opção
# ---------------------------------------------------------------------------
def op_pressao_vento():
    tipo = ler_tipo_poste()
    Vb = ler_vb()
    print(f"\n=> Pvp = {v.pressão_vento(tipo, Vb):.3f} daN/m²")


def op_area_superficie():
    dt = ler_float("Dimensão no topo dt (mm): ")
    ds = ler_float("Dimensão no solo ds (mm): ")
    h = ler_float("Altura livre h (m): ")
    print(f"\n=> Sp = {v.area_superficie(dt, ds, h):.3f} m²")


def op_esforco_vento_poste():
    tipo = ler_tipo_poste()
    usar = ler_str("Buscar dt/ds no catálogo de postes? [s/n] (s): ",
                   opcoes=["s", "n"], default="s")
    if usar == "s":
        L = ler_int("Comprimento do poste (m): ")
        R = ler_int("Resistência nominal (daN): ")
        dt, ds = v.get_dimensões(tipo, L, R)
        h = v.altura_util(L)
        print(f"  dt={dt} mm  ds={ds} mm  altura livre={h:.2f} m")
    else:
        dt = ler_float("Dimensão no topo dt (mm): ")
        ds = ler_float("Dimensão no solo ds (mm): ")
        h = ler_float("Altura livre h (m): ")
    Vb = ler_vb()
    Fp = v.esforço_do_vento(tipo, Vb, dt, ds, h)
    print(f"\n=> Fp = {Fp:.2f} daN")


def op_ponto_aplicacao():
    dt = ler_float("Dimensão no topo dt (mm): ")
    ds = ler_float("Dimensão no solo ds (mm): ")
    h = ler_float("Altura livre h (m): ")
    print(f"\n=> Ponto de aplicação H = {v.ponto_de_aplicacao(dt, ds, h):.2f} m")


def op_coeficiente_cabo():
    tipo = ler_tipo_poste()
    Vb = ler_vb()
    d = ler_float("Diâmetro do condutor d (mm): ")
    print(f"\n=> Cc = {v.coeficiente_cabo(Vb, d, tipo):.3f} daN/m por condutor")


def op_esforco_vento_cabos():
    tipo = ler_tipo_poste()
    Vb = ler_vb()
    a = ler_float("Vão médio a (m): ")
    print(f"  Cabos: {', '.join(v.CONDUTORES)}")
    tc = ler_str("Tipo de cabo: ", opcoes=list(v.CONDUTORES))
    awgs = [b["awg"] for b in v.CONDUTORES[tc]["bitolas"]]
    print(f"  Bitolas de {tc}: {', '.join(awgs)}")
    awg = ler_str("Bitola (AWG/MCM): ", opcoes=awgs)
    alfa = ler_float("Ângulo de deflexão α (graus) (0): ", default=0.0)
    n = ler_int("Número de fases/condutores (3): ", default=3)
    Fv = v.esforço_vento_condutores(tipo, Vb, a, tc, awg, alfa)
    Fc = v.esforco_vento_cabos_total(tipo, Vb, a, tc, awg, alfa, n)
    print(f"\n=> Fv = {Fv:.2f} daN/condutor    Fc({n} fases) = {Fc:.2f} daN")


def op_engastamento_alturas():
    L = ler_float("Comprimento nominal do poste L (m): ")
    print(f"\n=> Engastamento E      = {v.engastamento(L):.2f} m")
    print(f"=> Altura livre (L-E)  = {v.altura_util(L):.2f} m")
    print(f"=> Altura útil 10cm    = {v.altura_util_topo(L):.2f} m")


def op_balanco():
    S = ler_float("Espaçamento entre condutores S (m): ")
    E = ler_float("Tensão de operação E (kV): ")
    alfa = ler_float("Ângulo de deflexão α (graus) (0): ", default=0.0)
    print(f"\n=> Flecha final (balanço) f = {v.flecha_final_balanco(S, E, alfa):.3f} m")


def op_transferencia_topo():
    L = ler_float("Comprimento do poste L (m) [para h=L-E-0,10]: ")
    h = v.altura_util_topo(L)
    Fp = ler_float("Esforço da rede primária (já a 10cm do topo) (daN): ")
    cargas = []
    print("Cargas abaixo do topo (Enter em vazio para terminar):")
    while True:
        raw = input("  Força (daN) [Enter=fim]: ").strip()
        if raw == "":
            break
        F = _num(raw)
        alt = ler_float("  Altura de aplicação (m): ")
        cargas.append((F, alt))
    FT = v.forca_total_topo(Fp, cargas, h)
    print(f"\n=> h = {h:.2f} m    F_total no topo = {FT:.2f} daN")


def op_resultante_perp():
    fh = ler_float("Força horizontal Fh (daN): ")
    fv = ler_float("Força perpendicular Fv (daN): ")
    print(f"\n=> Resultante R = {v.resultante_perpendicular(fh, fv):.2f} daN")


def op_estai():
    F = ler_float("Força aplicada F (daN): ")
    hf = ler_float("Altura da força (m): ")
    he = ler_float("Altura do estai (m): ")
    Fe, Fr = v.esforco_estai_poste(F, hf, he)
    print(f"\n=> Força no estai Fe = {Fe:.2f} daN")
    print(f"=> Reação no solo Fr = {Fr:.2f} daN")


def op_momentos():
    print(f"  Postes no Anexo 1: {', '.join(v.MOMENTOS_ANEXO1)}")
    desig = ler_str("Designação do poste (ex.: 12/6): ",
                    opcoes=list(v.MOMENTOS_ANEXO1))
    X = ler_float("Altura da seção X (m): ")
    m = v.momentos_resistentes_poste(desig, X)
    print(f"\n=> MB = {m['MB']:.0f} daN·m   MA = {m['MA']:.0f} daN·m")
    print(f"=> MyA = {m['MyA']:.0f}   MyB = {m['MyB']:.0f}   "
          f"Momento resistente = {m['Mres']:.0f} daN·m")
    print(f"=> Altura de cruzamento Xp = {m['Xp']:.2f} m")


def op_reducao_flecha():
    T1 = ler_float("Tração de projeto original T1 (daN): ")
    V1 = ler_float("Vão médio original V1 (m): ")
    V2 = ler_float("Novo vão médio V2 (m): ")
    print(f"\n=> Nova tração T2 = {v.reducao_tracao_flecha_constante(T1, V1, V2):.2f} daN")


def op_reducao_vao():
    T1 = ler_float("Tração de projeto original T1 (daN): ")
    F1 = ler_float("Flecha original F1 (m): ")
    F2 = ler_float("Nova flecha F2 (m): ")
    print(f"\n=> Nova tração T2 = {v.reducao_tracao_vao_constante(T1, F1, F2):.2f} daN")


def op_vao_ancorado_nivel():
    P = _peso_condutor()
    V = ler_float("Largura do vão V (m): ")
    calc = ler_str("Calcular [f]lecha ou [t]ração? (f): ",
                   opcoes=["f", "t"], default="f")
    if calc == "f":
        T = ler_float("Tração aplicada T (daN): ")
        print(f"\n=> Flecha F = {v.flecha_vao_ancorado(P, V, T):.3f} m")
    else:
        F = ler_float("Flecha F (m): ")
        print(f"\n=> Tração T = {v.tracao_vao_ancorado(P, V, F):.2f} daN")


def op_vao_ancorado_desnivel():
    P = _peso_condutor()
    vao = ler_float("Largura do vão (m): ")
    HA = ler_float("Altura do apoio A - H_A (m): ")
    HB = ler_float("Altura do apoio B - H_B (m): ")
    LA, LB, TA, TB = v.flechas_tracoes_desnivel(P, vao, HA, HB)
    print(f"\n=> L_A = {LA:.2f} m   L_B = {LB:.2f} m")
    print(f"=> T_A = {TA:.2f} daN   T_B = {TB:.2f} daN")


def _peso_condutor():
    """Pede peso específico: do catálogo ou digitado."""
    usar = ler_str("Peso do catálogo? [s/n] (s): ",
                   opcoes=["s", "n"], default="s")
    if usar == "s":
        secoes = sorted({s for s, _ in v.PESOS_ESPECIFICOS})
        tipos = sorted({t for _, t in v.PESOS_ESPECIFICOS})
        print(f"  Seções: {', '.join(secoes)}   Tipos: {', '.join(tipos)}")
        sec = ler_str("Seção: ")
        tp = ler_str("Tipo: ", opcoes=tipos)
        return v.get_peso_especifico(sec, tp)
    return ler_float("Peso específico P (kg/m): ")


def op_compressao():
    T = ler_float("Tração de projeto por condutor T (daN): ")
    h1 = ler_float("Desnível vertical lance 1 - h1 (m): ")
    e1 = ler_float("Vão horizontal lance 1 - e1 (m): ")
    h2 = ler_float("Desnível vertical lance 2 - h2 (m): ")
    e2 = ler_float("Vão horizontal lance 2 - e2 (m): ")
    print(f"\n=> Rnv (compressão) = {v.esforco_compressao_vertical(T, h1, e1, h2, e2):.2f} daN")


def op_horizontal():
    T = ler_float("Tração de projeto por condutor T (daN): ")
    h1 = ler_float("Desnível vertical lance 1 - h1 (m): ")
    e1 = ler_float("Vão horizontal lance 1 - e1 (m): ")
    h2 = ler_float("Desnível vertical lance 2 - h2 (m): ")
    e2 = ler_float("Vão horizontal lance 2 - e2 (m): ")
    print(f"\n=> Rnh (horizontal) = {v.esforco_horizontal_longitudinal(T, h1, e1, h2, e2):.2f} daN")


def op_resultante_iguais():
    T = ler_float("Tração de projeto por condutor (daN): ")
    n = ler_int("Número de condutores (3): ", default=3)
    ang = ler_float("Ângulo de deflexão (graus): ")
    print(f"\n=> Constante = {v.constante_resultante(ang):.4f}")
    print(f"=> Resultante = {v.resultante_forcas_iguais(T, n, ang):.2f} daN")


def op_angulo_campo():
    AB = ler_float("Distância medida entre A e B - AB (m): ")
    D = ler_float("Distância D sobre cada linha (m) (10): ", default=10.0)
    met = ler_str("Método [I/II] (I): ", opcoes=["I", "II"], default="I")
    print(f"\n=> Ângulo de deflexão = {v.angulo_de_campo(AB, D, met):.2f}°")


def op_catalogos():
    print("\n-- Postes cadastrados --")
    for tipo, comp in v.postes.items():
        for L, res in comp.items():
            print(f"  {tipo} {L} m: {', '.join(str(r) + ' daN' for r in res)}")
    print("\n-- Condutores --")
    for tc, dados in v.CONDUTORES.items():
        awgs = ", ".join(b["awg"] for b in dados["bitolas"])
        print(f"  {tc} ({dados['nome']}): {awgs}")
    print("\n-- Momentos (Anexo 1) --")
    print(f"  {', '.join(v.MOMENTOS_ANEXO1)}")
    print("\n-- Pesos específicos (vãos ancorados) --")
    for (sec, tp), d in v.PESOS_ESPECIFICOS.items():
        print(f"  {sec} {tp}: {d['peso_kg_m']} kg/m, ruptura {d['ruptura_daN']} daN")
    print("\n-- Velocidades de vento --")
    for reg, vb in v.VELOCIDADES_VENTO.items():
        print(f"  {reg}: {vb} km/h")


# (rótulo, handler)
OPCOES = {
    "1":  ("Pressão do vento (Pvp)", op_pressao_vento),
    "2":  ("Área da superfície do poste (Sp)", op_area_superficie),
    "3":  ("Esforço do vento no poste (Fp)", op_esforco_vento_poste),
    "4":  ("Ponto de aplicação da resultante (H)", op_ponto_aplicacao),
    "5":  ("Coeficiente do cabo (Cc)", op_coeficiente_cabo),
    "6":  ("Esforço do vento nos condutores (Fv/Fc)", op_esforco_vento_cabos),
    "7":  ("Engastamento e alturas do poste", op_engastamento_alturas),
    "8":  ("Vão máximo por balanço dos condutores (flecha)", op_balanco),
    "9":  ("Transferência de esforços a 10 cm do topo", op_transferencia_topo),
    "10": ("Resultante de forças perpendiculares", op_resultante_perp),
    "11": ("Esforços num poste estaiado", op_estai),
    "12": ("Momentos resistentes (NBR 8451 / Anexo 1)", op_momentos),
    "13": ("Redução de tração — flecha constante", op_reducao_flecha),
    "14": ("Redução de tração — vão constante", op_reducao_vao),
    "15": ("Flecha/tração em vão ancorado (mesmo nível)", op_vao_ancorado_nivel),
    "16": ("Flecha/tração em vão ancorado (desnível)", op_vao_ancorado_desnivel),
    "17": ("Esforço vertical de compressão (Rnv)", op_compressao),
    "18": ("Esforço horizontal longitudinal (Rnh)", op_horizontal),
    "19": ("Resultante de forças iguais (Anexo 6)", op_resultante_iguais),
    "20": ("Ângulo de deflexão em campo (Anexo 7)", op_angulo_campo),
    "21": ("Listar catálogos (postes/condutores/...)", op_catalogos),
}

# Cabeçalhos de grupo exibidos no menu (antes da opção indicada).
GRUPOS = {
    "1":  "AÇÃO DO VENTO",
    "7":  "DIMENSIONAMENTO DO POSTE",
    "9":  "TRANSFERÊNCIA DE ESFORÇOS E MOMENTOS",
    "13": "REDUÇÃO DE TRAÇÃO E FLECHAS",
    "17": "ARRANCAMENTO E COMPRESSÃO",
    "19": "AUXILIARES / CATÁLOGOS",
}


def mostrar_menu():
    print("\n" + "=" * 60)
    print("  VALIDADOR DE CÁLCULO MECÂNICO — GED-3648 (CPFL)")
    print("=" * 60)
    for chave, (rotulo, _) in OPCOES.items():
        if chave in GRUPOS:
            print(f"\n [{GRUPOS[chave]}]")
        print(f"  {chave:>2}. {rotulo}")
    print("\n   0. Sair")
    print("=" * 60)


def main():
    while True:
        mostrar_menu()
        try:
            escolha = input("Escolha uma opção: ").strip()
        except EOFError:
            print("\n(entrada encerrada)")
            break
        if escolha == "0":
            print("Encerrando.")
            break
        item = OPCOES.get(escolha)
        if item is None:
            print(">> Opção inválida.")
            continue
        print(f"\n--- {item[0]} ---")
        try:
            item[1]()
        except EOFError:
            print("\n(entrada encerrada)")
            break
        except (ValueError, ZeroDivisionError) as e:
            print(f">> Erro no cálculo: {e}")


if __name__ == "__main__":
    main()
