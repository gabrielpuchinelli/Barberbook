import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const chrome = [
    process.env.CHROME_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].find(caminho => caminho && existsSync(caminho));

function instalarSupabaseFicticio() {
    const dados = {
        agendamentos: [], agendamentos_publicos: [], dias_disponiveis: [],
        horarios_disponiveis: [], datas_bloqueadas: [], barbeiros: [{ id: 1, nome: "Alex" }]
    };
    let sessao = null;
    let notificar;
    let confirmarExclusao = false;
    const escritas = [];
    window.confirm = () => confirmarExclusao;
    window.fixture = { dados, escritas, permitirExclusao: () => { confirmarExclusao = true; } };
    window.supabaseClient = {
        auth: {
            onAuthStateChange(callback) { notificar = callback; notificar("INITIAL_SESSION", null); },
            async signInWithPassword() {
                sessao = { user: { id: "admin-ficticio" }, access_token: "a.eyJzZXNzaW9uX2lkIjoiMSJ9.b" };
                notificar("SIGNED_IN", sessao);
                return { data: { session: sessao } };
            },
            async getSession() { return { data: { session: sessao } }; },
            async signOut() { sessao = null; notificar("SIGNED_OUT", null); return {}; }
        },
        async rpc(nome) { return { data: nome === "eh_admin" }; },
        from(tabela) {
            let id;
            let alteracao;
            let excluir = false;
            return {
                select() { return this; },
                order() { return this; },
                eq(campo, valor) { if (campo === "id") id = valor; return this; },
                update(valor) { alteracao = valor; return this; },
                delete() { excluir = true; return this; },
                single() { return this; },
                abortSignal() { return this; },
                then(resolve, reject) {
                    return Promise.resolve().then(() => {
                        if (alteracao) {
                            const item = dados[tabela].find(registro => registro.id === id);
                            Object.assign(item, alteracao);
                            escritas.push("editar");
                            return { data: { ...item } };
                        }
                        if (excluir) {
                            dados[tabela] = dados[tabela].filter(registro => registro.id !== id);
                            escritas.push("excluir");
                            return {};
                        }
                        return { data: dados[tabela].map(registro => ({ ...registro })) };
                    }).then(resolve, reject);
                }
            };
        }
    };
}

async function verificarListagem() {
    const $ = id => document.getElementById(id);
    const cartoes = $("cartoes-agendamentos");
    const tabela = document.querySelector(".tabela-admin-wrapper");
    const visivel = elemento => getComputedStyle(elemento).display !== "none";
    const assert = (condicao, mensagem) => { if (!condicao) throw Error(mensagem); };
    const esperar = () => new Promise(resolve => setTimeout(resolve, 20));
    const redimensionar = async largura => {
        window.frameElement.style.width = `${largura}px`;
        await esperar();
        assert(innerWidth === largura, `Largura ${largura} não aplicada`);
    };
    const entrar = async () => {
        $("btn-admin").click();
        $("form-login").requestSubmit();
        await esperar();
        document.querySelector('[data-secao-admin="painel-agendamentos"]').click();
        assert(!$("painel-agendamentos").hidden, "Falha ao abrir Agendamentos");
    };
    const vazia = () => {
        assert(cartoes.hidden && tabela.hidden, "O estado vazio deve definir hidden");
        assert(!visivel(cartoes) && !visivel(tabela), `Lista vazia visível a ${innerWidth}px`);
    };
    const preencherBusca = valor => {
        $("busca-agendamento").value = valor;
        $("busca-agendamento").dispatchEvent(new Event("input"));
    };

    $("usuario").value = "admin@example.test";
    $("senha").value = "senha-ficticia";
    await entrar();
    await redimensionar(320);
    vazia();
    await redimensionar(1200);
    vazia();

    $("btn-voltar").click();
    await esperar();
    fixture.dados.agendamentos.push({
        id: 1, nome: "Cliente fictício", whatsapp: "21900000000", servico: "Corte",
        preco: "R$ 25,00", data: "2032-03-01", horario: "09:00:00", barbeiro_id: 1, barbeiro_nome: "Alex"
    });
    $("usuario").value = "admin@example.test";
    $("senha").value = "senha-ficticia";
    await entrar();
    assert(visivel(tabela) && !visivel(cartoes) && tabela.querySelectorAll("tbody tr").length === 1,
        "Desktop deve voltar a exibir a tabela quando há registros");

    for (const largura of [320, 1200]) {
        await redimensionar(largura);
        $("busca-agendamento").focus();
        preencherBusca("sem correspondência");
        vazia();
        assert($("mensagem-agendamentos").textContent.includes("filtros"), "Mensagem de filtro vazio ausente");
        preencherBusca("");
        assert(visivel(cartoes) === (largura === 320) && visivel(tabela) === (largura === 1200),
            `Apresentação incorreta a ${largura}px após limpar filtro`);
        assert(document.activeElement.id === "busca-agendamento", "O filtro deslocou o foco");

        const listaAtiva = largura === 320 ? cartoes : tabela;
        const editar = () => listaAtiva.querySelector(".btn-editar");
        editar().click();
        assert(document.activeElement.id === "titulo-editar-agendamento", "Foco não entrou na edição");
        $("btn-cancelar-edicao").click();
        assert(document.activeElement === editar(), "Foco não voltou à ação visível após cancelar");
        document.getElementById("titulo-agendamentos-admin").focus();
    }

    preencherBusca("Cliente");
    tabela.querySelector(".btn-editar").click();
    $("editar-nome").value = "Nome atualizado";
    $("form-editar").requestSubmit();
    await esperar();
    vazia();
    assert(document.activeElement.id === "titulo-agendamentos-admin", "Faltou foco de retorno após salvar e sair do filtro");
    preencherBusca("");
    assert(tabela.textContent.includes("Nome atualizado") && cartoes.textContent.includes("Nome atualizado"),
        "Edição não atualizou as duas apresentações");

    const excluir = tabela.querySelector(".btn-excluir");
    excluir.click();
    assert(fixture.escritas.join() === "editar", "A exclusão ignorou a confirmação");
    fixture.permitirExclusao();
    excluir.click();
    await esperar();
    vazia();
    assert(fixture.escritas.join() === "editar,excluir", "Operações não foram preservadas");
    await redimensionar(320);
    vazia();
}

test("painel mantém listas vazias ocultas e recupera ações e foco nos dois layouts", {
    skip: !chrome && "Informe o executável do Chrome ou Chromium em CHROME_BIN."
}, () => {
    const pasta = mkdtempSync(join(tmpdir(), "barberbook-listagem-"));
    try {
        const raiz = new URL("../", import.meta.url).href;
        const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
            .replace("<head>", `<head><base href="${raiz}">`)
            .replace(/<script src="https:\/\/cdn[^"]+"[^>]*><\/script>/, `<script>(${instalarSupabaseFicticio})();</script>`)
            .replace('<script src="js/config.js"></script>', "")
            .replace("</body>", `<script>
                addEventListener("DOMContentLoaded", () => {
                    (${verificarListagem})().then(
                        () => parent.postMessage("OK", "*"),
                        erro => parent.postMessage(erro.message, "*")
                    );
                });
            </script></body>`);
        const srcdoc = html.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
        const pagina = join(pasta, "teste.html");
        writeFileSync(pagina, `<!doctype html><meta charset="utf-8">
            <script>addEventListener("message", evento => {
                document.getElementById("resultado").textContent = evento.data;
            });</script>
            <iframe title="Painel em teste" width="320" height="720" srcdoc="${srcdoc}"></iframe>
            <output id="resultado">Sem resultado</output>`);
        const resultado = spawnSync(chrome, [
            "--headless", "--disable-gpu", "--disable-background-networking", "--no-first-run",
            "--window-size=1280,900", "--dump-dom", "--virtual-time-budget=5000",
            `--user-data-dir=${join(pasta, "perfil")}`, pathToFileURL(pagina).href
        ], { encoding: "utf8", timeout: 30_000, windowsHide: true });
        assert.ifError(resultado.error);
        assert.equal(resultado.status, 0, resultado.stderr);
        const mensagem = resultado.stdout.match(/<output id="resultado">([^<]*)<\/output>/)?.[1];
        assert.equal(mensagem, "OK");
    } finally {
        rmSync(pasta, { recursive: true, force: true, maxRetries: 3 });
    }
});
