# Actualização clínica — 28 de Outubro de 2026

Esta actualização completa os fluxos de profissionais, documentos, seguradoras e endereços pedidos na auditoria. Mantém a organização da aplicação, os controlos flutuantes, o chat, as chamadas, a biblioteca, os resultados laboratoriais, a farmácia, a Facturação Integrada e Escalas/Salários. Esta revisão resolve a incompatibilidade detectada nos cinco ficheiros enviados pelo utilizador; não repõe a antiga página monolítica de facturação.

## Funcionários e identificação profissional

Em **Administração → Funcionários**, a conta de acesso está separada da ficha profissional. O formulário inclui categoria, especialidades, código interno, qualificação, cargo, serviço, vínculo, cédula, entidade emissora, validade e contactos. O catálogo contém médico clínico geral, médicos especialistas, enfermagem, análises clínicas, imagiologia, farmácia, nutrição, fisioterapia, psicologia e funções administrativas; permite descrever outras categorias.

O perfil de acesso continua a determinar as permissões. Escrever uma categoria ou especialidade não atribui competências adicionais à conta. A palavra-passe fica vazia durante a edição e só é substituída quando for introduzida outra. O utilizador é permanente para conservar autoria, conversas e episódios. Desactivar a conta conserva o histórico e revoga sessões e autorizações.

Cada profissional pode ter uma assinatura gráfica e um carimbo em PNG/JPEG, até 200 KB por imagem. Um responsável diferente do titular confirma a credencial em **Administração → Instituição e acessos → Profissionais e credenciais**. Alterações de identidade, cédula, especialidade, validade ou imagens exigem nova verificação; actualizar apenas um contacto conserva a verificação anterior.

As receitas e os documentos médicos novos utilizam a identificação da conta individual do médico verificado. Os relatórios, evoluções, planos de cuidados, passagens de turno, orientações de alta e declarações de cuidados de enfermagem utilizam a conta individual de enfermagem verificada. A emissão guarda a identificação e as imagens do autor e o cabeçalho institucional daquele momento. Uma alteração posterior da ficha não altera essa emissão. Os rascunhos e documentos anulados aparecem identificados na impressão.

O carimbo do director técnico do laboratório permanece nos documentos laboratoriais. Não é aplicado automaticamente a médicos ou enfermeiros. Documentos antigos conservam a autoria disponível no registo original, sem inventar assinaturas históricas. As imagens são reproduções gráficas, não certificados de assinatura digital qualificada.

## Seguradoras, segurados e facturação

**Finanças → Seguradoras** conserva os cadastros existentes e acrescenta cobrança, produção, extractos, contratos e modelos de exportação.

1. Cadastre a seguradora e associe o cartão ao paciente do cadastro central. O servidor confirma ID, nome e processo. Indique titular/dependente, apólice, plano, validade e cobertura. O cadastro administrativo do paciente também actualiza esse vínculo na mesma transacção.
2. Em **Contratos e preços**, defina vigência, exigência de autorização e a tabela de actos: código, descrição, serviço, preço contratado, percentagem coberta, limite coberto por unidade e custo interno opcional sem IVA. A cobertura 0% representa uma exclusão do acto.
3. Na facturação, seleccione o paciente e active **Facturar ao seguro deste atendimento**. Escolha vínculo e contrato, identifique os actos e o profissional responsável, aplique os preços contratados e valide a repartição. A simulação consulta os dados do servidor; não contacta nem confirma uma autorização no sistema externo da seguradora.
4. Em **Finanças → Facturação → Documentos**, emita como **Factura / Emitida**, sem pagamento integral na emissão do seguro. A emissão conserva vínculo, contrato, actos, preços, custos e cobertura, usando os mesmos cálculos por linha, IVA e distribuição de cêntimos do motor nativo. Registe depois cada parcela em **Seguradoras → Cobrança**, no âmbito de homologação.
5. Abra primeiro a sua sessão em **Finanças → Facturação → POS / Caixa**. Os recebimentos parciais usam o mesmo motor, série, autorização e chave do pedido. O numerário entra uma única vez na sessão de ensaio; pagamentos bancários/TPA exigem referência e não aumentam o numerário contado. Repetir o mesmo pedido não duplica recibo nem saldo.

**Âmbito fiscal conservado:** o pacote de Facturação Integrada recebido já bloqueava a produção fiscal e emitia em homologação. Esta integração mantém esse controlo. Escolha **Arquivo financeiro real** ou **Homologação — documentos de ensaio** nos mapas/extractos; o valor por defeito é o arquivo real. Ensaios, saldos e recebimentos de homologação não são apresentados como produção real, nem geram movimentos de tesouraria reais ou débitos de stock real. As exportações identificam o âmbito; as de ensaio acrescentam a indicação em todas as linhas, incluindo CSV. O arquivo fiscal anterior é de consulta; esta entrega não emite recibos reais por uma rota alternativa nem activa produção AGT.

A factura nativa emitida permanece imutável. O estado apresentado e o saldo são derivados dos débitos, recibos e notas de crédito; não se modifica o documento fiscal original para o marcar pago. Créditos de um pagador não escondem a dívida restante do outro. Notas de crédito identificam as linhas originais; documentos com desconto fixo mantêm o bloqueio de regularização específica do motor recebido.

As facturas já emitidas não são recalculadas quando o plano ou a tabela mudam. Os recebimentos não podem ultrapassar o saldo do pagador. Uma nota de crédito de seguro conserva a repartição dos actos originais e controla as quantidades já creditadas. Uma glosa/recusa regista motivo, valor e seguimento, sem apagar a dívida; uma redução financeira exige a nota de crédito correspondente. A revisão concorrente de contratos, cadastros, modelos e glosas é controlada.

Os limites implementados são por acto/unidade na tabela do contrato. Franquias anuais, consumos acumulados de uma apólice, transmissão electrónica e validação automática junto de cada seguradora não são inferidos de uma cobertura percentual.

## Extractos e mapas

O extracto por seguradora ou paciente apresenta saldo anterior, débitos, créditos, referências, factura de origem e saldo após cada movimento. Um saldo negativo representa crédito da entidade. A conta do paciente inclui os seus copagamentos e facturas particulares associadas ao ID central. Permite registar recebimentos parciais das facturas nativas no âmbito de homologação e imprimir os recibos com reserva e contagem de impressão no servidor. O arquivo real continua disponível para consulta.

Os documentos particulares antigos são lidos a partir das facturas, notas de crédito e movimentos de caixa efectivamente associados. Documentos sem ID de paciente não são atribuídos por semelhança de nome. Datas inválidas ou documentos marcados pagos sem movimento de caixa associado são apresentados para reconciliação, sem fabricar um pagamento.

O mapa de produção permite filtrar por período de realização, seguradora, paciente, acto, serviço e cobrança. Os valores por acto correspondem às linhas seleccionadas; os saldos e recebimentos apresentados correspondem às facturas seleccionadas completas. O extracto usa entidade e período, incluindo todos os actos dessa conta para conservar um saldo correcto.

XLSX, CSV e PDF usam os mesmos critérios aplicados à consulta correspondente. O XLSX contém células numéricas, filtros e uma folha de critérios. O PDF usa a impressão do navegador: seleccione **Guardar como PDF**. Os modelos por seguradora permitem escolher e ordenar colunas e adaptar os cabeçalhos; confirme com a seguradora a especificação que aceita. Não são apresentados como formatos externos homologados. Os custos e margens são opcionais nos mapas internos e reservados à administração, gestão e finanças; não integram por defeito o mapa enviado à seguradora. A margem é calculada antes do IVA.

Facturas antigas sem uma repartição de seguro conservada não são atribuídas retroactivamente a uma seguradora. Os seus documentos continuam acessíveis; a origem e os saldos devem ser reconciliados com os registos reais.

## Escalas e salários conservados

O módulo permanece em Gestão Hospitalar → Recursos humanos — escalas e salários. Usa os funcionários reais e activos da instituição; mantém calendário mensal, códigos e cores recebidos, publicação, reabertura fundamentada e histórico. As exportações PDF e XLSX usam revisões guardadas; os mapas de salário e recibos preservam os valores do processamento. A aprovação é independente e conserva a versão dos perfis/equipa. O registo de pagamento exige referência confirmada; não faz uma transferência bancária. Não foram alteradas as fórmulas salariais, regras fiscais, incidências ou limites de turnos do pacote recebido.

## Endereços

O cadastro acrescenta país de nacionalidade, naturalidade e residência separados. Países usam identificadores ISO alpha-2 e nomes em português. Angola contém 21 províncias, 326 municípios e 378 comunas extraídos dos quadros anexos da Lei 14/24. A província limita os municípios e o município limita as comunas; mudar um nível limpa os dependentes. Países estrangeiros permitem as subdivisões correspondentes em texto.

As moradas anteriores permanecem disponíveis. O botão **Aplicar endereço estruturado à morada completa** substitui esse texto apenas quando for accionado. Bairro/localidade, rua, casa e referência complementam o catálogo. Bairros em falta podem ser propostos e aprovados pela administração da instituição. Não é apresentada uma lista nacional fictícia de bairros. Os identificadores do catálogo são internos, não códigos administrativos oficiais. Fonte, páginas, versão e SHA-256 do documento de referência constam de `FONTE_GEOGRAFIA.json`.

Referências: [Lei 14/24, de 5 de Setembro](https://c2a.portais.gov.ao/uploads/LEI_14_24_5_de_SETEMBRO_LEI_DA_DPA_043a0de85f.pdf), [resultados definitivos do INE](https://www.ine.gov.ao/Arquivos/arquivosCarregados/Carregados/Publicacao_638992698392586291.pdf), [errata de Luanda e Icolo e Bengo](https://www.ine.gov.ao/noticias/detalhes/MjgxNDk=).

O catálogo geográfico é comum. Pacientes, localidades complementares, profissionais, imagens, vínculos, contratos, facturas, pagamentos, extractos e modelos continuam separados por empresa na API e nas referências compostas da base.

## Aplicar no projecto actual

Use o ZIP incremental `NVUALASOFT_Atualizacao_Clinica.zip` para conservar as alterações feitas no Codespaces/Replit. O instalador compara a versão anterior, a sua versão e a actualização; cria cópias e interrompe antes de alterar o projecto se encontrar um conflito. Não altera a página de Login, `App.tsx`, credenciais nem a ligação à base.

```bash
cd /workspaces/NV-DIGITAL &&
node scripts/parar-dev.mjs &&
unzip -oq NVUALASOFT_Atualizacao_Clinica.zip -d atualizacao_clinica_v2 &&
node atualizacao_clinica_v2/NVUALASOFT_Atualizacao_Clinica/instalar.mjs . &&
pnpm run install:app &&
pnpm db:migrate &&
pnpm test &&
pnpm build &&
pnpm dev
```

No Replit, substitua o primeiro caminho pela pasta que contém `package.json`, `artifacts` e `lib`. Precisa de Node.js 24, pnpm e Git. A pasta `atualizacao_clinica_v2` conserva o instalador separado do projecto. Use esse caminho para simular com `--dry-run` antes de instalar, se desejar. Não extraia sobre uma pasta de aplicação com `unzip -n`.

As três migrações novas são aditivas: geografia, documentos profissionais e contas/seguradoras. São incluídas no comando normal de migração. As migrações anteriores mantêm o conteúdo e os seus hashes. A entrega não executa comandos no seu Codespaces, Replit ou Neon; aplique os comandos no ambiente que usa, com a ligação actual configurada. O ZIP completo destina-se também a instalações novas em pasta separada.

Esta entrega inclui as correcções descritas e validação local; não constitui homologação MINSA/AGT nem confirma integrações externas não configuradas.
