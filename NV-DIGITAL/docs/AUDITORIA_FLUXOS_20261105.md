# Revisão do NV-DIGITAL — 5 de Novembro de 2026

Versão de código: `2026.11.05-netlify.3`. Base: projecto completo Netlify com a numeração curta do Laboratório. O pacote conserva os restantes módulos e aplica as correcções abaixo.

## Achados e correcções

| Área | Causa confirmada | Alteração |
|---|---|---|
| Histórico/PDF | A consulta escondia versões em revisão e a impressão dependia da libertação final | A equipa clínica pode consultar a versão mais recente e imprimir uma cópia interna provisória durante a revisão |
| Lançamento pelo circuito | O primeiro resultado só entrava na tabela do histórico depois da libertação | O primeiro lançamento já cria a associação ao histórico; correcções mostram os valores da nova versão e conservam a anterior |
| Fila de facturas no laboratório | Variações como `pro-forma` e `nota-credito` não eram todas excluídas; documentos da Farmácia podiam entrar na fila | Filtro normalizado para excluir proformas, recibos, notas de crédito e vendas do POS da Farmácia |
| Facturação e POS | A base Neon consultada não tinha cinco migrações presentes no código actual; a mensagem ocultava a diferença entre falta de estrutura e conflito de operação | Diagnóstico de estrutura e mensagem específica de actualização; circuito reproduzido numa base local antes e depois das migrações |
| Conta corrente | Formulário e eliminação não aguardavam a confirmação; conversão de valores aceitava entradas parciais; campos antigos nulos podiam quebrar a pesquisa; impressão inseria texto sem escape | Confirmação assíncrona, prevenção de repetição, cálculo em cêntimos, datas válidas, pesquisa tolerante a campos vazios e texto escapado no extracto |
| Movimentos financeiros | Valores, autor e data do movimento dependiam demasiado do pedido do navegador | Validação no servidor, autoria da sessão, repetição idempotente e auditoria. Recebimentos ligados a facturas não podem ser apagados nem duplicados por movimento manual |
| Honorários e salários | A navegação mantinha entradas redundantes e um formulário genérico paralelo | Uma área de remunerações em Serviços hospitalares → Recursos humanos; registos antigos ficam em consulta, sem serem contabilizados duas vezes |
| Passes | O componente simplificado tinha substituído o criador original | Recuperado o HTML original do projecto fornecido: 80 modelos, frente/verso, cores, assinatura, CSV, QR, código de barras, PNG e PDF |
| Assinaturas | Configurações só mostrava a assinatura do director técnico do laboratório | Nova secção de Assinaturas clínicas: Dr./Dra. Clínico(a) e Chefe de Enfermagem, associados a funcionários da mesma empresa com credencial verificada |
| Guardar configurações | A interface anunciava sucesso antes de a gravação terminar | O sucesso só aparece depois de confirmação do servidor; falhas conservam o formulário |

## Resultados em revisão

O Histórico/PDF permanece disponível à equipa autorizada. A impressão usa os valores da versão mais recente, mesmo quando a anterior já tinha sido emitida.

Uma versão por validar imprime **EM REVISÃO — DOCUMENTO PROVISÓRIO**, com indicação de cópia interna, versão e validação pendente. Não imprime a imagem da assinatura do director como se este a tivesse autorizado. A emissão final continua a exigir a revisão e libertação registadas. O portal do paciente, os parceiros e as notificações de resultado pronto continuam a usar apenas a versão final autorizada.

Não é necessário receber uma autorização do director para abrir o histórico ou imprimir a cópia interna. As permissões de validação final podem continuar delegadas nos profissionais habilitados em Instituição e acessos.

## Base Neon verificada

A auditoria consultou apenas a estrutura e o registo de migrações da base anteriormente indicada neste projecto. Não leu fichas clínicas nem alterou a base. Foram confirmadas estas migrações pendentes:

1. `20261029_agt_homologacao.sql`
2. `20261029_rh_chefias_modelo.sql`
3. `20261103_agt_replacement.sql`
4. `20261103_lab_referencias_institucionais.sql`
5. `20261103_pos_farmacia_formacao.sql`

Os ficheiros das migrações já registadas correspondiam aos respectivos hashes. Esta edição acrescenta ainda `20261105_fluxos_financeiros_assinaturas.sql`, que cria a configuração de assinaturas e a identificação de repetição dos movimentos. Não apaga movimentos, facturas ou documentos.

O comando novo `pnpm db:status` verifica a base configurada no ambiente em que é executado, sem a alterar. Execute-o no servidor da API para confirmar que está a verificar a mesma base usada pelo site; uma configuração noutro ambiente pode apontar para outra base.

## Remunerações

A folha actual mantém os cálculos, rubricas, escalas e exportações existentes. As entradas Honorários e Salários foram retiradas dos menus duplicados. As antigas referências de navegação encaminham para Serviços hospitalares, onde se encontra Recursos Humanos. Os dois componentes de página que só funcionavam como duplicados são removidos pelo actualizador, com backup.

Os registos antigos de honorários e salários genéricos permanecem em consulta na folha. Não são convertidos automaticamente em novos vencimentos, custos ou pagamentos.

## Passes e assinaturas

Os modelos de passes foram recuperados de `PASS DA APP.HTML` no ZIP original enviado pelo utilizador. As bibliotecas de QR, código de barras, PNG, PDF e CSV são compiladas no projecto; a página não depende de scripts de CDNs. As preferências são separadas por empresa. O designer é isolado da sessão do sistema e recebe apenas os dados do funcionário seleccionado e da instituição.

Em Configurações → Assinaturas clínicas, seleccione um médico ou enfermeiro activo da empresa. A credencial deve estar verificada. O gestor pode carregar PNG/JPEG até 200 KB para assinatura e carimbo, confirmando a identidade. As imagens ficam na ficha profissional correspondente e são capturadas nos documentos emitidos por esse autor. Uma assinatura institucional não substitui a autoria de outro profissional. Os documentos anteriores conservam as imagens e a identificação existentes na sua emissão.

## Validação e aplicação

Verificações automáticas, compilações e instruções de actualização estão em `VERIFICACAO.md` e `docs/ACTUALIZAR_NETLIFY.md`. A verificação local não substitui o ensaio no equipamento da clínica: confira impressão, leitor de QR/código de barras, perfis da equipa e ligação da API antes de usar a nova versão em produção.

O pacote não publica a API ou a Netlify nem executa as migrações na base remota automaticamente. A produção fiscal conserva o bloqueio existente; o modo de formação continua disponível para testes.
