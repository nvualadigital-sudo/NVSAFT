# Fontes técnicas consultadas em 29/10/2026 e revistas em 03/11/2026

- Documentação FE 2, Administração Geral Tributária / Ministério das Finanças: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/
- Autenticação: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/api.html
- Registar: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/servicos/servicos_solicitar_registo.html
- Obter estado: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/servicos/servicos_obter_estado.html
- Consultar: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/servicos/servicos_consultar.html
- Solicitar série: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/servicos/servicos_solicitar_criacao.html
- Listar séries: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/servicos/servicos_listar_series.html
- Listar facturas: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/servicos/servicos_listar.html
- Validar documento: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/servicos/servicos_validar_fatura.html
- QR: https://quiosqueagt.hml.minfin.gov.ao/doc-agt/faturacao-electronica/1/qrcode.html
- Decreto Executivo 74/19 e anexo técnico, Diário da República disponibilizado no Ministério: https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw40/otq5/~edisp/minfin4949834.pdf
- Modelo 8 de referência no Ministério (confirmar versão actual no procedimento): https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/zmlu/mdyw/~edisp/minfin060036.pdf
- Submissão oficial: https://portaldocontribuinte.minfin.gov.ao/ — Produtores de software → Submissão do Modelo 8.

## XSD incluído

Ficheiro: `SAFTAO1.01_01.xsd`; namespace `urn:OECD:StandardAuditFile-Tax:AO_1.01_01`.

Distribuição pública pela ASSOFT: https://github.com/assoft-portugal/SAF-T-AO/blob/master/XSD/SAFTAO1.01_01.xsd

Git blob consultado: `7ed8c7ef3f013b035e7f1bfdd98359b0a15bb610`.

SHA-256: `e9a938e1f47ac3d84ffbb26d0d95b827fc769a065c9d20533d0262c12f8c2631`.

125559 bytes, licença MIT conservada em `ASSOFT_LICENSE.txt`. O validador recusa uma alteração não verificada deste XSD. A presença do ficheiro não prova que não exista uma revisão posterior aplicável à candidatura; confirmar com a AGT.

## Divergências documentais relevantes

- Há exemplos com UUIDs inválidos; o conector gera UUID v4 real.
- O registo descreve `signatureVersion` e `documentTotals` como obrigatórios no conteúdo assinado, embora alguns exemplos os omitam. Foram seguidas as tabelas/listas de parâmetros.
- A página da série apresenta num local um endereço de registo de factura. Foi usado o serviço de série `solicitarSerie`, não `registarFactura`.
- A consulta exemplifica `invoiceNo`, mas a tabela e a assinatura especificam `documentNo`. Foi usado `documentNo`. A resposta é interpretada tanto no formato da tabela (`validationStatus` e `documents`) como no do exemplo legado, sempre com verificação do documento exacto.
- A confirmação do adquirente exemplifica percentagens globais, mas a tabela descreve `deductAllVAT`, `deductibleVATLines` e assinatura de NIF + número. Foi implementada a tabela; requer confirmação do contrato activo na homologação.
- O QR exige versão 4/M e uma URL cujo comprimento a ultrapassa nos casos ensaiados. A revisão 2 oferece um PNG de diagnóstico separado com a versão suficiente. Não o considera aprovado nem o inclui na impressão.
- O registo exige novo número, `documentStatus=C` e referência ao documento rejeitado. A revisão 2 guarda a evidência e só permite substituir uma FT em aberto sem movimentos dependentes.
- Para o recibo parcial, a validação do saldo e as regras publicadas sobre totais/origens requerem esclarecimento antes de montar um pedido electrónico. O diagnóstico local compara ambos os conjuntos de valores.
- O XSD legado restringe o número de certificação a `número/AGT/ano` ou `0`. Não se converte um número FE diferente num certificado legado. No ensaio usa-se `0`, acompanhado de advertência, quando necessário.

Estes pontos constam da matriz e devem ser tratados no ensaio com a AGT, não ocultados numa declaração de conformidade.
