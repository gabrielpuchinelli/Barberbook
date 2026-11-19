import { readFileSync } from "node:fs";

// Recebe apenas fuso, códigos e preços do catálogo ativo pela entrada padrão.
try {
    const { fuso, servicos } = JSON.parse(readFileSync(0, "utf8"));
    const config = readFileSync(new URL("../../js/config.js", import.meta.url), "utf8");
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const fusoPublicado = config.match(/^const FUSO_BARBEARIA = "([^"]+)";/m)?.[1];
    if (!fusoPublicado || fusoPublicado !== fuso) throw new Error("Fuso diferente entre frontend e banco.");
    new Intl.DateTimeFormat("pt-BR", { timeZone: fusoPublicado });

    const catalogo = new Map();
    const cartoes = [...html.matchAll(/<button\b[^>]*\bclass="card-servico"[^>]*>([\s\S]*?)<\/button>/g)];
    for (const [cartao, conteudo] of cartoes) {
        const codigo = cartao.match(/\bdata-servico="([^"]+)"/)?.[1];
        const preco = cartao.match(/\bdata-preco="(R\$ [0-9]+,[0-9]{2})"/)?.[1];
        if (!codigo || catalogo.has(codigo) || !preco || conteudo.match(/<p>([^<]+)<\/p>/)?.[1] !== preco) {
            throw new Error("Cartão com código duplicado, preço inválido ou preço divergente.");
        }
        catalogo.set(codigo, preco);
    }
    if (!catalogo.size || !Array.isArray(servicos) || catalogo.size !== servicos.length ||
        servicos.some(({ codigo, preco }) => catalogo.get(codigo) !== preco)) {
        throw new Error("Catálogo ativo diferente entre frontend e banco.");
    }
    console.log(`Fuso IANA e ${catalogo.size} serviços ativos conferidos.`);
} catch (erro) {
    console.error(erro.message);
    process.exitCode = 1;
}
