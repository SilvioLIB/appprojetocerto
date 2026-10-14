"use strict";

// Estado carregado da API
let OPERACOES = [];
let CATALOGOS = { postes: {}, condutores: {} };
let opAtual = null;
let coletores = [];   // [{nome, get}] para ler os valores do formulário

const $ = (sel) => document.querySelector(sel);

// Cria elemento com atributos e filhos
function el(tag, attrs = {}, filhos = []) {
  const e = document.createElement(tag);
  for (const [k, val] of Object.entries(attrs)) {
    if (k === "class") e.className = val;
    else if (k === "text") e.textContent = val;
    else if (k === "html") e.innerHTML = val;
    else if (k.startsWith("on") && typeof val === "function") e.addEventListener(k.slice(2), val);
    else if (val !== null && val !== undefined) e.setAttribute(k, val);
  }
  for (const f of [].concat(filhos)) if (f) e.append(f);
  return e;
}

const ordNum = (a, b) => Number(a) - Number(b);

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
async function init() {
  aplicarTemaSalvo();
  $("#btn-tema").addEventListener("click", alternarTema);
  $("#busca").addEventListener("input", filtrarLista);
  $("#form-calculo").addEventListener("submit", aoCalcular);
  $("#btn-limpar").addEventListener("click", () => selecionarOperacao(opAtual));

  try {
    const resp = await fetch("/api/operacoes");
    if (!resp.ok) throw new Error("Falha ao carregar operações");
    const dados = await resp.json();
    OPERACOES = dados.operacoes;
    CATALOGOS = dados.catalogos;
    renderSidebar();
  } catch (e) {
    $("#lista-operacoes").append(el("p", { class: "grupo-titulo", text: "Erro ao carregar: " + e.message }));
  }
}

// ---------------------------------------------------------------------------
// Barra lateral
// ---------------------------------------------------------------------------
function renderSidebar() {
  const nav = $("#lista-operacoes");
  nav.innerHTML = "";
  let grupoAtual = null;
  for (const op of OPERACOES) {
    if (op.grupo !== grupoAtual) {
      grupoAtual = op.grupo;
      nav.append(el("div", { class: "grupo-titulo", text: grupoAtual }));
    }
    const btn = el("button", {
      class: "item-operacao", type: "button", text: op.titulo,
      "data-id": op.id, "data-busca": (op.titulo + " " + op.grupo).toLowerCase(),
      onclick: () => selecionarOperacao(op),
    });
    nav.append(btn);
  }
}

function filtrarLista(ev) {
  const termo = ev.target.value.toLowerCase().trim();
  document.querySelectorAll(".item-operacao").forEach((btn) => {
    const ok = btn.dataset.busca.includes(termo);
    btn.style.display = ok ? "" : "none";
  });
}

// ---------------------------------------------------------------------------
// Seleção de operação e montagem do formulário
// ---------------------------------------------------------------------------
function selecionarOperacao(op) {
  opAtual = op;
  document.querySelectorAll(".item-operacao").forEach((b) =>
    b.classList.toggle("ativo", b.dataset.id === op.id));

  $("#boas-vindas").classList.add("oculto");
  $("#area-calculo").classList.remove("oculto");
  $("#erro").classList.add("oculto");
  $("#cartao-resultados").classList.add("oculto");
  $("#op-titulo").textContent = op.titulo;
  $("#op-descricao").textContent = op.descricao || "";

  const form = $("#form-calculo");
  form.innerHTML = "";
  coletores = [];
  for (const campo of op.campos) montarCampo(form, campo);
}

function montarCampo(form, campo) {
  const construtores = {
    number: campoNumero, select: campoSelect,
    select_ou_numero: campoSelectOuNumero,
    poste: campoPoste, condutor: campoCondutor, cargas: campoCargas,
  };
  const construtor = construtores[campo.tipo] || campoNumero;
  const { elemento, get, largo } = construtor(campo);
  coletores.push({ nome: campo.nome, get });
  const wrap = el("div", { class: "campo" + (largo ? " largo" : "") });
  wrap.append(el("label", { text: campo.label }));
  wrap.append(elemento);
  if (campo.ajuda) wrap.append(el("span", { class: "ajuda", text: campo.ajuda }));
  form.append(wrap);
}

// --- Campos numéricos (inputmode decimal aceita vírgula ou ponto) ---
function inputNumero(valor) {
  return el("input", {
    type: "text", inputmode: "decimal", autocomplete: "off",
    value: valor !== null && valor !== undefined ? valor : "",
    placeholder: "0",
  });
}

function comUnidade(input, unidade) {
  if (!unidade) return input;
  const box = el("div", { class: "entrada-unidade" });
  box.append(input, el("span", { class: "unidade", text: unidade }));
  return box;
}

function campoNumero(campo) {
  const input = inputNumero(campo.default);
  return { elemento: comUnidade(input, campo.unidade), get: () => input.value.trim() };
}

function campoSelect(campo) {
  const sel = el("select");
  for (const o of campo.opcoes) sel.append(el("option", { value: o.valor, text: o.label }));
  if (campo.default !== null && campo.default !== undefined) sel.value = campo.default;
  return { elemento: sel, get: () => sel.value };
}

function campoSelectOuNumero(campo) {
  const sel = el("select");
  for (const o of campo.opcoes) sel.append(el("option", { value: String(o.valor), text: o.label }));
  sel.append(el("option", { value: "__outro__", text: "Outro… (digitar)" }));
  const input = inputNumero("");
  const inputBox = comUnidade(input, campo.unidade);
  inputBox.classList.add("oculto");
  sel.addEventListener("change", () => {
    const outro = sel.value === "__outro__";
    inputBox.classList.toggle("oculto", !outro);
    if (outro) input.focus();
  });
  const wrap = el("div", { class: "cascata" }, [sel, inputBox]);
  const get = () => (sel.value === "__outro__" ? input.value.trim() : sel.value);
  return { elemento: wrap, get };
}

// --- Cascata de poste: tipo -> comprimento -> resistência ---
function campoPoste(campo) {
  const selTipo = el("select");
  const selComp = el("select");
  const selResist = el("select");

  const preencher = (sel, chaves, sufixo) => {
    sel.innerHTML = "";
    chaves.sort(ordNum).forEach((c) => sel.append(el("option", { value: c, text: c + sufixo })));
  };
  const atualizarComp = () => {
    preencher(selComp, Object.keys(CATALOGOS.postes[selTipo.value] || {}), " m");
    atualizarResist();
  };
  const atualizarResist = () => {
    const r = CATALOGOS.postes[selTipo.value]?.[selComp.value] || {};
    preencher(selResist, Object.keys(r), " daN");
  };

  Object.keys(CATALOGOS.postes).forEach((t) => selTipo.append(el("option", { value: t, text: t })));
  selTipo.addEventListener("change", atualizarComp);
  selComp.addEventListener("change", atualizarResist);
  atualizarComp();

  const wrap = el("div", { class: "cascata" }, [selTipo, selComp, selResist]);
  const get = () => ({ tipo: selTipo.value, comprimento: selComp.value, resistencia: selResist.value });
  return { elemento: wrap, get, largo: true };
}

// --- Cascata de condutor: tipo de cabo -> bitola ---
function campoCondutor(campo) {
  const selCabo = el("select");
  const selAwg = el("select");
  const atualizarAwg = () => {
    selAwg.innerHTML = "";
    const bitolas = CATALOGOS.condutores[selCabo.value]?.bitolas || [];
    bitolas.forEach((b) => selAwg.append(el("option", { value: b.awg, text: `${b.awg} (d=${b.d} mm)` })));
  };
  Object.entries(CATALOGOS.condutores).forEach(([tc, d]) =>
    selCabo.append(el("option", { value: tc, text: `${tc} — ${d.nome}` })));
  selCabo.addEventListener("change", atualizarAwg);
  atualizarAwg();

  const wrap = el("div", { class: "cascata" }, [selCabo, selAwg]);
  const get = () => ({ tipo_cabo: selCabo.value, awg: selAwg.value });
  return { elemento: wrap, get, largo: true };
}

// --- Lista dinâmica de cargas (F, altura) ---
function campoCargas(campo) {
  const lista = el("div", { class: "cargas-lista" });
  const linhas = [];

  const adicionar = (F = "", altura = "") => {
    const inF = inputNumero(F);
    const inA = inputNumero(altura);
    inF.placeholder = "Força (daN)";
    inA.placeholder = "Altura (m)";
    const linha = el("div", { class: "carga-linha" });
    const btnRem = el("button", {
      type: "button", class: "btn-remover", text: "×", title: "Remover",
      onclick: () => { linha.remove(); const i = linhas.indexOf(reg); if (i >= 0) linhas.splice(i, 1); },
    });
    linha.append(inF, inA, btnRem);
    lista.append(linha);
    const reg = { get: () => ({ F: inF.value.trim(), altura: inA.value.trim() }) };
    linhas.push(reg);
  };

  adicionar();
  const btnAdd = el("button", { type: "button", class: "btn-add", text: "+ Adicionar carga", onclick: () => adicionar() });
  const wrap = el("div", {}, [lista, btnAdd]);
  const get = () => linhas.map((l) => l.get()).filter((c) => c.F !== "" && c.altura !== "");
  return { elemento: wrap, get, largo: true };
}

// ---------------------------------------------------------------------------
// Envio e resultados
// ---------------------------------------------------------------------------
async function aoCalcular(ev) {
  ev.preventDefault();
  const valores = {};
  for (const c of coletores) valores[c.nome] = c.get();

  $("#erro").classList.add("oculto");
  const btn = $("#form-calculo").querySelector("button") || null;

  try {
    const resp = await fetch("/api/calcular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operacao: opAtual.id, valores }),
    });
    const dados = await resp.json();
    if (!resp.ok) return mostrarErro(dados.erro || "Erro no cálculo.");
    mostrarResultados(dados.resultados);
  } catch (e) {
    mostrarErro("Não foi possível calcular: " + e.message);
  }
}

function mostrarErro(msg) {
  $("#cartao-resultados").classList.add("oculto");
  const box = $("#erro");
  box.textContent = "⚠️ " + msg;
  box.classList.remove("oculto");
}

function mostrarResultados(resultados) {
  const ul = $("#lista-resultados");
  ul.innerHTML = "";
  for (const r of resultados) {
    const li = el("li", { class: r.destaque ? "destaque" : "" });
    li.append(el("span", { class: "res-rotulo", text: r.rotulo }));
    const valor = el("span", { class: "res-valor", text: r.valor });
    if (r.unidade) valor.append(el("span", { class: "res-unidade", text: " " + r.unidade }));
    li.append(valor);
    ul.append(li);
  }
  $("#cartao-resultados").classList.remove("oculto");
  $("#cartao-resultados").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ---------------------------------------------------------------------------
// Tema claro/escuro
// ---------------------------------------------------------------------------
function aplicarTemaSalvo() {
  const tema = localStorage.getItem("tema") || "claro";
  document.documentElement.setAttribute("data-tema", tema);
  $("#btn-tema").textContent = tema === "escuro" ? "☀️" : "🌙";
}
function alternarTema() {
  const novo = document.documentElement.getAttribute("data-tema") === "escuro" ? "claro" : "escuro";
  document.documentElement.setAttribute("data-tema", novo);
  localStorage.setItem("tema", novo);
  $("#btn-tema").textContent = novo === "escuro" ? "☀️" : "🌙";
}

document.addEventListener("DOMContentLoaded", init);
