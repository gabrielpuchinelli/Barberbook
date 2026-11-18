import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../js/script.js", import.meta.url), "utf8");
const hoje = "2026-11-18";
const amanha = "2026-11-19";
const dataBloqueada = "2026-11-20";

function criarElemento() {
    const eventos = new Map();
    const filhos = new Map();
    return {
        children: [],
        style: {},
        value: "",
        classList: { toggle() {} },
        setAttribute() {},
        removeAttribute() {},
        focus() {},
        reportValidity: () => true,
        reset() {},
        addEventListener(tipo, callback) { eventos.set(tipo, callback); },
        disparar(tipo) { return eventos.get(tipo)({ preventDefault() {} }); },
        querySelector(seletor) {
            if (!filhos.has(seletor)) filhos.set(seletor, criarElemento());
            return filhos.get(seletor);
        },
        replaceChildren() { this.children = []; },
        append(...elementos) { this.children.push(...elementos); },
        appendChild(elemento) { this.children.push(elemento); }
    };
}

async function carregarAplicacao(agora) {
    const elementos = new Map();
    const elementosPorId = id => {
        if (!elementos.has(id)) elementos.set(id, criarElemento());
        return elementos.get(id);
    };
    const envios = [];
    const dados = {
        agendamentos_publicos: [{ data: hoje, horario: "10:00:00", barbeiro_id: 1 }],
        barbeiros: [{ id: 1, nome: "Alex" }, { id: 2, nome: "Bianca" }],
        dias_disponiveis: Array.from({ length: 7 }, (_, dia_semana) => ({ dia_semana, ativo: true })),
        datas_bloqueadas: [{ data: dataBloqueada }],
        horarios_disponiveis: ["00:00", "00:15", "09:00", "09:30", "09:31", "10:00", "10:30", "23:59"]
            .map(hora => ({ horario: `${hora}:00`, ativo: hora !== "10:30" }))
    };
    const supabaseClient = {
        auth: { onAuthStateChange() {} },
        from(tabela) {
            return {
                select() { return this; },
                order() { return this; },
                eq() { return this; },
                then(resolve, reject) {
                    return Promise.resolve({ data: dados[tabela] }).then(resolve, reject);
                },
                async insert(registros) { envios.push(...registros); return {}; }
            };
        }
    };
    const contexto = {
        Date: class extends Date {
            constructor(...argumentos) { super(...(argumentos.length ? argumentos : [agora])); }
        },
        document: {
            getElementById: elementosPorId,
            querySelectorAll: () => [],
            createElement: criarElemento
        },
        localStorage: { removeItem() {} },
        supabaseClient
    };
    const prepararData = runInNewContext(`${script}
        (data, barbeiroId) => {
            reserva = { servico: { nome: "Corte", preco: "R$ 20,00", rotulo: "Corte" }, data, barbeiroId };
            mudarEtapaAgendamento(agendamento);
        };
    `, contexto);
    await new Promise(resolve => setImmediate(resolve));

    elementosPorId("nome").value = "Cliente fictício";
    elementosPorId("whatsapp").value = "21900000000";
    return {
        envios,
        prepararData: (data, barbeiroId = "1") => prepararData(data, barbeiroId),
        avancarRelogio: horario => { agora = horario; },
        horario: hora => elementosPorId("horarios-cliente").children.find(item => item.textContent.startsWith(hora)),
        confirmar: () => elementosPorId("form-agendamento").disparar("submit"),
        estaNaData: () => !elementosPorId("agendamento").hidden,
        estaNaConfirmacao: () => !elementosPorId("dados-cliente").hidden
    };
}

test("desabilita horários passados e iguais ao atual, mantendo as demais regras", async () => {
    const app = await carregarAplicacao(`${hoje}T09:30:00`);
    app.prepararData(hoje);
    assert.equal(app.horario("09:00").disabled, true);
    assert.equal(app.horario("09:30").disabled, true);
    assert.match(app.horario("09:30").textContent, /encerrado/);
    assert.equal(app.horario("09:31").disabled, false);
    assert.equal(app.horario("10:00").disabled, true);
    assert.match(app.horario("10:00").textContent, /ocupado/);
    assert.equal(app.horario("10:30"), undefined);

    app.prepararData(hoje, "2");
    assert.equal(app.horario("10:00").disabled, false);
    app.prepararData(dataBloqueada);
    assert.equal(app.horario("09:31"), undefined);
});

test("revalida o relógio no clique e no envio de uma seleção que envelheceu", async () => {
    const app = await carregarAplicacao(`${hoje}T09:29:59`);
    app.prepararData(hoje);
    const horarioAntigo = app.horario("09:30");
    app.avancarRelogio(`${hoje}T09:30:00`);
    horarioAntigo.disparar("click");
    assert.equal(app.estaNaData(), true);

    app.horario("09:31").disparar("click");
    assert.equal(app.estaNaConfirmacao(), true);
    app.avancarRelogio(`${hoje}T09:31:01`);
    await app.confirmar();
    assert.equal(app.envios.length, 0);
    assert.equal(app.estaNaData(), true);
    assert.equal(app.horario("09:31").disabled, true);

    app.prepararData(hoje, "2");
    app.horario("10:00").disparar("click");
    await app.confirmar();
    assert.equal(app.envios.length, 1);
    assert.equal(app.envios[0].horario, "10:00");
});

test("considera a data na virada do dia, inclusive ao confirmar meia-noite", async () => {
    const app = await carregarAplicacao(`${hoje}T23:59:59`);
    app.prepararData(hoje);
    assert.equal(app.horario("23:59").disabled, true);
    app.prepararData(amanha);
    assert.equal(app.horario("00:00").disabled, false);

    app.horario("00:00").disparar("click");
    assert.equal(app.estaNaConfirmacao(), true);
    app.avancarRelogio(`${amanha}T00:00:00`);
    await app.confirmar();
    assert.equal(app.envios.length, 0);
    assert.equal(app.horario("00:00").disabled, true);
    assert.equal(app.horario("00:15").disabled, false);
    app.prepararData(hoje);
    assert.equal(app.horario("23:59"), undefined);
});
