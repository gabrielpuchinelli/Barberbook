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
    let responderHorarios;
    const pedidosHorarios = [];
    const widgets = [];
    const dados = {
        barbeiros: [{ id: 1, nome: "Alex" }, { id: 2, nome: "Bianca" }],
        dias_disponiveis: Array.from({ length: 7 }, (_, dia_semana) => ({ dia_semana, ativo: true })),
        datas_bloqueadas: [{ data: dataBloqueada }]
    };
    const supabaseClient = {
        auth: { onAuthStateChange() {} },
        async rpc(nome, parametros) {
            assert.equal(nome, "horarios_elegiveis");
            pedidosHorarios.push(parametros);
            if (responderHorarios) return responderHorarios(parametros);
            const horarios = ["00:00", "00:15", "09:00", "09:30", "09:31", "10:00", "23:59"]
                .filter(hora => !(parametros.p_data === hoje && parametros.p_barbeiro_id === "1" && hora === "10:00"));
            return { data: { total: horarios.length, horarios } };
        },
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
                }
            };
        }
    };
    const cartoes = ["Corte", "Barba"].map(nome => {
        const card = criarElemento();
        card.dataset = { servico: nome, preco: "R$ 20,00" };
        card.querySelector("h3").textContent = nome;
        return card;
    });
    const contexto = {
        Date: class extends Date {
            constructor(...argumentos) { super(...(argumentos.length ? argumentos : [agora])); }
        },
        document: {
            addEventListener() {},
            getElementById: elementosPorId,
            querySelectorAll: seletor => seletor === ".card-servico" ? cartoes : [],
            createElement: criarElemento
        },
        window: {
            addEventListener() {},
            setInterval() {},
            turnstile: {
                render(_, config) {
                    widgets.push(config);
                    config.callback(`token-${widgets.length}`);
                    return widgets.length;
                },
                remove() {}
            }
        },
        localStorage: { removeItem() {} },
        supabaseClient,
        TURNSTILE_SITE_KEY: "chave-ficticia",
        SUPABASE_URL: "http://127.0.0.1:12345",
        SUPABASE_ANON_KEY: "chave-publica-ficticia",
        crypto: globalThis.crypto,
        AbortController,
        setTimeout,
        clearTimeout,
        async fetch(url, opcoes) {
            assert.equal(url, "http://127.0.0.1:12345/functions/v1/criar-reserva");
            assert.equal(opcoes.headers.Authorization, undefined);
            envios.push(JSON.parse(opcoes.body));
            if (falhaEnvio instanceof Error) throw falhaEnvio;
            const dados = falhaEnvio || { status: 201, resultado: "confirmada" };
            return { status: dados.status, json: async () => dados };
        },
        FUSO_BARBEARIA: fuso
    };
    const prepararData = runInNewContext(`${script}
        ({
            preparar(data, barbeiroId, nome) {
                reserva = { servico: { nome, preco: "R$ 20,00", rotulo: nome }, data, barbeiroId };
                mudarEtapaAgendamento(agendamento);
                return carregarHorariosElegiveis();
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
        envios, widgets,
        dados, consultas, pedidosHorarios,
        responderHorarios: callback => { responderHorarios = callback; },
        falharPagina: pagina => { paginaComFalha = pagina; },
        falharEnvio: erro => { falhaEnvio = erro; },
        observarPagina: callback => { antesDaPagina = callback; },
        recarregar: prepararData.recarregar,
        dia: prepararData.dia,
        instante: prepararData.instante,
        elemento: elementosPorId,
        prepararData: (data, barbeiroId = "1", nome = "Corte") => prepararData.preparar(data, barbeiroId, nome),
        escolherServico: indice => cartoes[indice].disparar("click"),
        voltar: () => elementosPorId("btn-etapa-anterior").disparar("click"),
        avancarRelogio: horario => { agora = horario; },
        horario: hora => elementosPorId("horarios-cliente").children.find(item => item.textContent.startsWith(hora)),
        confirmar: async () => {
            await Promise.resolve();
            return elementosPorId("form-agendamento").disparar("submit");
        },
        estaNaData: () => !elementosPorId("agendamento").hidden,
        estaNaConfirmacao: () => !elementosPorId("dados-cliente").hidden
    };
}

test("omite horários passados, iguais ao atual e ausentes na resposta do banco", async () => {
    const app = await carregarAplicacao(`${hoje}T09:30:00-03:00`);
    await app.prepararData(hoje);
    assert.equal(app.horario("09:00"), undefined);
    assert.equal(app.horario("09:30"), undefined);
    assert(app.horario("09:31"));
    assert.equal(app.horario("10:00"), undefined);
    assert.equal(app.horario("10:30"), undefined);

    await app.prepararData(hoje, "2");
    assert(app.horario("10:00"));
    await app.prepararData(dataBloqueada);
    assert.equal(app.horario("09:31"), undefined);
});

test("revalida o relógio no clique e no envio de uma seleção que envelheceu", async () => {
    const app = await carregarAplicacao(`${hoje}T09:29:59-03:00`);
    await app.prepararData(hoje);
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
    assert.equal(app.horario("09:31"), undefined);

    await app.prepararData(hoje, "2");
    app.horario("10:00").disparar("click");
    await app.confirmar();
    assert.equal(app.envios.length, 1);
    assert.equal(app.envios[0].horario, "10:00");
});

test("considera a data na virada do dia, inclusive ao confirmar meia-noite", async () => {
    const app = await carregarAplicacao(`${hoje}T23:59:59-03:00`);
    await app.prepararData(hoje);
    assert.equal(app.horario("23:59"), undefined);
    await app.prepararData(amanha);
    assert(app.horario("00:00"));

    app.horario("00:00").disparar("click");
    assert.equal(app.estaNaConfirmacao(), true);
    app.avancarRelogio(`${amanha}T00:00:00-03:00`);
    await app.confirmar();
    assert.equal(app.envios.length, 0);
    assert.equal(app.horario("00:00"), undefined);
    assert(app.horario("00:15"));
    await app.prepararData(hoje);
    assert.equal(app.horario("23:59"), undefined);
});

test("falha na segunda página bloqueia horários e a recuperação exige nova seleção", async () => {
    const app = await carregarAplicacao(`${hoje}T08:00:00-03:00`);
    await app.prepararData(hoje);
    app.horario("09:00").disparar("click");
    app.falharPagina(["dias_disponiveis", 2]);
    await app.recarregar();
    assert.equal(app.estaNaData(), true);
    assert.equal(app.horario("09:00"), undefined);
    assert.match(app.elemento("aviso-data").textContent, /Não foi possível/);
    app.falharPagina(null);
    await app.recarregar();
    assert(app.horario("09:00"));
    await app.confirmar();
    assert.equal(app.envios.length, 0);
    assert(app.consultas.every(item => item.tabela !== "agendamentos_publicos"));
});

test("bloqueio repetido entre páginas impede consultar horários mesmo com contagem constante", async () => {
    const app = await carregarAplicacao(`${hoje}T08:00:00-03:00`, { limite: 1 });
    await app.prepararData(hoje);
    const horarioAntesDaRecarga = app.horario("09:00");
    assert(horarioAntesDaRecarga);

    const bloqueios = app.dados.datas_bloqueadas;
    bloqueios.push({ data: "2026-11-21" });
    const offsets = [];
    app.observarPagina((tabela, inicio) => {
        if (tabela !== "datas_bloqueadas") return;
        offsets.push(inicio);
        if (inicio === 1) {
            // Um bloqueio entra antes do primeiro resultado e outro sai, mantendo o total.
            bloqueios.pop();
            bloqueios.unshift({ data: amanha });
        }
    });
    await app.recarregar();

    assert.deepEqual(offsets, [0, 1]);
    assert.equal(bloqueios.length, 2);
    assert.match(app.elemento("aviso-data").textContent, /Não foi possível/);
    assert.equal(app.horario("09:00"), undefined);
    horarioAntesDaRecarga.disparar("click");
    await app.confirmar();
    assert.equal(app.estaNaData(), true);
    assert.equal(app.envios.length, 0);

    app.observarPagina(null);
    await app.recarregar();
    assert(app.horario("09:00"));
});

test("resultado indeterminado preserva dados e não repete o envio", async () => {
    const app = await carregarAplicacao(`${hoje}T08:00:00-03:00`);
    await app.prepararData(hoje);
    app.horario("09:00").disparar("click");
    app.elemento("whatsapp").value = "+55 (21) 90000-0000";
    app.falharEnvio(new Error("Falha de transporte"));
    await Promise.all([app.confirmar(), app.confirmar()]);
    assert.equal(app.envios.length, 1);
    assert.equal(app.envios[0].whatsapp, "+5521900000000");
    assert.equal("preco" in app.envios[0], false);
    assert.equal("barbeiro_nome" in app.envios[0], false);
    assert.equal(app.elemento("whatsapp").value, "+55 (21) 90000-0000");
    assert.match(app.elemento("aviso-confirmacao").textContent, /pode ter sido registrada/);
    assert.equal(app.elemento("nome").readOnly, true);
    app.voltar();
    assert(app.estaNaConfirmacao());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.envios.length, 1);
    app.falharEnvio(null);
    await app.confirmar();
    assert.equal(app.envios.length, 2);
    assert.equal(app.envios[0].chave, app.envios[1].chave);
    assert.notEqual(app.envios[0].token, app.envios[1].token);
});

test("falha ou resposta incompleta da RPC deixa a lista vazia até a recuperação", async () => {
    const app = await carregarAplicacao(`${hoje}T08:00:00-03:00`);
    const respostas = [
        { error: new Error("Falha na consulta") },
        { data: { total: 2, horarios: ["09:00"] } },
        { data: { total: 2, horarios: ["09:00", "09:00"] } }
    ];
    for (const resposta of respostas) {
        app.responderHorarios(() => resposta);
        await app.prepararData(hoje);
        assert.equal(app.horario("09:00"), undefined);
        assert.match(app.elemento("aviso-horarios").textContent, /Não foi possível/);
        assert.equal(app.elemento("btn-recarregar-disponibilidade").hidden, false);
    }
    app.responderHorarios(() => ({ data: { total: 1, horarios: ["10:00"] } }));
    await app.prepararData(hoje);
    assert(app.horario("10:00"));
    assert.equal(app.elemento("btn-recarregar-disponibilidade").hidden, true);
});

test("trocar o serviço após escolher horário exige nova seleção e consulta", async () => {
    const app = await carregarAplicacao(`${hoje}T08:00:00-03:00`);
    await app.prepararData(hoje);
    const horarioAnterior = app.horario("09:00");
    horarioAnterior.disparar("click");
    assert(app.estaNaConfirmacao());
    app.voltar();
    app.voltar();
    app.voltar();
    app.escolherServico(1);
    app.elemento("lista-barbeiros").children[0].disparar("click");
    assert.equal(app.horario("09:00"), undefined);
    app.responderHorarios(() => ({ data: { total: 1, horarios: ["10:00"] } }));
    await app.elemento("dias-cliente").children[0].disparar("click");
    assert.equal(app.pedidosHorarios.at(-1).p_servico, "Barba");
    horarioAnterior.disparar("click");
    assert(app.estaNaData());
    assert(app.horario("10:00"));
});

test("respostas obsoletas de serviço, profissional ou data não substituem a seleção atual", async () => {
    const app = await carregarAplicacao(`${hoje}T08:00:00-03:00`);
    for (const [data, barbeiro, servico] of [[hoje, "1", "Barba"], [hoje, "2", "Corte"], [amanha, "1", "Corte"]]) {
        let concluir;
        app.responderHorarios(() => new Promise(resolve => { concluir = resolve; }));
        const antiga = app.prepararData(hoje);
        assert.equal(app.horario("09:00"), undefined);
        app.responderHorarios(() => ({ data: { total: 1, horarios: ["10:00"] } }));
        await app.prepararData(data, barbeiro, servico);
        concluir({ data: { total: 1, horarios: ["09:00"] } });
        await antiga;
        assert.equal(app.horario("09:00"), undefined);
        assert(app.horario("10:00"));
        assert.equal(app.pedidosHorarios.at(-1).p_data, data);
        assert.equal(app.pedidosHorarios.at(-1).p_barbeiro_id, barbeiro);
        assert.equal(app.pedidosHorarios.at(-1).p_servico, servico);
    }
});

test("conflito HTTP recarrega a disponibilidade e mantém os dados de contato", async () => {
        const app = await carregarAplicacao(`${hoje}T08:00:00-03:00`);
        await app.prepararData(hoje);
        app.horario("09:00").disparar("click");
        app.falharEnvio({ status: 409, resultado: "conflito" });
        app.responderHorarios(() => ({ data: { total: 1, horarios: ["10:00"] } }));
        await app.confirmar();
        assert.match(app.elemento("aviso-data").textContent, /Escolha outro horário/);
        assert.equal(app.elemento("nome").value, "Cliente fictício");
        assert.equal(app.horario("09:00"), undefined);
        assert(app.horario("10:00"));
        await app.confirmar();
        assert.equal(app.envios.length, 1);
});

test("callback atrasado do widget descartado não autoriza nova confirmação", async () => {
    const app = await carregarAplicacao(`${hoje}T08:00:00-03:00`);
    await app.prepararData(hoje);
    app.horario("09:00").disparar("click");
    await Promise.resolve();
    app.voltar();
    app.horario("09:00").disparar("click");
    await Promise.resolve();
    app.widgets.at(-1)["expired-callback"]();
    app.widgets[0].callback("token obsoleto");
    await app.confirmar();
    assert.equal(app.envios.length, 0);
    assert.match(app.elemento("aviso-turnstile").textContent, /expirou/);
});

test("relógio IANA preserva horários únicos e rejeita os inexistentes e repetidos", async () => {
    const app = await carregarAplicacao("2026-11-01T03:59:00Z", { fuso: "America/New_York" });
    assert.equal(app.dia(), "2026-10-31");
    assert.equal(app.instante("2026-03-08", "02:30"), null);
    assert.equal(app.instante("2026-11-01", "01:30"), null);
    assert.equal(app.instante("2026-11-01", "02:30"), Date.parse("2026-11-01T07:30:00Z"));
    app.responderHorarios(() => ({ data: { total: 2, horarios: ["01:30", "02:30"] } }));
    await app.prepararData("2026-11-01");
    assert.equal(app.horario("01:30"), undefined);
    assert(app.horario("02:30"));
});

test("relógio IANA rejeita repetição de meia hora", async () => {
    const app = await carregarAplicacao("2026-04-04T06:00:00Z", { fuso: "Australia/Lord_Howe" });
    assert.equal(app.instante("2026-04-05", "01:45"), null);
    assert.equal(app.instante("2026-04-05", "02:00"), Date.parse("2026-04-04T15:30:00Z"));
});

test("fuso inválido impede a consulta e mantém a agenda indisponível", async () => {
    const app = await carregarAplicacao("2026-11-18T03:59:00Z", { fuso: "Loja/Ficticia" });
    await app.prepararData(hoje);
    assert.equal(app.consultas.length, 0);
    assert.match(app.elemento("aviso-data").textContent, /fuso horário/);
    assert.equal(app.horario("09:00"), undefined);
});
