/**
 * Revalidação do motor TypeScript contra os exemplos da norma GED-3648.
 * Executar:  npx tsx scripts/validar.ts
 */
import * as v from "../src/lib/validador";
import { ventoNoPonto, v0Ponto } from "../src/lib/vento";
import { capacidadeLado, dimensionarPoste, TRACAO_NO_CALCULO, trechosDaLinha, vaoRegulador, type EntradaPoste, type RedeExistente } from "../src/lib/dimensionamento";
import { tracaoTabelada } from "../src/lib/tracao-tabelada";

let falhas = 0;
function check(nome: string, obtido: number, esperado: number, tol = 0.5) {
  const ok = Math.abs(obtido - esperado) <= tol;
  if (!ok) falhas++;
  console.log(`${ok ? "✓" : "✗"} ${nome}: obtido=${obtido.toFixed(3)} esperado≈${esperado}`);
}

// Fp poste circular 11/300, Vb=94 (dt=170, ds=390, h=9,30)
const dim = v.getDimensoes("circular", 11, 300);
const h = v.alturaUtil(11);
check("Fp (11/300, SP)", v.esforcoDoVento("circular", 94, dim.dt, dim.ds, h), 108.37);

// Cc e vento nos cabos 4/0 CA, Vb=94, vão 100
check("Fv por condutor (4/0 CA)", v.esforcoVentoCondutores(94, 100, "CA", "4/0", 0), 55.18);
check("Fc 3 fases (4/0 CA)", v.esforcoVentoCabosTotal(94, 100, "CA", "4/0", 0, 3), 165.55);

// Momentos 12/6 em X=4
const m = v.momentosResistentesPoste("12/6", 4);
check("MB (12/6)", m.MB, 6000);
check("MA (12/6)", m.MA, 772.1, 1);
check("Xp (12/6)", m.Xp, 3.0, 0.02);
check("Mres (12/6, X=4)", m.Mres, 2400);

// Estai poste a poste (exemplo item 6.3.3)
const e = v.esforcoEstaiPoste(1044, 9.1, 8.95);
check("Fe estai", e.Fe, 1061.5, 1);
check("Fr estai", e.Fr, -17.5, 1);

// Transferência a 10 cm do topo (poste 12 m), escolha do projetista (NBR 8451):
// h = 12 − 1,8 − 0,1 = 10,1 m. (A GED-3648 usa 20 cm → 10,0 m.)
const ht = v.alturaUtilTopo(12);
check("h útil 12 m", ht, 10.1);
// Exemplo 1 do item 6.3.2 com h = 10,1 m: 3·96 + 336·7/10,1 + 90·5/10,1 = 565,43 daN.
// (A norma usa h = 10 m e imprime 589 por trocar FS = 336 por 366 na conta.)
check("F_total topo", v.forcaTotalTopo(288, [{ F: 336, altura: 7 }, { F: 90, altura: 5 }], ht), 565.43);

// Flecha de vão ancorado 4/0 CA (P=0,2941, V=100, T=194)
check("Flecha vão ancorado", v.flechaVaoAncorado(0.2941, 100, 194), 1.895, 0.01);

// Resultante de forças iguais (Anexo 6): 3×220 a 16° ≈ 183
check("Resultante forças iguais", v.resultanteForcasIguais(220, 3, 16), 183, 1);

// Constantes Anexo 6
check("const(60°)", v.constanteResultante(60), 1.0, 0.001);
check("const(90°)", v.constanteResultante(90), 1.4142, 0.001);
check("const(180°)", v.constanteResultante(180), 2.0, 0.001);

// Ângulo de campo (Anexo 7)
check("ângulo campo I (AB=10,D=10)", v.anguloDeCampo(10, 10, "I"), 60, 0.1);

// Vento por coordenada (NBR 6123) — valores de referência do módulo Python
// (isopletas + S1=1,00 · S2=0,79 · S3=0,85; v = Vk·3,6).
check("V0 Porto Alegre (-30,0; -51,167)", v0Ponto(-30.0, -51.167), 45.0785, 0.01);
check("V0 Campinas (-23,0; -47,1)", v0Ponto(-23.0, -47.1), 44.3068, 0.01);
check("V0 Bagé (-31,4; -54,1)", v0Ponto(-31.4, -54.1), 48.0521, 0.01);
check("v km/h João Pessoa (-7,115; -34,863)", ventoNoPonto(-7.115, -34.863).v_kmh, 72.5, 0.1);
check("v km/h Curitiba (-25,517; -49,183)", ventoNoPonto(-25.517, -49.183).v_kmh, 97.7, 0.1);

// Espaçamento mínimo entre condutores (NT 11836), em mm por faixa de tensão.
check("espaçamento até 1 kV", v.espacamentoMinimoMm(0.38), 200, 0);
check("espaçamento 13,8 kV", v.espacamentoMinimoMm(13.8), 500, 0);
check("espaçamento 24,2 kV", v.espacamentoMinimoMm(24.2), 600, 0);
check("espaçamento 36,2 kV", v.espacamentoMinimoMm(36.2), 600, 0);
check("espaçamento 13,8 kV em m", v.espacamentoMinimo(13.8), 0.5, 0);

// Tração de projeto do CAA: NDU 007 Tab. 26 (terno ÷ 3); tabelas de montagem fora de uso.
{
  for (const awg of ["2", "1/0", "2/0", "4/0", "336.4"]) {
    check(`CAA ${awg} sem tabela de montagem`, tracaoTabelada("CAA", awg, 40, 30) === null ? 1 : 0, 1, 0);
  }
  check("CAL sem tabela", tracaoTabelada("CAL", "1/0", 40, 25) === null ? 1 : 0, 1, 0);
  check("CA sem tabela", tracaoTabelada("CA", "336.4", 40, 25) === null ? 1 : 0, 1, 0);
  check("CAA 2: NDU", v.tracaoProjetoFeixe("CAA", "2")!, 454 / 3, 1e-9);
  check("CAA 1/0: NDU", v.tracaoProjetoFeixe("CAA", "1/0")!, 605 / 3, 1e-9);
  check("CAA 4/0: NDU", v.tracaoProjetoFeixe("CAA", "4/0")!, 1212 / 3, 1e-9);
  check("CAA 336,4: NDU", v.tracaoProjetoFeixe("CAA", "336.4")!, 1517 / 3, 1e-9);
  // Fora da tabela: interpolado pelo peso entre as vizinhas tabeladas.
  const t20 = 605 / 3 + ((272 - 216.2) / (433.2 - 216.2)) * (1212 / 3 - 605 / 3);
  check("CAA 2/0: interpolado 1/0–4/0", v.tracaoProjetoFeixe("CAA", "2/0")!, t20, 1e-9);
  check("CAA 2/0: vizinhas 1/0 e 4/0", v.tracaoProjetoInterpolada("CAA", "2/0")?.abaixo === "1/0" && v.tracaoProjetoInterpolada("CAA", "2/0")?.acima === "4/0" ? 1 : 0, 1, 0);
  // Ordem preservada: 4/0 < 266,8 < 336,4.
  const t268 = v.tracaoProjetoFeixe("CAA", "266.8")!;
  check("CAA 266,8 entre 4/0 e 336,4", t268 > 1212 / 3 && t268 < 1517 / 3 ? 1 : 0, 1, 0);
  check("CA 3/0 continua sem tração tabelada", v.tracaoProjetoFeixe("CA", "3/0") === null ? 1 : 0, 1, 0);

  // Fim de linha 11/300, 3 × CAA 336,4, vão 40 m, 25 °C: NDU 007 Tab. 26 = 1517 daN por terno.
  const fim: EntradaPoste = {
    estrutura: "fim_linha", tipoFisico: "circular", comprimento: 11, resistencia: 300,
    vao: 40, alfa: 0, nFases: 3, limiarPct: 100,
  };
  if (!TRACAO_NO_CALCULO) {
    // Tração desligada: o esforço é só o vento em qualquer estrutura.
    check("Tração desligada: fim de linha sem tração", dimensionarPoste(72.5, "CAA", "336.4", fim, 25).tracao === null ? 1 : 0, 1, 0);
  } else {
  const mf = dimensionarPoste(72.5, "CAA", "336.4", fim, 25).tracao!;
  check("Fim de linha 3 × CAA 336,4: T", mf.T, 1517, 1e-9);
  check("Fim de linha: fonte NDU 007", mf.fonte === "tabela" ? 1 : 0, 1, 0);
  const m4 = dimensionarPoste(72.5, "CAA", "4/0", fim, 25).tracao!;
  check("Fim de linha 3 × CAA 4/0: T NDU", m4.fonte === "tabela" ? m4.T : NaN, 1212, 1e-9);
  // CAL cai na tabela fixa (NDU 007 Tab. 26: 3 × 1/0 CAA/CAL = 605 daN por terno → 605/3 por condutor).
  const mc = dimensionarPoste(72.5, "CAL", "1/0", fim, 25).tracao!;
  check("CAL 1/0: tabela fixa", mc.fonte === "tabela" ? mc.Tcondutor : NaN, 605 / 3, 0);
  }
}

// Vão regulador do trecho entre ancoragens: ar = √(Σa³/Σa).
{
  // 40 e 80 m: √((64000 + 512000)/120) = √4800 = 69,282 m.
  check("ar(40, 80)", vaoRegulador([40, 80]), 69.282, 0.001);
  check("ar(vãos iguais) = o vão", vaoRegulador([50, 50, 50]), 50, 1e-9);

  // Linha: P1 derivação · P2 passagem 5° · P3 ângulo 30° ancorado · P4 ângulo 20°
  // sem âncora · P5 fim de linha. Trechos P1–P3 (40, 80 m) e P3–P5 (60, 60 m).
  const p = (o: Partial<EntradaPoste>): EntradaPoste => ({
    estrutura: "passagem", tipoFisico: "circular", comprimento: 11, resistencia: 600,
    vao: 60, alfa: 0, nFases: 3, limiarPct: 100, ...o,
  });
  const linha = [
    p({ estrutura: "derivacao" }),
    p({ alfa: 5, vaoRe: 40 }),
    p({ estrutura: "angulo", alfa: 30, ancorado: true, vaoRe: 80 }),
    p({ estrutura: "angulo", alfa: 20, vaoRe: 60 }),
    p({ estrutura: "fim_linha", vaoRe: 60 }),
  ];
  const tr = trechosDaLinha(linha);
  check("P2 no trecho P1–P3: ar", tr[1][0].ar ?? NaN, 69.282, 0.001);
  check("P3 ancorado: 2 trechos", tr[2].length, 2, 0);
  check("P4 sem âncora: trecho P3–P5, ar", tr[3].length === 1 ? tr[3][0].ar ?? NaN : NaN, 60, 1e-9);
  const semVaoRe = trechosDaLinha([linha[0], p({ vaoRe: 40 }), p({ estrutura: "fim_linha" })]);
  check("Trecho com vão à ré faltando: sem ar", semVaoRe[1][0].ar === null ? 1 : 0, 1, 0);

  if (TRACAO_NO_CALCULO) {
  // CAA pela NDU 007: a tração por condutor é fixa — não depende do trecho.
  const m2 = dimensionarPoste(72.5, "CAA", "1/0", linha[1], 10, tr[1]);
  check("P2: T por condutor = NDU (sem tabela de montagem)", m2.tracao!.tabelada === null ? m2.tracao!.Tcondutor : NaN, 605 / 3, 1e-9);
  check("P3 ancorado: mesma T da NDU", dimensionarPoste(72.5, "CAA", "1/0", linha[2], 10, tr[2]).tracao!.Tcondutor, 605 / 3, 1e-9);
  // Passagem reta (α = 0): as trações se anulam — só vento (GED, Exemplo 2).
  check("Passagem α=0: sem tração", dimensionarPoste(72.5, "CAA", "336.4", p({}), 25, []).tracao === null ? 1 : 0, 1, 0);
  }
}

// Derivação: verificação do poste existente (poste 01), nova rede 3 × CAA 1/0.
{
  const rede = (o: Partial<RedeExistente>): RedeExistente => ({
    tipoCabo: "CAA", awg: "4/0", nFases: 3, situacao: "passagem", alfa: 0, vao: 40,
    anguloDerivacao: 90, lado: "maior", ...o,
  });
  const deriv = (o: Partial<RedeExistente>, Rn = 600) =>
    dimensionarPoste(72.5, "CAA", "1/0", {
      estrutura: "derivacao", tipoFisico: "duplo T", comprimento: 12, resistencia: Rn,
      vao: 40, alfa: 0, nFases: 3, limiarPct: 100, redeExistente: rede(o),
    }, 30, []).derivacao!;

  // Passagem a 90°: a tração existente se anula; F = T nova + vento no poste e nos cabos existentes.
  const d1 = deriv({});
  check("Derivação passagem: tração existente anulada", d1.Rexistente, 0, 0);
  check("Derivação: T nova = 605 (NDU, 3 × CAA 1/0)", d1.Tnova, 605, 1e-9);
  check("Derivação: T existente = 1212 (NDU, 3 × CAA 4/0)", d1.Texistente, 1212, 1e-9);
  // Vento a 90° dá T + Fp + Fc existente; a varredura pode achar um pouco mais
  // (o vento oblíquo pega também os cabos novos), nunca menos.
  const f90 = d1.Tnova + d1.FpTopo + d1.FcExistente;
  check("Derivação passagem 90°: F ≥ T + Fp + Fc existente", d1.F >= f90 - 1e-9 && d1.F <= f90 + d1.FcNova ? 1 : 0, 1, 0);
  // Fim de linha com a derivação prolongando a rede (θ = 180°): as trações se opõem.
  const d2 = deriv({ situacao: "fim_linha", anguloDerivacao: 180 });
  check("Derivação fim de linha 180°: trações se opõem", d2.Rtracao, Math.abs(d2.Texistente - d2.Tnova), 1e-6);
  // Fim de linha a 90°: trações perpendiculares.
  const d3 = deriv({ situacao: "fim_linha" });
  check("Derivação fim de linha 90°: √(Tex² + Tnova²)", d3.Rtracao, Math.hypot(d3.Texistente, d3.Tnova), 1e-6);
  // Lado menor = Rn/2; circular não tem lado.
  check("Lado menor = Rn/2", deriv({ lado: "menor" }).capacidade, 300, 0);
  check("Circular: Rn em qualquer lado", capacidadeLado("circular", 600, "menor"), 600, 0);
  // Não atende em 600 daN: menor classe do catálogo que atende e faixa do estai.
  check("Derivação 12/600: não atende", d1.atende ? 1 : 0, 0, 0);
  const sug = d1.solucoes.posteSugerido!;
  const est = d1.solucoes.estai!;
  check("Estai em heMin deixa |Fr| = capacidade", Math.abs(d1.F * (1 - 10.1 / est.heMin)), 600, 1e-6);
  // Com o poste sugerido, a derivação atende.
  check("Poste sugerido: atende", deriv({}, sug.resistencia).atende ? 1 : 0, 1, 0);
}

// Cruzeta — MA_CR = (Pc + PE)·d2 + PCR·LCR/4 + Pc·d1
// Pc = 40, PE = 100, PCR = 35/2, LCR = 2,0, d1 = 0,2, d2 = 0,9:
// 140·0,9 + 17,5·0,5 + 40·0,2 = 126 + 8,75 + 8 = 142,75 daN·m
{
  const MA_CR = v.momentoFletorCruzeta({
    Pc: 40, PE: 100, PCR: v.metadePesoCruzeta(35), LCR: 2.0, d1: 0.2, d2: 0.9,
  });
  check("MA_CR cruzeta", MA_CR, 142.75, 1e-9);
  check("Esforço na ponta = MA_CR/(LCR/2)", v.esforcoPontaCruzeta(MA_CR, 2.0), 142.75, 1e-9);
  // Pc de 80 m de CAA 4/0 (433,2 kg/km) + 3 daN de acessórios = 34,656 + 3
  check("Pc (80 m CAA 4/0 + 3 daN)", v.pesoCondutorNoApoio("CAA", "4/0", 80, 3), 37.656, 1e-9);
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
