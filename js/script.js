const cardsServico = document.querySelectorAll(".card-servico");
const servicosDaInstalacao = new Map([...cardsServico].map(card => [
    card.dataset.servico, card.querySelector("h3").textContent
]));
const servicos = document.getElementById("servicos");
const agendamento = document.getElementById("agendamento");
const avisoData = document.getElementById("aviso-data");
const btnRecarregarDisponibilidade = document.getElementById("btn-recarregar-disponibilidade");
const diasCliente = document.getElementById("dias-cliente");
const areaHorarios = document.getElementById("area-horarios");
const horariosCliente = document.getElementById("horarios-cliente");
const barbeirosSection = document.getElementById("barbeiros");
const listaBarbeiros = document.getElementById("lista-barbeiros");
const dadosCliente = document.getElementById("dados-cliente");
const formAgendamento = document.getElementById("form-agendamento");
const quadroTurnstile = document.getElementById("turnstile-reserva");
const avisoTurnstile = document.getElementById("aviso-turnstile");
const btnRenovarTurnstile = document.getElementById("btn-renovar-turnstile");
const btnEncerrarTentativa = document.getElementById("btn-encerrar-tentativa");
const introducaoAgendamento = document.getElementById("introducao-agendamento");
const etapasAgendamento = [servicos, barbeirosSection, agendamento, dadosCliente];
const indicadoresEtapa = document.querySelectorAll(".booking-steps li");
const btnEtapaAnterior = document.getElementById("btn-etapa-anterior");
const btnNovaReserva = document.getElementById("btn-nova-reserva");
const avisoHorarios = document.getElementById("aviso-horarios");
const avisoConfirmacao = document.getElementById("aviso-confirmacao");
const nomeCliente = document.getElementById("nome");
const whatsappCliente = document.getElementById("whatsapp");
const btnAdmin = document.getElementById("btn-admin");
const areaCliente = document.getElementById("area-cliente");
const areaLogin = document.getElementById("area-login");
const areaAdmin = document.getElementById("area-admin");
const adminSaudacao = document.getElementById("admin-saudacao");
const formLogin = document.getElementById("form-login");
const erroLogin = document.getElementById("erro-login");
const btnVoltar = document.getElementById("btn-voltar");
const statusLoginAdmin = document.getElementById("status-login-admin");
const botoesSecaoAdmin = document.querySelectorAll("[data-secao-admin]");
const secoesAdmin = document.querySelectorAll(".admin-secao");
const filtroProfissionalAdmin = document.getElementById("filtro-profissional-admin");
const profissionalAdmin = document.getElementById("profissional-admin");
const listaAtendimentosHoje = document.getElementById("lista-atendimentos-hoje");
const agendaAdminData = document.getElementById("agenda-admin-data");
const cartoesAgendamentos = document.getElementById("cartoes-agendamentos");
const tituloEditarAgendamento = document.getElementById("titulo-editar-agendamento");
const camposEdicao = document.getElementById("campos-edicao-agendamento");
const statusPainel = {
    agendamentos: document.getElementById("status-agendamentos-admin"),
    edicao: document.getElementById("status-edicao-admin"),
    dias: document.getElementById("status-dias-admin"),
    horarios: document.getElementById("status-horarios-admin"),
    bloqueios: document.getElementById("status-bloqueios-admin")
};
const AGENDAMENTO_CAMPOS = "id::text, nome, whatsapp, data, horario, barbeiro_id, barbeiro_nome, servico, preco";
const OPERACAO_SEM_LINHA = new Error("Nenhuma linha afetada.");
const formatoFusoBarbearia = (() => {
    try {
        if (typeof FUSO_BARBEARIA !== "string" || !FUSO_BARBEARIA.trim()) return null;
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: FUSO_BARBEARIA, calendar: "iso8601", numberingSystem: "latn",
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", hourCycle: "h23"
        });
    } catch {
        return null;
    }
})();
const deslocamentosPorDia = new Map();

const totalAgendamentos = document.getElementById("total-agendamentos");
const agendamentosHoje = document.getElementById("agendamentos-hoje");
const proximoHorario = document.getElementById("proximo-horario");
const filtroMesFaturamento = document.getElementById("filtro-mes-faturamento");
const faturamentoMes = document.getElementById("faturamento-mes");
const atendimentosMes = document.getElementById("atendimentos-mes");
const ticketMedio = document.getElementById("ticket-medio");
const faturamentoServicos = document.getElementById("faturamento-servicos");
const checkboxesDia = document.querySelectorAll(".checkbox-dia");
const formHorario = document.getElementById("form-horario");
const novoHorario = document.getElementById("novo-horario");
const listaHorariosAdmin = document.getElementById("lista-horarios-admin");
const disponibilidadeLeitura = document.getElementById("disponibilidade-leitura");
const listaProximosAtendimentos = document.getElementById("lista-proximos-atendimentos");
const formDataBloqueada = document.getElementById("form-data-bloqueada");
const novaDataBloqueada = document.getElementById("nova-data-bloqueada");
const listaDatasBloqueadas = document.getElementById("lista-datas-bloqueadas");
const tabelaAgendamentos = document.getElementById("tabela-agendamentos");
const mensagemAgendamentos = document.getElementById("mensagem-agendamentos");
const buscaAgendamento = document.getElementById("busca-agendamento");
const filtroData = document.getElementById("filtro-data");
const btnLimparFiltros = document.getElementById("btn-limpar-filtros");
const btnExportarCsv = document.getElementById("btn-exportar-csv");
const btnRecarregarAgendamentos = document.getElementById("btn-recarregar-agendamentos");

const formEditar = document.getElementById("form-editar");
const editarIndex = document.getElementById("editar-index");
const editarNome = document.getElementById("editar-nome");
const editarWhatsapp = document.getElementById("editar-whatsapp");
const editarServico = document.getElementById("editar-servico");
const editarData = document.getElementById("editar-data");
const editarHorario = document.getElementById("editar-horario");
const btnCancelarEdicao = document.getElementById("btn-cancelar-edicao");

const NOMES_DIAS = {
    0: "Domingo",
    1: "Segunda",
    2: "Terca",
    3: "Quarta",
    4: "Quinta",
    5: "Sexta",
    6: "Sabado"
};

let disponibilidadePublica = null;
let estadoDisponibilidade = "carregando";
let consultaDisponibilidade = 0;
let consultaHorarios = null;
let etapaAgendamento = servicos;
let reserva = {};
let reservaConfirmada = false;
let enviandoReserva = false;
let mensagemReserva = "";
let tentativaReserva = null;
let desafioReserva = null;
let scriptTurnstile = null;
let mensagemConfirmacao = "";
let aguardarReservaAte = 0;
let agendamentosPrivados = [];
let diasDisponiveisCache = {};
let horariosDisponiveisCache = [];
let datasBloqueadasCache = [];
let barbeirosCache = [];
let sessaoAuth = null;
let tentativaLogin = null;
let sessaoPainel = null;
let encerrandoSessao = false;
let secaoAdmin = "painel-agenda";
let relogioPainel = null;

for (const chave of ["agendamentos", "barbeiro_nome", "servico", "preco", "barbeiro_id", "data", "horario"]) {
    localStorage.removeItem(chave);
}

function normalizarAgendamento(agendamentoItem) {
    return {
        ...agendamentoItem,
        horario: agendamentoItem.horario ? agendamentoItem.horario.slice(0, 5) : agendamentoItem.horario
    };
}

function mensagemErroSupabase(erro) {
    return [
        erro.message,
        erro.details,
        erro.hint,
        erro.code ? `Codigo: ${erro.code}` : ""
    ].filter(Boolean).join("\n");
}

function normalizarWhatsapp(valor) {
    const texto = valor.trim();
    if (texto.length > 64 || !/^\+?[0-9(). -]+$/.test(texto)) return null;
    const numero = texto.replace(/[(). -]/g, "");
    return /^\+?\d{10,15}$/.test(numero) ? numero : null;
}

function idBarbeiroValido(id) {
    if (typeof id === "number") return Number.isSafeInteger(id) && id > 0;
    return typeof id === "string" && (
        /^[1-9]\d*$/.test(id) ||
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
    );
}

async function consultarPaginas(tabela, campos, ordem, atual, filtrar = consulta => consulta, sinal) {
    const itens = [];
    const chaves = new Set();
    let total;
    do {
        if (!atual()) throw new Error("Consulta cancelada.");
        let consulta = filtrar(supabaseClient.from(tabela).select(campos, { count: "exact" }));
        for (const coluna of ordem) consulta = consulta.order(coluna);
        if (sinal) consulta = consulta.abortSignal(sinal);
        const { data, count, error } = await consulta.range(itens.length, itens.length + 199);
        if (!atual()) throw new Error("Consulta cancelada.");
        if (error) throw error;
        total ??= count;
        if (!Array.isArray(data) || !Number.isSafeInteger(total) || total < 0 || count !== total ||
            itens.length + data.length > total || (!data.length && itens.length < total)) {
            throw new Error("Consulta incompleta.");
        }
        for (const linha of data) {
            const chave = JSON.stringify(ordem.map(coluna => linha[coluna]));
            if (chaves.has(chave)) throw new Error("Consulta mudou durante o carregamento.");
            chaves.add(chave);
            itens.push(linha);
        }
    } while (itens.length < total);
    return itens;
}

async function consultarConfiguracaoAgenda(atual, sinal) {
    const [dias, bloqueios, barbeiros] = await Promise.all([
        consultarPaginas("dias_disponiveis", "dia_semana, ativo", ["dia_semana"], atual, undefined, sinal),
        consultarPaginas("datas_bloqueadas", "data", ["data"], atual, undefined, sinal),
        consultarPaginas("barbeiros", "id, nome", ["nome", "id"], atual, consulta => consulta.eq("ativo", true), sinal)
    ]);

    return {
        dias: Object.fromEntries(dias.map(item => [item.dia_semana, item.ativo])),
        datasBloqueadas: bloqueios.map(item => item.data),
        barbeiros: barbeiros.filter(item => idBarbeiroValido(item.id))
    };
}

async function carregarDisponibilidadePublica() {
    if (enviandoReserva || tentativaReserva?.incerta) return;
    if (!formatoFusoBarbearia) {
        estadoDisponibilidade = "configuracao";
        renderizarEtapaAgendamento();
        return;
    }

    const consulta = ++consultaDisponibilidade;
    const dia = dataAtualISO();
    const atual = () => consulta === consultaDisponibilidade;
    const etapaAnterior = etapaAgendamento;
    consultaHorarios = null;
    if (!reservaConfirmada) {
        reserva.horario = null;
        if (etapaAgendamento === dadosCliente) etapaAgendamento = agendamento;
    }
    disponibilidadePublica = null;
    estadoDisponibilidade = "carregando";
    renderizarEtapaAgendamento(etapaAnterior !== etapaAgendamento);

    try {
        const configuracao = await consultarConfiguracaoAgenda(atual);
        if (!atual()) return;
        if (dia !== dataAtualISO()) return carregarDisponibilidadePublica();

        disponibilidadePublica = { dia, ...configuracao };
        estadoDisponibilidade = "disponivel";
    } catch {
        if (!atual()) return;
        ++consultaDisponibilidade;
        estadoDisponibilidade = "erro";
    }

    const etapaEmConsulta = etapaAgendamento;
    if (disponibilidadePublica && !reservaConfirmada) {
        if (reserva.barbeiroId && !barbeiroSelecionado()) {
            reserva.barbeiroId = null;
            reserva.data = null;
            if (etapaAgendamento === agendamento) etapaAgendamento = barbeirosSection;
        }
        if (!dataDisponivel(reserva.data)) reserva.data = null;
    }
    renderizarEtapaAgendamento(etapaEmConsulta !== etapaAgendamento);
    if (etapaAgendamento === agendamento && dataDisponivel(reserva.data)) {
        await carregarHorariosElegiveis();
    }
}

async function consultarAgendamentosPrivados(sessao, atual) {
    if (sessao.tipo !== "admin" && (
        sessao.tipo !== "barbeiro" || !idBarbeiroValido(sessao.barbeiroId)
    )) throw new Error("Escopo de leitura inválido.");

    const dados = await consultarPaginas("agendamentos", AGENDAMENTO_CAMPOS, ["data", "horario", "id"], atual,
        consulta => sessao.tipo === "barbeiro" ? consulta.eq("barbeiro_id", sessao.barbeiroId) : consulta,
        sessao.controlador.signal);
    return dados.map(normalizarAgendamento);
}

async function consultarDadosPainel(sessao, atual) {
    const sinal = sessao.controlador.signal;
    const [agendamentos, configuracao, horarios] = await Promise.all([
        consultarAgendamentosPrivados(sessao, atual),
        consultarConfiguracaoAgenda(atual, sinal),
        consultarPaginas("horarios_disponiveis", "horario, ativo", ["horario"], atual, undefined, sinal)
    ]);
    configuracao.horarios = horarios.map(({ horario, ativo }) => ({ horario: horario.slice(0, 5), ativo }));
    return { agendamentos, configuracao };
}

async function enviarPedidoReserva(pedido, chave, token) {
    const controlador = new AbortController();
    const prazo = setTimeout(() => controlador.abort(), 18000);
    try {
        // A reserva pública usa só a chave pública, inclusive com o painel autenticado em outra aba.
        const resposta = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/criar-reserva`, {
            method: "POST",
            headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY },
            body: JSON.stringify({ ...pedido, chave, token }),
            signal: controlador.signal
        });
        const dados = await resposta.json();
        if (resposta.status === 201 && dados?.resultado === "confirmada") return dados;
        if (resposta.status === 429 && dados?.resultado === "limitada" &&
            Number.isSafeInteger(dados.tentar_em) && dados.tentar_em > 0 && dados.tentar_em <= 86400) return dados;
        if ((resposta.status === 409 && ["conflito", "chave_incompativel"].includes(dados?.resultado)) ||
            (resposta.status === 400 && ["token_invalido", "invalida"].includes(dados?.resultado)) ||
            (resposta.status === 503 && dados?.resultado === "indisponivel")) return dados;
        if (resposta.status === 422 && dados?.resultado === "invalida") return { resultado: "revalidar" };
        if (resposta.status === 403 && dados?.resultado === "origem_invalida") return { resultado: "indisponivel" };
    } catch {
        // Uma resposta perdida pode ocorrer depois do commit.
    } finally {
        clearTimeout(prazo);
    }
    return { resultado: "indeterminada" };
}

async function executarEscritaPainel(sessao, consultar) {
    if (!sessaoPainelAtiva(sessao)) return false;

    const estado = await verificarSessaoAuth(sessao.auth);
    if (!sessaoPainelAtiva(sessao)) return false;
    if (estado === "falha") throw new Error("Não foi possível verificar a sessão.");
    if (estado !== "atual") {
        pedirNovoLogin();
        return false;
    }

    let resposta;
    try {
        resposta = await consultar().abortSignal(sessao.controlador.signal);
    } catch (erro) {
        if (!sessaoPainelAtiva(sessao)) return false;
        throw erro;
    }
    if (!sessaoPainelAtiva(sessao)) return false;
    if (resposta.error) throw { code: resposta.error.code, status: resposta.status };
    return resposta;
}

function confirmarLinhaEscrita(resposta, campo, esperado) {
    const dados = resposta.data;
    if (!Array.isArray(dados)) throw new Error("Resposta inesperada da operação.");
    if (dados.length === 0) throw OPERACAO_SEM_LINHA;
    const linha = dados[0];
    const valor = campo === "horario" ? linha?.horario?.slice(0, 5) : linha?.[campo];
    if (dados.length !== 1 || String(valor) !== String(esperado)) {
        throw new Error("Resposta inesperada da operação.");
    }
    return linha;
}

async function atualizarAgendamentoSupabase(sessao, id, agendamentoAtualizado) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("agendamentos")
        .update(agendamentoAtualizado)
        .eq("id", id)
        .select(AGENDAMENTO_CAMPOS));

    if (!resposta || !sessaoPainelAtiva(sessao)) return false;
    const linha = confirmarLinhaEscrita(resposta, "id", id);
    agendamentosPrivados = agendamentosPrivados.map(item => {
        return item.id === id ? normalizarAgendamento(linha) : item;
    });
    return true;
}

async function excluirAgendamentoSupabase(sessao, id) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("agendamentos")
        .delete()
        .eq("id", id)
        .select("id::text"));

    if (!resposta || !sessaoPainelAtiva(sessao)) return false;
    confirmarLinhaEscrita(resposta, "id", id);
    agendamentosPrivados = agendamentosPrivados.filter(item => item.id !== id);
    return true;
}

async function salvarDiaDisponivelSupabase(sessao, diaSemana, ativo) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("dias_disponiveis")
        .upsert([{ dia_semana: Number(diaSemana), ativo }], { onConflict: "dia_semana" })
        .select("dia_semana, ativo"));

    if (!resposta || !sessaoPainelAtiva(sessao)) return false;
    diasDisponiveisCache[diaSemana] = confirmarLinhaEscrita(resposta, "dia_semana", diaSemana).ativo;
    return true;
}

async function salvarHorarioDisponivelSupabase(sessao, horario, ativo) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("horarios_disponiveis")
        .upsert([{ horario, ativo }], { onConflict: "horario" })
        .select("horario, ativo"));

    if (!resposta || !sessaoPainelAtiva(sessao)) return false;
    const linha = confirmarLinhaEscrita(resposta, "horario", horario);
    horariosDisponiveisCache = [
        ...horariosDisponiveisCache.filter(item => item.horario !== horario),
        { horario, ativo: linha.ativo }
    ];
    return true;
}

async function removerHorarioSupabase(sessao, horario) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("horarios_disponiveis")
        .delete()
        .eq("horario", horario)
        .select("horario"));

    if (!resposta || !sessaoPainelAtiva(sessao)) return false;
    confirmarLinhaEscrita(resposta, "horario", horario);
    horariosDisponiveisCache = horariosDisponiveisCache.filter(item => item.horario !== horario);
    return true;
}

async function salvarDataBloqueadaSupabase(sessao, data) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("datas_bloqueadas")
        .insert([{ data }])
        .select("data"));

    if (!resposta || !sessaoPainelAtiva(sessao)) return false;
    confirmarLinhaEscrita(resposta, "data", data);
    datasBloqueadasCache = [...datasBloqueadasCache, data].sort();
    return true;
}

async function removerDataBloqueadaSupabase(sessao, data) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("datas_bloqueadas")
        .delete()
        .eq("data", data)
        .select("data"));

    if (!resposta || !sessaoPainelAtiva(sessao)) return false;
    confirmarLinhaEscrita(resposta, "data", data);
    datasBloqueadasCache = datasBloqueadasCache.filter(item => item !== data);
    return true;
}

function dataHoraBarbearia(instante) {
    const partes = Object.fromEntries(formatoFusoBarbearia.formatToParts(instante)
        .map(({ type, value }) => [type, value]));
    return { data: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

function dataAtualISO(hoje = new Date()) {
    return dataHoraBarbearia(hoje).data;
}

function diaSemanaCalendario(data) {
    return new Date(`${data}T00:00:00Z`).getUTCDay();
}

function deslocamentosDoDia(data) {
    if (deslocamentosPorDia.has(data)) return deslocamentosPorDia.get(data);
    const meioDia = Date.parse(`${data}T12:00:00Z`);
    const offsets = new Set([-36, 0, 36].map(horas => {
        const instante = meioDia + horas * 3_600_000;
        const local = dataHoraBarbearia(new Date(instante));
        return Date.parse(`${local.data}T${local.hora}:00Z`) - instante;
    }));
    if (deslocamentosPorDia.size >= 32) deslocamentosPorDia.delete(deslocamentosPorDia.keys().next().value);
    deslocamentosPorDia.set(data, offsets);
    return offsets;
}

function instanteDoHorario(data, horario) {
    const civil = Date.parse(`${data}T${horario}:00Z`);
    if (!Number.isFinite(civil)) return null;
    let instanteValido = null;
    for (const offset of deslocamentosDoDia(data)) {
        const candidato = civil - offset;
        const local = dataHoraBarbearia(new Date(candidato));
        if (local.data === data && local.hora === horario) {
            // Dois instantes para o mesmo horário civil indicam ambiguidade.
            if (instanteValido !== null) return null;
            instanteValido = candidato;
        }
    }
    return instanteValido;
}

function atualizarSaudacao() {
    if (!adminSaudacao) return;

    let texto = "Bem-vindo ao painel.";

    if (sessaoPainel?.tipo === "admin") {
        texto = "Bem-vindo, administrador.";
    } else if (sessaoPainel?.tipo === "barbeiro") {
        const barbeiro = barbeirosCache.find(item => String(item.id) === String(sessaoPainel.barbeiroId));
        if (barbeiro?.nome) {
            texto = `Olá, ${barbeiro.nome}`;
        } else {
            texto = "Olá, barbeiro";
        }
    }

    adminSaudacao.textContent = texto;
}

function formatarData(data) {
    if (!data) return "-";

    const partes = data.split("-");
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function mesAtualISO() {
    return dataAtualISO().slice(0, 7);
}

function formatarMoeda(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function precoParaNumero(preco) {
    if (typeof preco === "number") return preco;
    if (!preco) return 0;

    return Number(
        String(preco)
            .replace("R$", "")
            .replace(/\./g, "")
            .replace(",", ".")
            .trim()
    ) || 0;
}

function ordenarHorarios(horarios) {
    return horarios.sort((a, b) => a.horario.localeCompare(b.horario));
}

function proximaDataDoDia(diaSemana) {
    const data = new Date(`${dataAtualISO()}T00:00:00Z`);
    const diferenca = (Number(diaSemana) - data.getUTCDay() + 7) % 7;
    data.setUTCDate(data.getUTCDate() + diferenca);
    return data.toISOString().slice(0, 10);
}



function marcarOpcaoSelecionada(botao, selecionada) {
    botao.classList.toggle("selecionado", selecionada);
    botao.setAttribute("aria-pressed", String(selecionada));
}

function mudarEtapaAgendamento(etapa) {
    if (enviandoReserva || tentativaReserva?.incerta) return;
    if (etapaAgendamento === dadosCliente && etapa !== dadosCliente) {
        limparDesafioReserva();
        mensagemConfirmacao = "";
    }
    etapaAgendamento = etapa;
    renderizarEtapaAgendamento(true);
}

function renderizarEtapaAgendamento(focarTitulo = false) {
    const indice = etapasAgendamento.indexOf(etapaAgendamento);
    introducaoAgendamento.hidden = etapaAgendamento !== servicos;
    etapasAgendamento.forEach(etapa => { etapa.hidden = etapa !== etapaAgendamento; });
    indicadoresEtapa.forEach((indicador, i) => {
        if (i === indice) indicador.setAttribute("aria-current", "step");
        else indicador.removeAttribute("aria-current");
        indicador.classList.toggle("etapa-concluida", i < indice);
    });

    btnEtapaAnterior.hidden = indice === 0 || reservaConfirmada;
    btnEtapaAnterior.disabled = enviandoReserva || Boolean(tentativaReserva?.incerta);
    btnAdmin.disabled = btnEtapaAnterior.disabled;

    renderizarStatusDisponibilidade();

    if (etapaAgendamento === servicos) {
        cardsServico.forEach(card => marcarOpcaoSelecionada(card, card.dataset.servico === reserva.servico?.nome));
    } else if (etapaAgendamento === barbeirosSection) {
        renderizarBarbeirosCliente();
    } else if (etapaAgendamento === agendamento) {
        if (disponibilidadePublica && !dataDisponivel(reserva.data)) {
            reserva.data = null;
            reserva.horario = null;
        }
        renderizarDiasCliente();
        renderizarHorariosCliente();
    } else {
        renderizarConfirmacao();
    }

    if (focarTitulo && areaCliente.style.display !== "none") {
        etapaAgendamento.querySelector(".titulo-etapa").focus();
    }
}

function renderizarStatusDisponibilidade() {
    const consultaVisivel = etapaAgendamento === barbeirosSection || etapaAgendamento === agendamento;
    const erroHorarios = etapaAgendamento === agendamento && consultaDaSelecao()?.estado === "erro";
    btnRecarregarDisponibilidade.hidden = !consultaVisivel || (estadoDisponibilidade !== "erro" && !erroHorarios);
    avisoData.textContent = consultaVisivel ? mensagemDisponibilidade() : "";
}

function mensagemDisponibilidade() {
    let mensagem = "";
    if (estadoDisponibilidade === "carregando") {
        mensagem = "Carregando disponibilidade…";
    } else if (estadoDisponibilidade === "erro") {
        mensagem = "Não foi possível carregar a disponibilidade.";
    } else if (estadoDisponibilidade === "configuracao") {
        mensagem = "O fuso horário da barbearia precisa ser configurado.";
    } else if (etapaAgendamento === barbeirosSection && disponibilidadePublica?.barbeiros.length === 0) {
        mensagem = "Nenhum profissional disponível no momento.";
    }

    return [mensagemReserva, mensagem].filter(Boolean).join(" ");
}

cardsServico.forEach(card => {
    card.addEventListener("click", () => {
        if (enviandoReserva || etapaAgendamento !== servicos) return;

        const { servico: nome, preco } = card.dataset;
        if (reserva.servico?.nome !== nome) {
            consultaHorarios = null;
            reserva = { servico: { nome, preco, rotulo: card.querySelector("h3").textContent } };
            mensagemReserva = "";
        }
        mudarEtapaAgendamento(barbeirosSection);
    });
});

function barbeiroSelecionado() {
    return disponibilidadePublica?.barbeiros.find(item => String(item.id) === reserva.barbeiroId);
}

function renderizarBarbeirosCliente() {
    listaBarbeiros.replaceChildren();
    disponibilidadePublica?.barbeiros.forEach(item => {
        const id = String(item.id);
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "card-barbeiro";
        botao.textContent = item.nome;
        marcarOpcaoSelecionada(botao, id === reserva.barbeiroId);

        botao.addEventListener("click", () => {
            if (enviandoReserva || etapaAgendamento !== barbeirosSection ||
                !disponibilidadePublica?.barbeiros.includes(item)) return;
            if (reserva.barbeiroId !== id) {
                consultaHorarios = null;
                reserva.barbeiroId = id;
                reserva.data = null;
                reserva.horario = null;
                mensagemReserva = "";
            }
            mudarEtapaAgendamento(agendamento);
        });
        listaBarbeiros.appendChild(botao);
    });
}

function dataDisponivel(data) {
    if (!disponibilidadePublica || !data || disponibilidadePublica.dia !== dataAtualISO()) return false;
    const limite = new Date(`${disponibilidadePublica.dia}T00:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() + 6);
    if (data < disponibilidadePublica.dia || data > limite.toISOString().slice(0, 10)) return false;
    const diaSemana = diaSemanaCalendario(data);
    return Boolean(disponibilidadePublica.dias[diaSemana]) && !disponibilidadePublica.datasBloqueadas.includes(data);
}

function consultaDaSelecao() {
    if (!consultaHorarios || consultaHorarios.servico !== reserva.servico?.nome ||
        consultaHorarios.barbeiroId !== reserva.barbeiroId || consultaHorarios.data !== reserva.data ||
        consultaHorarios.dia !== disponibilidadePublica?.dia || !dataDisponivel(reserva.data)) return null;
    return consultaHorarios;
}

async function carregarHorariosElegiveis() {
    if (enviandoReserva || !reserva.servico || !barbeiroSelecionado() || !dataDisponivel(reserva.data)) return false;
    const consulta = {
        servico: reserva.servico.nome, barbeiroId: reserva.barbeiroId, data: reserva.data,
        dia: disponibilidadePublica.dia, estado: "carregando", horarios: []
    };
    consultaHorarios = consulta;
    reserva.horario = null;
    renderizarStatusDisponibilidade();
    renderizarHorariosCliente();

    try {
        const { data, error } = await supabaseClient.rpc("horarios_elegiveis", {
            p_servico: consulta.servico, p_barbeiro_id: consulta.barbeiroId, p_data: consulta.data
        });
        if (consultaDaSelecao() !== consulta) return false;
        const horarios = data?.horarios;
        // O total acompanha a lista escalar para rejeitar respostas incompletas ou fora do contrato.
        if (error || !Array.isArray(horarios) || data.total !== horarios.length || horarios.length > 1440 ||
            horarios.some((hora, i) => typeof hora !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ||
                (i > 0 && hora <= horarios[i - 1]))) {
            throw new Error("Consulta de horários incompleta.");
        }
        consulta.horarios = horarios;
        consulta.estado = "disponivel";
    } catch {
        if (consultaDaSelecao() !== consulta) return false;
        consulta.estado = "erro";
    }

    renderizarStatusDisponibilidade();
    if (etapaAgendamento === agendamento) renderizarHorariosCliente();
    return consulta.estado === "disponivel";
}

function horarioFuturo(data, horario, agora = new Date()) {
    const instante = instanteDoHorario(data, horario);
    return instante !== null && instante > agora.getTime();
}

function horarioDisponivel(horario) {
    return Boolean(consultaDaSelecao()?.horarios.includes(horario)) && horarioFuturo(reserva.data, horario);
}

function renderizarDiasCliente() {
    diasCliente.replaceChildren();
    if (!disponibilidadePublica) return;

    const datas = Object.keys(NOMES_DIAS)
        .map(dia => ({ dia, data: proximaDataDoDia(dia) }))
        .sort((a, b) => a.data.localeCompare(b.data));

    datas.forEach(({ dia, data }) => {
        const disponivel = dataDisponivel(data);
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "card-dia";
        botao.disabled = !disponivel;
        botao.classList.toggle("indisponivel", !disponivel);
        marcarOpcaoSelecionada(botao, data === reserva.data);

        const nomeDia = document.createElement("strong");
        const dataFormatada = document.createElement("span");
        nomeDia.textContent = NOMES_DIAS[dia];
        dataFormatada.textContent = formatarData(data);
        botao.append(nomeDia, dataFormatada);
        if (!disponivel) {
            const status = document.createElement("small");
            status.textContent = disponibilidadePublica.datasBloqueadas.includes(data) ? "Bloqueado" : "Indisponível";
            botao.append(status);
        }

        botao.addEventListener("click", async evento => {
            if (enviandoReserva || etapaAgendamento !== agendamento || !dataDisponivel(data)) return;
            if (reserva.data !== data) {
                consultaHorarios = null;
                reserva.data = data;
                reserva.horario = null;
                mensagemReserva = "";
            }
            for (const card of diasCliente.children) marcarOpcaoSelecionada(card, card === botao);
            const consulta = consultaDaSelecao();
            if ((!consulta || consulta.estado === "erro") && !await carregarHorariosElegiveis()) return;
            if (etapaAgendamento === agendamento && !areaHorarios.hidden &&
                evento.detail > 0 && matchMedia("(pointer: coarse)").matches) {
                areaHorarios.querySelector("h3").scrollIntoView({ block: "start" });
            }
        });
        diasCliente.appendChild(botao);
    });
}

function renderizarHorariosCliente() {
    horariosCliente.replaceChildren();
    areaHorarios.hidden = true;
    avisoHorarios.textContent = "";
    if (!disponibilidadePublica) return;
    if (![...diasCliente.children].some(botao => !botao.disabled)) {
        avisoHorarios.textContent = "Nenhuma data disponível no momento.";
        return;
    }

    const data = reserva.data;
    if (!dataDisponivel(data) || !barbeiroSelecionado()) return;

    const consulta = consultaDaSelecao();
    if (!consulta) return;
    if (consulta.estado === "carregando") {
        avisoHorarios.textContent = "Carregando horários…";
        return;
    }
    if (consulta.estado === "erro") {
        avisoHorarios.textContent = "Não foi possível carregar os horários. Tente novamente.";
        return;
    }
    const agora = new Date();
    const horarios = consulta.horarios.filter(horario => horarioFuturo(data, horario, agora));
    if (horarios.length === 0) {
        avisoHorarios.textContent = "Nenhum horário disponível nessa data. Escolha outra data.";
        return;
    }

    areaHorarios.hidden = false;

    horarios.forEach(horario => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "card-horario";
        botao.textContent = horario;
        marcarOpcaoSelecionada(botao, horario === reserva.horario);

        botao.addEventListener("click", () => {
            if (enviandoReserva || etapaAgendamento !== agendamento || consultaDaSelecao() !== consulta) return;
            if (!horarioDisponivel(horario)) {
                renderizarHorariosCliente();
                return;
            }
            reserva.horario = horario;
            mensagemReserva = "";
            mudarEtapaAgendamento(dadosCliente);
        });
        horariosCliente.appendChild(botao);
    });
}

function carregarScriptTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (!scriptTurnstile) {
        scriptTurnstile = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            const falhou = () => {
                clearTimeout(prazo);
                script.remove();
                reject(new Error("Verificação indisponível."));
            };
            const prazo = setTimeout(falhou, 12000);
            script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            script.async = true;
            script.onload = () => {
                if (!window.turnstile) return falhou();
                clearTimeout(prazo);
                resolve(window.turnstile);
            };
            script.onerror = falhou;
            document.head.append(script);
        }).catch(erro => {
            scriptTurnstile = null;
            throw erro;
        });
    }
    return scriptTurnstile;
}

function limparDesafioReserva() {
    const anterior = desafioReserva;
    desafioReserva = null;
    if (anterior?.widget != null) {
        try {
            anterior.api.remove(anterior.widget);
        } catch {
            // O estado local já foi descartado, mesmo se o widget não responder.
        }
    }
    quadroTurnstile.replaceChildren();
}

function atualizarDesafioReserva() {
    const estado = desafioReserva?.estado;
    avisoTurnstile.textContent = {
        carregando: "Carregando verificação…",
        pendente: "Conclua a verificação para confirmar.",
        expirado: "A verificação expirou. Refaça a verificação.",
        erro: "Verificação indisponível. Tente novamente ou abra a página no navegador.",
        configuracao: "A verificação da reserva ainda não foi configurada."
    }[estado] || "";
    btnRenovarTurnstile.hidden = !["expirado", "erro"].includes(estado);
    formAgendamento.querySelector('button[type="submit"]').disabled = enviandoReserva || !desafioReserva?.token;
}

async function prepararDesafioReserva() {
    if (desafioReserva || enviandoReserva || reservaConfirmada || etapaAgendamento !== dadosCliente) return;
    const desafio = { estado: "carregando", token: null };
    desafioReserva = desafio;
    if (typeof TURNSTILE_SITE_KEY !== "string" || !TURNSTILE_SITE_KEY) {
        desafio.estado = "configuracao";
        atualizarDesafioReserva();
        return;
    }
    atualizarDesafioReserva();
    const atualizar = (estado, token = null) => {
        if (desafioReserva !== desafio || etapaAgendamento !== dadosCliente) return;
        desafio.estado = estado;
        desafio.token = token;
        atualizarDesafioReserva();
    };
    try {
        const api = await carregarScriptTurnstile();
        if (desafioReserva !== desafio || etapaAgendamento !== dadosCliente) return;
        desafio.api = api;
        atualizar("pendente");
        desafio.widget = api.render(quadroTurnstile, {
            sitekey: TURNSTILE_SITE_KEY,
            action: "criar_reserva",
            size: "compact",
            theme: "dark",
            "response-field": false,
            "refresh-expired": "manual",
            callback: token => atualizar("pronto", token),
            "expired-callback": () => atualizar("expirado"),
            "timeout-callback": () => atualizar("expirado"),
            "error-callback": () => atualizar("erro")
        });
    } catch {
        atualizar("erro");
    }
}

btnRenovarTurnstile.addEventListener("click", () => {
    if (enviandoReserva || etapaAgendamento !== dadosCliente) return;
    limparDesafioReserva();
    prepararDesafioReserva();
});

function renderizarConfirmacao() {
    const { servico, data, horario, nomeProfissional } = reserva;
    dadosCliente.querySelector(".titulo-etapa").textContent = reservaConfirmada ? "Agendamento confirmado" : "Confirme a reserva";
    document.getElementById("resumo-servico").textContent = servico.rotulo;
    document.getElementById("resumo-preco").textContent = servico.preco;
    document.getElementById("resumo-profissional").textContent = nomeProfissional ?? barbeiroSelecionado()?.nome ?? "";
    document.getElementById("resumo-data-horario").textContent = `${formatarData(data)} às ${horario}`;
    formAgendamento.hidden = reservaConfirmada;
    formAgendamento.querySelector("fieldset").disabled = enviandoReserva;
    nomeCliente.readOnly = whatsappCliente.readOnly = Boolean(tentativaReserva?.incerta);
    btnEncerrarTentativa.hidden = !tentativaReserva?.incerta || enviandoReserva;
    btnNovaReserva.hidden = !reservaConfirmada;
    avisoConfirmacao.textContent = enviandoReserva ? "Confirmando sua reserva…" : mensagemConfirmacao;
    if (!reservaConfirmada) prepararDesafioReserva();
}

btnEtapaAnterior.addEventListener("click", () => {
    const indice = etapasAgendamento.indexOf(etapaAgendamento);
    if (indice > 0 && !reservaConfirmada) mudarEtapaAgendamento(etapasAgendamento[indice - 1]);
});

btnNovaReserva.addEventListener("click", () => {
    if (!reservaConfirmada) return;
    consultaHorarios = null;
    reserva = {};
    reservaConfirmada = false;
    mensagemConfirmacao = "";
    mudarEtapaAgendamento(servicos);
});

btnEncerrarTentativa.addEventListener("click", () => {
    if (!tentativaReserva?.incerta || enviandoReserva ||
        !confirm("A reserva pode ter sido registrada. Confirme com a barbearia antes de fazer outra. Encerrar a tentativa?")) return;
    tentativaReserva = null;
    mensagemReserva = "Confirme com a barbearia se o pedido anterior foi registrado.";
    limparDesafioReserva();
    carregarDisponibilidadePublica();
});

btnRecarregarDisponibilidade.addEventListener("click", () => {
    if (btnRecarregarDisponibilidade.hidden || enviandoReserva) return;
    etapaAgendamento.querySelector(".titulo-etapa").focus();
    if (estadoDisponibilidade === "erro") carregarDisponibilidadePublica();
    else carregarHorariosElegiveis();
});

function atualizarDiaDisponibilidade() {
    if (!enviandoReserva && !tentativaReserva?.incerta && disponibilidadePublica && disponibilidadePublica.dia !== dataAtualISO()) {
        return carregarDisponibilidadePublica();
    }
}

formAgendamento.addEventListener("submit", async e => {
    e.preventDefault();
    if (enviandoReserva || reservaConfirmada || etapaAgendamento !== dadosCliente) return;
    const recarga = atualizarDiaDisponibilidade();
    if (recarga) {
        await recarga;
        return;
    }
    if (!formAgendamento.reportValidity()) return;
    const espera = Math.ceil((aguardarReservaAte - Date.now()) / 1000);
    if (espera > 0) {
        avisoConfirmacao.textContent = `Aguarde ${espera} s antes de tentar novamente.`;
        return;
    }

    const nome = nomeCliente.value.trim();
    const whatsapp = normalizarWhatsapp(whatsappCliente.value);
    if (!nome || !whatsapp) {
        avisoConfirmacao.textContent = nome ? "Informe um WhatsApp com 10 a 15 dígitos." : "Preencha seu nome.";
        (nome ? whatsappCliente : nomeCliente).focus();
        return;
    }

    const barbeiro = barbeiroSelecionado();
    if (!reserva.servico || (!tentativaReserva?.incerta && !horarioDisponivel(reserva.horario))) {
        reserva.horario = null;
        mensagemReserva = "O horário selecionado está indisponível. Escolha outro horário.";
        mudarEtapaAgendamento(barbeiro ? agendamento : barbeirosSection);
        return;
    }

    const { servico, data, horario, barbeiroId } = reserva;
    const agendamentoCliente = {
        servico: servico.nome,
        data,
        horario,
        nome,
        whatsapp,
        barbeiro_id: barbeiroId
    };

    const token = desafioReserva?.token;
    if (!token) {
        avisoConfirmacao.textContent = "Conclua a verificação antes de confirmar.";
        return;
    }
    const conteudo = JSON.stringify(agendamentoCliente);
    if (tentativaReserva?.incerta && (tentativaReserva.conteudo !== conteudo ||
        Date.now() - tentativaReserva.iniciadaEm >= 86_400_000)) {
        avisoConfirmacao.textContent = "Confirme o pedido anterior com a barbearia antes de fazer outro.";
        return;
    }
    if (tentativaReserva?.conteudo !== conteudo) {
        if (typeof globalThis.crypto?.randomUUID !== "function") {
            avisoConfirmacao.textContent = "Abra a página em um navegador atualizado para confirmar.";
            return;
        }
        tentativaReserva = { chave: crypto.randomUUID(), conteudo, iniciadaEm: Date.now(), incerta: false };
    }

    enviandoReserva = true;
    limparDesafioReserva();
    renderizarEtapaAgendamento();
    const { resultado, tentar_em } = await enviarPedidoReserva(agendamentoCliente, tentativaReserva.chave, token);
    enviandoReserva = false;
    if (resultado === "conflito" || resultado === "revalidar") {
        tentativaReserva = null;
        mensagemReserva = resultado === "conflito" ? "Não foi possível reservar esse horário. Escolha outro horário."
            : "Não foi possível gravar a reserva. Confira o serviço e escolha um horário disponível.";
        await carregarDisponibilidadePublica();
        return;
    }
    if (resultado !== "confirmada") {
        if (resultado === "indeterminada") tentativaReserva.incerta = true;
        if (resultado === "limitada") aguardarReservaAte = Date.now() + tentar_em * 1000;
        mensagemConfirmacao = tentativaReserva.incerta
            ? "A reserva pode ter sido registrada. Faça uma nova verificação e confirme o mesmo pedido ou consulte a barbearia."
            : ({
                limitada: `Aguarde ${tentar_em} s antes de tentar novamente.`,
                token_invalido: "A verificação venceu ou foi recusada. Verifique novamente.",
                indisponivel: "Não foi possível verificar a reserva agora. Tente novamente.",
                invalida: "Confira os dados e a disponibilidade antes de tentar novamente.",
                chave_incompativel: "Não foi possível recuperar este pedido."
            }[resultado] || "Não foi possível confirmar sua reserva.");
        if (resultado === "limitada" && tentativaReserva.incerta) mensagemConfirmacao += ` Aguarde ${tentar_em} s.`;
        if (!tentativaReserva.incerta && ["invalida", "chave_incompativel"].includes(resultado)) tentativaReserva = null;
        renderizarEtapaAgendamento();
        return;
    }

    tentativaReserva = null;
    mensagemConfirmacao = "";
    consultaHorarios = null;
    reserva.nomeProfissional = barbeiro?.nome;
    reservaConfirmada = true;
    formAgendamento.reset();
    renderizarEtapaAgendamento(true);
});

btnAdmin.addEventListener("click", () => {
    if (enviandoReserva || tentativaReserva?.incerta) return;
    limparDesafioReserva();
    areaCliente.style.display = "none";
    areaLogin.style.display = "block";
    areaAdmin.style.display = "none";
    erroLogin.textContent = "";
    statusLoginAdmin.textContent = "";
});

function identificarSessao(sessao) {
    if (!sessao?.user?.id || !sessao.access_token) return null;

    try {
        const payload = sessao.access_token.split(".")[1];
        const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        // A claim identifica a sessão durante a renovação do token. As RPCs verificam o perfil.
        if (claims.session_id) return `${sessao.user.id}:${claims.session_id}`;
    } catch {
        // Um token sem claim de sessão só identifica a sessão enquanto não for renovado.
    }
    return `${sessao.user.id}:${sessao.access_token}`;
}

function limparPainel() {
    sessaoPainel?.controlador.abort();
    sessaoPainel = null;
    clearTimeout(relogioPainel);
    relogioPainel = null;
    agendamentosPrivados = [];
    diasDisponiveisCache = {};
    horariosDisponiveisCache = [];
    datasBloqueadasCache = [];
    barbeirosCache = [];

    areaAdmin.style.display = "none";
    areaAdmin.removeAttribute("aria-busy");
    formEditar.style.display = "none";
    formEditar.reset();
    editarIndex.value = "";
    delete camposEdicao.dataset.operacao;
    buscaAgendamento.value = "";
    filtroData.value = "";
    profissionalAdmin.value = "";
    filtroMesFaturamento.value = "";
    novoHorario.value = "";
    novaDataBloqueada.value = "";
    Object.values(statusPainel).forEach(status => { status.textContent = ""; });
    mostrarSecaoAdmin("painel-agenda");
    carregarPainelAdmin();
    atualizarControlesPendentes();
    atualizarSaudacao();
}

function sessaoPainelAtiva(sessao) {
    return Boolean(sessao && sessaoPainel === sessao && sessaoAuth === sessao.auth);
}

async function verificarSessaoAuth(auth) {
    if (!auth || sessaoAuth !== auth) return "encerrada";

    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (sessaoAuth !== auth) return "encerrada";
        if (error) {
            return error.status === 401 || error.status === 403 || error.name === "AuthSessionMissingError"
                ? "encerrada" : "falha";
        }
        return identificarSessao(data?.session) === auth.chave ? "atual" : "encerrada";
    } catch {
        return "falha";
    }
}

async function confirmarSessaoAuth(auth) {
    return await verificarSessaoAuth(auth) === "atual";
}

function loginAtual(tentativa) {
    return tentativaLogin === tentativa && tentativa.auth && sessaoAuth === tentativa.auth;
}

function pedirNovoLogin() {
    tentativaLogin?.controlador?.abort();
    tentativaLogin = null;
    limparPainel();
    areaLogin.style.display = "block";
    statusLoginAdmin.textContent = "";
    erroLogin.textContent = "Sua sessão mudou. Entre novamente para acessar o painel.";
}

supabaseClient.auth.onAuthStateChange((evento, sessao) => {
    const chave = identificarSessao(sessao);
    const mudou = chave !== (sessaoAuth?.chave ?? null) || evento === "SIGNED_OUT";
    if (mudou) sessaoAuth = chave ? { chave } : null;

    if (tentativaLogin && !tentativaLogin.auth && evento === "SIGNED_IN" && sessaoAuth) {
        tentativaLogin.auth = sessaoAuth;
    } else if (tentativaLogin && mudou && (tentativaLogin.auth || evento !== "INITIAL_SESSION")) {
        pedirNovoLogin();
    }

    if (sessaoPainel && !sessaoPainelAtiva(sessaoPainel)) pedirNovoLogin();
});

formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    const botao = formLogin.querySelector('button[type="submit"]');
    if (botao.disabled || encerrandoSessao) return;
    if (!formatoFusoBarbearia) {
        erroLogin.textContent = "O fuso horário da barbearia precisa ser configurado.";
        return;
    }
    botao.disabled = true;
    erroLogin.textContent = "";
    statusLoginAdmin.textContent = "Entrando…";

    const tentativa = { auth: null };
    tentativaLogin = tentativa;

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: document.getElementById("usuario").value.trim(),
            password: document.getElementById("senha").value
        });

        if (tentativaLogin !== tentativa) return;
        if (error) {
            erroLogin.textContent = mensagemErroSupabase(error) || "E-mail ou senha incorretos.";
            return;
        }

        if (!loginAtual(tentativa) || identificarSessao(data?.session) !== tentativa.auth.chave ||
            !await confirmarSessaoAuth(tentativa.auth) || !loginAtual(tentativa)) {
            if (tentativaLogin === tentativa) pedirNovoLogin();
            return;
        }

        const [admResponse, barbeiroResponse] = await Promise.all([
            supabaseClient.rpc("eh_admin"),
            supabaseClient.rpc("eh_barbeiro")
        ]);
        if (!loginAtual(tentativa)) return;

        let erroAcesso = "";
        const tipo = admResponse.data ? "admin" : barbeiroResponse.data ? "barbeiro" : null;
        let barbeiroId = null;
        if (admResponse.error || barbeiroResponse.error) {
            erroAcesso = "Não foi possível verificar o tipo de usuário. Tente novamente.";
        } else if (!tipo) {
            erroAcesso = "Acesso restrito: apenas administradores ou barbeiros podem acessar este painel.";
        } else if (tipo === "barbeiro") {
            const { data: id, error: erroId } = await supabaseClient.rpc("barbeiro_atual_id");
            if (!loginAtual(tentativa)) return;
            if (erroId || !idBarbeiroValido(id)) {
                erroAcesso = "Não foi possível identificar o barbeiro. Contate o suporte.";
            }
            barbeiroId = id;
        }

        if (!await confirmarSessaoAuth(tentativa.auth) || !loginAtual(tentativa)) {
            if (tentativaLogin === tentativa) pedirNovoLogin();
            return;
        }
        if (erroAcesso) {
            await supabaseClient.auth.signOut();
            erroLogin.textContent = erroAcesso;
            return;
        }

        const sessao = {
            auth: tentativa.auth, tipo, barbeiroId,
            controlador: new AbortController(), operacoesPendentes: new Set()
        };
        statusLoginAdmin.textContent = "Carregando o painel…";
        tentativa.controlador = sessao.controlador;
        const dados = await consultarDadosPainel(sessao, () => loginAtual(tentativa));
        if (!loginAtual(tentativa)) return;
        if (!await confirmarSessaoAuth(tentativa.auth) || !loginAtual(tentativa)) {
            if (tentativaLogin === tentativa) pedirNovoLogin();
            return;
        }

        const { agendamentos, configuracao } = dados;
        agendamentosPrivados = agendamentos;
        diasDisponiveisCache = configuracao.dias;
        horariosDisponiveisCache = configuracao.horarios;
        datasBloqueadasCache = configuracao.datasBloqueadas;
        barbeirosCache = configuracao.barbeiros;
        sessaoPainel = sessao;

        carregarPainelAdmin();
        atualizarSaudacao();
        areaCliente.style.display = "none";
        areaLogin.style.display = "none";
        areaAdmin.style.display = "block";
        mostrarSecaoAdmin("painel-agenda", true);
        iniciarRelogioPainel(sessao);
        formLogin.reset();
    } catch {
        if (tentativaLogin === tentativa) {
            limparPainel();
            erroLogin.textContent = "Não foi possível carregar o painel. Tente novamente.";
        }
    } finally {
        if (tentativaLogin === tentativa) {
            if (!sessaoPainel) tentativa.controlador?.abort();
            tentativaLogin = null;
        }
        statusLoginAdmin.textContent = "";
        botao.disabled = false;
    }
});

btnVoltar.addEventListener("click", async () => {
    if (encerrandoSessao) return;
    encerrandoSessao = true;
    tentativaLogin?.controlador?.abort();
    tentativaLogin = null;
    limparPainel();
    formLogin.reset();

    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    } catch {
        areaLogin.style.display = "block";
        erroLogin.textContent = "Não foi possível encerrar a sessão. Entre novamente para acessar o painel.";
        return;
    } finally {
        encerrandoSessao = false;
    }

    areaLogin.style.display = "none";
    areaCliente.style.display = "block";
    carregarDisponibilidadePublica();
});

function carregarPainelAdmin() {
    if (sessaoPainel && !filtroMesFaturamento.value) {
        filtroMesFaturamento.value = mesAtualISO();
    }

    renderizarOpcoesProfissionais();
    renderizarDiasAdmin();
    renderizarHorariosAdmin();
    renderizarDatasBloqueadas();
    atualizarAgendaPainel();
    renderizarAgendamentos();
    renderizarFaturamento();
}

function mostrarSecaoAdmin(id, focar = false) {
    secaoAdmin = id;
    secoesAdmin.forEach(secao => { secao.hidden = secao.id !== id; });
    botoesSecaoAdmin.forEach(botao => {
        if (botao.dataset.secaoAdmin === id) botao.setAttribute("aria-current", "true");
        else botao.removeAttribute("aria-current");
    });
    filtroProfissionalAdmin.hidden = sessaoPainel?.tipo !== "admin" ||
        (id !== "painel-agenda" && id !== "painel-agendamentos");
    if (focar) document.getElementById(id).querySelector("h3").focus();
}

botoesSecaoAdmin.forEach(botao => {
    botao.addEventListener("click", () => {
        if (sessaoPainelAtiva(sessaoPainel)) mostrarSecaoAdmin(botao.dataset.secaoAdmin, true);
    });
});

function iniciarRelogioPainel(sessao) {
    const atualizar = () => {
        if (!sessaoPainelAtiva(sessao)) return;
        clearTimeout(relogioPainel);
        const agora = new Date();
        atualizarAgendaPainel(agora);
        relogioPainel = setTimeout(atualizar, 60_000 - agora.getTime() % 60_000);
    };
    const opcoes = { signal: sessao.controlador.signal };
    window.addEventListener("focus", atualizar, opcoes);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) atualizar();
    }, opcoes);
    atualizar();
}

function renderizarOpcoesProfissionais() {
    const anterior = profissionalAdmin.value;
    profissionalAdmin.replaceChildren();
    if (sessaoPainel?.tipo !== "admin") return;

    const profissionais = new Map(barbeirosCache.map(item => [String(item.id), item.nome]));
    agendamentosPrivados.forEach(item => {
        if (item.barbeiro_id == null) return;
        const id = String(item.barbeiro_id);
        if (!profissionais.has(id)) profissionais.set(id, item.barbeiro_nome || "Profissional sem nome");
    });
    const adicionarOpcao = (id, nome) => {
        const opcao = document.createElement("option");
        opcao.value = id;
        opcao.textContent = nome;
        profissionalAdmin.appendChild(opcao);
    };
    adicionarOpcao("", "Todos os profissionais");
    [...profissionais].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
        .forEach(([id, nome]) => adicionarOpcao(id, nome));
    profissionalAdmin.value = profissionais.has(anterior) ? anterior : "";
}

profissionalAdmin.addEventListener("change", () => {
    atualizarAgendaPainel();
    renderizarAgendamentos();
});

function operacaoPendente(sessao, chave) {
    return Boolean(sessao?.operacoesPendentes.has(chave));
}

function podeGerenciarDisponibilidade(sessao) {
    return sessaoPainelAtiva(sessao) && sessao.tipo === "admin";
}

function atualizarControlesPendentes() {
    const recarregando = Boolean(sessaoPainel?.recarregando);
    const podeAlterar = podeGerenciarDisponibilidade(sessaoPainel) && !recarregando;
    const edicaoPendente = recarregando || operacaoPendente(sessaoPainel, camposEdicao.dataset.operacao);
    btnRecarregarAgendamentos.disabled = !sessaoPainel || recarregando || sessaoPainel.operacoesPendentes.size > 0;
    camposEdicao.disabled = edicaoPendente;
    areaAdmin.querySelectorAll("[data-operacao]").forEach(controle => {
        controle.disabled = recarregando || operacaoPendente(sessaoPainel, controle.dataset.operacao) ||
            (edicaoPendente && controle.classList.contains("btn-editar"));
    });

    for (const [formulario, chave] of [[formHorario, `horario:${novoHorario.value}`],
        [formDataBloqueada, `bloqueio:${novaDataBloqueada.value}`]]) {
        const pendente = operacaoPendente(sessaoPainel, chave);
        formulario.querySelectorAll("button, input").forEach(controle => {
            controle.disabled = !podeAlterar || pendente;
        });
    }
}

async function executarOperacaoPainel(sessao, chave, status, executar, sucesso, falha) {
    if (!sessaoPainelAtiva(sessao) || sessao.recarregando || operacaoPendente(sessao, chave)) return false;

    sessao.operacoesPendentes.add(chave);
    atualizarControlesPendentes();
    status.textContent = "Salvando…";
    try {
        if (!await executar() || !sessaoPainelAtiva(sessao)) return false;
        status.textContent = sucesso;
        return true;
    } catch (erro) {
        if (sessaoPainelAtiva(sessao)) {
            if (erro === OPERACAO_SEM_LINHA) {
                status.textContent = "Registro indisponível para esta sessão. Nenhuma alteração foi confirmada.";
            } else if (erro?.code === "42501" || erro?.status === 403) {
                status.textContent = "Você não tem permissão para realizar esta operação.";
            } else {
                status.textContent = falha;
            }
        }
        return false;
    } finally {
        sessao.operacoesPendentes.delete(chave);
        if (sessaoPainelAtiva(sessao)) atualizarControlesPendentes();
    }
}

function renderizarDiasAdmin() {
    const podeAlterar = podeGerenciarDisponibilidade(sessaoPainel);
    disponibilidadeLeitura.hidden = podeAlterar;
    formHorario.hidden = !podeAlterar;
    formDataBloqueada.hidden = !podeAlterar;
    checkboxesDia.forEach(checkbox => {
        const ativo = Boolean(diasDisponiveisCache[checkbox.dataset.dia]);
        const label = checkbox.parentElement;
        let situacao = label.querySelector(".situacao-dia");
        if (!situacao) {
            situacao = document.createElement("span");
            situacao.className = "situacao-dia";
            label.appendChild(situacao);
        }
        checkbox.hidden = !podeAlterar;
        situacao.hidden = podeAlterar;
        situacao.textContent = ativo ? "Disponível" : "Indisponível";
        if (!operacaoPendente(sessaoPainel, checkbox.dataset.operacao)) {
            checkbox.checked = ativo;
        }
    });
    atualizarControlesPendentes();
}

checkboxesDia.forEach(checkbox => {
    const dia = checkbox.dataset.dia;
    const chave = `dia:${dia}`;
    checkbox.dataset.operacao = chave;
    checkbox.addEventListener("change", async () => {
        const sessao = sessaoPainel;
        if (!podeGerenciarDisponibilidade(sessao)) return;
        await executarOperacaoPainel(sessao, chave, statusPainel.dias,
            () => salvarDiaDisponivelSupabase(sessao, dia, checkbox.checked),
            "Dia atualizado.", "Não foi possível atualizar o dia.");
        if (sessaoPainelAtiva(sessao)) renderizarDiasAdmin();
    });
});

formHorario.addEventListener("submit", async e => {
    e.preventDefault();
    const sessao = sessaoPainel;
    const horario = novoHorario.value;
    const chave = `horario:${horario}`;
    if (!podeGerenciarDisponibilidade(sessao) || !horario || operacaoPendente(sessao, chave)) return;
    if (horariosDisponiveisCache.some(item => item.horario === horario)) {
        statusPainel.horarios.textContent = "Esse horário já está na lista.";
        return;
    }

    const salvo = await executarOperacaoPainel(sessao, chave, statusPainel.horarios,
        () => salvarHorarioDisponivelSupabase(sessao, horario, true),
        "Horário adicionado.", "Não foi possível adicionar o horário.");
    if (!salvo || !sessaoPainelAtiva(sessao)) return;
    novoHorario.value = "";
    renderizarHorariosAdmin();
});

function renderizarHorariosAdmin() {
    const sessao = sessaoPainel;
    const podeAlterar = podeGerenciarDisponibilidade(sessao);
    listaHorariosAdmin.replaceChildren();
    if (horariosDisponiveisCache.length === 0) {
        mostrarListaVazia(listaHorariosAdmin, "Nenhum horário configurado.");
        return;
    }

    ordenarHorarios(horariosDisponiveisCache).forEach(({ horario, ativo }) => {
        const linha = document.createElement("div");
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        const texto = document.createElement("span");
        const remover = document.createElement("button");
        const chave = `horario:${horario}`;

        linha.className = "horario-admin-item";
        if (!podeAlterar) {
            linha.textContent = `${horario} · ${ativo ? "Disponível" : "Indisponível"}`;
            listaHorariosAdmin.appendChild(linha);
            return;
        }
        checkbox.type = "checkbox";
        checkbox.checked = ativo;
        checkbox.dataset.operacao = chave;
        checkbox.disabled = operacaoPendente(sessao, chave);
        checkbox.setAttribute("aria-label", `Horário ${horario} disponível`);
        texto.textContent = horario;
        remover.type = "button";
        remover.textContent = "Remover";
        remover.className = "btn-excluir pequeno";
        remover.dataset.operacao = chave;
        remover.disabled = checkbox.disabled;
        remover.setAttribute("aria-label", `Remover horário ${horario}`);

        checkbox.addEventListener("change", async () => {
            if (!podeGerenciarDisponibilidade(sessao)) return;
            const salvo = await executarOperacaoPainel(sessao, chave, statusPainel.horarios,
                () => salvarHorarioDisponivelSupabase(sessao, horario, checkbox.checked),
                "Horário atualizado.", "Não foi possível atualizar o horário.");
            if (sessaoPainelAtiva(sessao) && !salvo && !operacaoPendente(sessao, chave)) {
                checkbox.checked = Boolean(horariosDisponiveisCache.find(item => item.horario === horario)?.ativo);
            }
        });

        remover.addEventListener("click", async () => {
            if (!podeGerenciarDisponibilidade(sessao) || operacaoPendente(sessao, chave)) return;
            if (!confirm(`Remover o horário ${horario}?`)) return;
            const removido = await executarOperacaoPainel(sessao, chave, statusPainel.horarios,
                () => removerHorarioSupabase(sessao, horario),
                "Horário removido.", "Não foi possível remover o horário.");
            if (removido && sessaoPainelAtiva(sessao)) renderizarHorariosAdmin();
        });

        label.append(checkbox, texto);
        linha.append(label, remover);
        listaHorariosAdmin.appendChild(linha);
    });
}

function mostrarListaVazia(lista, mensagem) {
    const aviso = document.createElement("p");
    aviso.className = "mensagem-vazia";
    aviso.textContent = mensagem;
    lista.appendChild(aviso);
}

function renderizarListaAgenda(lista, agendamentos, mensagem, mostrarData = false) {
    lista.replaceChildren();
    if (agendamentos.length === 0) {
        mostrarListaVazia(lista, mensagem);
        return;
    }

    agendamentos.forEach(item => {
        const linha = document.createElement("div");
        const detalhes = document.createElement("div");
        const cliente = document.createElement("strong");
        const servico = document.createElement("span");
        const whatsapp = document.createElement("small");
        linha.className = "proximo-atendimento-item";
        const horario = item.horario || "Horário não informado";
        const momento = mostrarData ? `${formatarData(item.data)} às ${horario}` : horario;
        cliente.textContent = `${momento} · ${item.nome || "Cliente"}`;
        servico.textContent = [item.servico, item.barbeiro_nome].filter(Boolean).join(" · ");
        whatsapp.textContent = item.whatsapp || "";
        detalhes.append(cliente, servico);
        linha.append(detalhes, whatsapp);
        lista.appendChild(linha);
    });
}

function renderizarDatasBloqueadas() {
    const sessao = sessaoPainel;
    listaDatasBloqueadas.replaceChildren();
    if (datasBloqueadasCache.length === 0) {
        mostrarListaVazia(listaDatasBloqueadas, "Nenhuma data bloqueada.");
        return;
    }

    datasBloqueadasCache.forEach(data => {
        const linha = document.createElement("div");
        const texto = document.createElement("span");
        const remover = document.createElement("button");
        const chave = `bloqueio:${data}`;

        linha.className = "data-bloqueada-item";
        texto.textContent = formatarData(data);
        if (!podeGerenciarDisponibilidade(sessao)) {
            linha.appendChild(texto);
            listaDatasBloqueadas.appendChild(linha);
            return;
        }
        remover.type = "button";
        remover.textContent = "Remover";
        remover.className = "btn-excluir pequeno";
        remover.dataset.operacao = chave;
        remover.disabled = operacaoPendente(sessao, chave);
        remover.setAttribute("aria-label", `Remover bloqueio de ${formatarData(data)}`);

        remover.addEventListener("click", async () => {
            if (!podeGerenciarDisponibilidade(sessao) || operacaoPendente(sessao, chave)) return;
            if (!confirm(`Remover bloqueio de ${formatarData(data)}?`)) return;
            const removido = await executarOperacaoPainel(sessao, chave, statusPainel.bloqueios,
                () => removerDataBloqueadaSupabase(sessao, data),
                "Bloqueio removido.", "Não foi possível remover o bloqueio.");
            if (removido && sessaoPainelAtiva(sessao)) renderizarDatasBloqueadas();
        });

        linha.append(texto, remover);
        listaDatasBloqueadas.appendChild(linha);
    });
}

function filtrarPorProfissional(agendamentos) {
    const id = sessaoPainel?.tipo === "admin" ? profissionalAdmin.value : "";
    return id ? agendamentos.filter(item => String(item.barbeiro_id) === id) : agendamentos;
}

function emOrdemCronologica(agendamentos) {
    return [...agendamentos].sort((a, b) => {
        const momentoA = `${a.data || ""} ${a.horario || ""}`;
        const momentoB = `${b.data || ""} ${b.horario || ""}`;
        return momentoA.localeCompare(momentoB);
    });
}

function agendamentosFiltrados() {
    const termo = buscaAgendamento.value.trim().toLowerCase();
    const telefone = /^[+\d(). -]+$/.test(termo) ? termo.replace(/\D/g, "") : "";
    const data = filtroData.value;

    return emOrdemCronologica(filtrarPorProfissional(agendamentosPrivados).filter(item => {
        const texto = [item.nome, item.servico, item.whatsapp].join(" ").toLowerCase();
        const combina = !termo || texto.includes(termo) ||
            (telefone && String(item.whatsapp).replace(/\D/g, "").includes(telefone));
        return combina && (!data || item.data === data);
    }));
}

function criarAcoesAgendamento(sessao, item) {
    const acoes = document.createElement("div");
    acoes.className = "acoes-tabela";

    for (const [texto, classe, acao] of [
        ["Editar", "btn-editar", () => abrirEdicao(item.id)],
        ["Excluir", "btn-excluir pequeno", () => excluirAgendamento(sessao, item.id)]
    ]) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = classe;
        botao.textContent = texto;
        botao.dataset.id = item.id;
        botao.dataset.operacao = `agendamento:${item.id}`;
        botao.disabled = sessao.recarregando || operacaoPendente(sessao, botao.dataset.operacao) ||
            (classe === "btn-editar" && operacaoPendente(sessao, camposEdicao.dataset.operacao));
        botao.setAttribute("aria-label", `${texto} agendamento de ${item.nome || "cliente"}`);
        botao.addEventListener("click", () => {
            if (sessaoPainelAtiva(sessao) && !operacaoPendente(sessao, botao.dataset.operacao)) acao();
        });
        acoes.appendChild(botao);
    }
    return acoes;
}

function renderizarAgendamentos() {
    const sessao = sessaoPainel;
    const agendamentos = agendamentosFiltrados();
    tabelaAgendamentos.replaceChildren();
    cartoesAgendamentos.replaceChildren();
    const semResultados = agendamentos.length === 0;
    tabelaAgendamentos.closest(".tabela-admin-wrapper").hidden = semResultados;
    cartoesAgendamentos.hidden = semResultados;
    mensagemAgendamentos.textContent = "";
    if (semResultados) {
        mensagemAgendamentos.textContent = agendamentosPrivados.length
            ? "Nenhum agendamento corresponde aos filtros."
            : "Nenhum agendamento encontrado.";
        return;
    }

    agendamentos.forEach(item => {
        const detalhes = [
            ["Serviço", item.servico],
            ["Valor", item.preco || formatarMoeda(0)],
            ["Data", formatarData(item.data)],
            ["Horário", item.horario],
            ["Barbeiro", item.barbeiro_nome],
            ["WhatsApp", item.whatsapp]
        ];

        const linha = document.createElement("tr");
        const celulaAcoes = document.createElement("td");
        linha.appendChild(criarCelula(item.nome));
        detalhes.forEach(([, valor]) => linha.appendChild(criarCelula(valor)));
        celulaAcoes.appendChild(criarAcoesAgendamento(sessao, item));
        linha.appendChild(celulaAcoes);
        tabelaAgendamentos.appendChild(linha);

        const cartao = document.createElement("li");
        const nome = document.createElement("strong");
        const listaDetalhes = document.createElement("dl");
        cartao.className = "admin-cartao-agendamento";
        nome.textContent = item.nome || "Cliente";
        listaDetalhes.className = "admin-detalhes-agendamento";
        detalhes.forEach(([rotulo, valor]) => {
            const campo = document.createElement("div");
            const termo = document.createElement("dt");
            const descricao = document.createElement("dd");
            termo.textContent = rotulo;
            descricao.textContent = valor || "-";
            campo.append(termo, descricao);
            listaDetalhes.appendChild(campo);
        });
        cartao.append(nome, listaDetalhes, criarAcoesAgendamento(sessao, item));
        cartoesAgendamentos.appendChild(cartao);
    });
}

function criarCelula(valor) {
    const celula = document.createElement("td");
    celula.textContent = valor || "-";
    return celula;
}

function atualizarAgendaPainel(agora = new Date()) {
    if (!formatoFusoBarbearia) return;
    const agendamentos = emOrdemCronologica(filtrarPorProfissional(agendamentosPrivados));
    const hoje = dataAtualISO(agora);
    const mes = hoje.slice(0, 7);
    const atendimentosHoje = agendamentos.filter(item => item.data === hoje);
    const proximos = agendamentos.filter(item => item.data >= hoje && item.horario &&
        horarioFuturo(item.data, item.horario, agora));

    agendaAdminData.dateTime = hoje;
    agendaAdminData.textContent = formatarData(hoje);
    totalAgendamentos.textContent = agendamentos.filter(item => item.data?.slice(0, 7) === mes).length;
    agendamentosHoje.textContent = atendimentosHoje.length;
    proximoHorario.textContent = proximos[0]?.horario || "--:--";
    renderizarListaAgenda(listaAtendimentosHoje, atendimentosHoje, "Nenhum atendimento hoje.");
    renderizarListaAgenda(listaProximosAtendimentos, proximos.slice(0, 5), "Nenhum próximo atendimento.", true);
}

function renderizarFaturamento() {
    if (!formatoFusoBarbearia) return;
    const mesSelecionado = filtroMesFaturamento.value || mesAtualISO();
    const agendamentosMes = agendamentosPrivados.filter(item => {
        return item.data && item.data.slice(0, 7) === mesSelecionado;
    });

    const total = agendamentosMes.reduce((soma, item) => {
        return soma + precoParaNumero(item.preco);
    }, 0);

    const totalAtendimentos = agendamentosMes.length;
    const media = totalAtendimentos ? total / totalAtendimentos : 0;
    const servicos = agendamentosMes.reduce((agrupados, item) => {
        const nomeServico = item.servico || "Servico nao informado";
        const valor = precoParaNumero(item.preco);

        if (!agrupados[nomeServico]) {
            agrupados[nomeServico] = {
                quantidade: 0,
                total: 0
            };
        }

        agrupados[nomeServico].quantidade += 1;
        agrupados[nomeServico].total += valor;

        return agrupados;
    }, Object.create(null));

    faturamentoMes.textContent = formatarMoeda(total);
    atendimentosMes.textContent = totalAtendimentos;
    ticketMedio.textContent = formatarMoeda(media);
    faturamentoServicos.innerHTML = "";

    const rankingServicos = Object.entries(servicos).sort((a, b) => {
        return b[1].total - a[1].total;
    });

    if (rankingServicos.length === 0) {
        faturamentoServicos.innerHTML = '<p class="mensagem-vazia">Nenhum atendimento encontrado para este mes.</p>';
        return;
    }

    rankingServicos.forEach(([servico, dados]) => {
        const linha = document.createElement("div");
        const nome = document.createElement("span");
        const total = document.createElement("strong");
        const quantidade = document.createElement("small");
        linha.className = "faturamento-servico-item";

        nome.textContent = servico;
        total.textContent = formatarMoeda(dados.total);
        quantidade.textContent = `${dados.quantidade} atendimento${dados.quantidade === 1 ? "" : "s"}`;
        linha.appendChild(nome);
        linha.appendChild(total);
        linha.appendChild(quantidade);
        faturamentoServicos.appendChild(linha);
    });
}

function valorCsv(valor) {
    const texto = String(valor || "");
    return `"${texto.replace(/"/g, '""')}"`;
}

function exportarAgendamentosCsv() {
    if (!sessaoPainelAtiva(sessaoPainel)) return;
    const agendamentos = agendamentosFiltrados();
    const cabecalho = ["Cliente", "Servico", "Valor", "Data", "Horario", "WhatsApp"];
    const linhas = agendamentos.map(item => [
        item.nome,
        item.servico,
        item.preco,
        formatarData(item.data),
        item.horario,
        item.whatsapp
    ]);

    const csv = [cabecalho, ...linhas]
        .map(linha => linha.map(valorCsv).join(";"))
        .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dataArquivo = dataAtualISO();

    link.href = url;
    link.download = `agendamentos-${dataArquivo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

buscaAgendamento.addEventListener("input", renderizarAgendamentos);
filtroData.addEventListener("change", renderizarAgendamentos);
filtroMesFaturamento.addEventListener("change", renderizarFaturamento);
btnExportarCsv.addEventListener("click", exportarAgendamentosCsv);

btnRecarregarAgendamentos.addEventListener("click", async () => {
    const sessao = sessaoPainel;
    if (!sessaoPainelAtiva(sessao) || sessao.recarregando || sessao.operacoesPendentes.size) return;
    sessao.recarregando = true;
    areaAdmin.setAttribute("aria-busy", "true");
    atualizarControlesPendentes();
    statusPainel.agendamentos.textContent = "Carregando agendamentos…";
    try {
        const estado = await verificarSessaoAuth(sessao.auth);
        if (!sessaoPainelAtiva(sessao)) return;
        if (estado === "encerrada") {
            pedirNovoLogin();
            return;
        }
        if (estado === "falha") throw new Error("Não foi possível verificar a sessão.");
        const itens = await consultarAgendamentosPrivados(sessao, () => sessaoPainelAtiva(sessao));
        if (!sessaoPainelAtiva(sessao)) return;
        agendamentosPrivados = itens;
        renderizarAgendamentos();
        atualizarAgendaPainel();
        renderizarFaturamento();
        statusPainel.agendamentos.textContent = "Lista de agendamentos atualizada.";
    } catch {
        if (sessaoPainelAtiva(sessao)) {
            statusPainel.agendamentos.textContent = "Falha ao atualizar. A lista continua com os últimos dados carregados.";
        }
    } finally {
        sessao.recarregando = false;
        if (sessaoPainelAtiva(sessao)) {
            areaAdmin.removeAttribute("aria-busy");
            atualizarControlesPendentes();
        }
    }
});

btnLimparFiltros.addEventListener("click", () => {
    buscaAgendamento.value = "";
    filtroData.value = "";
    profissionalAdmin.value = "";
    atualizarAgendaPainel();
    renderizarAgendamentos();
});

formDataBloqueada.addEventListener("submit", async e => {
    e.preventDefault();
    const sessao = sessaoPainel;
    const data = novaDataBloqueada.value;
    const chave = `bloqueio:${data}`;
    if (!podeGerenciarDisponibilidade(sessao) || !data || operacaoPendente(sessao, chave)) return;
    if (datasBloqueadasCache.includes(data)) {
        statusPainel.bloqueios.textContent = "Essa data já está bloqueada.";
        return;
    }

    const salvo = await executarOperacaoPainel(sessao, chave, statusPainel.bloqueios,
        () => salvarDataBloqueadaSupabase(sessao, data),
        "Data bloqueada.", "Não foi possível bloquear a data.");
    if (!salvo || !sessaoPainelAtiva(sessao)) return;
    novaDataBloqueada.value = "";
    renderizarDatasBloqueadas();
});

function abrirEdicao(id) {
    if (camposEdicao.disabled) return;
    const agendamentoItem = agendamentosPrivados.find(item => item.id === id);
    if (!agendamentoItem) return;

    editarIndex.value = id;
    editarNome.value = agendamentoItem.nome;
    editarWhatsapp.value = agendamentoItem.whatsapp;
    editarServico.replaceChildren();
    const opcoes = new Map(servicosDaInstalacao);
    if (!opcoes.has(agendamentoItem.servico)) {
        opcoes.set(agendamentoItem.servico, `${agendamentoItem.servico} (serviço registrado)`);
    }
    for (const [codigo, rotulo] of opcoes) {
        const opcao = document.createElement("option");
        opcao.value = codigo;
        opcao.textContent = rotulo;
        editarServico.append(opcao);
    }
    editarServico.value = agendamentoItem.servico;
    editarData.value = agendamentoItem.data;
    editarHorario.value = agendamentoItem.horario;
    camposEdicao.dataset.operacao = `agendamento:${id}`;

    statusPainel.edicao.textContent = "";
    formEditar.style.display = "block";
    tituloEditarAgendamento.focus();
}

function fecharEdicao(id, restaurarFoco = true) {
    formEditar.style.display = "none";
    formEditar.reset();
    delete camposEdicao.dataset.operacao;
    statusPainel.edicao.textContent = "";

    if (restaurarFoco && secaoAdmin === "painel-agendamentos") {
        const botao = [...areaAdmin.querySelectorAll(".btn-editar")].find(item =>
            item.dataset.id === id && item.getClientRects().length > 0);
        (botao || document.getElementById("titulo-agendamentos-admin")).focus();
    }
}

formEditar.addEventListener("submit", async e => {
    e.preventDefault();

    const sessao = sessaoPainel;
    if (!sessaoPainelAtiva(sessao)) return;
    const agendamentoItem = agendamentosPrivados.find(item => String(item.id) === editarIndex.value);
    if (!agendamentoItem) {
        statusPainel.edicao.textContent = "Registro indisponível para esta sessão. Nenhuma alteração foi confirmada.";
        return;
    }
    if (!formEditar.reportValidity()) return;

    const nome = editarNome.value.trim();
    const whatsapp = normalizarWhatsapp(editarWhatsapp.value);
    const servico = editarServico.value;
    if (!nome || !whatsapp) {
        statusPainel.edicao.textContent = nome ? "Informe um WhatsApp com 10 a 15 dígitos." : "Preencha o nome.";
        (nome ? editarWhatsapp : editarNome).focus();
        return;
    }
    if (servico !== agendamentoItem.servico && !servicosDaInstalacao.has(servico)) {
        statusPainel.edicao.textContent = "Escolha um serviço do catálogo da barbearia.";
        editarServico.focus();
        return;
    }
    if ((editarData.value !== agendamentoItem.data || editarHorario.value !== agendamentoItem.horario) &&
        !horarioFuturo(editarData.value, editarHorario.value)) {
        statusPainel.edicao.textContent = "Escolha uma data e um horário futuros na barbearia.";
        editarHorario.focus();
        return;
    }

    const id = agendamentoItem.id;
    const agendamentoAtualizado = {
        nome,
        whatsapp,
        data: editarData.value,
        horario: editarHorario.value
    };
    if (servico !== agendamentoItem.servico) agendamentoAtualizado.servico = servico;

    const salvo = await executarOperacaoPainel(sessao, `agendamento:${id}`, statusPainel.edicao,
        () => atualizarAgendamentoSupabase(sessao, id, agendamentoAtualizado),
        "Agendamento atualizado.", "Não foi possível editar o agendamento.");
    if (!salvo || !sessaoPainelAtiva(sessao)) return;

    renderizarAgendamentos();
    atualizarAgendaPainel();
    renderizarFaturamento();
    statusPainel.agendamentos.textContent = "Agendamento atualizado.";
    fecharEdicao(String(id));
});

btnCancelarEdicao.addEventListener("click", () => {
    if (!camposEdicao.disabled) fecharEdicao(editarIndex.value);
});

async function excluirAgendamento(sessao, id) {
    const chave = `agendamento:${id}`;
    if (!sessaoPainelAtiva(sessao) || sessao.recarregando || operacaoPendente(sessao, chave)) return;
    if (!agendamentosPrivados.some(item => item.id === id)) return;
    if (!confirm("Deseja realmente excluir este agendamento?")) return;

    const removido = await executarOperacaoPainel(sessao, chave, statusPainel.agendamentos,
        () => excluirAgendamentoSupabase(sessao, id),
        "Agendamento excluído.", "Não foi possível excluir o agendamento.");
    if (!removido || !sessaoPainelAtiva(sessao)) return;

    if (editarIndex.value === String(id)) fecharEdicao(String(id), false);
    renderizarAgendamentos();
    atualizarAgendaPainel();
    renderizarFaturamento();
}

if (typeof window !== "undefined") {
    window.addEventListener("focus", atualizarDiaDisponibilidade);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) atualizarDiaDisponibilidade();
    });
    window.setInterval(() => {
        if (!document.hidden) atualizarDiaDisponibilidade();
    }, 60000);
}
carregarDisponibilidadePublica();
