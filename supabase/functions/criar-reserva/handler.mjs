const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAVE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACAO = "criar_reserva";
const PROVIDER = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const CAMPOS = ["chave", "token", "nome", "whatsapp", "servico", "data", "horario", "barbeiro_id"];

async function lerCorpo(requisicao) {
    if (!requisicao.body || !/^application\/json(?:\s*;|$)/i.test(requisicao.headers.get("content-type") || "")) return null;
    const leitor = requisicao.body.getReader();
    const texto = new TextDecoder("utf-8", { fatal: true });
    let bruto = "";
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await leitor.read();
            if (done) return bruto + texto.decode();
            total += value.byteLength;
            if (total > 8192) {
                await leitor.cancel();
                return null;
            }
            bruto += texto.decode(value, { stream: true });
        }
    } finally {
        leitor.releaseLock();
    }
}

function normalizarPedido(valor) {
    if (!valor || typeof valor !== "object" || Object.keys(valor).length !== CAMPOS.length ||
        CAMPOS.some(chave => typeof valor[chave] !== "string")) return null;
    const { chave, token, whatsapp, servico, data, horario, barbeiro_id } = valor;
    const nome = valor.nome.trim();
    if (!CHAVE.test(chave) || !token.trim() || token.length > 2048 ||
        !nome || [...nome].length > 120 || /[\u0000-\u001f\u007f]/.test(nome) ||
        !/^\+?\d{10,15}$/.test(whatsapp) || !servico.trim() || [...servico].length > 120 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data) || data.startsWith("0000") ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario) || !UUID.test(barbeiro_id)) return null;
    const dia = new Date(`${data}T00:00:00Z`);
    if (!Number.isFinite(dia.getTime()) || dia.toISOString().slice(0, 10) !== data) return null;
    return { chave: chave.toLowerCase(), token, nome, whatsapp, servico, data, horario, barbeiro_id: barbeiro_id.toLowerCase() };
}

function normalizarIP(valor) {
    if (/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(valor) &&
        valor.split(".").every(parte => Number(parte) <= 255)) return valor;
    if (!valor.includes(":") || !/^[0-9a-f:.]+$/i.test(valor)) return null;
    try {
        const ip = new URL(`http://[${valor}]`).hostname.slice(1, -1);
        const mapeado = /^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/i.exec(ip);
        if (!mapeado) return ip;
        const [a, b] = mapeado.slice(1).map(parte => parseInt(parte, 16));
        return [a >> 8, a & 255, b >> 8, b & 255].join(".");
    } catch {
        return null;
    }
}

async function origemVerificada(headers, bruto, chaveProxy, agora) {
    if (!chaveProxy) return null;
    const origem = headers.get("x-barberbook-origem") || "";
    const tempo = headers.get("x-barberbook-tempo") || "";
    const assinatura = headers.get("x-barberbook-assinatura") || "";
    if (!/^\d{10}$/.test(tempo) || Math.abs(Math.floor(agora() / 1000) - Number(tempo)) > 30 ||
        !/^[a-f\d]{64}$/i.test(assinatura)) return null;
    const ip = normalizarIP(origem);
    if (!ip) return null;
    // Só um proxy com a chave separada pode atestar a origem deste corpo.
    const bytes = Uint8Array.from(assinatura.match(/../g), parte => parseInt(parte, 16));
    const dados = encoder.encode(JSON.stringify(["barberbook:proxy:v1", tempo, origem, bruto]));
    return await crypto.subtle.verify("HMAC", chaveProxy, bytes, dados) ? ip : null;
}

async function validarTurnstile(token, configuracao, fetchSiteverify, agora) {
    try {
        const resposta = await fetchSiteverify(PROVIDER, {
            method: "POST",
            redirect: "error",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ secret: configuracao.segredoTurnstile, response: token }),
            signal: AbortSignal.timeout(4500)
        });
        if (!resposta.ok) return "indisponivel";
        const dados = await resposta.json();
        if (dados?.success === false) {
            const erros = dados["error-codes"];
            return Array.isArray(erros) && erros.length && erros.every(erro =>
                ["invalid-input-response", "missing-input-response", "timeout-or-duplicate"].includes(erro))
                ? "token_invalido" : "indisponivel";
        }
        if (dados?.success !== true) return "indisponivel";
        const idade = agora() - Date.parse(dados.challenge_ts);
        return Number.isFinite(idade) && idade >= -5000 && idade <= 300_000 &&
            configuracao.hostnames.includes(dados.hostname) && dados.action === ACAO
            ? "valido" : "token_invalido";
    } catch {
        return "indisponivel";
    }
}

export function importarHmac(segredo) {
    return crypto.subtle.importKey("raw", encoder.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export function criarHandler(configuracao, banco, { fetchSiteverify = fetch, agora = Date.now } = {}) {
    async function resumo(dominio, valor) {
        return new Uint8Array(await crypto.subtle.sign("HMAC", configuracao.chaveHmac,
            encoder.encode(JSON.stringify([`barberbook:${dominio}:v1`, valor]))));
    }

    return async requisicao => {
        const headers = new Headers({ "cache-control": "no-store", "vary": "Origin" });
        const origem = requisicao.headers.get("origin");
        if (origem && configuracao.origens.includes(origem)) {
            headers.set("access-control-allow-origin", origem);
            headers.set("access-control-expose-headers", "Retry-After");
        }
        const responder = (status, resultado, espera) => {
            if (espera) headers.set("retry-after", String(espera));
            return Response.json({ resultado, ...(espera ? { tentar_em: espera } : {}) }, { status, headers });
        };
        if (origem && !headers.has("access-control-allow-origin")) return responder(403, "origem_invalida");
        if (requisicao.method === "OPTIONS") {
            headers.set("access-control-allow-methods", "POST, OPTIONS");
            headers.set("access-control-allow-headers", "content-type, apikey");
            return new Response(null, { status: 204, headers });
        }
        if (requisicao.method !== "POST") {
            headers.set("allow", "POST, OPTIONS");
            return responder(405, "metodo_invalido");
        }

        let bruto, pedido;
        try {
            bruto = await lerCorpo(requisicao);
            pedido = normalizarPedido(JSON.parse(bruto));
        } catch {
            return responder(400, "invalida");
        }
        if (!pedido) return responder(400, "invalida");

        let confirmacaoIniciada = false;
        try {
            const ip = await origemVerificada(requisicao.headers, bruto, configuracao.chaveProxy, agora);
            const espera = await banco.admitir(ip ? await resumo("origem", ip) : null);
            if (!Number.isSafeInteger(espera) || espera < 0) return responder(503, "indisponivel");
            if (espera) return responder(429, "limitada", espera);

            const validacao = await validarTurnstile(pedido.token, configuracao, fetchSiteverify, agora);
            if (validacao !== "valido") return responder(validacao === "token_invalido" ? 400 : 503, validacao);

            const dados = [pedido.nome, pedido.whatsapp, pedido.servico, pedido.data, pedido.horario, pedido.barbeiro_id];
            const digests = await Promise.all([
                resumo("idempotencia", pedido.chave), resumo("prova", dados),
                resumo("token", pedido.token), resumo("contato", pedido.whatsapp.replace(/^\+/, ""))
            ]);
            confirmacaoIniciada = true;
            const retorno = await banco.confirmar(digests, dados);
            switch (retorno?.resultado) {
                case "confirmada": return responder(201, "confirmada");
                case "conflito": return responder(409, "conflito");
                case "invalida": return responder(422, "invalida");
                case "chave_incompativel": return responder(409, "chave_incompativel");
                case "token_reutilizado": return responder(400, "token_invalido");
                case "limitada":
                    if (Number.isSafeInteger(retorno.tentar_em) && retorno.tentar_em > 0) {
                        return responder(429, "limitada", retorno.tentar_em);
                    }
            }
            return responder(503, "indeterminada");
        } catch (erro) {
            // Nunca repasse diagnósticos do driver, do provedor ou a URL da conexão.
            if (confirmacaoIniciada && ["23P01", "23505"].includes(erro?.code)) return responder(409, "conflito");
            return responder(503, confirmacaoIniciada ? "indeterminada" : "indisponivel");
        }
    };
}
