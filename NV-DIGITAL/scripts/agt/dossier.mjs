import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadProducer,
  readKey,
  projectRoot,
} from "../../artifacts/api-server/src/lib/agt/runtime.ts";
import {
  publicPem,
  fingerprint,
  sha256,
} from "../../artifacts/api-server/src/lib/agt/crypto.ts";
const p = loadProducer(),
  root = projectRoot(),
  out = resolve(root, "agt-export");
mkdirSync(out, { recursive: true, mode: 0o700 });
const esc = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const html = (title, body) =>
  '<!doctype html><html lang="pt-AO"><meta charset="UTF-8"><title>' +
  esc(title) +
  '</title><style>@page{size:A4;margin:22mm}body{font:12pt/1.5 Arial;color:#111;max-width:170mm;margin:20px auto}h1{font-size:18pt}.notice{border:1px solid #d89e15;padding:12px;background:#fff9db;font-size:10pt}.signature{margin-top:50px}small{font-size:9pt}@media print{body{margin:0}}</style><body><div class="notice">MINUTA — REVER, COMPLETAR E ASSINAR. Não submetida. Não comprova conformidade ou certificação.</div><h1>' +
  esc(title) +
  "</h1>" +
  body +
  "</body></html>";
const name = esc(p.legalName),
  rep = esc(p.representativeName),
  software = esc(p.productId) + " — " + esc(p.productVersion);
const request = html(
  "Requerimento de certificação de software de facturação",
  "<p>À Administração Geral Tributária</p><p><strong>Assunto: pedido de certificação do software " +
    software +
    "</strong></p><p>" +
    name +
    ", NIF " +
    esc(p.nif) +
    ", com sede em " +
    esc(p.address) +
    ", representada por " +
    rep +
    ", NIF " +
    esc(p.representativeNif) +
    ", vem requerer a apreciação do software acima identificado, mediante o procedimento e o formulário Modelo 8 em vigor.</p><p>Contactos técnicos: " +
    esc(p.email) +
    " · " +
    esc(p.phone) +
    '.</p><p>Solicita-se a indicação das credenciais, agenda e requisitos do ensaio de homologação aplicáveis. Juntam-se a identificação do programa, a chave pública no formato solicitado e os elementos efectivamente conferidos e assinados pelo requerente.</p><p>Local e data: __________________________________</p><p class="signature">O representante competente<br>__________________________________<br>' +
    rep +
    "</p>",
);
const declaration = html(
  "Declaração do produtor — minuta para revisão",
  "<p>Declarante: " +
    rep +
    ", NIF " +
    esc(p.representativeNif) +
    ", na qualidade de representante de " +
    name +
    ", NIF " +
    esc(p.nif) +
    ".</p><p>Programa: " +
    software +
    ". Versão da assinatura: " +
    esc(p.signatureVersion) +
    '.</p><p><strong>Texto a confirmar pelo declarante, apenas após concluir a verificação:</strong></p><p>Declaro, sob minha responsabilidade, que o programa de facturação identificado reúne os requisitos legais e técnicos aplicáveis ao pedido de certificação, que os elementos apresentados correspondem à versão submetida e que as chaves privadas são conservadas sob controlo do respectivo titular.</p><p>A presente declaração deve ser adaptada ao texto e aos anexos exigidos pela AGT. Não a assinar enquanto existirem requisitos pendentes, nomeadamente os descritos na matriz de verificação e no ensaio de homologação.</p><p>Local e data: __________________________________</p><p class="signature">Assinatura / qualidade do representante<br>__________________________________</p>',
);
const publicFE = publicPem(readKey(p.fePrivateKeyFile)),
  publicLegacy = p.legacyPrivateKeyFile
    ? publicPem(readKey(p.legacyPrivateKeyFile))
    : null;
const files = {
  "DADOS_PARA_MODELO8_MINUTA.html": html(
    "Dados para o Modelo 8 — minuta de preenchimento",
    '<p>Use os dados abaixo no formulário oficial em vigor. Esta folha não substitui a submissão no Portal do Contribuinte.</p><table style="border-collapse:collapse;width:100%;font-size:11pt">' +
      [
        ["1. NIF do produtor", esc(p.nif)],
        [
          "2. Tipo de declaração",
          "☐ Primeira declaração &nbsp; ☐ Substituição — assinalar pelo requerente",
        ],
        ["3. Nome / designação", name],
        ["3. Endereço", esc(p.address)],
        ["3. Contactos", esc(p.email) + " · " + esc(p.phone)],
        ["4. Programa / versão", software],
        [
          "5. Chave pública / versão",
          "CHAVE_PUBLICA_SAFT_MODELO8.txt; FE: CHAVE_PUBLICA_FE.pem. Versão " +
            esc(p.signatureVersion) +
            ". Confirmar com AGT qual o anexo aplicável.",
        ],
        [
          "6. Conformidade",
          "☐ Por verificar e assinalar exclusivamente pelo requerente após concluir os requisitos. Consultar a matriz de pendências.",
        ],
        ["7. Representante legal", rep + " · NIF " + esc(p.representativeNif)],
      ]
        .map(
          ([label, value]) =>
            '<tr><th style="text-align:left;border:1px solid #bbb;padding:8px;width:35%">' +
            label +
            '</th><td style="border:1px solid #bbb;padding:8px">' +
            value +
            "</td></tr>",
        )
        .join("") +
      "</table><p>Local e data: __________________________________</p><p>Assinatura / qualidade: __________________________________</p>",
  ),
  "REQUERIMENTO_AGT_MINUTA.html": request,
  "DECLARACAO_PRODUTOR_MINUTA.html": declaration,
  "CHAVE_PUBLICA_FE.pem": publicFE,
  "LEIA_ANTES_DE_SUBMETER.txt":
    "1. Confirmar a identificação legal do produtor e a versão candidata.\n2. Preencher o formulário oficial Modelo 8 em vigor; estes ficheiros não o substituem.\n3. Confirmar com a AGT qual a chave pública solicitada: SAF-T legado e FE são chaves diferentes.\n4. Rever a matriz e executar os ensaios com as credenciais oficiais de homologação.\n5. Assinar o requerimento e a declaração apenas por quem tem poderes para o fazer.\n6. Juntar os anexos adicionais efectivamente solicitados pela AGT.\n7. Nunca enviar chaves privadas, palavras-passe, DATABASE_URL, dados clínicos ou cópias da base de produção.\n8. A produção fiscal permanece bloqueada; os resultados locais não são certificação.\n",
};
if (publicLegacy) files["CHAVE_PUBLICA_SAFT_MODELO8.txt"] = publicLegacy;
for (const [name, content] of Object.entries(files))
  writeFileSync(resolve(out, name), content, { mode: 0o600 });
const manifest = {
  generatedAt: new Date().toISOString(),
  producer: {
    legalName: p.legalName,
    nif: p.nif,
    address: p.address,
    email: p.email,
    phone: p.phone,
    representativeName: p.representativeName,
    representativeNif: p.representativeNif,
  },
  software: {
    productId: p.productId,
    productVersion: p.productVersion,
    signatureVersion: p.signatureVersion,
    softwareValidationNumber: p.softwareValidationNumber || null,
  },
  fingerprintFE: fingerprint(publicFE),
  fingerprintSAFT: publicLegacy ? fingerprint(publicLegacy) : null,
  files: Object.entries(files).map(([name, c]) => ({
    name,
    sha256: sha256(c),
  })),
  submitted: false,
  signed: false,
  certified: false,
};
writeFileSync(
  resolve(out, "MANIFESTO_PUBLICO.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  { mode: 0o600 },
);
console.log(
  "Minutas e chaves públicas preparadas em agt-export. Reveja antes de assinar; não foi feita submissão.",
);
