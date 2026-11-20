import assert from "node:assert/strict";
import { test } from "node:test";
import { criarHandler, importarHmac } from "../supabase/functions/criar-reserva/handler.mjs";

const agora = () => Date.parse("2026-11-20T15:00:00Z");
const origem = "https://barberbook.example.test";
const pedido = {
    chave: "88888888-8888-4888-8888-888888888888", token: "desafio-ficticio",
    nome: "Pessoa fictícia", whatsapp: "+5521900000000", servico: "Corte teste",
    data: "2026-11-21", horario: "09:00", barbeiro_id: "10000000-0000-4000-8000-000000000001"
};
const valido = { success: true, action: "criar_reserva", hostname: "barberbook.example.test",
    challenge_ts: "2026-11-20T14:59:30Z" };

async function montar({ resposta = valido, espera = 0, retorno = { resultado: "confirmada" } } = {}) {
    const eventos = [];
    const chaveProxy = await importarHmac("proxy-ficticio-para-testar-assinatura");
    const handler = criarHandler({
        origens: [origem], hostnames: ["barberbook.example.test"], segredoTurnstile: "ficticio",
        chaveHmac: await importarHmac("segredo-ficticio-dos-resumos-do-teste"), chaveProxy
    }, {
        async admitir(ip) { eventos.push(["admitir", ip]); return espera; },
        async confirmar(resumos, dados) {
            eventos.push(["confirmar", resumos, dados]);
            if (retorno instanceof Error) throw retorno;
            return retorno;
        }
    }, {
        agora,
        async fetchSiteverify(_, opcoes) {
            eventos.push(["provedor", JSON.parse(opcoes.body)]);
            if (resposta instanceof Error) throw resposta;
            return Response.json(resposta);
        }
    });
    const enviar = (body = JSON.stringify(pedido), headers = {}) =>
        handler(new Request("http://localhost/reservas", {
            method: "POST", headers: { "content-type": "application/json", origin: origem, ...headers }, body
        }));
    return { enviar, eventos, chaveProxy };
}

test("admite, verifica e confirma nessa ordem e omite os dados da resposta", async () => {
    const app = await montar();
    const resposta = await app.enviar();
    assert.equal(resposta.status, 201);
    assert.deepEqual(await resposta.json(), { resultado: "confirmada" });
    assert.deepEqual(app.eventos.map(x => x[0]), ["admitir", "provedor", "confirmar"]);
    assert.deepEqual(Object.keys(app.eventos[1][1]).sort(), ["response", "secret"]);
    assert.equal(new Set(app.eventos[2][1].map(String)).size, 4);
});

for (const [cenario, resposta, status] of [
    ["inválido", { success: false, "error-codes": ["invalid-input-response"] }, 400],
    ["expirado", { ...valido, challenge_ts: "2026-11-20T14:50:00Z" }, 400],
    ["reutilizado", { success: false, "error-codes": ["timeout-or-duplicate"] }, 400],
    ["host divergente", { ...valido, hostname: "outro.example.test" }, 400],
    ["ação divergente", { ...valido, action: "outro_fluxo" }, 400],
    ["provedor indisponível", new Error("segredo não pode ser retornado"), 503]
]) {
    test(`desafio ${cenario} não grava reserva`, async () => {
        const app = await montar({ resposta });
        const recebido = await app.enviar();
        assert.equal(recebido.status, status);
        assert.deepEqual(await recebido.json(), { resultado: status === 400 ? "token_invalido" : "indisponivel" });
        assert.deepEqual(app.eventos.map(x => x[0]), ["admitir", "provedor"]);
    });
}

test("limite concorrente é comunicado com Retry-After e antes do provedor", async () => {
    const app = await montar({ espera: 17 });
    const r = await app.enviar();
    assert.equal(r.status, 429);
    assert.equal(r.headers.get("retry-after"), "17");
    assert.deepEqual(await r.json(), { resultado: "limitada", tentar_em: 17 });
    assert.deepEqual(app.eventos.map(x => x[0]), ["admitir"]);
});

test("cabeçalhos de IP forjados são ignorados e origem assinada fica vinculada ao corpo", async () => {
    const app = await montar();
    const bruto = JSON.stringify(pedido);
    const tempo = String(agora() / 1000);
    const ip = "192.0.2.30";
    const bytes = new TextEncoder().encode(JSON.stringify(["barberbook:proxy:v1", tempo, ip, bruto]));
    const assinatura = Buffer.from(await crypto.subtle.sign("HMAC", app.chaveProxy, bytes)).toString("hex");
    await app.enviar(bruto, { "x-forwarded-for": ip, "cf-connecting-ip": ip, "x-real-ip": ip });
    assert.equal(app.eventos[0][1], null);
    const headers = { "x-barberbook-origem": ip, "x-barberbook-tempo": tempo, "x-barberbook-assinatura": assinatura };
    await app.enviar(bruto, headers);
    assert.equal(app.eventos[3][1].byteLength, 32);
    await app.enviar(bruto + " ", headers);
    assert.equal(app.eventos[6][1], null);
    const bloqueada = await app.enviar(bruto, { origin: "https://outro.example.test" });
    assert.equal(bloqueada.status, 403);
    assert.equal(app.eventos.length, 9);
});

for (const [erro, status, resultado] of [
    [Object.assign(new Error("detalhe privado"), { code: "23505" }), 409, "conflito"],
    [Object.assign(new Error("detalhe privado"), { code: "23P01" }), 409, "conflito"],
    [new Error("conexão privada perdida"), 503, "indeterminada"],
    [{ resultado: "token_reutilizado" }, 400, "token_invalido"],
    [{ resultado: "chave_incompativel" }, 409, "chave_incompativel"]
]) {
    test(`mapeia ${erro.code || erro.resultado || "gravação indeterminada"} sem detalhes privados`, async () => {
        const app = await montar({ retorno: erro });
        const r = await app.enviar();
        assert.equal(r.status, status);
        assert.deepEqual(await r.json(), { resultado });
    });
}
