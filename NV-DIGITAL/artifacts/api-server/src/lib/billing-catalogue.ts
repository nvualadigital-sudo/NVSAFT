import { check, text, cents } from "./billing-engine.js";
export async function catalogueSettings(c: any, org: string) {
  return (
    (
      await c.query(
        "SELECT data FROM public.nv_billing_settings WHERE empresa_id=$1",
        [org],
      )
    ).rows[0]?.data || {}
  );
}
export async function saveCatalogue(c: any, org: string, patch: any) {
  check(
    JSON.stringify(patch).length < 450000,
    "O catálogo excede o tamanho suportado.",
  );
  await c.query(
    "INSERT INTO public.nv_billing_settings(empresa_id,data,revision) VALUES($1,$2,1) ON CONFLICT(empresa_id) DO UPDATE SET data=nv_billing_settings.data || $2::jsonb,revision=nv_billing_settings.revision+1",
    [org, JSON.stringify(patch)],
  );
}
export function categoryNames(settings: any, products: any[]) {
  return [
    ...new Set<string>(
      [
        ...(Array.isArray(settings.categoriasCatalogo)
          ? settings.categoriasCatalogo
          : []),
        ...products.map((p) => p.categoria),
        ...(settings.kits || []).map((k: any) => k.categoria),
      ]
        .filter((s: any) => typeof s === "string" && s.trim())
        .map((s: string) => s.trim()),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt"));
}
export async function validatedKit(c: any, org: string, input: any) {
  check(input && typeof input === "object", "Kit inválido.");
  const codigo = text(input.codigo, 80),
    nome = text(input.nome, 300),
    categoria = text(input.categoria || "", 100);
  check(codigo && nome, "Indique o código e o nome do kit.");
  check(
    Array.isArray(input.itens) &&
      input.itens.length > 0 &&
      input.itens.length <= 100,
    "Um kit deve incluir entre 1 e 100 componentes.",
  );
  check(
    input.itens.every(
      (i: any) => i && typeof i === "object" && !Array.isArray(i),
    ),
    "Componente inválido.",
  );
  const ids = input.itens.map((x: any) => Number(x.produtoId));
  check(
    ids.every((id: number) => Number.isSafeInteger(id) && id > 0) &&
      new Set(ids).size === ids.length,
    "Componentes inválidos ou repetidos no kit.",
  );
  const rows = (
    await c.query(
      "SELECT * FROM public.produtos WHERE empresa_id=$1 AND id=ANY($2::integer[])",
      [org, ids],
    )
  ).rows;
  const itens = input.itens.map((i: any) => {
    const p = rows.find((p: any) => p.id === Number(i.produtoId)),
      q = Number(i.quantidade);
    check(
      p && p.ativo,
      "O componente não existe nesta empresa ou está inactivo.",
    );
    check(
      Number.isFinite(q) &&
        q > 0 &&
        q <= 1e6 &&
        Math.abs(q * 1e6 - Math.round(q * 1e6)) < 0.0001,
      "Quantidade inválida no componente do kit.",
    );
    return {
      produtoId: p.id,
      produtoCodigo: p.codigo || "",
      produtoNome: p.nome,
      quantidade: q,
      precoUnitario: Number(p.preco),
      unidade: p.billing_meta?.unidadeMedida || "un",
      categoria: p.categoria,
      ivaIsento: p.iva_isento,
    };
  });
  const calculated =
    Math.round(
      itens.reduce(
        (sum: number, i: any) =>
          sum + Math.round(i.quantidade * i.precoUnitario * 100) / 100,
        0,
      ) * 100,
    ) / 100;
  if (input.precoVendaKit !== undefined && input.precoVendaKit !== "")
    check(
      typeof input.precoVendaKit === "number" &&
        Number.isFinite(input.precoVendaKit),
      "Preço de venda do kit inválido.",
    );
  const price =
    input.precoVendaKit === undefined || input.precoVendaKit === ""
      ? calculated
      : Number(input.precoVendaKit);
  check(cents(price) >= 0, "Preço de venda do kit inválido.");
  return {
    codigo,
    nome,
    descricao: text(input.descricao || "", 1000),
    categoria,
    itens,
    precoTotalCalculado: calculated,
    precoVendaKit: price,
    ativo: input.ativo !== false,
  };
}
