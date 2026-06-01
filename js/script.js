    //area de tipos de servicos
const cardsServico = document.querySelectorAll(".card-servico");
const servicos = document.getElementById("servicos");
const agendamento = document.getElementById("agendamento");

cardsServico.forEach(card => {
    card.addEventListener("click", () => {

        // Salva o serviço escolhido
        localStorage.setItem("servico", card.textContent);

        // Esconde os serviços
        servicos.style.display = "none";

        // Mostra a próxima etapa
        agendamento.style.display = "block";
    });
});

//area de escolha de data e horario

const inputData = document.getElementById("data");
const areaHorarios = document.getElementById("area-horarios");
const cardsHorario = document.querySelectorAll(".card-horario");

inputData.addEventListener("change", () => {
    localStorage.setItem("data", inputData.value);

    areaHorarios.style.display = "block";
});

cardsHorario.forEach(card => {
    card.addEventListener("click", () => {
        cardsHorario.forEach(h => h.classList.remove("selecionado"));

        card.classList.add("selecionado");

        localStorage.setItem("horario", card.textContent);
    });
});

//dados do cliente

const dadosCliente = document.getElementById("dados-cliente");

cardsHorario.forEach(card => {
    card.addEventListener("click", () => {
        cardsHorario.forEach(h => h.classList.remove("selecionado"));

        card.classList.add("selecionado");

        localStorage.setItem("horario", card.textContent);

        dadosCliente.style.display = "block";
        dadosCliente.scrollIntoView({ behavior: "smooth" });
    });
});

//salvar em localStorage

const formAgendamento = document.getElementById("form-agendamento");

formAgendamento.addEventListener("submit", (e) => {
    e.preventDefault();

    const agendamento = {
        servico: localStorage.getItem("servico"),
        data: localStorage.getItem("data"),
        horario: localStorage.getItem("horario"),
        nome: document.getElementById("nome").value,
        whatsapp: document.getElementById("whatsapp").value
    };

    let agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];

    agendamentos.push(agendamento);

    localStorage.setItem("agendamentos", JSON.stringify(agendamentos));

    alert("Agendamento confirmado com sucesso!");

    formAgendamento.reset();
});

//area admin

const btnAdmin = document.getElementById("btn-admin");
const areaCliente = document.getElementById("area-cliente");
const areaLogin = document.getElementById("area-login");
const areaAdmin = document.getElementById("area-admin");
const formLogin = document.getElementById("form-login");
const erroLogin = document.getElementById("erro-login");
const listaAgendamentos = document.getElementById("lista-agendamentos");
const btnVoltar = document.getElementById("btn-voltar");

btnAdmin.addEventListener("click", () => {
    areaCliente.style.display = "none";
    areaLogin.style.display = "block";
    areaAdmin.style.display = "none";
});

formLogin.addEventListener("submit", (e) => {
    e.preventDefault();

    const usuario = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;

    if (usuario === "admin" && senha === "1234") {
        areaLogin.style.display = "none";
        areaAdmin.style.display = "block";
        carregarAgendamentos();
    } else {
        erroLogin.textContent = "Usuário ou senha incorretos.";
    }
});

btnVoltar.addEventListener("click", () => {
    areaAdmin.style.display = "none";
    areaLogin.style.display = "none";
    areaCliente.style.display = "block";
});

function carregarAgendamentos() {
    const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];

    listaAgendamentos.innerHTML = "";

    if (agendamentos.length === 0) {
        listaAgendamentos.innerHTML = "<p>Nenhum agendamento encontrado.</p>";
        return;
    }

    agendamentos.forEach((agendamento, index) => {
        listaAgendamentos.innerHTML += `
            <div class="card-admin">
                <h3>${agendamento.nome}</h3>

                <p><strong>Serviço:</strong> ${agendamento.servico}</p>
                <p><strong>Data:</strong> ${agendamento.data}</p>
                <p><strong>Horário:</strong> ${agendamento.horario}</p>
                <p><strong>WhatsApp:</strong> ${agendamento.whatsapp}</p>

                <button onclick="excluirAgendamento(${index})" class="btn-excluir">
                    Excluir
                </button>
            </div>
        `;
    });
}

function excluirAgendamento(index) {

    const confirmar = confirm(
        "Deseja realmente excluir este agendamento?"
    );

    if (!confirmar) return;

    let agendamentos =
        JSON.parse(localStorage.getItem("agendamentos")) || [];

    agendamentos.splice(index, 1);

    localStorage.setItem(
        "agendamentos",
        JSON.stringify(agendamentos)
    );

    carregarAgendamentos();
}
