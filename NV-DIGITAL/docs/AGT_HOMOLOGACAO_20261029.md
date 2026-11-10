# AGT — preparação técnica e ensaio de homologação

Revisão de 29/10/2026. Actualização sobre a Facturação Visual Fiel, revisão 2. O nome comercial, a razão social do produtor e o representante legal devem ser confirmados pelo proprietário. Nenhuma identidade foi presumida a partir do nome de uma clínica.

## Instalar na aplicação existente

Use a raiz com `package.json`, `pnpm-workspace.yaml`, `artifacts` e `lib`. O instalador do ZIP verifica os ficheiros, integra alterações compatíveis, recusa conflitos e conserva cópia em `backups/agt-homologacao`. Não altera `.env`, chaves, ligação Neon, chat, RH, enfermagem, laboratório, médicos ou `App.tsx`. A adaptação do cálculo do seguro é restrita às facturas novas com o perfil FE 2.0 activo.

Depois de instalar, pare a execução antiga e execute:

```bash
python3 -m venv .agt-python
.agt-python/bin/python -m pip install -r scripts/agt/requirements.txt
pnpm db:migrate
pnpm test
pnpm build
pnpm dev
```

Há uma nova migração aditiva: `20261029_agt_homologacao.sql`. Ela cria perfis, séries de homologação, pedidos e auditoria. Também impede alterar/apagar pró-formas finalizadas. Não converte facturas antigas, não activa produção e não envia dados. Faça uma cópia de segurança antes de aplicar uma migração na sua instalação. A migração remota no seu Neon não foi executada nesta entrega.

## 1. Preparar o produtor no seu computador

```bash
node scripts/agt/configurar.mjs
node --import tsx scripts/agt/verificar.mjs
node --import tsx scripts/agt/dossier.mjs
```

O primeiro comando pede razão social, NIF, endereço, email, telefone, nome e NIF do representante legal, nome e versão do software. Se a AGT ainda não atribuiu um número de registo/certificação, deixe esse campo vazio. O gerador funciona para preparar a candidatura; o envio electrónico fica bloqueado sem o número real. Não utilize números apresentados nos exemplos da documentação.

São geradas duas chaves distintas:

- FE: RSA de 4096 bits, usada pelo produtor para JWS RS256.
- SAF-T 1.01_01: RSA de 1024 bits e SHA-1, usada exclusivamente na assinatura encadeada legada, cujo campo Hash tem limite de 172 caracteres. Não é usada como chave FE.

As chaves privadas e os ficheiros de configuração ficam em `.agt`, com permissões privadas. Não são exportados para o navegador. O gerador não substitui uma pasta `.agt` existente e não altera `.env`. Conserve uma cópia privada das chaves e das respectivas versões. A mudança de chaves exige registo da nova versão junto da AGT; este gerador não executa uma rotação automática nem apaga as anteriores.

Os ficheiros de `agt-export` incluem apenas chaves públicas, identificação e minutas. Abra os HTML no navegador para rever/editar e imprimir ou guardar como PDF. O requerimento e a declaração **não estão assinados nem submetidos**. O formulário oficial Modelo 8 em vigor deve ser preenchido no procedimento indicado pela AGT.

Para permitir o download da identificação completa do produtor à instituição proprietária, use o UUID que aparece em **AGT → Perfil fiscal**:

```bash
node scripts/agt/configurar.mjs --dossier-company UUID_DA_EMPRESA_PROPRIETARIA
```

As outras empresas não recebem o NIF do representante legal do produtor. A geração local das minutas continua disponível ao responsável do servidor.

## 2. Disponibilizar o validador XML

O SAF-T só é descarregado depois de passar na validação XSD local. Requer Python 3 e `lxml`. Se `agt:verificar` indicar que falta o validador:

```bash
python3 -m venv .agt-python
.agt-python/bin/python -m pip install -r scripts/agt/requirements.txt
```

Se criar o ambiente Python antes de configurar o produtor, o gerador detecta-o. Se o produtor já está configurado, indique em `.agt/runtime.json` o caminho absoluto de `.agt-python/bin/python` na propriedade `xmlPython`. Conserve as outras propriedades e a permissão `600` do ficheiro. Pode também usar `AGT_XML_PYTHON` com caminho absoluto no servidor. O XSD e o XML são processados offline, sem DTD nem entidades externas.

## 3. Solicitar acesso à homologação

O Portal do Parceiro informa que as credenciais Basic Auth são atribuídas ao produtor e indica `produtores.dfe.dcrr.agt@minfin.gov.ao` para as solicitar, incluindo nome e NIF da empresa. Este pacote não envia mensagens. Confirme o contacto no portal antes de o usar.

Para cada empresa que vai emitir em homologação, são necessários o seu UUID, o NIF real, a chave privada do **contribuinte emissor**, e as credenciais de acesso fornecidas pela AGT. A chave do contribuinte é distinta da chave do produtor; não a substitua pela chave do software nem por uma chave inventada.

Copie `.agt/contribuinte.example.json` para um ficheiro privado e preencha os dados localmente. `username` e `password` são as credenciais de acesso atribuídas pela AGT; `privateKeyFile` é o caminho da chave de homologação do contribuinte. Confira com a AGT o procedimento de obtenção/importação da chave. Depois:

```bash
chmod 600 /caminho/privado/contribuinte.json /caminho/privado/chave-contribuinte-hml.pem
node scripts/agt/configurar.mjs --tenant /caminho/privado/contribuinte.json
```

O NIF da empresa na aplicação tem de coincidir com o ficheiro importado. Cada UUID tem a sua configuração e chave. O importador recusa substituir uma configuração já existente. Actualize o número real do software em `.agt/producer.json` quando for atribuído; conserve as chaves e a versão registada. Nenhuma destas etapas realiza chamadas à AGT.

Só depois de confirmar que todas as credenciais são de homologação:

```bash
node scripts/agt/configurar.mjs --enable-hml
```

Para interromper novos envios:

```bash
node scripts/agt/configurar.mjs --disable-hml
```

O único destino de rede do conector é `https://sifphml.minfin.gov.ao/sigt/fe/v1/`. O destino de produção não é configurável. O acesso às operações fiscais exige administrador/gestor da empresa activa. A recepção pode emitir documentos depois da configuração, mas não gerir chaves, séries ou pedidos.

## 4. Ensaiar no módulo

1. **Facturação → AGT → Perfil fiscal:** confira nome/NIF do emitente; indique registo comercial, morada e cidade. Escolha operação, tipo de produto e imposto de cada artigo/kit. A isenção exige código e norma legal, não resulta automaticamente de ser um serviço de saúde.
2. **Pedidos e séries:** escolha tipo, ano e estabelecimento. Prepare o pedido. Descarregue e confira o conteúdo. Clique em **Enviar para homologação** e confirme. Só uma resposta de série com código/range válidos permite seleccionar essa série no perfil.
3. Volte ao perfil, seleccione a série confirmada e active a emissão em séries de homologação. Novos documentos usam a numeração autorizada e o cálculo FE 2.0. Desligar essa opção conserva a formação local em séries TEST. Não altera documentos anteriores.
4. Emita uma factura pelo formulário habitual. O servidor confirma valores e reserva o próximo número na transacção. A impressão continua marcada **ENSAIO / HOMOLOGAÇÃO — SEM VALIDADE FISCAL**.
5. Em **AGT → Documentos**, seleccione até 30 documentos das séries de homologação. Prepare e assine o lote; esta operação não envia. Reveja o pedido antes de enviar expressamente.
6. Um `requestID` significa **recebido**, não **validado**. Aguarde o intervalo e use **Consultar estado**. Só a resposta conclusiva de todos os números permite marcar o lote validado; numa resposta parcial, a impressão identifica o estado individual disponível.
7. Se faltar resposta ao envio, não repita a factura. O pedido fica **envio sem confirmação**. A reconciliação consulta os números, exige a mesma assinatura e não reenvia. Se não conseguir comprovar o resultado, conserve o pedido e confirme com a AGT. Um pedido preso em envio por interrupção do servidor só pode ser reconciliado após 60 segundos.
8. Um pedido que nunca foi enviado pode ser cancelado e preparado de novo. Um pedido rejeitado/validado não é apagado nem reenviado como se fosse novo.

### Substituir uma factura rejeitada — revisão 2

1. Em **Preparação AGT → Pedidos**, consulte o estado do pedido recebido. Só uma rejeição conclusiva por documento desbloqueia a correcção.
2. Em **Documentos**, abra **Corrigir adquirente** para uma factura FT em aberto, sem seguro, crédito ou recebimento. Altere os dados do adquirente e registe o motivo. Se a rejeição envolver valores, linhas, outra tipologia ou uma factura já liquidada, trate o caso com a AGT antes de emitir outro documento.
3. A aplicação cria uma FT com outro número na série activa, conserva as linhas e os totais e liga-a à rejeitada. O saldo passa para a nova FT sem movimento de caixa. A emissão não muda o cadastro do paciente. A original fica no histórico e aparece como substituída. Não é tratada como anulada pela AGT.
4. Reveja a substituta e prepare o seu pedido. No JSON assinado, confirme `documentStatus: "C"` e `rejectedDocumentNo`. O envio para HML é uma acção separada. Aguarde validação da substituta antes de receber ou creditar.
5. Se o envio ficar incerto, use **Reconciliar sem reenviar**. Uma consulta com penalização, documentos múltiplos ou discrepâncias não fecha o pedido como validado. O SAF-T de períodos com substituição fica bloqueado até confirmação do tratamento pela AGT.

### Ensaios de QR e recibos parciais

Em **Documentos**, seleccione um documento e descarregue o diagnóstico do QR ou o PNG de ensaio 350×350. O PNG usa a menor versão que comporta o URL publicado com M. Não contém logótipo da AGT, não é fiscal e fica separado do QR e código de barras internos da factura.

O recebimento parcial pode ser registado e impresso no circuito de homologação. Seleccione o recibo emitido e use **Diagnóstico de recibo parcial** para guardar os totais da factura original e a repartição em cêntimos usada no registo local. O JSON tem `transmissivel: false` e não é assinado. A preparação do pedido electrónico continua bloqueada enquanto a AGT não confirmar a base e os totais aplicáveis.

## 5. Exportar e reunir o dossier

**SAF-T e dossier** permite escolher um período dentro do mesmo ano. O ZIP contém XML de facturação 1.01_01 e relatório de validação. As pró-formas finalizadas ficam em `WorkingDocuments`; não são transmitidas como facturas electrónicas. Os recibos novos conservam uma repartição proporcional em cêntimos da base e IVA da origem, separada do valor recebido. Recibos antigos sem essa repartição não são reinterpretados silenciosamente.

Documentos antigos sem assinatura SAF-T original usam `Hash=0/HashControl=0` no ficheiro de ensaio e aparecem nas advertências. Não são assinados retroactivamente. Uma certificação FE cujo formato não cabe no XSD legado não é transformada num certificado SAF-T: usa-se `0` no ensaio com advertência. Quando existir um número SAF-T legado efectivamente atribuído, pode ser indicado em `saftValidationNumber` do produtor, no formato aceite pelo XSD. Confirme com a AGT o XSD e os números aplicáveis.

As exportações não incluem contabilidade geral nem inventário. A validação estrutural, os ensaios locais e as minutas não provam certificação. Consulte `AGT_MATRIZ_DE_VERIFICACAO.md` antes de preparar qualquer declaração de conformidade.
