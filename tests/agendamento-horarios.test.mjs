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

async function carregarAplicacao(agora, { fuso = "America/Sao_Paulo", limite = 2 } = {}) {
    const elementos = new Map();
    const elementosPorId = id => {
        if (!elementos.has(id)) elementos.set(id, criarElemento());
        return elementos.get(id);
    };
    const envios = [];
    const consultas = [];
    let paginaComFalha;
    let falhaEnvio;
    let antesDaPagina;
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
                select(campos, opcoes) {
                    assert.equal(opcoes.count, "exact");
                    consultas.push({ tabela, campos });
                    return this;
                },
                order(coluna) { consultas.at(-1).ordem ??= []; consultas.at(-1).ordem.push(coluna); return this; },
                eq() { return this; },
                async range(inicio, fim) {
                    antesDaPagina?.(tabela, inicio);
                    if (paginaComFalha?.[0] === tabela && paginaComFalha[1] === inicio) {
                        return { error: new Error("Falha de página") };
                    }
                    return { data: dados[tabela].slice(inicio, Math.min(inicio + limite, fim + 1)),
                        count: dados[tabela].length };
                },
                async insert(registros) { envios.push(...registros); return falhaEnvio || {}; }
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
        supabaseClient,
        FUSO_BARBEARIA: fuso
    };
    const prepararData = runInNewContext(`${script}
        ({
            preparar(data, barbeiroId) {
                reserva = { servico: { nome: "Corte", preco: "R$ 20,00", rotulo: "Corte" }, data, barbeiroId };
                mudarEtapaAgendamento(agendamento);
            },
            recarregar: carregarDisponibilidadePublica,
            dia: dataAtualISO,
            instante: instanteDoHorario
        });
    `, contexto);
    await new Promise(resolve => setImmediate(resolve));

    elementosPorId("nome").value = "Cliente fictício";
    elementosPorId("whatsapp").value = "21900000000";
    return {
        envios,
        dados, consultas,
        falharPagina: pagina => { paginaComFalha = pagina; },
        falharEnvio: erro => { falhaEnvio = erro; },
        observarPagina: callback => { antesDaPagina = callback; },
        recarregar: prepararData.recarregar,
        dia: prepararData.dia,
        instante: prepararData.instante,
        elemento: elementosPorId,
        prepararData: (data, barbeiroId = "1") => prepararData.preparar(data, barbeiroId),
        avancarRelogio: horario => { agora = horario; },
        horario: hora => elementosPorId("horarios-cliente").children.find(item => item.textContent.startsWith(hora)),
        confirmar: () => elementosPorId("form-agendamento").disparar("submit"),
        estaNaData: () => !elementosPorId("agendamento").hidden,
        estaNaConfirmacao: () => !elementosPorId("dados-cliente").hidden
    };
}

test("desabilita horários passados e iguais ao atual, mantendo as demais regras", async () => {
    const app = await carregarAplicacao(`${hoje}T09:30:00-03:00`);
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
    const app = await carregarAplicacao(`${hoje}T09:29:59-03:00`);
    app.prepararData(hoje);
    const horarioAntigo = app.horario("09:30");
    app.avancarRelogio(`${hoje}T09:30:00-03:00`);
    horarioAntigo.disparar("click");
    assert.equal(app.estaNaData(), true);

    app.horario("09:31").disparar("click");
    assert.equal(app.estaNaConfirmacao(), true);
    app.avancarRelogio(`${hoje}T09:31:01-03:00`);
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
    const app = await carregarAplicacao(`${hoje}T23:59:59-03:00`);
    app.prepararData(hoje);
    assert.equal(app.horario("23:59").disabled, true);
    app.prepararData(amanha);
    assert.equal(app.horario("00:00").disabled, false);

    app.horario("00:00").disparar("click");
    assert.equal(app.estaNaConfirmacao(), true);
    app.avancarRelogio(`${amanha}T00:00:00-03:00`);
    await app.confirmar();
    assert.equal(app.envios.length, 0);
    assert.equal(app.horario("00:00").disabled, true);
    assert.equal(app.horario("00:15").disabled, false);
    app.prepararData(hoje);
    assert.equal(app.horario("23:59"), undefined);
});

test("falha na segunda página bloqueia horários e a recuperação exige nova seleção", async () => {
    const app = await carregarAplicacao(`${hoje}T08:00:00-03:00`);
    app.prepararData(hoje);
    app.horario("09:00").disparar("click");
    app.falharPagina(["horarios_disponiveis", 2]);
    await app.recarregar();
    assert.equal(app.estaNaData(), true);
    assert.equal(app.horario("09:00"), undefined);
    assert.match(app.elemento("aviso-data").textContent, /Não foi possível/);
    app.falharPagina(null);
    await app.recarregar();
    assert.equal(app.horario("09:00").disabled, false);
    await app.confirmar();
    assert.equal(app.envios.length, 0);
    assert(app.consultas.filter(item => item.tabela === "agendamentos_publicos")
        .every(item => item.campos === "data, horario, barbeiro_id" &&
            item.ordem.join() === "data,horario,barbeiro_id"));
});

test("ocupação repetida entre páginas bloqueia horários mesmo com contagem constante", async () => {
    const app = await carregarAplicacao(`${hoje}T08:00:00-03:00`, { limite: 1 });
    app.prepararData(hoje);
    const horarioAntesDaRecarga = app.horario("09:00");
    assert.equal(horarioAntesDaRecarga.disabled, false);

    const ocupacoes = app.dados.agendamentos_publicos;
    ocupacoes.unshift({ data: hoje, horario: "09:30:00", barbeiro_id: 1 });
    const offsets = [];
    app.observarPagina((tabela, inicio) => {
        if (tabela !== "agendamentos_publicos") return;
        offsets.push(inicio);
        if (inicio === 1) {
            // Uma nova reserva entra antes da primeira linha lida e outra sai.
            ocupacoes.pop();
            ocupacoes.unshift({ data: hoje, horario: "09:00:00", barbeiro_id: 1 });
        }
    });
    await app.recarregar();

    assert.deepEqual(offsets, [0, 1]);
    assert.equal(ocupacoes.length, 2);
    assert.match(app.elemento("aviso-data").textContent, /Não foi possível/);
    assert.equal(app.horario("09:00"), undefined);
    horarioAntesDaRecarga.disparar("click");
    await app.confirmar();
    assert.equal(app.estaNaData(), true);
    assert.equal(app.envios.length, 0);

    app.observarPagina(null);
    await app.recarregar();
    app.prepararData(hoje);
    assert.equal(app.horario("09:00").disabled, true);
    assert.equal(app.horario("10:00").disabled, false);
});

test("resultado indeterminado preserva dados e não repete o envio", async () => {
    const app = await carregarAplicacao(`${hoje}T08:00:00-03:00`);
    app.prepararData(hoje);
    app.horario("09:00").disparar("click");
    app.elemento("whatsapp").value = "+55 (21) 90000-0000";
    app.falharEnvio({ status: 0, error: { message: "Falha de transporte" } });
    await Promise.all([app.confirmar(), app.confirmar()]);
    assert.equal(app.envios.length, 1);
    assert.equal(app.envios[0].whatsapp, "+5521900000000");
    assert.equal("preco" in app.envios[0], false);
    assert.equal("barbeiro_nome" in app.envios[0], false);
    assert.equal(app.elemento("whatsapp").value, "+55 (21) 90000-0000");
    assert.match(app.elemento("aviso-data").textContent, /pode ter sido registrada/);
    await app.confirmar();
    assert.equal(app.envios.length, 1);
});

test("relógio IANA considera hora ausente e ocorrência posterior nas trocas de horário", async () => {
    const app = await carregarAplicacao("2026-11-18T03:59:00Z", { fuso: "America/New_York" });
    assert.equal(app.dia(), "2026-11-17");
    assert.equal(app.instante("2026-03-08", "02:30"), null);
    assert.equal(app.instante("2026-11-01", "01:30"), Date.parse("2026-11-01T06:30:00Z"));
});

test("fuso inválido impede a consulta e mantém a agenda indisponível", async () => {
    const app = await carregarAplicacao("2026-11-18T03:59:00Z", { fuso: "Loja/Ficticia" });
    app.prepararData(hoje);
    assert.equal(app.consultas.length, 0);
    assert.match(app.elemento("aviso-data").textContent, /fuso horário/);
    assert.equal(app.horario("09:00"), undefined);
});
