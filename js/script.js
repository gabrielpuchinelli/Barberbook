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
let horarioSelecionado = null;
let agendamentosPrivados = [];
let diasDisponiveisCache = {};
let horariosDisponiveisCache = [];
let datasBloqueadasCache = [];
let barbeirosCache = [];
let sessaoAuth = null;
let tentativaLogin = null;
let sessaoPainel = null;
let encerrandoSessao = false;

localStorage.removeItem("agendamentos");
localStorage.removeItem("barbeiro_nome");
localStorage.removeItem("horario");

function renderizarBarbeirosCliente() {
    const barbeiroSelecionado = localStorage.getItem("barbeiro_id");
    const barbeiros = disponibilidadePublica?.barbeiros;

    listaBarbeiros.replaceChildren();

    if (!barbeiros) return;
    if (barbeiros.length === 0) {
        listaBarbeiros.innerHTML = '<p class="mensagem-vazia">Nenhum barbeiro disponivel no momento.</p>';
        return;
    }

    barbeiros.forEach(item => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "card-barbeiro";
        botao.textContent = item.nome;

        if (String(item.id) === String(barbeiroSelecionado)) {
            botao.classList.add("selecionado");
        }

        botao.addEventListener("click", () => {
            if (localStorage.getItem("barbeiro_id") !== String(item.id)) {
                invalidarHorarioSelecionado();
            }
            localStorage.setItem("barbeiro_id", item.id);
            renderizarBarbeirosCliente();
            renderizarHorariosCliente();
        });

        listaBarbeiros.appendChild(botao);
    });
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
    const consulta = ++consultaDisponibilidade;
    invalidarHorarioSelecionado();
    disponibilidadePublica = null;
    estadoDisponibilidade = "carregando";
    renderizarDisponibilidadeCliente();

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

    renderizarDisponibilidadeCliente();
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



cardsServico.forEach(card => {
    card.addEventListener("click", () => {

        const servicoEscolhido = card.dataset.servico;
        const precoEscolhido = card.dataset.preco;

        localStorage.setItem("servico", servicoEscolhido);
        localStorage.setItem("preco", precoEscolhido);
        invalidarHorarioSelecionado();

        cardsServico.forEach(item => item.classList.remove("selecionado"));
        card.classList.add("selecionado");

        servicos.style.display = "none";
        agendamento.style.display = "block";
        barbeirosSection.style.display = "block";
        renderizarDiasCliente();
        renderizarBarbeirosCliente();
        agendamento.scrollIntoView({ behavior: "smooth" });
    });
});

function renderizarHorariosCliente() {
    horariosCliente.innerHTML = "";
    avisoData.textContent = "";
    btnRecarregarDisponibilidade.hidden = estadoDisponibilidade !== "erro";

    if (!disponibilidadePublica) {
        areaHorarios.style.display = "none";
        dadosCliente.style.display = "none";
        avisoData.textContent = estadoDisponibilidade === "erro"
            ? "Não foi possível verificar a disponibilidade. Tente novamente."
            : "Carregando disponibilidade...";
        return;
    }

    const dataSelecionada = localStorage.getItem("data");
    if (!dataSelecionada) {
        areaHorarios.style.display = "none";
        return;
    }

    const { dias: diasDisponiveis, datasBloqueadas, horarios } = disponibilidadePublica;
    const diaSemana = new Date(`${dataSelecionada}T12:00:00`).getDay();

    if (!diasDisponiveis[diaSemana]) {
        areaHorarios.style.display = "none";
        avisoData.textContent = "Este dia nao esta disponivel para agendamentos.";
        return;
    }

    if (datasBloqueadas.includes(dataSelecionada)) {
        areaHorarios.style.display = "none";
        avisoData.textContent = "Esta data foi bloqueada pelo administrador.";
        return;
    }

    const barbeiro = barbeiroSelecionado();
    if (!barbeiro) {
        areaHorarios.style.display = "block";
        avisoData.textContent = "Selecione um barbeiro para ver a disponibilidade no horario.";
        horariosCliente.innerHTML = '<p class="mensagem-vazia">Selecione um barbeiro.</p>';
        return;
    }

    const horariosDisponiveis = horarios.filter(item => item.ativo);
    if (horariosDisponiveis.length === 0) {
        areaHorarios.style.display = "none";
        avisoData.textContent = "Nenhum horario disponivel no momento.";
        return;
    }

    areaHorarios.style.display = "block";
    const horariosOcupados = obterHorariosOcupados(dataSelecionada, barbeiro.id);

    ordenarHorarios(horariosDisponiveis).forEach(item => {
        const botao = document.createElement("button");
        const horarioOcupado = horariosOcupados.includes(item.horario);

        botao.type = "button";
        botao.className = "card-horario";
        botao.textContent = horarioOcupado ? `${item.horario} ocupado` : item.horario;
        botao.disabled = horarioOcupado;

        if (horarioOcupado) {
            botao.classList.add("indisponivel");
        }


            botao.addEventListener("click", () => {
                if (horarioOcupado) return;

                document.querySelectorAll(".card-horario").forEach(horario => {
                    horario.classList.remove("selecionado");
                });

                botao.classList.add("selecionado");
                horarioSelecionado = { data: dataSelecionada, barbeiroId: barbeiro.id, horario: item.horario };

                areaHorarios.style.display = "none";
                dadosCliente.style.display = "block";
                dadosCliente.scrollIntoView({ behavior: "smooth" });

            });


        horariosCliente.appendChild(botao);
    });
}

function renderizarDiasCliente() {
    diasCliente.innerHTML = "";
    if (!disponibilidadePublica) return;

    const { dias: diasDisponiveis, datasBloqueadas } = disponibilidadePublica;
    const ordemDias = [1, 2, 3, 4, 5, 6, 0];

    ordemDias.forEach(dia => {
        const botao = document.createElement("button");
        const dataDia = proximaDataDoDia(dia);
        const dataBloqueada = datasBloqueadas.includes(dataDia);
        const disponivel = Boolean(diasDisponiveis[dia]) && !dataBloqueada;

        botao.type = "button";
        botao.className = "card-dia";
        botao.disabled = !disponivel;

        if (localStorage.getItem("data") === dataDia) {
            botao.classList.add("selecionado");
        }

        if (!disponivel) {
            botao.classList.add("indisponivel");
        }

        const nomeDia = document.createElement("strong");
        const dataFormatada = document.createElement("span");
        nomeDia.textContent = NOMES_DIAS[dia];
        dataFormatada.textContent = formatarData(dataDia);
        botao.appendChild(nomeDia);
        botao.appendChild(dataFormatada);

            botao.addEventListener("click", () => {
                if (!disponivel) return;

                localStorage.setItem("data", dataDia);
                invalidarHorarioSelecionado();
                areaHorarios.style.display = "block";
                renderizarDiasCliente();
                renderizarHorariosCliente();
            });

        diasCliente.appendChild(botao);
    });
}

function barbeiroSelecionado() {
    const id = localStorage.getItem("barbeiro_id");
    return disponibilidadePublica?.barbeiros.find(item => String(item.id) === id);
}

function invalidarHorarioSelecionado() {
    horarioSelecionado = null;
    dadosCliente.style.display = "none";
}

function obterHorariosOcupados(data, barbeiroId) {
    return disponibilidadePublica.ocupacoes
        .filter(item => item.data === data && String(item.barbeiro_id) === String(barbeiroId))
        .map(item => item.horario);
}

function renderizarDisponibilidadeCliente() {
    renderizarDiasCliente();
    renderizarBarbeirosCliente();
    renderizarHorariosCliente();
}

btnRecarregarDisponibilidade.addEventListener("click", carregarDisponibilidadePublica);

formAgendamento.addEventListener("submit", async (e) => {
    e.preventDefault();

    const disponibilidade = disponibilidadePublica;
    if (!disponibilidade) return;

    const barbeiro = barbeiroSelecionado();
    const dataSelecionada = localStorage.getItem("data");
    if (!barbeiro || !horarioSelecionado || horarioSelecionado.data !== dataSelecionada ||
        horarioSelecionado.barbeiroId !== barbeiro.id) {
        alert("Escolha um dia, um profissional e um horário antes de confirmar.");
        return;
    }

    const agendamentoCliente = {
        servico: localStorage.getItem("servico"),
        preco: localStorage.getItem("preco"),
        data: dataSelecionada,
        horario: horarioSelecionado.horario,
        nome: document.getElementById("nome").value.trim(),
        whatsapp: document.getElementById("whatsapp").value.trim(),
        barbeiro_id: String(barbeiro.id),
        barbeiro_nome: barbeiro.nome
    };

    const { data, horario, barbeiro_id } = agendamentoCliente;
    const diaSemana = new Date(`${data}T12:00:00`).getDay();
    if (!disponibilidade.dias[diaSemana] || disponibilidade.datasBloqueadas.includes(data) ||
        !disponibilidade.horarios.some(item => item.ativo && item.horario === horario) ||
        obterHorariosOcupados(data, barbeiro_id).includes(horario)) {
        invalidarHorarioSelecionado();
        renderizarHorariosCliente();
        avisoData.textContent = "O horário selecionado está indisponível. Escolha outro horário.";
        return;
    }

    try {
        await criarAgendamentoSupabase(agendamentoCliente);
    } catch (erro) {
        if (erro?.code === "23505") {
            await carregarDisponibilidadePublica();
            if (disponibilidadePublica) {
                avisoData.textContent = "Não foi possível reservar esse horário. Confira a disponibilidade.";
            }
        } else {
            alert("Não foi possível confirmar o agendamento. Tente novamente.");
        }
        return;
    }

    if (disponibilidade === disponibilidadePublica) {
        disponibilidade.ocupacoes.push({ data, horario, barbeiro_id });
    } else if (areaCliente.style.display !== "none") {
        carregarDisponibilidadePublica();
    }

    alert("Agendamento confirmado com sucesso!");

    formAgendamento.reset();
    localStorage.removeItem("servico");
    localStorage.removeItem("preco");
    localStorage.removeItem("data");
    invalidarHorarioSelecionado();
    localStorage.removeItem("barbeiro_id");
    areaHorarios.style.display = "none";
    barbeirosSection.style.display = "none";
    servicos.style.display = "block";
    agendamento.style.display = "none";
    cardsServico.forEach(card => card.classList.remove("selecionado"));
    renderizarHorariosCliente();
});

btnAdmin.addEventListener("click", () => {
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
