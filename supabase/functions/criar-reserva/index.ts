import postgres from "npm:postgres@3.4.7";
import { criarHandler, importarHmac } from "./handler.mjs";

async function configurar() {
    const dsn = Deno.env.get("BARBERBOOK_EDGE_DSN") ?? "";
    const url = new URL(dsn);
    const local = Deno.env.get("BARBERBOOK_POSTGRES_LOCAL") === "true" &&
        ["127.0.0.1", "localhost", "[::1]", "db"].includes(url.hostname);
    const papel = decodeURIComponent(url.username);
    const segredoTurnstile = Deno.env.get("BARBERBOOK_TURNSTILE_SECRET");
    const hmac = Deno.env.get("BARBERBOOK_RESERVA_HMAC") ?? "";
    const proxy = Deno.env.get("BARBERBOOK_PROXY_HMAC") ?? "";
    const lista = (chave: string) => (Deno.env.get(chave) ?? "").split(",").map(s => s.trim()).filter(Boolean);
    const origens = lista("BARBERBOOK_ORIGENS");
    const hostnames = lista("BARBERBOOK_TURNSTILE_HOSTNAMES");
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.password || url.search || url.hash ||
        (papel !== "barberbook_edge_exec" && !/^barberbook_edge_exec\.[a-z0-9]+$/.test(papel)) ||
        !segredoTurnstile || hmac.length < 32 || (proxy && (proxy.length < 32 || proxy === hmac)) ||
        !hostnames.length || !origens.length || origens.some(valor => {
            const origem = new URL(valor);
            return origem.origin !== valor || (origem.protocol !== "https:" &&
                !(local && origem.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(origem.hostname)));
        })) throw new Error("Configuração inválida.");

    const sql = postgres(dsn, {
        max: 2, prepare: false, connect_timeout: 4, idle_timeout: 10,
        ssl: local ? false : { rejectUnauthorized: true }
    });
    // Cada operação usa uma transação curta e valida o papel na conexão efetiva.
    async function transacao<T>(executar: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
        return await sql.begin(async tx => {
            await tx`set local statement_timeout = '5s'`;
            const [identidade] = await tx`select current_user = ${"barberbook_edge_exec"} as correto`;
            if (!identidade.correto) throw new Error("Papel inválido.");
            return await executar(tx);
        }) as T;
    }
    return criarHandler({
        segredoTurnstile, origens, hostnames, chaveHmac: await importarHmac(hmac),
        chaveProxy: proxy ? await importarHmac(proxy) : null
    }, {
        admitir: (origem: Uint8Array | null) => transacao(async tx => {
            const [linha] = await tx`select barberbook_reservas.admitir_tentativa(${origem}::bytea) as espera`;
            return linha.espera;
        }),
        confirmar: (resumos: Uint8Array[], dados: string[]) => transacao(async tx => {
            const [chave, prova, token, contato] = resumos;
            const [nome, whatsapp, servico, data, horario, profissional] = dados;
            const [linha] = await tx`select barberbook_reservas.confirmar_reserva(
                ${chave}::bytea, ${prova}::bytea, ${token}::bytea, ${contato}::bytea,
                ${nome}::text, ${whatsapp}::text, ${servico}::text,
                ${data}::date, ${horario}::time, ${profissional}::uuid) as retorno`;
            return linha.retorno;
        })
    });
}

// A falha de inicialização não deve aparecer como exceção bruta nos logs.
const handler = configurar().catch(() => null);
Deno.serve(async requisicao => {
    const executar = await handler;
    if (executar) return executar(requisicao);
    return Response.json({ resultado: "indisponivel" }, { status: 503, headers: { "cache-control": "no-store" } });
});
