import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadProducer,
  readKey,
  projectRoot,
  options,
  certificateReady,
} from "../../artifacts/api-server/src/lib/agt/runtime.ts";
import {
  jws,
  verifyJws,
  publicPem,
  legacySignature,
  fingerprint,
} from "../../artifacts/api-server/src/lib/agt/crypto.ts";
const results = [];
const test = (name, fn) => {
  try {
    if (fn() === false) throw Error("Verificação falhou");
    results.push({ name, ok: true });
  } catch (e) {
    results.push({
      name,
      ok: false,
      message: e.code ? "Configure os ficheiros fiscais locais." : e.message,
    });
  }
};
let p, key;
test("Identificação e chave FE do produtor", () => {
  p = loadProducer();
  key = readKey(p.fePrivateKeyFile);
  const payload = { productId: p.productId, productVersion: p.productVersion };
  return verifyJws(jws(payload, key), payload, publicPem(key));
});
test("Chave SAF-T separada", () => {
  if (!p?.legacyPrivateKeyFile) throw Error("Falta a chave SAF-T");
  const k = readKey(p.legacyPrivateKeyFile);
  if (fingerprint(k) === fingerprint(key)) return false;
  return (
    legacySignature(
      {
        date: "2026-01-01",
        entryDate: "2026-01-01T12:00:00",
        number: "FT VERIFICACAO/1",
        gross: 1,
        previous: "",
      },
      k,
    ).hash.length === 172
  );
});
test("Validador XML offline disponível", () => {
  const r = spawnSync(
    process.env.AGT_XML_PYTHON || options().xmlPython || "python3",
    ["-c", 'import lxml.etree; print("OK")'],
    { encoding: "utf8", timeout: 10000 },
  );
  return r.status === 0 && r.stdout.trim() === "OK";
});
const out = resolve(projectRoot(), "agt-export");
mkdirSync(out, { recursive: true, mode: 0o700 });
const report = {
  createdAt: new Date().toISOString(),
  checks: results,
  localChecksPassed: results.every((r) => r.ok),
  softwareRegistrationConfigured: p ? certificateReady(p) : false,
  productionEnabled: false,
  submittedToAGT: false,
  notice:
    "Autoteste local. A aceitação técnica e a certificação são decisões da AGT.",
};
writeFileSync(
  resolve(out, "VERIFICACAO_LOCAL.json"),
  JSON.stringify(report, null, 2) + "\n",
  { mode: 0o600 },
);
for (const r of results)
  console.log(
    (r.ok ? "OK" : "FALTA") +
      " — " +
      r.name +
      (r.message ? ": " + r.message : ""),
  );
if (!report.softwareRegistrationConfigured)
  console.log(
    "Por atribuir/indicar: número real de registo/certificação do software.",
  );
if (!report.localChecksPassed) process.exitCode = 1;
