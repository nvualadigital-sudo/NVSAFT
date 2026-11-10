import { readFileSync, lstatSync, realpathSync, existsSync } from "node:fs";
import { resolve, dirname, isAbsolute } from "node:path";
import { fingerprint, publicPem, rsaPrivate } from "./crypto.js";
export type Producer = {
  legalName: string;
  nif: string;
  address: string;
  email: string;
  phone: string;
  representativeName: string;
  representativeNif: string;
  productId: string;
  productVersion: string;
  softwareValidationNumber: string;
  saftValidationNumber?: string;
  signatureVersion: number;
  fePrivateKeyFile: string;
  legacyPrivateKeyFile?: string;
};
export function projectRoot() {
  if (process.env.AGT_PROJECT_ROOT)
    return resolve(process.env.AGT_PROJECT_ROOT);
  let dir = process.cwd();
  for (let i = 0; i < 7; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const next = dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return process.cwd();
}
export function configDirectory() {
  return resolve(process.env.AGT_CONFIG_DIR || resolve(projectRoot(), ".agt"));
}
export function secureRead(file: string) {
  const stat = lstatSync(file);
  if (
    stat.isSymbolicLink() ||
    !stat.isFile() ||
    stat.size > 100000 ||
    (process.platform !== "win32" && (stat.mode & 0o077) !== 0)
  )
    throw new Error(
      "O ficheiro fiscal deve ser regular, privado (chmod 600) e não pode ser uma ligação simbólica.",
    );
  return readFileSync(realpathSync(file), "utf8");
}
function privateJson(path: string) {
  const raw = secureRead(path);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      "Configuração fiscal local com JSON inválido. Corrija o ficheiro no servidor.",
    );
  }
}
export function options() {
  const path = resolve(configDirectory(), "runtime.json");
  return existsSync(path) ? privateJson(path) : {};
}
export function loadProducer() {
  const p = privateJson(
    resolve(configDirectory(), "producer.json"),
  ) as Producer;
  for (const k of [
    "legalName",
    "nif",
    "address",
    "email",
    "phone",
    "representativeName",
    "representativeNif",
    "productId",
    "productVersion",
    "fePrivateKeyFile",
  ] as const)
    if (typeof p[k] !== "string" || !p[k].trim())
      throw new Error(
        "Complete a identificação verdadeira do produtor na configuração local.",
      );
  if (
    !/^[A-Za-z0-9]{8,15}$/.test(p.nif) ||
    !Number.isInteger(p.signatureVersion) ||
    p.signatureVersion < 1
  )
    throw new Error("NIF ou versão da assinatura do produtor inválidos.");
  return p;
}
export function readKey(path: string) {
  return secureRead(isAbsolute(path) ? path : resolve(configDirectory(), path));
}
export function certificateReady(p: Producer) {
  return (
    typeof p.softwareValidationNumber === "string" &&
    p.softwareValidationNumber.length > 0 &&
    p.softwareValidationNumber !== "0" &&
    !/PENDENTE|PREENCH|EXEMPLO|TESTE/i.test(p.softwareValidationNumber)
  );
}
export function loadRuntime(companyId: string, nif: string) {
  const producer = loadProducer(),
    producerKey = readKey(producer.fePrivateKeyFile);
  rsaPrivate(producerKey);
  const tenants = privateJson(resolve(configDirectory(), "tenants.json")),
    tenant = tenants[companyId];
  if (
    !tenant ||
    tenant.nif !== nif ||
    !tenant.username ||
    !tenant.password ||
    !tenant.privateKeyFile
  )
    throw new Error(
      "Configure as credenciais e a chave do contribuinte desta empresa. O NIF tem de coincidir.",
    );
  const issuerKey = readKey(tenant.privateKeyFile);
  rsaPrivate(issuerKey);
  if (fingerprint(issuerKey) === fingerprint(producerKey))
    throw new Error(
      "As chaves do produtor e do contribuinte têm de ser distintas.",
    );
  return {
    producer,
    producerKey,
    issuerKey,
    username: String(tenant.username),
    password: String(tenant.password),
    live: options().hmlEnabled === true,
  };
}
export type Runtime = ReturnType<typeof loadRuntime>;
export function publicConfiguration(companyId: string, nif: string) {
  try {
    const p = loadProducer(),
      key = readKey(p.fePrivateKeyFile);
    let issuerConfigured = false,
      live = false;
    try {
      const r = loadRuntime(companyId, nif);
      issuerConfigured = true;
      live = r.live;
    } catch {}
    return {
      producerConfigured: true,
      producer: {
        legalName: p.legalName,
        nif: p.nif,
        productId: p.productId,
        productVersion: p.productVersion,
        softwareValidationNumber: p.softwareValidationNumber,
        signatureVersion: p.signatureVersion,
      },
      certificateConfigured: certificateReady(p),
      publicKey: publicPem(key),
      fingerprint: fingerprint(key),
      issuerConfigured,
      hmlEnabled: live,
      productionEnabled: false,
    };
  } catch {
    return {
      producerConfigured: false,
      issuerConfigured: false,
      certificateConfigured: false,
      hmlEnabled: false,
      productionEnabled: false,
    };
  }
}
