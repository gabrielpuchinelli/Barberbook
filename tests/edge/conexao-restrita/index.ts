import postgres from "npm:postgres@3.4.7";

// Sonda exclusiva de teste. Copie só para um stack local descartável.
Deno.serve(async () => {
    const dsn = Deno.env.get("BARBERBOOK_EDGE_TEST_DSN");
    if (!dsn) return Response.json({ resultado: "configuracao_ausente" }, { status: 503 });
    let sql: ReturnType<typeof postgres> | undefined;
    try {
        const url = new URL(dsn);
        if (!["localhost", "127.0.0.1", "[::1]", "db"].includes(url.hostname)) {
            return Response.json({ resultado: "destino_invalido" }, { status: 503 });
        }
        sql = postgres(dsn, { max: 1, prepare: false, connect_timeout: 4 });
        const [papel] = await sql`select current_user = ${"barberbook_edge_exec"} as correto`;
        const [cota] = await sql`select barberbook_reservas.admitir_tentativa(${null}::bytea) as espera`;
        try {
            await sql`select nome, whatsapp from public.agendamentos limit 1`;
            return Response.json({ resultado: "leitura_indevida" }, { status: 500 });
        } catch (erro) {
            if (!(erro instanceof postgres.PostgresError) || erro.code !== "42501") throw erro;
        }
        if (!papel.correto || cota.espera !== 0) {
            return Response.json({ resultado: "conexao_invalida" }, { status: 500 });
        }
        return Response.json({ resultado: "conexao_restrita" });
    } catch {
        // Erros do driver podem conter dados da conexão. Retorne só um código fixo.
        return Response.json({ resultado: "falha_de_conexao" }, { status: 503 });
    } finally {
        await sql?.end({ timeout: 1 }).catch(() => {});
    }
});
