import jsQR from "jsqr";
const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
function csvRows(text: string) {
  const first = text.split(/\r?\n/)[0],
    delimiter = first.includes(";") ? ";" : first.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("CSV com aspas não terminadas.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseCadastro(text: string, kind: "cliente" | "produto") {
  if (text.length > 1_000_000)
    throw new Error("O texto excede o limite de importação.");
  const clean = text.replace(/^\uFEFF/, "").trim();
  let raw: any;
  try {
    raw = JSON.parse(clean);
  } catch {
    const rows = csvRows(clean);
    if (rows.length !== 2 || rows[0].length !== rows[1].length)
      throw new Error(
        "Utilize JSON ou CSV com cabeçalho e exactamente um registo. Um QR cifrado/assinado exige a integração oficial para extrair a identidade.",
      );
    raw = Object.fromEntries(rows[0].map((k, i) => [k, rows[1][i]]));
  }
  if (Array.isArray(raw)) {
    if (raw.length !== 1)
      throw new Error("Seleccione um único registo para conferência.");
    raw = raw[0];
  }
  if (!raw || typeof raw !== "object")
    throw new Error("O documento não contém um registo reconhecido.");
  const keys = new Map(Object.entries(raw).map(([k, v]) => [normal(k), v]));
  const get = (...aliases: string[]) => {
    for (const a of aliases) {
      const v = keys.get(normal(a));
      if (v !== undefined && v !== null) return String(v).trim();
    }
    return "";
  };
  const nome = get("nome", "name", "nomeCompleto", "fullName");
  if (!nome || nome.length > 200)
    throw new Error("Nome ausente ou inválido. Não foi criado nenhum registo.");
  if (kind === "cliente")
    return {
      nome,
      bi: get("bi", "bilheteIdentidade", "numeroDocumento"),
      dataNascimento: get(
        "dataNascimento",
        "nascimento",
        "nasc",
        "dateOfBirth",
      ),
      sexo: get("sexo", "sex"),
      naturalidade: get("naturalidade"),
      filiacao: get("filiacao"),
      endereco: get("endereco", "address"),
    };
  const codigo = get("codigo", "code"),
    price = get("preco", "price");
  if (!codigo || !price)
    throw new Error(
      "O produto exige código e preço no documento. Não se calculam valores a partir de uma fotografia.",
    );
  const number = (s: string) => {
    if (!/^\d+(?:[.,]\d+)?$/.test(s))
      throw new Error(
        "Preço/stock inválido. Utilize números sem separador de milhares.",
      );
    const n = Number(s.replace(",", "."));
    if (!Number.isFinite(n) || n < 0)
      throw new Error("Valor numérico inválido.");
    return n;
  };
  return {
    nome,
    codigo,
    preco: number(price),
    stock: number(get("stock") || "0"),
    stockMinimo: number(get("stockMinimo", "minimum") || "0"),
    categoria: get("categoria", "category"),
    descricao: get("descricao", "description"),
    ivaIsento: ["true", "1", "sim"].includes(get("ivaIsento").toLowerCase()),
  };
}
export async function readCadastroFile(
  file: File,
  kind: "cliente" | "produto",
) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Limite de 10 MB por documento.");
  if (/\.(json|csv)$/i.test(file.name))
    return parseCadastro(await file.text(), kind);
  if (!["image/png", "image/jpeg"].includes(file.type))
    throw new Error(
      "Formatos suportados: JSON, CSV e imagem PNG/JPEG com QR legível.",
    );
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.width * img.height > 30_000_000)
      throw new Error("Imagem demasiado grande.");
    const factor = Math.min(1, 2400 / Math.max(img.width, img.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * factor);
    canvas.height = Math.round(img.height * factor);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Leitor de imagem indisponível.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
      qr = jsQR(pixels.data, pixels.width, pixels.height);
    if (!qr)
      throw new Error(
        "Não foi encontrado QR legível. Registe os dados manualmente após conferir o documento.",
      );
    return parseCadastro(qr.data, kind);
  } finally {
    URL.revokeObjectURL(url);
  }
}
