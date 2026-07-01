const cardsServico = document.querySelectorAll(".card-servico");
const servicos = document.getElementById("servicos");
const agendamento = document.getElementById("agendamento");
const avisoData = document.getElementById("aviso-data");
const diasCliente = document.getElementById("dias-cliente");
const areaHorarios = document.getElementById("area-horarios");
const horariosCliente = document.getElementById("horarios-cliente");
const dadosCliente = document.getElementById("dados-cliente");
const formAgendamento = document.getElementById("form-agendamento");

const barbeiros = document.getElementById("barbeiros");
const listaBarbeiros = document.getElementById("lista-barbeiros");
const avisoBarbeiro = document.getElementById("aviso-barbeiro");


const btnAdmin = document.getElementById("btn-admin");
const areaCliente = document.getElementById("area-cliente");
const areaLogin = document.getElementById("area-login");
const areaAdmin = document.getElementById("area-admin");
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

const HORARIOS_PADRAO = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
    "19:00"
];

const DIAS_PADRAO = {
    0: false,
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true
};

const NOMES_DIAS = {
    0: "Domingo",
    1: "Segunda",
    2: "Terca",
    3: "Quarta",
    4: "Quinta",
    5: "Sexta",
    6: "Sabado"
};

let agendamentosCache = [];
let diasDisponiveisCache = { ...DIAS_PADRAO };
let horariosDisponiveisCache = HORARIOS_PADRAO.map(horario => ({ horario, ativo: true }));
let datasBloqueadasCache = [];

function lerJSON(chave, fallback) {
    const dados = localStorage.getItem(chave);

    if (!dados) return fallback;

    try {
        return JSON.parse(dados);
    } catch {
        return fallback;
    }
}

function salvarJSON(chave, valor) {
    localStorage.setItem(chave, JSON.stringify(valor));
}

function obterAgendamentos() {
    return agendamentosCache;
}

function salvarAgendamentos(agendamentos) {
    agendamentosCache = agendamentos;
    salvarJSON("agendamentos", agendamentos);
}

function obterDiasDisponiveis() {
    return diasDisponiveisCache;
}

function salvarDiasDisponiveis(dias) {
    diasDisponiveisCache = dias;
    salvarJSON("diasDisponiveis", dias);
}

function obterHorariosDisponiveis() {
    return horariosDisponiveisCache;
}

function salvarHorariosDisponiveis(horarios) {
    horariosDisponiveisCache = horarios;
    salvarJSON("horariosDisponiveis", horarios);
}

function obterDatasBloqueadas() {
    return datasBloqueadasCache;
}

function salvarDatasBloqueadas(datas) {
    datasBloqueadasCache = datas;
    salvarJSON("datasBloqueadas", datas);
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

async function carregarDadosSupabase(carregarDadosPrivados = false) {
    try {
        const tabelaAgendamentos = carregarDadosPrivados ? "agendamentos" : "agendamentos_publicos";
        const [agendamentosResposta, diasResposta, horariosResposta, datasBloqueadasResposta] = await Promise.all([
            supabaseClient.from(tabelaAgendamentos).select("*").order("data").order("horario"),
            supabaseClient.from("dias_disponiveis").select("*").order("dia_semana"),
            supabaseClient.from("horarios_disponiveis").select("*").order("horario"),
            supabaseClient.from("datas_bloqueadas").select("*").order("data")
        ]);

        if (agendamentosResposta.error) throw agendamentosResposta.error;
        if (diasResposta.error) throw diasResposta.error;
        if (horariosResposta.error) throw horariosResposta.error;
        if (datasBloqueadasResposta.error) throw datasBloqueadasResposta.error;

        salvarAgendamentos((agendamentosResposta.data || []).map(normalizarAgendamento));

        if (diasResposta.data && diasResposta.data.length > 0) {
            const dias = { ...DIAS_PADRAO };
            diasResposta.data.forEach(item => {
                dias[item.dia_semana] = item.ativo;
            });
            salvarDiasDisponiveis(dias);
        }

        if (horariosResposta.data && horariosResposta.data.length > 0) {
            salvarHorariosDisponiveis(horariosResposta.data.map(item => ({
                horario: item.horario.slice(0, 5),
                ativo: item.ativo
            })));
        }

        salvarDatasBloqueadas((datasBloqueadasResposta.data || []).map(item => item.data));
    } catch (erro) {
        console.error("Nao foi possivel carregar dados do Supabase.", erro);
        salvarAgendamentos(lerJSON("agendamentos", []));
        salvarDiasDisponiveis(lerJSON("diasDisponiveis", DIAS_PADRAO));
        salvarHorariosDisponiveis(lerJSON(
            "horariosDisponiveis",
            HORARIOS_PADRAO.map(horario => ({ horario, ativo: true }))
        ));
        salvarDatasBloqueadas(lerJSON("datasBloqueadas", []));
    }
}

async function criarAgendamentoSupabase(agendamentoCliente) {
    const { error } = await supabaseClient
        .from("agendamentos")
        .insert([agendamentoCliente]);

    if (error) throw error;

    salvarAgendamentos([...obterAgendamentos(), normalizarAgendamento(agendamentoCliente)]);
}

async function atualizarAgendamentoSupabase(id, agendamentoAtualizado) {
    const { data, error } = await supabaseClient
        .from("agendamentos")
        .update(agendamentoAtualizado)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;

    salvarAgendamentos(obterAgendamentos().map(item => {
        return item.id === id ? normalizarAgendamento(data) : item;
    }));
}

async function excluirAgendamentoSupabase(id) {
    const { error } = await supabaseClient
        .from("agendamentos")
        .delete()
        .eq("id", id);

    if (error) throw error;

    salvarAgendamentos(obterAgendamentos().filter(item => item.id !== id));
}

async function salvarDiasDisponiveisSupabase(dias) {
    salvarDiasDisponiveis(dias);

    const registros = Object.entries(dias).map(([dia_semana, ativo]) => ({
        dia_semana: Number(dia_semana),
        ativo
    }));

    const { error } = await supabaseClient
        .from("dias_disponiveis")
        .upsert(registros, { onConflict: "dia_semana" });

    if (error) throw error;
}

async function salvarHorariosDisponiveisSupabase(horarios) {
    salvarHorariosDisponiveis(ordenarHorarios(horarios));

    const { error } = await supabaseClient
        .from("horarios_disponiveis")
        .upsert(horarios, { onConflict: "horario" });

    if (error) throw error;
}

async function removerHorarioSupabase(horario) {
    const { error } = await supabaseClient
        .from("horarios_disponiveis")
        .delete()
        .eq("horario", horario);

    if (error) throw error;
}

async function salvarDataBloqueadaSupabase(data) {
    const { error } = await supabaseClient
        .from("datas_bloqueadas")
        .insert([{ data }]);

    if (error) throw error;

    salvarDatasBloqueadas([...obterDatasBloqueadas(), data].sort());
}

async function removerDataBloqueadaSupabase(data) {
    const { error } = await supabaseClient
        .from("datas_bloqueadas")
        .delete()
        .eq("data", data);

    if (error) throw error;

    salvarDatasBloqueadas(obterDatasBloqueadas().filter(item => item !== data));
}

function dataAtualISO() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
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

const BARBEIROS_FALLBACK = [
    { id: "1", nome: "Niel" },
    { id: "2", nome: "Edvan" },
];

async function carregarBarbeirosAtivos() {
    if (!supabaseClient) return BARBEIROS_FALLBACK;

    try {
        const { data, error } = await supabaseClient
            .from("barbeiros")
            .select("id, nome")
            .eq("ativo", true)
            .order("nome");

        if (error) throw error;

        return data && data.length ? data.map(b => ({ id: b.id, nome: b.nome })) : [];
    } catch (erro) {
        console.error("Erro ao carregar barbeiros.", erro);
        return BARBEIROS_FALLBACK;
    }
}

function renderizarBarbeirosCliente(barbeirosLista) {
    if (!listaBarbeiros) return;

    const selecionadoId = localStorage.getItem("barbeiro_id");
    listaBarbeiros.innerHTML = "";
    avisoBarbeiro.textContent = "";

    if (!barbeirosLista || barbeirosLista.length === 0) {
        avisoBarbeiro.textContent = "Nenhum barbeiro ativo no momento.";
        return;
    }

    barbeirosLista.forEach(barbeiro => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "card-horario";
        const estaSelecionado = String(selecionadoId) === String(barbeiro.id);
        if (estaSelecionado) botao.classList.add("selecionado");

        botao.textContent = barbeiro.nome;
        botao.addEventListener("click", () => {
            localStorage.setItem("barbeiro_id", barbeiro.id);
            localStorage.setItem("barbeiro_nome", barbeiro.nome);

            document.querySelectorAll("#lista-barbeiros .card-horario").forEach(btn => {
                btn.classList.remove("selecionado");
            });
            botao.classList.add("selecionado");

            barbeiros.style.display = "none";
            dadosCliente.style.display = "block";
            dadosCliente.scrollIntoView({ behavior: "smooth" });
        });

        listaBarbeiros.appendChild(botao);
    });
}

cardsServico.forEach(card => {
    card.addEventListener("click", () => {

        const servicoEscolhido = card.dataset.servico;
        const precoEscolhido = card.dataset.preco;

        localStorage.setItem("servico", servicoEscolhido);
        localStorage.setItem("preco", precoEscolhido);

        cardsServico.forEach(item => item.classList.remove("selecionado"));
        card.classList.add("selecionado");

        servicos.style.display = "none";
        agendamento.style.display = "block";
        renderizarDiasCliente();
        agendamento.scrollIntoView({ behavior: "smooth" });
    });
});

function renderizarHorariosCliente() {
    const dataSelecionada = localStorage.getItem("data");

    const diasDisponiveis = obterDiasDisponiveis();
    const datasBloqueadas = obterDatasBloqueadas();
    const horariosDisponiveis = obterHorariosDisponiveis().filter(item => item.ativo);
    const horariosOcupados = obterAgendamentos()
        .filter(item => item.data === dataSelecionada)
        .map(item => item.horario);

    horariosCliente.innerHTML = "";
    avisoData.textContent = "";

    if (!dataSelecionada) {
        areaHorarios.style.display = "none";
        return;
    }

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

    if (horariosDisponiveis.length === 0) {
        areaHorarios.style.display = "none";
        avisoData.textContent = "Nenhum horario disponivel no momento.";
        return;
    }

    areaHorarios.style.display = "block";

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
                localStorage.setItem("horario", item.horario);

                dadosCliente.style.display = "none";

                barbeiros.style.display = "block";
                barbeiros.scrollIntoView({ behavior: "smooth" });

                localStorage.removeItem("barbeiro_id");
                localStorage.removeItem("barbeiro_nome");

                carregarBarbeirosAtivos().then(renderizarBarbeirosCliente);
            });


        horariosCliente.appendChild(botao);
    });
}

function renderizarDiasCliente() {
    const diasDisponiveis = obterDiasDisponiveis();
    const datasBloqueadas = obterDatasBloqueadas();
    const ordemDias = [1, 2, 3, 4, 5, 6, 0];

    diasCliente.innerHTML = "";

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

        botao.innerHTML = `
            <strong>${NOMES_DIAS[dia]}</strong>
            <span>${formatarData(dataDia)}</span>
        `;

        botao.addEventListener("click", () => {
            if (!disponivel) return;

            localStorage.setItem("data", dataDia);
            localStorage.removeItem("horario");
            dadosCliente.style.display = "none";
            renderizarDiasCliente();
            renderizarHorariosCliente();
        });

        diasCliente.appendChild(botao);
    });
}

formAgendamento.addEventListener("submit", async (e) => {
    e.preventDefault();

    const agendamentoCliente = {
        servico: localStorage.getItem("servico"),
        preco: localStorage.getItem("preco"),
        data: localStorage.getItem("data"),
        horario: localStorage.getItem("horario"),
        barbeiro_id: localStorage.getItem("barbeiro_id"),
        barbeiro_nome: localStorage.getItem("barbeiro_nome"),
        nome: document.getElementById("nome").value.trim(),
        whatsapp: document.getElementById("whatsapp").value.trim()
    };


    if (!agendamentoCliente.data || !agendamentoCliente.horario) {
        alert("Escolha um dia e um horario antes de confirmar.");
        return;
    }

    if (!agendamentoCliente.barbeiro_id || !agendamentoCliente.barbeiro_nome) {
        alert("Escolha um barbeiro antes de confirmar.");
        return;
    }


    try {
        await criarAgendamentoSupabase(agendamentoCliente);
    } catch (erro) {
        console.error("Erro ao salvar agendamento.", mensagemErroSupabase(erro), erro);
        alert(`Nao foi possivel confirmar o agendamento.\n\n${mensagemErroSupabase(erro)}`);
        return;
    }

    alert("Agendamento confirmado com sucesso!");

    formAgendamento.reset();
    localStorage.removeItem("data");
    localStorage.removeItem("horario");
    areaHorarios.style.display = "none";
    dadosCliente.style.display = "none";
    servicos.style.display = "block";
    agendamento.style.display = "none";
    cardsServico.forEach(card => card.classList.remove("selecionado"));
    renderizarHorariosCliente();
    renderizarProximosAtendimentos();
    renderizarFaturamento();
});

btnAdmin.addEventListener("click", () => {
    areaCliente.style.display = "none";
    areaLogin.style.display = "block";
    areaAdmin.style.display = "none";
    erroLogin.textContent = "";
});

formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value;

    erroLogin.textContent = "";

    const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password: senha
    });

    if (error) {
        console.error("Erro no login.", mensagemErroSupabase(error), error);
        erroLogin.textContent = mensagemErroSupabase(error) || "E-mail ou senha incorretos.";
        return;
    }

    const { data: usuarioAdmin, error: erroAdmin } = await supabaseClient.rpc("eh_admin");

    if (erroAdmin || !usuarioAdmin) {
        await supabaseClient.auth.signOut();
        erroLogin.textContent = "Este usuario nao tem permissao de administrador.";
        return;
    }

    areaLogin.style.display = "none";
    areaAdmin.style.display = "block";
    await carregarDadosSupabase(true);
    carregarPainelAdmin();
});

btnVoltar.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    areaAdmin.style.display = "none";
    areaLogin.style.display = "none";
    areaCliente.style.display = "block";
    formLogin.reset();
    await carregarDadosSupabase(false);
    renderizarDiasCliente();
});

function carregarPainelAdmin() {
    if (!filtroMesFaturamento.value) {
        filtroMesFaturamento.value = mesAtualISO();
    }

    renderizarDiasAdmin();
    renderizarHorariosAdmin();
    renderizarDatasBloqueadas();
    renderizarProximosAtendimentos();
    renderizarAgendamentos();
    renderizarFaturamento();
    atualizarResumo();
}

function renderizarDiasAdmin() {
    const diasDisponiveis = obterDiasDisponiveis();

    checkboxesDia.forEach(checkbox => {
        checkbox.checked = Boolean(diasDisponiveis[checkbox.dataset.dia]);
    });
}

checkboxesDia.forEach(checkbox => {
    checkbox.addEventListener("change", async () => {
        const diasDisponiveis = obterDiasDisponiveis();
        diasDisponiveis[checkbox.dataset.dia] = checkbox.checked;

        try {
            await salvarDiasDisponiveisSupabase(diasDisponiveis);
        } catch (erro) {
            console.error("Erro ao salvar dias disponiveis.", erro);
            alert("Nao foi possivel salvar os dias disponiveis.");
        }

        renderizarDiasCliente();
        renderizarHorariosCliente();
    });
});

formHorario.addEventListener("submit", async (e) => {
    e.preventDefault();

    const horario = novoHorario.value;
    const horarios = obterHorariosDisponiveis();
    const horarioExiste = horarios.some(item => item.horario === horario);

    if (!horario || horarioExiste) {
        novoHorario.value = "";
        return;
    }

    horarios.push({ horario, ativo: true });

    try {
        await salvarHorariosDisponiveisSupabase(horarios);
    } catch (erro) {
        console.error("Erro ao salvar horario.", erro);
        alert("Nao foi possivel salvar o horario.");
        return;
    }

    novoHorario.value = "";
    renderizarHorariosAdmin();
    renderizarHorariosCliente();
});

function renderizarHorariosAdmin() {
    const horarios = ordenarHorarios(obterHorariosDisponiveis());

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
            const horariosAtualizados = obterHorariosDisponiveis().map(horario => {
                if (horario.horario === item.horario) {
                    return { ...horario, ativo: checkbox.checked };
                }

                return horario;
            });

            try {
                await salvarHorariosDisponiveisSupabase(horariosAtualizados);
            } catch (erro) {
                console.error("Erro ao atualizar horario.", erro);
                alert("Nao foi possivel atualizar o horario.");
            }

            renderizarHorariosCliente();
        });

        remover.addEventListener("click", async () => {
            if (!confirm(`Remover o horario ${item.horario}?`)) return;

            const horariosAtualizados = obterHorariosDisponiveis().filter(horario => {
                return horario.horario !== item.horario;
            });

            try {
                await removerHorarioSupabase(item.horario);
                salvarHorariosDisponiveis(horariosAtualizados);
            } catch (erro) {
                console.error("Erro ao remover horario.", erro);
                alert("Nao foi possivel remover o horario.");
                return;
            }

            renderizarHorariosAdmin();
            renderizarHorariosCliente();
        });

        label.appendChild(checkbox);
        label.appendChild(texto);
        linha.appendChild(label);
        linha.appendChild(remover);
        listaHorariosAdmin.appendChild(linha);
    });
}

function renderizarProximosAtendimentos() {
    const agora = new Date();
    const proximos = obterAgendamentos()
        .filter(item => {
            if (!item.data || !item.horario) return false;
            return new Date(`${item.data}T${item.horario}:00`) >= agora;
        })
        .sort((a, b) => {
            return `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`);
        })
        .slice(0, 5);

    listaProximosAtendimentos.innerHTML = "";

    if (proximos.length === 0) {
        listaProximosAtendimentos.innerHTML = '<p class="mensagem-vazia">Nenhum proximo atendimento encontrado.</p>';
        return;
    }

    proximos.forEach(item => {
        const linha = document.createElement("div");
        linha.className = "proximo-atendimento-item";

        linha.innerHTML = `
            <div>
                <strong>${item.nome || "Cliente"}</strong>
                <span>${item.servico || "Servico"} - ${formatarData(item.data)} as ${item.horario}</span>
            </div>
            <small>${item.whatsapp || ""}</small>
        `;

        listaProximosAtendimentos.appendChild(linha);
    });
}

function renderizarDatasBloqueadas() {
    const datas = obterDatasBloqueadas();

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
            if (!confirm(`Remover bloqueio de ${formatarData(data)}?`)) return;

            try {
                await removerDataBloqueadaSupabase(data);
            } catch (erro) {
                console.error("Erro ao remover data bloqueada.", erro);
                alert("Nao foi possivel remover a data bloqueada.");
                return;
            }

            renderizarDatasBloqueadas();
            renderizarDiasCliente();
            renderizarHorariosCliente();
        });

        linha.appendChild(texto);
        linha.appendChild(remover);
        listaDatasBloqueadas.appendChild(linha);
    });
}

function agendamentosFiltrados() {
    const termo = buscaAgendamento.value.trim().toLowerCase();
    const data = filtroData.value;

    return obterAgendamentos()
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
        linha.appendChild(criarCelula(agendamentoItem.whatsapp));

        acoes.className = "acoes-tabela";

        botaoEditar.type = "button";
        botaoEditar.className = "btn-editar";
        botaoEditar.dataset.id = agendamentoItem.id;
        botaoEditar.textContent = "Editar";

        botaoExcluir.type = "button";
        botaoExcluir.className = "btn-excluir pequeno";
        botaoExcluir.dataset.id = agendamentoItem.id;
        botaoExcluir.textContent = "Excluir";

        acoes.appendChild(botaoEditar);
        acoes.appendChild(botaoExcluir);
        linha.appendChild(acoes);

        tabelaAgendamentos.appendChild(linha);
    });

    document.querySelectorAll(".btn-editar").forEach(botao => {
        botao.addEventListener("click", () => abrirEdicao(Number(botao.dataset.id)));
    });

    document.querySelectorAll(".acoes-tabela .btn-excluir").forEach(botao => {
        botao.addEventListener("click", () => excluirAgendamento(Number(botao.dataset.id)));
    });
}

function criarCelula(valor) {
    const celula = document.createElement("td");
    celula.textContent = valor || "-";
    return celula;
}

function atualizarResumo() {
    const agendamentos = obterAgendamentos();
    const hoje = dataAtualISO();
    const mesAtual = mesAtualISO();
    const proximos = agendamentos
        .filter(item => item.data >= hoje)
        .sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`));

    totalAgendamentos.textContent = agendamentos.filter(item => {
        return item.data && item.data.slice(0, 7) === mesAtual;
    }).length;
    agendamentosHoje.textContent = agendamentos.filter(item => item.data === hoje).length;
    proximoHorario.textContent = proximos.length ? proximos[0].horario : "--:--";
}

function renderizarFaturamento() {
    const mesSelecionado = filtroMesFaturamento.value || mesAtualISO();
    const agendamentosMes = obterAgendamentos().filter(item => {
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
    }, {});

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
        linha.className = "faturamento-servico-item";

        linha.innerHTML = `
            <span>${servico}</span>
            <strong>${formatarMoeda(dados.total)}</strong>
            <small>${dados.quantidade} atendimento${dados.quantidade === 1 ? "" : "s"}</small>
        `;

        faturamentoServicos.appendChild(linha);
    });
}

function valorCsv(valor) {
    const texto = String(valor || "");
    return `"${texto.replace(/"/g, '""')}"`;
}

function exportarAgendamentosCsv() {
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

    const data = novaDataBloqueada.value;

    if (!data || obterDatasBloqueadas().includes(data)) {
        novaDataBloqueada.value = "";
        return;
    }

    try {
        await salvarDataBloqueadaSupabase(data);
    } catch (erro) {
        console.error("Erro ao bloquear data.", erro);
        alert("Nao foi possivel bloquear a data.");
        return;
    }

    novaDataBloqueada.value = "";
    renderizarDatasBloqueadas();
    renderizarDiasCliente();
    renderizarHorariosCliente();
});

function abrirEdicao(id) {
    const agendamentos = obterAgendamentos();
    const agendamentoItem = agendamentos.find(item => item.id === id);

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

    const id = Number(editarIndex.value);
    const agendamentoItem = obterAgendamentos().find(item => item.id === id);

    if (!agendamentoItem) return;

    const agendamentoAtualizado = {
        nome: editarNome.value.trim(),
        whatsapp: editarWhatsapp.value.trim(),
        servico: editarServico.value.trim(),
        data: editarData.value,
        horario: editarHorario.value
    };

    try {
        await atualizarAgendamentoSupabase(id, agendamentoAtualizado);
    } catch (erro) {
        console.error("Erro ao editar agendamento.", erro);
        alert("Nao foi possivel editar o agendamento.");
        return;
    }

    formEditar.style.display = "none";
    renderizarAgendamentos();
    renderizarProximosAtendimentos();
    renderizarFaturamento();
    atualizarResumo();
});

btnCancelarEdicao.addEventListener("click", () => {
    formEditar.style.display = "none";
    formEditar.reset();
});

async function excluirAgendamento(id) {
    if (!confirm("Deseja realmente excluir este agendamento?")) return;

    try {
        await excluirAgendamentoSupabase(id);
    } catch (erro) {
        console.error("Erro ao excluir agendamento.", erro);
        alert("Nao foi possivel excluir o agendamento.");
        return;
    }

    renderizarAgendamentos();
    renderizarProximosAtendimentos();
    renderizarFaturamento();
    atualizarResumo();
}

carregarDadosSupabase().then(() => {
    renderizarDiasCliente();
});
