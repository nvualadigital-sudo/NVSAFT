# NVUALASOFT — Facturação: categorias, clientes, kits e impressão

Revisão 2 de 29/10/2026. Correcção cumulativa do módulo com o visual do HTML fornecido. Pode ser aplicada à versão integrada, à correcção de formação ou à primeira entrega **Faturacao Visual Fiel**. Não substitui os outros módulos.

## Instalar

Volte a baixar **NVUALASOFT_Faturacao_Visual_Fiel.zip** e coloque-o na raiz do projecto. No Codespaces:

```bash
cd /workspaces/NV-DIGITAL &&
node scripts/parar-dev.mjs &&
unzip -oq NVUALASOFT_Faturacao_Visual_Fiel.zip -d correcao_facturacao &&
node correcao_facturacao/NVUALASOFT_Faturacao_Visual_Fiel/instalar.mjs . &&
pnpm test &&
pnpm build &&
pnpm dev
```

Use a pasta que contém package.json, artifacts e lib se o projecto tiver outro nome. Requer Node.js 24, Git e a versão clínica integrada. Não há novas dependências nem novas migrações nesta revisão. Não substitua a aplicação pela pasta payload.

O instalador verifica as versões e a integridade, conserva alterações locais compatíveis e pára antes de escrever se houver conflito. Faz cópia dos ficheiros alterados em **backups/faturacao-visual-fiel**. Pode simular acrescentando **--dry-run** ao comando do instalador. Login, variáveis de ambiente, portal, RH, laboratório, enfermagem, médicos e chat ficam fora do plano desta revisão. O App.tsx só recebe o callback de navegação, quando ainda não o tem.

## Categorias: uma lista da instituição

Foram retirados os filtros fixos SVC/VC, PEC, CON, ACC, SW e DIV. Não são usados para adivinhar a categoria pelo código do artigo.

Em **Produtos → Categorias do catálogo**, a gestão pode criar e renomear as categorias necessárias à instituição. Produtos, kits, filtros de pesquisa e POS usam os mesmos nomes. As categorias já existentes nos produtos ou kits são conservadas e passam a aparecer na lista; não são apagadas nem substituídas por categorias de exemplo. Renomear uma categoria actualiza os produtos e kits da empresa na mesma operação. Só é possível remover uma categoria sem produtos ou kits associados.

Um produto pode ficar **Sem categoria**. A criação de produto e de kit começa sem uma categoria inventada e permite escolher ou criar uma categoria real. O campo Código continua a ser o identificador do produto; não tem de começar pelo nome ou por um prefixo de categoria.

## Clientes e Consumidor Final

O campo Cliente mostra os pacientes/clientes da empresa logo ao abrir. Escrever nome, NIF ou telefone filtra a lista. **Consumidor Final** é sempre uma opção visível e não exige criar um paciente fictício ou fornecer NIF para testar.

Seleccionar um paciente conserva o seu ID. Seleccionar Consumidor Final limpa os dados e a associação do paciente anterior. Os clientes de outra empresa não aparecem. O utilizador que inicia sessão e o adquirente do documento são identidades diferentes: um cliente chamado Teste aparece quando está cadastrado como paciente/cliente da empresa; o login de teste não é automaticamente convertido num paciente.

O cadastro de novos clientes continua a usar o cadastro de pacientes existente. A edição actualiza o mesmo registo.

## Desconto, IVA e total

A pré-visualização usa arredondamentos em cêntimos compatíveis com o cálculo do servidor. São aceites vírgula decimal e valores como **10,50%**, **125,50 Kz** e **1.250,50 Kz**. Um valor inválido deixa de ser transformado silenciosamente em zero.

A indicação genérica foi substituída por mensagens do campo: desconto percentual entre 0 e 100; desconto em Kz não superior à base; preço ou quantidade inválidos; taxa não suportada. O cálculo continua a ser confirmado pelo servidor antes de emitir.

Também foi corrigido o reinício do documento: um novo documento deixa de seleccionar Multibanco automaticamente. Uma proforma ou um rascunho não pede referência de pagamento nem regista um recebimento. Para receber, o operador escolhe a forma e confirma o pagamento, com caixa aberta quando exigido. Os ensaios continuam separados da tesouraria real.

## Kits funcionais

O botão **Kits** fica visível junto a **Itens** no formulário. A gestão pode criar, editar e remover kits com código, nome, categoria, componentes, quantidades e preço de venda. Os componentes são produtos/serviços reais desta empresa; o servidor confirma nomes, preços e existência. A janela só fecha a criação depois de a gravação ter sido confirmada. Uma edição desactualizada é recusada.

Depois de guardado, a recepção consegue seleccionar o kit, incluindo numa nova sessão. Há duas opções explícitas:

- **Inserir componentes**: linhas individuais com os preços dos componentes.
- **Inserir pelo preço do kit**: uma linha ao preço definido para o kit. Exige o mesmo enquadramento de IVA nos componentes; kits com IVA diferente devem usar linhas individuais.

A criação/alteração do catálogo e dos kits continua reservada à gestão; a recepção pode usá-los na facturação.

## QR, código de barras e impressão

Facturas e proformas guardadas passam a imprimir um QR de referência interna e um código de barras Code128 em A4, 58 mm e 80 mm. São gerados localmente. O QR inclui versão, aplicação, referência, número, tipo e ambiente do documento; não inclui nome do paciente, NIF do paciente ou dados clínicos. Não é um QR fiscal AGT.

O cadastro de produto inclui **Código de barras**, utilizável na pesquisa e com leitor que funciona como teclado. Enter na pesquisa adiciona um item uma única vez; não duplica pela captura global do leitor. O QR/código interno não cria acesso público ao documento nem remove a autenticação por empresa.

O botão PDF abre a impressão do navegador: escolha **Guardar como PDF**. A impressão é reservada no servidor e conserva o controlo de vias. A proforma identifica-se como documento não fiscal. A formação continua a mostrar **ENSAIO / HOMOLOGAÇÃO — SEM VALIDADE FISCAL**.

## Testar o circuito

1. Entre na empresa de formação como gestão e abra Facturação. Feche o aviso amarelo com OK.
2. Em Produtos, crie uma categoria, um serviço com preço e código de barras. Regresse a Criar Documento.
3. Abra Kits, crie um kit com o serviço, escolha quantidade e preço e guarde. Confirme que continua na lista depois de voltar a entrar.
4. Entre como recepção. No formulário, abra Cliente e escolha um paciente ou Consumidor Final. Adicione o serviço pelo código ou escolha o kit.
5. Se precisar, introduza desconto percentual ou em Kz. Aguarde a confirmação do rascunho. Clique em Criar Factura, confira o total e confirme Emitir.
6. Abra PDF/Imprimir. Confirme cliente, itens, IVA, total e os dois códigos. Para testar uma proforma, crie outro documento, use Alterar no tipo, escolha Factura Pró-Forma e repita até imprimir.

## Validação e limites

139 testes de API/domínio aprovados, verificação TypeScript e compilação da API/interface concluídas. No navegador foram usados os componentes, o servidor e uma base PostgreSQL local de teste para criar categoria, produto e kit, voltar a entrar como recepção, seleccionar clientes, emitir uma factura de Consumidor Final e uma proforma de um paciente, e imprimir os documentos. Os QR impressos foram decodificados; os valores impressos foram conferidos com o servidor. O isolamento de empresas e a ausência de movimentos financeiros reais foram verificados.

A produção fiscal permanece bloqueada. Não foram feitas alterações na sua base Neon real nem uma instalação remota no Codespaces/Replit. O ensaio em equipamento físico e a aceitação pelos operadores devem ser feitos no seu ambiente. A presente revisão não regenera o projecto completo, conservando os ficheiros dos restantes módulos fora do plano.

## Restauro

Use a pasta exacta que o instalador indicar:

```bash
node correcao_facturacao/NVUALASOFT_Faturacao_Visual_Fiel/restaurar.mjs backups/faturacao-visual-fiel/PASTA_DA_COPIA .
```

O restauro recusa substituir ficheiros editados depois da instalação. Não elimina os dados já registados na base.
