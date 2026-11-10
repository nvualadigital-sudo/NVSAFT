#!/usr/bin/env node
import {
  generateKeyPairSync,
  createPublicKey,
  createPrivateKey,
  createHash,
  randomUUID,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  lstatSync,
  chmodSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  dir = resolve(root, ".agt");
if (Number(process.versions.node.split(".")[0]) < 24)
  throw Error("Use Node.js 24.");
if (!existsSync(resolve(root, "package.json")))
  throw Error("Execute dentro do projecto instalado.");
const args = process.argv.slice(2),
  from = args.indexOf("--from"),
  tenant = args.indexOf("--tenant");
const readPrivate = (p) => {
  const s = lstatSync(p);
  if (
    s.isSymbolicLink() ||
    !s.isFile() ||
    s.size > 100000 ||
    (process.platform !== "win32" && s.mode & 0o077)
  )
    throw Error(
      "O ficheiro de configuração/chave tem de ser privado (chmod 600) e regular.",
    );
  return readFileSync(p, "utf8");
};
const write = (p, data) => {
  writeFileSync(p, data, { flag: "wx", mode: 0o600 });
};
const fingerprint = (p) =>
  createHash("sha256")
    .update(createPublicKey(p).export({ format: "der", type: "spki" }))
    .digest("hex");
if (tenant >= 0) {
  if (!args[tenant + 1])
    throw Error(
      "Indique o ficheiro JSON privado com companyId, nif, username, password e privateKeyFile.",
    );
  const v = JSON.parse(readPrivate(resolve(args[tenant + 1]))),
    p = JSON.parse(readPrivate(resolve(dir, "producer.json")));
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v.companyId || "",
    ) ||
    !/^[A-Za-z0-9]{10,15}$/.test(v.nif || "") ||
    v.nif === "999999999" ||
    typeof v.username !== "string" ||
    !v.username ||
    typeof v.password !== "string" ||
    !v.password ||
    typeof v.privateKeyFile !== "string"
  )
    throw Error(
      "Dados do contribuinte incompletos. Use as credenciais de homologação atribuídas pela AGT.",
    );
  const pem = readPrivate(resolve(v.privateKeyFile)),
    key = createPrivateKey(pem);
  if (
    key.asymmetricKeyType !== "rsa" ||
    key.asymmetricKeyDetails.modulusLength < 2048
  )
    throw Error(
      "A chave do contribuinte deve ser RSA de pelo menos 2048 bits.",
    );
  if (
    fingerprint(pem) ===
    fingerprint(readPrivate(resolve(dir, p.fePrivateKeyFile)))
  )
    throw Error("A chave do contribuinte tem de ser distinta da do produtor.");
  const existing = JSON.parse(readPrivate(resolve(dir, "tenants.json")));
  if (existing[v.companyId])
    throw Error(
      "Esta empresa já tem credenciais. Não serão substituídas automaticamente.",
    );
  const keyName =
    "keys/contribuinte-" + v.companyId + "-" + randomUUID() + ".pem";
  write(resolve(dir, keyName), pem);
  existing[v.companyId] = {
    nif: v.nif,
    username: v.username,
    password: v.password,
    privateKeyFile: keyName,
  };
  write(
    resolve(dir, "tenants.next.json"),
    JSON.stringify(existing, null, 2) + "\n",
  );
  renameSync(resolve(dir, "tenants.next.json"), resolve(dir, "tenants.json"));
  console.log(
    "Credenciais locais do contribuinte importadas. Nenhum pedido foi enviado à AGT.",
  );
  process.exit(0);
}
const owner = args.indexOf("--dossier-company");
if (owner >= 0) {
  const id = args[owner + 1];
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id || "",
    )
  )
    throw Error("Indique o UUID da empresa proprietária.");
  const runtime = JSON.parse(readPrivate(resolve(dir, "runtime.json")));
  runtime.dossierCompanyIds = Array.from(
    new Set([...(runtime.dossierCompanyIds || []), id]),
  );
  write(
    resolve(dir, "runtime.next.json"),
    JSON.stringify(runtime, null, 2) + "\n",
  );
  renameSync(resolve(dir, "runtime.next.json"), resolve(dir, "runtime.json"));
  console.log(
    "A empresa indicada pode descarregar a identificação do produtor. Nenhum envio efectuado.",
  );
  process.exit(0);
}
if (args.includes("--disable-hml")) {
  const runtime = JSON.parse(readPrivate(resolve(dir, "runtime.json")));
  runtime.hmlEnabled = false;
  write(
    resolve(dir, "runtime.next.json"),
    JSON.stringify(runtime, null, 2) + "\n",
  );
  renameSync(resolve(dir, "runtime.next.json"), resolve(dir, "runtime.json"));
  console.log("Envio para homologação desligado.");
  process.exit(0);
}
if (args.includes("--enable-hml")) {
  const p = JSON.parse(readPrivate(resolve(dir, "producer.json"))),
    tenants = JSON.parse(readPrivate(resolve(dir, "tenants.json")));
  if (
    !p.softwareValidationNumber ||
    p.softwareValidationNumber === "0" ||
    /PENDENTE|TESTE|EXEMPLO|PREENCH/i.test(p.softwareValidationNumber) ||
    !Object.keys(tenants).length
  )
    throw Error(
      "Indique o registo do software e importe as credenciais de homologação antes de ligar o envio.",
    );
  const runtime = JSON.parse(readPrivate(resolve(dir, "runtime.json")));
  runtime.hmlEnabled = true;
  write(
    resolve(dir, "runtime.next.json"),
    JSON.stringify(runtime, null, 2) + "\n",
  );
  renameSync(resolve(dir, "runtime.next.json"), resolve(dir, "runtime.json"));
  console.log(
    "Envio manual ao ambiente de homologação ligado. Produção fiscal continua bloqueada.",
  );
  process.exit(0);
}
if (existsSync(dir))
  throw Error(
    "A pasta .agt já existe. As chaves existentes não serão substituídas. Use --tenant para importar credenciais de uma nova empresa.",
  );
const fields = [
  ["legalName", "Razão social do produtor"],
  ["nif", "NIF do produtor"],
  ["address", "Morada do produtor"],
  ["email", "Email do produtor"],
  ["phone", "Telefone do produtor"],
  ["representativeName", "Nome do representante legal"],
  ["representativeNif", "NIF do representante legal"],
  ["productId", "Nome comercial do software"],
  ["productVersion", "Versão a candidatar"],
  [
    "softwareValidationNumber",
    "Número de registo/certificação atribuído pela AGT (Enter se ainda não atribuído)",
  ],
];
let values;
if (from >= 0) {
  if (!args[from + 1])
    throw Error("Indique o JSON com os dados reais do produtor.");
  values = JSON.parse(readFileSync(resolve(args[from + 1]), "utf8"));
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  values = {};
  try {
    for (const [key, label] of fields)
      values[key] = (await rl.question(label + ": ")).trim();
  } finally {
    rl.close();
  }
}
for (const [key] of fields) {
  if (key === "softwareValidationNumber") continue;
  if (
    typeof values[key] !== "string" ||
    !values[key].trim() ||
    values[key].length > 200
  )
    throw Error("Complete o campo " + key + " com dados verdadeiros.");
  values[key] = values[key].trim();
}
if (
  !/^[A-Za-z0-9]{10,15}$/.test(values.nif) ||
  !/^[A-Za-z0-9]{8,15}$/.test(values.representativeNif) ||
  !/^\S+@\S+\.\S+$/.test(values.email)
)
  throw Error("NIF ou email inválido.");
const fe = generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
// Chave distinta para o formato legado do SAF-T 1.01_01 (limite Hash=172).
const legacy = generateKeyPairSync("rsa", {
  modulusLength: 1024,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
mkdirSync(dir, { mode: 0o700 });
mkdirSync(resolve(dir, "keys"), { mode: 0o700 });
write(resolve(dir, "keys/produtor-fe-v1.pem"), fe.privateKey);
write(resolve(dir, "keys/produtor-saft-v1.pem"), legacy.privateKey);
const producer = {
  ...Object.fromEntries(fields.map(([k]) => [k, values[k] || ""])),
  signatureVersion: 1,
  fePrivateKeyFile: "keys/produtor-fe-v1.pem",
  legacyPrivateKeyFile: "keys/produtor-saft-v1.pem",
};
write(resolve(dir, "producer.json"), JSON.stringify(producer, null, 2) + "\n");
write(resolve(dir, "tenants.json"), "{}\n");
write(
  resolve(dir, "runtime.json"),
  JSON.stringify(
    {
      hmlEnabled: false,
      dossierCompanyIds: [],
      signLocalHml: true,
      xmlPython: existsSync(resolve(root, ".agt-python/bin/python"))
        ? resolve(root, ".agt-python/bin/python")
        : "python3",
    },
    null,
    2,
  ) + "\n",
);
write(
  resolve(dir, "contribuinte.example.json"),
  JSON.stringify(
    {
      companyId: "PREENCHER_UUID_DA_EMPRESA",
      nif: "PREENCHER_NIF_DA_EMPRESA",
      username: "ATRIBUIDO_PELA_AGT",
      password: "ATRIBUIDA_PELA_AGT",
      privateKeyFile: "/caminho/privado/chave-contribuinte-hml.pem",
    },
    null,
    2,
  ) + "\n",
);
const out = resolve(root, "agt-export");
mkdirSync(out, { recursive: true, mode: 0o700 });
write(resolve(out, "CHAVE_PUBLICA_FE.pem"), fe.publicKey);
write(resolve(out, "CHAVE_PUBLICA_SAFT_MODELO8.txt"), legacy.publicKey);
write(
  resolve(out, "DADOS_MODELO8.json"),
  JSON.stringify(
    {
      producer: {
        ...producer,
        fePrivateKeyFile: undefined,
        legacyPrivateKeyFile: undefined,
      },
      fingerprintFE: fingerprint(fe.publicKey),
      fingerprintSAFT: fingerprint(legacy.publicKey),
      notice:
        "Preparação para o formulário oficial. Não é certificação nem declaração assinada.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Configuração criada. Chaves privadas conservadas em .agt; exportação contém apenas dados e chaves públicas.",
);
console.log(
  "Guarde uma cópia privada das chaves antes de mudar de computador. Não as envie no ZIP nem publique no Git.",
);
console.log(
  "Execute: node --import tsx scripts/agt/verificar.mjs e node --import tsx scripts/agt/dossier.mjs",
);
