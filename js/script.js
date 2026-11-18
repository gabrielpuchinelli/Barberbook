const cardsServico = document.querySelectorAll(".card-servico");
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
let etapaAgendamento = servicos;
let reserva = {};
let reservaConfirmada = false;
let enviandoReserva = false;
let mensagemReserva = "";
let agendamentosPrivados = [];
let diasDisponiveisCache = {};
let horariosDisponiveisCache = [];
let datasBloqueadasCache = [];
let barbeirosCache = [];
let sessaoAuth = null;
let tentativaLogin = null;
let sessaoPainel = null;
let encerrandoSessao = false;

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

function idBarbeiroValido(id) {
    if (typeof id === "number") return Number.isSafeInteger(id) && id > 0;
    return typeof id === "string" && (
        /^[1-9]\d*$/.test(id) ||
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
    );
}

async function consultarConfiguracaoAgenda() {
    const [dias, horarios, bloqueios, barbeiros] = await Promise.all([
        supabaseClient.from("dias_disponiveis").select("dia_semana, ativo").order("dia_semana"),
        supabaseClient.from("horarios_disponiveis").select("horario, ativo").order("horario"),
        supabaseClient.from("datas_bloqueadas").select("data").order("data"),
        supabaseClient.from("barbeiros").select("id, nome").eq("ativo", true).order("nome")
    ]);

    for (const resposta of [dias, horarios, bloqueios, barbeiros]) {
        if (resposta.error) throw resposta.error;
    }

    return {
        dias: Object.fromEntries(dias.data.map(item => [item.dia_semana, item.ativo])),
        horarios: horarios.data.map(item => ({
            horario: item.horario.slice(0, 5),
            ativo: item.ativo
        })),
        datasBloqueadas: bloqueios.data.map(item => item.data),
        barbeiros: barbeiros.data.filter(item => idBarbeiroValido(item.id))
    };
}

async function carregarDisponibilidadePublica() {
    if (enviandoReserva) return;

    const consulta = ++consultaDisponibilidade;
    const etapaAnterior = etapaAgendamento;
    if (!reservaConfirmada) {
        reserva.horario = null;
        if (etapaAgendamento === dadosCliente) etapaAgendamento = agendamento;
    }
    disponibilidadePublica = null;
    estadoDisponibilidade = "carregando";
    renderizarEtapaAgendamento(etapaAnterior !== etapaAgendamento);

    try {
        const [resposta, configuracao] = await Promise.all([
            supabaseClient.from("agendamentos_publicos")
                .select("data, horario, barbeiro_id")
                .order("data")
                .order("horario"),
            consultarConfiguracaoAgenda()
        ]);
        if (consulta !== consultaDisponibilidade) return;
        if (resposta.error) throw resposta.error;

        disponibilidadePublica = {
            ...configuracao,
            ocupacoes: resposta.data.map(({ data, horario, barbeiro_id }) => ({
                data,
                horario: horario.slice(0, 5),
                barbeiro_id
            }))
        };
        estadoDisponibilidade = "disponivel";
    } catch {
        if (consulta !== consultaDisponibilidade) return;
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
}

async function consultarDadosPainel(sessao) {
    if (sessao.tipo !== "admin" && (
        sessao.tipo !== "barbeiro" || !idBarbeiroValido(sessao.barbeiroId)
    )) return null;

    const consulta = supabaseClient.from("agendamentos")
        .select("id, nome, whatsapp, data, horario, barbeiro_id, barbeiro_nome, servico, preco")
        .order("data")
        .order("horario");

    const [resposta, configuracao] = await Promise.all([
        sessao.tipo === "barbeiro" ? consulta.eq("barbeiro_id", sessao.barbeiroId) : consulta,
        consultarConfiguracaoAgenda()
    ]);
    if (resposta.error) throw resposta.error;

    return { agendamentos: resposta.data.map(normalizarAgendamento), configuracao };
}

async function criarAgendamentoSupabase(agendamentoCliente) {
    const { error } = await supabaseClient
        .from("agendamentos")
        .insert([agendamentoCliente]);

    if (error) throw error;
}

async function executarEscritaPainel(sessao, consultar) {
    if (!sessaoPainelAtiva(sessao)) return false;

    const valida = await confirmarSessaoAuth(sessao.auth);
    if (!sessaoPainelAtiva(sessao)) return false;
    if (!valida) {
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
    if (resposta.error) throw resposta.error;
    return resposta;
}

async function atualizarAgendamentoSupabase(sessao, id, agendamentoAtualizado) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("agendamentos")
        .update(agendamentoAtualizado)
        .eq("id", id)
        .select()
        .single());

    if (!resposta || !sessaoPainelAtiva(sessao)) return false;
    agendamentosPrivados = agendamentosPrivados.map(item => {
        return item.id === id ? normalizarAgendamento(resposta.data) : item;
    });
    return true;
}

async function excluirAgendamentoSupabase(sessao, id) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("agendamentos")
        .delete()
        .eq("id", id));

    if (!resposta || !sessaoPainelAtiva(sessao)) return false;
    agendamentosPrivados = agendamentosPrivados.filter(item => item.id !== id);
    return true;
}

async function salvarDiaDisponivelSupabase(sessao, diaSemana, ativo) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("dias_disponiveis")
        .upsert([{ dia_semana: Number(diaSemana), ativo }], { onConflict: "dia_semana" }));

    if (!resposta || !sessaoPainelAtiva(sessao)) return;
    diasDisponiveisCache[diaSemana] = ativo;
}

async function salvarHorarioDisponivelSupabase(sessao, horario, ativo) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("horarios_disponiveis")
        .upsert([{ horario, ativo }], { onConflict: "horario" }));

    if (!resposta || !sessaoPainelAtiva(sessao)) return;
    horariosDisponiveisCache = [
        ...horariosDisponiveisCache.filter(item => item.horario !== horario),
        { horario, ativo }
    ];
}

async function removerHorarioSupabase(sessao, horario) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("horarios_disponiveis")
        .delete()
        .eq("horario", horario));

    if (!resposta || !sessaoPainelAtiva(sessao)) return;
    horariosDisponiveisCache = horariosDisponiveisCache.filter(item => item.horario !== horario);
}

async function salvarDataBloqueadaSupabase(sessao, data) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("datas_bloqueadas")
        .insert([{ data }]));

    if (!resposta || !sessaoPainelAtiva(sessao)) return;
    datasBloqueadasCache = [...datasBloqueadasCache, data].sort();
}

async function removerDataBloqueadaSupabase(sessao, data) {
    const resposta = await executarEscritaPainel(sessao, () => supabaseClient
        .from("datas_bloqueadas")
        .delete()
        .eq("data", data));

    if (!resposta || !sessaoPainelAtiva(sessao)) return;
    datasBloqueadasCache = datasBloqueadasCache.filter(item => item !== data);
}

function dataAtualISO() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
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
    const hoje = new Date();
    const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const diferenca = (Number(diaSemana) - data.getDay() + 7) % 7;

    data.setDate(data.getDate() + diferenca);

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
}



function marcarOpcaoSelecionada(botao, selecionada) {
    botao.classList.toggle("selecionado", selecionada);
    botao.setAttribute("aria-pressed", String(selecionada));
}

function mudarEtapaAgendamento(etapa) {
    if (enviandoReserva) return;
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
    btnEtapaAnterior.disabled = enviandoReserva;
    btnAdmin.disabled = enviandoReserva;

    const consultaVisivel = etapaAgendamento === barbeirosSection || etapaAgendamento === agendamento;
    btnRecarregarDisponibilidade.hidden = !consultaVisivel || estadoDisponibilidade !== "erro";
    avisoData.textContent = consultaVisivel ? mensagemDisponibilidade() : "";

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

function mensagemDisponibilidade() {
    let mensagem = "";
    if (estadoDisponibilidade === "carregando") {
        mensagem = "Carregando disponibilidade…";
    } else if (estadoDisponibilidade === "erro") {
        mensagem = "Não foi possível carregar a disponibilidade.";
    } else if (etapaAgendamento === barbeirosSection && disponibilidadePublica.barbeiros.length === 0) {
        mensagem = "Nenhum profissional disponível no momento.";
    }

    return [mensagemReserva, mensagem].filter(Boolean).join(" ");
}

cardsServico.forEach(card => {
    card.addEventListener("click", () => {
        if (enviandoReserva || etapaAgendamento !== servicos) return;

        const { servico: nome, preco } = card.dataset;
        if (reserva.servico?.nome !== nome) {
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
    if (!disponibilidadePublica || !data || data < dataAtualISO()) return false;
    const diaSemana = new Date(`${data}T12:00:00`).getDay();
    return Boolean(disponibilidadePublica.dias[diaSemana]) && !disponibilidadePublica.datasBloqueadas.includes(data);
}

function obterHorariosOcupados(data, barbeiroId) {
    return disponibilidadePublica.ocupacoes
        .filter(item => item.data === data && String(item.barbeiro_id) === barbeiroId)
        .map(item => item.horario);
}

function horarioFuturo(data, horario, agora = new Date()) {
    return new Date(`${data}T${horario}:00`) > agora;
}

function horarioDisponivel(horario) {
    return dataDisponivel(reserva.data) && Boolean(barbeiroSelecionado()) &&
        horarioFuturo(reserva.data, horario) &&
        disponibilidadePublica.horarios.some(item => item.ativo && item.horario === horario) &&
        !obterHorariosOcupados(reserva.data, reserva.barbeiroId).includes(horario);
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

        botao.addEventListener("click", evento => {
            if (enviandoReserva || etapaAgendamento !== agendamento || !dataDisponivel(data)) return;
            if (reserva.data !== data) {
                reserva.data = data;
                reserva.horario = null;
                mensagemReserva = "";
                avisoData.textContent = mensagemDisponibilidade();
            }
            for (const card of diasCliente.children) marcarOpcaoSelecionada(card, card === botao);
            renderizarHorariosCliente();
            if (!areaHorarios.hidden && evento.detail > 0 && matchMedia("(pointer: coarse)").matches) {
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

    const horarios = ordenarHorarios(disponibilidadePublica.horarios.filter(item => item.ativo));
    if (horarios.length === 0) {
        avisoHorarios.textContent = "Nenhum horário disponível no momento.";
        return;
    }

    const barbeiroId = reserva.barbeiroId;
    const ocupados = obterHorariosOcupados(data, barbeiroId);
    const agora = new Date();
    let temHorarioDisponivel = false;
    areaHorarios.hidden = false;

    horarios.forEach(({ horario }) => {
        const ocupado = ocupados.includes(horario);
        const encerrado = !horarioFuturo(data, horario, agora);
        const indisponivel = ocupado || encerrado;
        if (!indisponivel) temHorarioDisponivel = true;

        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "card-horario";
        botao.textContent = ocupado ? `${horario} ocupado` : encerrado ? `${horario} encerrado` : horario;
        botao.disabled = indisponivel;
        botao.classList.toggle("indisponivel", indisponivel);
        marcarOpcaoSelecionada(botao, !indisponivel && horario === reserva.horario);

        botao.addEventListener("click", () => {
            if (enviandoReserva || etapaAgendamento !== agendamento || data !== reserva.data ||
                barbeiroId !== reserva.barbeiroId || !horarioDisponivel(horario)) return;
            reserva.horario = horario;
            mensagemReserva = "";
            mudarEtapaAgendamento(dadosCliente);
        });
        horariosCliente.appendChild(botao);
    });

    if (!temHorarioDisponivel) {
        avisoHorarios.textContent = "Nenhum horário disponível nessa data. Escolha outra data.";
    }
}

function renderizarConfirmacao() {
    const { servico, data, horario, nomeProfissional } = reserva;
    dadosCliente.querySelector(".titulo-etapa").textContent = reservaConfirmada ? "Agendamento confirmado" : "Confirme a reserva";
    document.getElementById("resumo-servico").textContent = servico.rotulo;
    document.getElementById("resumo-preco").textContent = servico.preco;
    document.getElementById("resumo-profissional").textContent = nomeProfissional ?? barbeiroSelecionado()?.nome ?? "";
    document.getElementById("resumo-data-horario").textContent = `${formatarData(data)} às ${horario}`;
    formAgendamento.hidden = reservaConfirmada;
    formAgendamento.querySelector("fieldset").disabled = enviandoReserva;
    btnNovaReserva.hidden = !reservaConfirmada;
    avisoConfirmacao.textContent = enviandoReserva ? "Confirmando sua reserva…" : "";
}

btnEtapaAnterior.addEventListener("click", () => {
    const indice = etapasAgendamento.indexOf(etapaAgendamento);
    if (indice > 0 && !reservaConfirmada) mudarEtapaAgendamento(etapasAgendamento[indice - 1]);
});

btnNovaReserva.addEventListener("click", () => {
    if (!reservaConfirmada) return;
    reserva = {};
    reservaConfirmada = false;
    mudarEtapaAgendamento(servicos);
});

btnRecarregarDisponibilidade.addEventListener("click", () => {
    if (btnRecarregarDisponibilidade.hidden || enviandoReserva) return;
    etapaAgendamento.querySelector(".titulo-etapa").focus();
    carregarDisponibilidadePublica();
});

formAgendamento.addEventListener("submit", async e => {
    e.preventDefault();
    if (enviandoReserva || reservaConfirmada || etapaAgendamento !== dadosCliente) return;
    if (!formAgendamento.reportValidity()) return;

    const nome = nomeCliente.value.trim();
    const whatsapp = whatsappCliente.value.trim();
    if (!nome || !whatsapp) {
        avisoConfirmacao.textContent = "Preencha seu nome e WhatsApp.";
        (nome ? whatsappCliente : nomeCliente).focus();
        return;
    }

    const barbeiro = barbeiroSelecionado();
    if (!reserva.servico || !horarioDisponivel(reserva.horario)) {
        reserva.horario = null;
        mensagemReserva = "O horário selecionado está indisponível. Escolha outro horário.";
        mudarEtapaAgendamento(barbeiro ? agendamento : barbeirosSection);
        return;
    }

    const { servico, data, horario, barbeiroId } = reserva;
    const agendamentoCliente = {
        servico: servico.nome,
        preco: servico.preco,
        data,
        horario,
        nome,
        whatsapp,
        barbeiro_id: barbeiroId,
        barbeiro_nome: barbeiro.nome
    };

    enviandoReserva = true;
    renderizarEtapaAgendamento();
    try {
        await criarAgendamentoSupabase(agendamentoCliente);
    } catch (erro) {
        mensagemReserva = erro?.code === "23505"
            ? "Não foi possível reservar esse horário. Escolha outro horário."
            : "Não foi possível confirmar sua reserva. Confira a disponibilidade antes de tentar novamente.";
    } finally {
        enviandoReserva = false;
    }

    if (mensagemReserva) {
        await carregarDisponibilidadePublica();
        return;
    }

    disponibilidadePublica.ocupacoes.push({ data, horario, barbeiro_id: barbeiroId });
    reserva.nomeProfissional = barbeiro.nome;
    reservaConfirmada = true;
    formAgendamento.reset();
    renderizarEtapaAgendamento(true);
});

btnAdmin.addEventListener("click", () => {
    if (enviandoReserva) return;
    areaCliente.style.display = "none";
    areaLogin.style.display = "block";
    areaAdmin.style.display = "none";
    erroLogin.textContent = "";
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
    agendamentosPrivados = [];
    diasDisponiveisCache = {};
    horariosDisponiveisCache = [];
    datasBloqueadasCache = [];
    barbeirosCache = [];

    areaAdmin.style.display = "none";
    formEditar.style.display = "none";
    formEditar.reset();
    editarIndex.value = "";
    buscaAgendamento.value = "";
    filtroData.value = "";
    filtroMesFaturamento.value = "";
    novoHorario.value = "";
    novaDataBloqueada.value = "";
    carregarPainelAdmin();
    atualizarSaudacao();
}

function sessaoPainelAtiva(sessao) {
    return Boolean(sessao && sessaoPainel === sessao && sessaoAuth === sessao.auth);
}

async function confirmarSessaoAuth(auth) {
    if (!auth || sessaoAuth !== auth) return false;

    try {
        const { data, error } = await supabaseClient.auth.getSession();
        return !error && sessaoAuth === auth && identificarSessao(data?.session) === auth.chave;
    } catch {
        return false;
    }
}

function loginAtual(tentativa) {
    return tentativaLogin === tentativa && tentativa.auth && sessaoAuth === tentativa.auth;
}

function pedirNovoLogin() {
    tentativaLogin = null;
    limparPainel();
    areaLogin.style.display = "block";
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
    botao.disabled = true;
    erroLogin.textContent = "";

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

        const sessao = { auth: tentativa.auth, tipo, barbeiroId, controlador: new AbortController() };
        const dados = await consultarDadosPainel(sessao);
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
        formLogin.reset();
    } catch {
        if (tentativaLogin === tentativa) {
            limparPainel();
            erroLogin.textContent = "Não foi possível carregar o painel. Tente novamente.";
        }
    } finally {
        if (tentativaLogin === tentativa) tentativaLogin = null;
        botao.disabled = false;
    }
});

btnVoltar.addEventListener("click", async () => {
    if (encerrandoSessao) return;
    encerrandoSessao = true;
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

    renderizarDiasAdmin();
    renderizarHorariosAdmin();
    renderizarDatasBloqueadas();
    atualizarAgendaPainel();
    renderizarAgendamentos();
    renderizarFaturamento();
}

function renderizarDiasAdmin() {
    checkboxesDia.forEach(checkbox => {
        checkbox.checked = Boolean(diasDisponiveisCache[checkbox.dataset.dia]);
        if (!sessaoPainel) checkbox.disabled = false;
    });
}

checkboxesDia.forEach(checkbox => {
    checkbox.addEventListener("change", async () => {
        const sessao = sessaoPainel;
        if (!sessaoPainelAtiva(sessao)) return;
        checkbox.disabled = true;

        try {
            await salvarDiaDisponivelSupabase(sessao, checkbox.dataset.dia, checkbox.checked);
        } catch (erro) {
            console.error("Erro ao salvar dias disponiveis.", erro);
            alert("Nao foi possivel salvar os dias disponiveis.");
        } finally {
            if (sessaoPainelAtiva(sessao)) {
                checkbox.disabled = false;
                renderizarDiasAdmin();
            }
        }
    });
});

formHorario.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sessao = sessaoPainel;
    if (!sessaoPainelAtiva(sessao)) return;

    const horario = novoHorario.value;
    const horarioExiste = horariosDisponiveisCache.some(item => item.horario === horario);

    if (!horario || horarioExiste) {
        novoHorario.value = "";
        return;
    }

    try {
        await salvarHorarioDisponivelSupabase(sessao, horario, true);
    } catch (erro) {
        console.error("Erro ao salvar horario.", erro);
        alert("Nao foi possivel salvar o horario.");
        return;
    }

    if (!sessaoPainelAtiva(sessao)) return;
    novoHorario.value = "";
    renderizarHorariosAdmin();
});

function renderizarHorariosAdmin() {
    const sessao = sessaoPainel;
    const horarios = ordenarHorarios(horariosDisponiveisCache);

    listaHorariosAdmin.innerHTML = "";

    horarios.forEach(item => {
        const linha = document.createElement("div");
        linha.className = "horario-admin-item";

        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        const texto = document.createElement("span");
        const remover = document.createElement("button");

        checkbox.type = "checkbox";
        checkbox.checked = item.ativo;
        texto.textContent = item.horario;
        remover.type = "button";
        remover.textContent = "Remover";
        remover.className = "btn-excluir pequeno";

        checkbox.addEventListener("change", async () => {
            if (!sessaoPainelAtiva(sessao)) return;
            checkbox.disabled = true;
            remover.disabled = true;

            try {
                await salvarHorarioDisponivelSupabase(sessao, item.horario, checkbox.checked);
            } catch (erro) {
                console.error("Erro ao atualizar horario.", erro);
                alert("Nao foi possivel atualizar o horario.");
            } finally {
                if (sessaoPainelAtiva(sessao)) renderizarHorariosAdmin();
            }
        });

        remover.addEventListener("click", async () => {
            if (!sessaoPainelAtiva(sessao)) return;
            if (!confirm(`Remover o horario ${item.horario}?`)) return;

            try {
                await removerHorarioSupabase(sessao, item.horario);
            } catch (erro) {
                console.error("Erro ao remover horario.", erro);
                alert("Nao foi possivel remover o horario.");
                return;
            }

            if (sessaoPainelAtiva(sessao)) renderizarHorariosAdmin();
        });

        label.appendChild(checkbox);
        label.appendChild(texto);
        linha.appendChild(label);
        linha.appendChild(remover);
        listaHorariosAdmin.appendChild(linha);
    });
}

function obterAtendimentosFuturos() {
    const agora = new Date();
    return agendamentosPrivados
        .filter(item => {
            if (!item.data || !item.horario) return false;
            return new Date(`${item.data}T${item.horario}:00`) >= agora;
        })
        .sort((a, b) => {
            return `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`);
        });
}

function renderizarProximosAtendimentos(proximos) {
    listaProximosAtendimentos.innerHTML = "";

    if (proximos.length === 0) {
        listaProximosAtendimentos.innerHTML = '<p class="mensagem-vazia">Nenhum proximo atendimento encontrado.</p>';
        return;
    }

    proximos.slice(0, 5).forEach(item => {
        const linha = document.createElement("div");
        const detalhes = document.createElement("div");
        const cliente = document.createElement("strong");
        const servico = document.createElement("span");
        const whatsapp = document.createElement("small");
        linha.className = "proximo-atendimento-item";
        cliente.textContent = item.nome || "Cliente";
        servico.textContent = `${item.servico || "Servico"} - ${formatarData(item.data)} as ${item.horario}`;
        whatsapp.textContent = item.whatsapp || "";
        detalhes.appendChild(cliente);
        detalhes.appendChild(servico);
        linha.appendChild(detalhes);
        linha.appendChild(whatsapp);
        listaProximosAtendimentos.appendChild(linha);
    });
}

function renderizarDatasBloqueadas() {
    const sessao = sessaoPainel;
    const datas = datasBloqueadasCache;

    listaDatasBloqueadas.innerHTML = "";

    if (datas.length === 0) {
        listaDatasBloqueadas.innerHTML = '<p class="mensagem-vazia">Nenhuma data bloqueada.</p>';
        return;
    }

    datas.forEach(data => {
        const linha = document.createElement("div");
        const texto = document.createElement("span");
        const remover = document.createElement("button");

        linha.className = "data-bloqueada-item";
        texto.textContent = formatarData(data);
        remover.type = "button";
        remover.className = "btn-excluir pequeno";
        remover.textContent = "Remover";

        remover.addEventListener("click", async () => {
            if (!sessaoPainelAtiva(sessao)) return;
            if (!confirm(`Remover bloqueio de ${formatarData(data)}?`)) return;

            try {
                await removerDataBloqueadaSupabase(sessao, data);
            } catch (erro) {
                console.error("Erro ao remover data bloqueada.", erro);
                alert("Nao foi possivel remover a data bloqueada.");
                return;
            }

            if (sessaoPainelAtiva(sessao)) renderizarDatasBloqueadas();
        });

        linha.appendChild(texto);
        linha.appendChild(remover);
        listaDatasBloqueadas.appendChild(linha);
    });
}

function agendamentosFiltrados() {
    const termo = buscaAgendamento.value.trim().toLowerCase();
    const data = filtroData.value;

    return agendamentosPrivados
        .filter(agendamentoItem => {
            const textoCompleto = [
                agendamentoItem.nome,
                agendamentoItem.servico,
                agendamentoItem.whatsapp
            ].join(" ").toLowerCase();

            const combinaTexto = !termo || textoCompleto.includes(termo);
            const combinaData = !data || agendamentoItem.data === data;

            return combinaTexto && combinaData;
        })
        .sort((a, b) => {
            const dataA = `${a.data} ${a.horario}`;
            const dataB = `${b.data} ${b.horario}`;
            return dataA.localeCompare(dataB);
        });
}

function renderizarAgendamentos() {
    const sessao = sessaoPainel;
    const agendamentos = agendamentosFiltrados();

    tabelaAgendamentos.innerHTML = "";
    mensagemAgendamentos.textContent = "";

    if (agendamentos.length === 0) {
        mensagemAgendamentos.textContent = "Nenhum agendamento encontrado.";
        return;
    }

    agendamentos.forEach(agendamentoItem => {
        const linha = document.createElement("tr");
        const acoes = document.createElement("td");
        const botaoEditar = document.createElement("button");
        const botaoExcluir = document.createElement("button");

        linha.appendChild(criarCelula(agendamentoItem.nome));
        linha.appendChild(criarCelula(agendamentoItem.servico));
        linha.appendChild(criarCelula(agendamentoItem.preco || formatarMoeda(0)));
        linha.appendChild(criarCelula(formatarData(agendamentoItem.data)));
        linha.appendChild(criarCelula(agendamentoItem.horario));
        linha.appendChild(criarCelula(agendamentoItem.barbeiro_nome));
        linha.appendChild(criarCelula(agendamentoItem.whatsapp));


        acoes.className = "acoes-tabela";

        botaoEditar.type = "button";
        botaoEditar.className = "btn-editar";
        botaoEditar.dataset.id = agendamentoItem.id;
        botaoEditar.textContent = "Editar";
        botaoEditar.addEventListener("click", () => {
            if (sessaoPainelAtiva(sessao)) abrirEdicao(agendamentoItem.id);
        });

        botaoExcluir.type = "button";
        botaoExcluir.className = "btn-excluir pequeno";
        botaoExcluir.dataset.id = agendamentoItem.id;
        botaoExcluir.textContent = "Excluir";
        botaoExcluir.addEventListener("click", () => excluirAgendamento(sessao, agendamentoItem.id));

        acoes.appendChild(botaoEditar);
        acoes.appendChild(botaoExcluir);
        linha.appendChild(acoes);

        tabelaAgendamentos.appendChild(linha);
    });
}

function criarCelula(valor) {
    const celula = document.createElement("td");
    celula.textContent = valor || "-";
    return celula;
}

function atualizarResumo(proximos) {
    const agendamentos = agendamentosPrivados;
    const hoje = dataAtualISO();
    const mesAtual = mesAtualISO();

    totalAgendamentos.textContent = agendamentos.filter(item => {
        return item.data && item.data.slice(0, 7) === mesAtual;
    }).length;
    agendamentosHoje.textContent = agendamentos.filter(item => item.data === hoje).length;
    proximoHorario.textContent = proximos.length ? proximos[0].horario : "--:--";
}

function atualizarAgendaPainel() {
    const proximos = obterAtendimentosFuturos();
    renderizarProximosAtendimentos(proximos);
    atualizarResumo(proximos);
}

function renderizarFaturamento() {
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

btnLimparFiltros.addEventListener("click", () => {
    buscaAgendamento.value = "";
    filtroData.value = "";
    renderizarAgendamentos();
});

formDataBloqueada.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sessao = sessaoPainel;
    if (!sessaoPainelAtiva(sessao)) return;

    const data = novaDataBloqueada.value;

    if (!data || datasBloqueadasCache.includes(data)) {
        novaDataBloqueada.value = "";
        return;
    }

    try {
        await salvarDataBloqueadaSupabase(sessao, data);
    } catch (erro) {
        console.error("Erro ao bloquear data.", erro);
        alert("Nao foi possivel bloquear a data.");
        return;
    }

    if (!sessaoPainelAtiva(sessao)) return;
    novaDataBloqueada.value = "";
    renderizarDatasBloqueadas();
});

function abrirEdicao(id) {
    const agendamentoItem = agendamentosPrivados.find(item => item.id === id);

    if (!agendamentoItem) return;

    editarIndex.value = id;
    editarNome.value = agendamentoItem.nome;
    editarWhatsapp.value = agendamentoItem.whatsapp;
    editarServico.value = agendamentoItem.servico;
    editarData.value = agendamentoItem.data;
    editarHorario.value = agendamentoItem.horario;

    formEditar.style.display = "block";
    formEditar.scrollIntoView({ behavior: "smooth" });
}

formEditar.addEventListener("submit", async (e) => {
    e.preventDefault();

    const sessao = sessaoPainel;
    if (!sessaoPainelAtiva(sessao)) return;
    const agendamentoItem = agendamentosPrivados.find(item => String(item.id) === editarIndex.value);

    if (!agendamentoItem) return;

    const agendamentoAtualizado = {
        nome: editarNome.value.trim(),
        whatsapp: editarWhatsapp.value.trim(),
        servico: editarServico.value.trim(),
        data: editarData.value,
        horario: editarHorario.value
    };

    try {
        if (!await atualizarAgendamentoSupabase(sessao, agendamentoItem.id, agendamentoAtualizado) ||
            !sessaoPainelAtiva(sessao)) return;
    } catch (erro) {
        console.error("Erro ao editar agendamento.", erro);
        alert("Nao foi possivel editar o agendamento.");
        return;
    }

    formEditar.style.display = "none";
    renderizarAgendamentos();
    atualizarAgendaPainel();
    renderizarFaturamento();
});

btnCancelarEdicao.addEventListener("click", () => {
    formEditar.style.display = "none";
    formEditar.reset();
});

async function excluirAgendamento(sessao, id) {
    if (!sessaoPainelAtiva(sessao)) return;
    if (!agendamentosPrivados.some(item => item.id === id)) return;
    if (!confirm("Deseja realmente excluir este agendamento?")) return;

    try {
        if (!await excluirAgendamentoSupabase(sessao, id) || !sessaoPainelAtiva(sessao)) return;
    } catch (erro) {
        console.error("Erro ao excluir agendamento.", erro);
        alert("Nao foi possivel excluir o agendamento.");
        return;
    }

    renderizarAgendamentos();
    atualizarAgendaPainel();
    renderizarFaturamento();
}

carregarDisponibilidadePublica();
