const cardsServico = document.querySelectorAll(".card-servico");
const servicos = document.getElementById("servicos");
const agendamento = document.getElementById("agendamento");
const avisoData = document.getElementById("aviso-data");
const diasCliente = document.getElementById("dias-cliente");
const areaHorarios = document.getElementById("area-horarios");
const horariosCliente = document.getElementById("horarios-cliente");
const dadosCliente = document.getElementById("dados-cliente");
const formAgendamento = document.getElementById("form-agendamento");

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
const checkboxesDia = document.querySelectorAll(".checkbox-dia");
const formHorario = document.getElementById("form-horario");
const novoHorario = document.getElementById("novo-horario");
const listaHorariosAdmin = document.getElementById("lista-horarios-admin");
const tabelaAgendamentos = document.getElementById("tabela-agendamentos");
const mensagemAgendamentos = document.getElementById("mensagem-agendamentos");
const buscaAgendamento = document.getElementById("busca-agendamento");
const filtroData = document.getElementById("filtro-data");
const btnLimparFiltros = document.getElementById("btn-limpar-filtros");

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
    return lerJSON("agendamentos", []);
}

function salvarAgendamentos(agendamentos) {
    salvarJSON("agendamentos", agendamentos);
}

function obterDiasDisponiveis() {
    return lerJSON("diasDisponiveis", DIAS_PADRAO);
}

function salvarDiasDisponiveis(dias) {
    salvarJSON("diasDisponiveis", dias);
}

function obterHorariosDisponiveis() {
    return lerJSON(
        "horariosDisponiveis",
        HORARIOS_PADRAO.map(horario => ({ horario, ativo: true }))
    );
}

function salvarHorariosDisponiveis(horarios) {
    salvarJSON("horariosDisponiveis", horarios);
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

            dadosCliente.style.display = "block";
            dadosCliente.scrollIntoView({ behavior: "smooth" });
        });

        horariosCliente.appendChild(botao);
    });
}

function renderizarDiasCliente() {
    const diasDisponiveis = obterDiasDisponiveis();
    const ordemDias = [1, 2, 3, 4, 5, 6, 0];

    diasCliente.innerHTML = "";

    ordemDias.forEach(dia => {
        const botao = document.createElement("button");
        const dataDia = proximaDataDoDia(dia);
        const disponivel = Boolean(diasDisponiveis[dia]);

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

formAgendamento.addEventListener("submit", (e) => {
    e.preventDefault();

    const agendamentoCliente = {
        servico: localStorage.getItem("servico"),
        preco: localStorage.getItem("preco"),
        data: localStorage.getItem("data"),
        horario: localStorage.getItem("horario"),
        nome: document.getElementById("nome").value.trim(),
        whatsapp: document.getElementById("whatsapp").value.trim()
    };

    if (!agendamentoCliente.horario) {
        alert("Escolha um horario antes de confirmar.");
        return;
    }

    const agendamentos = obterAgendamentos();
    agendamentos.push(agendamentoCliente);
    salvarAgendamentos(agendamentos);

    alert("Agendamento confirmado com sucesso!");

    formAgendamento.reset();
    localStorage.removeItem("data");
    localStorage.removeItem("horario");
    areaHorarios.style.display = "none";
    dadosCliente.style.display = "none";
    servicos.style.display = "block";
    agendamento.style.display = "none";
    cardsServico.forEach(card => card.classList.remove("selecionado"));
});

btnAdmin.addEventListener("click", () => {
    areaCliente.style.display = "none";
    areaLogin.style.display = "block";
    areaAdmin.style.display = "none";
    erroLogin.textContent = "";
});

formLogin.addEventListener("submit", (e) => {
    e.preventDefault();

    const usuario = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value;

    if (usuario === "admin" && senha === "1234") {
        areaLogin.style.display = "none";
        areaAdmin.style.display = "block";
        carregarPainelAdmin();
    } else {
        erroLogin.textContent = "Usuario ou senha incorretos.";
    }
});

btnVoltar.addEventListener("click", () => {
    areaAdmin.style.display = "none";
    areaLogin.style.display = "none";
    areaCliente.style.display = "block";
    formLogin.reset();
});

function carregarPainelAdmin() {
    renderizarDiasAdmin();
    renderizarHorariosAdmin();
    renderizarAgendamentos();
    atualizarResumo();
}

function renderizarDiasAdmin() {
    const diasDisponiveis = obterDiasDisponiveis();

    checkboxesDia.forEach(checkbox => {
        checkbox.checked = Boolean(diasDisponiveis[checkbox.dataset.dia]);
    });
}

checkboxesDia.forEach(checkbox => {
    checkbox.addEventListener("change", () => {
        const diasDisponiveis = obterDiasDisponiveis();
        diasDisponiveis[checkbox.dataset.dia] = checkbox.checked;
        salvarDiasDisponiveis(diasDisponiveis);
        renderizarDiasCliente();
        renderizarHorariosCliente();
    });
});

formHorario.addEventListener("submit", (e) => {
    e.preventDefault();

    const horario = novoHorario.value;
    const horarios = obterHorariosDisponiveis();
    const horarioExiste = horarios.some(item => item.horario === horario);

    if (!horario || horarioExiste) {
        novoHorario.value = "";
        return;
    }

    horarios.push({ horario, ativo: true });
    salvarHorariosDisponiveis(ordenarHorarios(horarios));

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

        checkbox.addEventListener("change", () => {
            const horariosAtualizados = obterHorariosDisponiveis().map(horario => {
                if (horario.horario === item.horario) {
                    return { ...horario, ativo: checkbox.checked };
                }

                return horario;
            });

            salvarHorariosDisponiveis(horariosAtualizados);
            renderizarHorariosCliente();
        });

        remover.addEventListener("click", () => {
            if (!confirm(`Remover o horario ${item.horario}?`)) return;

            const horariosAtualizados = obterHorariosDisponiveis().filter(horario => {
                return horario.horario !== item.horario;
            });

            salvarHorariosDisponiveis(horariosAtualizados);
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

function agendamentosFiltrados() {
    const termo = buscaAgendamento.value.trim().toLowerCase();
    const data = filtroData.value;

    return obterAgendamentos()
        .map((agendamentoItem, index) => ({ ...agendamentoItem, index }))
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
        linha.appendChild(criarCelula(formatarData(agendamentoItem.data)));
        linha.appendChild(criarCelula(agendamentoItem.horario));
        linha.appendChild(criarCelula(agendamentoItem.whatsapp));

        acoes.className = "acoes-tabela";

        botaoEditar.type = "button";
        botaoEditar.className = "btn-editar";
        botaoEditar.dataset.index = agendamentoItem.index;
        botaoEditar.textContent = "Editar";

        botaoExcluir.type = "button";
        botaoExcluir.className = "btn-excluir pequeno";
        botaoExcluir.dataset.index = agendamentoItem.index;
        botaoExcluir.textContent = "Excluir";

        acoes.appendChild(botaoEditar);
        acoes.appendChild(botaoExcluir);
        linha.appendChild(acoes);

        tabelaAgendamentos.appendChild(linha);
    });

    document.querySelectorAll(".btn-editar").forEach(botao => {
        botao.addEventListener("click", () => abrirEdicao(Number(botao.dataset.index)));
    });

    document.querySelectorAll(".acoes-tabela .btn-excluir").forEach(botao => {
        botao.addEventListener("click", () => excluirAgendamento(Number(botao.dataset.index)));
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
    const proximos = agendamentos
        .filter(item => item.data >= hoje)
        .sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`));

    totalAgendamentos.textContent = agendamentos.length;
    agendamentosHoje.textContent = agendamentos.filter(item => item.data === hoje).length;
    proximoHorario.textContent = proximos.length ? proximos[0].horario : "--:--";
}

buscaAgendamento.addEventListener("input", renderizarAgendamentos);
filtroData.addEventListener("change", renderizarAgendamentos);

btnLimparFiltros.addEventListener("click", () => {
    buscaAgendamento.value = "";
    filtroData.value = "";
    renderizarAgendamentos();
});

function abrirEdicao(index) {
    const agendamentos = obterAgendamentos();
    const agendamentoItem = agendamentos[index];

    if (!agendamentoItem) return;

    editarIndex.value = index;
    editarNome.value = agendamentoItem.nome;
    editarWhatsapp.value = agendamentoItem.whatsapp;
    editarServico.value = agendamentoItem.servico;
    editarData.value = agendamentoItem.data;
    editarHorario.value = agendamentoItem.horario;

    formEditar.style.display = "block";
    formEditar.scrollIntoView({ behavior: "smooth" });
}

formEditar.addEventListener("submit", (e) => {
    e.preventDefault();

    const index = Number(editarIndex.value);
    const agendamentos = obterAgendamentos();

    if (!agendamentos[index]) return;

    agendamentos[index] = {
        ...agendamentos[index],
        nome: editarNome.value.trim(),
        whatsapp: editarWhatsapp.value.trim(),
        servico: editarServico.value.trim(),
        data: editarData.value,
        horario: editarHorario.value
    };

    salvarAgendamentos(agendamentos);
    formEditar.style.display = "none";
    renderizarAgendamentos();
    atualizarResumo();
});

btnCancelarEdicao.addEventListener("click", () => {
    formEditar.style.display = "none";
    formEditar.reset();
});

function excluirAgendamento(index) {
    if (!confirm("Deseja realmente excluir este agendamento?")) return;

    const agendamentos = obterAgendamentos();
    agendamentos.splice(index, 1);
    salvarAgendamentos(agendamentos);

    renderizarAgendamentos();
    atualizarResumo();
}
