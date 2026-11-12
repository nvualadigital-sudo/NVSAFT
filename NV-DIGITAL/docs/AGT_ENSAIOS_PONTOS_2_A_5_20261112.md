# NV-DIGITAL — verificação dos pontos 2 a 5 para avaliação AGT
Data: 12/11/2026. Estado: **preparação técnica, não certificação nem prova de testes oficiais**.

Esta nota acompanha `AGT_MATRIZ_DE_VERIFICACAO.md` e `AGT_HOMOLOGACAO_20261029.md`. A verificação foi feita pela leitura do código da `main` e das instruções oficiais, sem acesso à instalação efectiva no Codespaces, às credenciais da AGT ou à base Neon da instituição. O ponto 1 (IVA) tem alteração publicada anteriormente, mas o ensaio no servidor e a confirmação do enquadramento fiscal da instituição não foram apresentados nesta auditoria.

## 2 — Numeração, assinatura/hash e imutabilidade
**Já existe:** `artifacts/api-server/src/routes/billing-integrated.ts` reserva séries e incrementa números numa transacção; documentos emitidos são impedidos de voltar a ser editados; `tests/billing-integrated.test.ts` contém ensaios de concorrência, idempotência e rejeição de UPDATE/DELETE; `tests/agt-homologacao.test.ts` contém ensaios de JWS RS256 e alteração do conteúdo. O novo sistema FE utiliza JWS RS256; o campo legado de SAF-T tem tratamento distinto.

**Não comprovado no ambiente real:** execução dos testes na versão instalada, numeração com série oficialmente autorizada para o contribuinte, assinaturas com chaves registadas na AGT e integridade de uma amostra de documentos produzidos na BD real.

**Critério de aceitação:** duas emissões concorrentes não repetem número; retentativas não duplicam documento; edição/apagamento de emitidos falha também na base; assinatura com chave correcta valida e qualquer alteração dos dados fiscais falha; série/número/ano coincidem com registo AGT.

## 3 — SAF-T (AO)
**Já existe:** `artifacts/api-server/src/lib/agt/saft.ts` gera XML da versão de facturação 1.01_01; a rota `/agt/saft` executa validador XSD; `scripts/agt/validate_xml.py` efectua validação offline. Integra documentos de venda, notas de crédito, documentos de trabalho e pagamentos nos limites descritos no projecto.

**Limites expressos no código:** exportação de HOMOLOGAÇÃO, não prova de aceitação; documentos antigos sem assinatura original podem aparecer como `Hash=0` e exigem revisão; períodos com substituições ficam bloqueados; não corresponde ao SAF-T de contabilidade geral nem de inventário. O XML precisa de ser ensaiado contra XSD vigente e com dados fiscais reais, antes de qualquer declaração de conformidade.

**Critério de aceitação:** gerar ficheiro com FT, FR, NC, impostos, isenções fundamentadas, NIF/razão social/morada corretos, validar XSD localmente, conferir somas e totais com BD, e obter a confirmação do formato exigido no canal da AGT.

## 4 — Chaves RSA e produtor
**Já existe:** `scripts/agt/configurar.mjs` gera par RSA 4096 para assinatura FE do produtor e um par legado separado para o formato SAF-T 1.01_01; `lib/agt/runtime.ts` exige chaves FE RSA >=2048, restringe permissões dos ficheiros, impede reutilizar a mesma chave de produtor e contribuinte. `pnpm agt:verificar` verifica assinatura local e dependências.

**Ainda é externo:** preencher dados **verdadeiros** do produtor, submeter **apenas a chave pública FE** e a versão ao Portal do Parceiro da AGT, receber registo/número se aplicável; obter a chave do contribuinte e credenciais de homologação pelos canais AGT; associá-las ao NIF e UUID de cada empresa. Nunca enviar, copiar para GitHub, para o chat, ou para ZIP público a chave privada ou palavras-passe.

**No Codespaces/servidor seguro** (uma única vez, se `.agt` ainda não existir; não voltar a gerar chaves se já foram registadas):

```bash
cd /workspaces/NVSAFT/NV-DIGITAL
node -v
pnpm agt:configurar
pnpm agt:verificar
pnpm agt:dossier
```
O assistente coloca as privadas em `.agt` e os elementos públicos/minutas em `agt-export`. Se já existir `.agt`, não executar um gerador novo nem substituir essas chaves. O produtor deve guardar cópia privada segura fora do repositório. Importação do contribuinte: consultar `docs/AGT_HOMOLOGACAO_20261029.md`, usando `--tenant` e um JSON privado, **apenas com credenciais efectivamente atribuídas pela AGT**.

A assinatura SAF-T legada, no projecto, é RSA1024/SHA1 por limitação do formato de `Hash` do XSD 1.01_01; **não é a chave FE**, que é RSA >=2048/RS256. Confirmar com a AGT se este mecanismo legado e o XSD continuam aplicáveis à candidatura concreta.

## 5 — Homologação e comunicações
**Já existe:** `artifacts/api-server/src/lib/agt/transport.ts` só usa endpoint de HOMOLOGAÇÃO; `routes/agt-homologacao.ts` prepara envio, regista resposta, consulta estado, reconcilia falha incerta e bloqueia reenvio automático. `tests/agt-homologacao.test.ts` usa respostas HTTP simuladas; isto não prova integração real.

**Ensaio oficial exigido:** acesso HML autorizado, série autorizada, NIF/UUID de empresa conferidos, chaves e credenciais HML; testar criação/consulta de séries, documento FT, FR e NC, lote, confirmação de `requestID`, processamento e rejeição controlada, tentativa de correcção sem alterar o original; guardar os identificadores, códigos e datas **sem segredos nem dados clínicos** em dossier de evidências. Nunca assumir que HTTP 200/`requestID` significa factura validada. Não reenviar quando o estado for incerto; consultar/reconciliar primeiro.

**Não activar produção:** `billing-integrated.ts` contém bloqueio explícito de produção; o conector actual não tem destino de produção configurável. Liberação depende de certificação, adesão do contribuinte e aprovação dos ensaios.

## Testes técnicos no Codespaces antes de solicitar avaliação
```bash
cd /workspaces/NVSAFT/NV-DIGITAL
pnpm test
pnpm typecheck
pnpm build
pnpm agt:verificar
```
Opcional, para validação XSD local:
```bash
python3 -m venv .agt-python
.agt-python/bin/python -m pip install -r scripts/agt/requirements.txt
```
Após configurar o caminho do Python em `.agt/runtime.json`, repetir `pnpm agt:verificar`. A exportação XML é feita pela área Facturação → AGT → SAF-T e dossier; guardar o relatório do XSD.

## Pendências para decisão
- **2:** executar ensaios reais e recolher evidência de série/assinatura.
- **3:** produzir e validar XML completo com dados correctos; confirmar regras para substituições, recibos parciais e assinatura original.
- **4:** registar chave pública do produtor, obter as credenciais/chaves válidas do contribuinte; não partilhar privadas.
- **5:** efectuar ensaios com o serviço HML e obter os estados de validação/rejeição reais.
- **Adicional:** esclarecer com a AGT eventuais diferenças entre exemplos de cabeçalho JWS (`typ: JOSE`) e texto do guia (`typ: JWT`); não alterar o formato apenas com base num dos exemplos sem teste de interoperabilidade. Confirmar o QR fiscal exigido e a impressão definitiva.

## Fontes da AGT
- Chaves do produtor: https://portaldoparceiro.minfin.gov.ao/doc-agt/faturacao-electronica/1/gestao.html
- Registar factura / acompanhar pedido: https://portaldoparceiro.minfin.gov.ao/doc-agt/faturacao-electronica/1/servicos/registar.html
- Estrutura JWS: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/estrutura.html

**Este documento é um roteiro de verificação, não um certificado AGT, não constitui declaração fiscal assinada e não prova que a comunicação real foi realizada.**
