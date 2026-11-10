# NVUALASOFT — Laboratório, visual original e edição de resultados

Actualização de 28/10/2026 para o projecto NVUALASOFT_Integrado.

## O que foi feito

Foram usados como base os dois ficheiros recebidos: LancarResultados.tsx e CadastrarExames.tsx. A paleta, a tipografia, os cartões, os cabeçalhos numerados, os filtros, o editor de parâmetros e a organização das páginas foram conservados. As cópias recebidas estão na pasta referencia do ZIP.

A navegação do Laboratório passa a abrir:

- Lançar Resultados: fila por factura, lançamento manual e pedidos de parceiros, com o visual enviado.
- Resultados Prontos / Revisão: pesquisa por paciente, processo ou referência, filtros de estado, consulta de versões e acesso à edição.
- Cadastrar Exames: categorias, parâmetros, unidades, referências, códigos de produtos, sincronização e exportação do catálogo.
- Amostras, qualidade e catálogo técnico: circuito existente de pedidos, recipientes, rastreabilidade, controlos, validação e indicadores.

O menu Exames também abre o cadastro que enviaste. O circuito técnico é conservado em CircuitoLaboratorial.tsx, a partir do Laboratorio.tsx existente na instalação.

## Instalação no Replit

1. Pare o workflow NV.Digital.
2. Carregue NVUALASOFT_Laboratorio_Visual_Resultados.zip para ~/workspace.
3. Execute cada linha e espere que termine sem erro:

    cd ~/workspace
    unzip -nq NVUALASOFT_Laboratorio_Visual_Resultados.zip -d atualizacao_laboratorio_20261028
    node atualizacao_laboratorio_20261028/instalar.mjs ~/workspace/NVUALASOFT_Integrado
    cd ~/workspace/NVUALASOFT_Integrado
    pnpm run db:migrate
    pnpm test
    pnpm build

4. Reinicie o workflow NV.Digital e entre novamente na instituição.

Para verificar os ficheiros previstos antes da instalação:

    node ~/workspace/atualizacao_laboratorio_20261028/instalar.mjs ~/workspace/NVUALASOFT_Integrado --dry-run

O pacote usa as dependências existentes; não é necessário reinstalá-las.

O instalador altera os ficheiros do projecto. A migração da base é executada pelo comando db:migrate, usando o Secret DATABASE_URL_UNPOOLED com ligação directa à base pretendida. Não inclua a ligação no código ou no chat.

A migração 20261027_laboratorio_resultados.sql adiciona a tabela nv_lab_report_versions e o respectivo índice. Os dados existentes não são apagados. Este pacote não executou alterações na sua base Neon.

## Editar um resultado pronto

1. Abra Laboratório → Resultados Prontos / Revisão.
2. Pesquise o paciente, o processo ou a referência.
3. Clique em Editar resultado ou abra Ver / versões → Editar resultado pronto.
4. A página Lançar Resultados abre com o paciente, a data, os exames, os valores, as unidades e as referências existentes.
5. Corrija os valores, indique o motivo e clique em Guardar para validação.
6. O resultado mantém o mesmo identificador. A versão anterior fica preservada, com os seus valores e a sua autoria disponível.
7. A nova versão passa pela revisão técnica e pela libertação. Depois aparece como Pronto e pode ser entregue ou impresso.

Um resultado associado a uma amostra abre directamente os resultados do seu circuito de rastreabilidade. Continua a usar as verificações existentes de amostra, equipamento, lote e qualidade.

O lançamento manual usa o formulário enviado e guarda uma versão para revisão profissional. O cadastro de parâmetros é um conjunto de modelos para esse lançamento; o catálogo técnico contém as fichas, protocolos e controlos do circuito de amostras.

## Perfis e validação

A introdução e a edição são permitidas aos perfis admin, gestor e tecnico da própria empresa. Os perfis médico e enfermeiro têm consulta segundo as permissões do módulo.

São usadas as permissões e credenciais profissionais já existentes no sistema:

- lab.validate.technical: revisão técnica por outro profissional.
- lab.validate.release: libertação por um profissional diferente do autor e do revisor técnico.

A gestão configura as autorizações no módulo Instituição. O instalador não atribui permissões automaticamente.

Campos por preencher podem ser guardados em rascunho. Para validar, cada parâmetro tem de conter o valor ou uma indicação explícita do profissional sobre a sua não realização.

Durante uma correcção pendente, a entrega e a exportação do resultado actual ficam bloqueadas. Os valores anteriores permanecem no histórico de versões. Uma configuração posterior do catálogo não reescreve as referências de um resultado já guardado.

Os registos legados são identificados como tal. A primeira edição arquiva o seu conteúdo anterior sem inventar uma autoria ou validação histórica.

## Melhorias de funcionamento

- Editar um pedido externo concluído abre o mesmo resultado; deixa de iniciar um lançamento vazio.
- Um pedido externo só fica Concluído depois da libertação. Uma rectificação devolve-o a Em processo.
- A selecção de outro exame conserva os valores já introduzidos nos exames mantidos.
- O índice dos parâmetros é preservado na edição de documentos com exames agrupados.
- O paciente de um resultado em edição fica fixo; o servidor também impede a troca da associação.
- O técnico responsável é obtido da sessão autenticada no servidor.
- Pedidos repetidos de gravação com o mesmo conteúdo e identificador não duplicam o resultado.
- Uma versão alterada noutro posto é recusada até à actualização da página.
- Uma falha de gravação mantém os dados no formulário; a repetição usa o mesmo identificador enquanto o conteúdo não mudar.
- A fila identifica o resultado associado à factura, sem considerar que qualquer resultado antigo do paciente conclui todos os seus atendimentos.
- A fila devolve identificação e exames necessários ao laboratório; não expõe preços, saldos ou dados fiscais.
- A sincronização de produtos mostra os erros. Se parte da importação falhar, ficam seleccionados apenas os itens não confirmados.
- Alterações na configuração dos exames são recusadas a perfis financeiros.
- A importação de documentos usa o token da sessão actual. A leitura disponível depende do serviço configurado; valores extraídos são sempre apresentados para revisão.
- A impressão abre a janela no clique e só escreve o documento depois da autorização do servidor.

## Separação das empresas

Todas as consultas, versões e alterações usam a empresa da sessão autenticada. O identificador enviado pelo navegador não permite abrir, editar, copiar associações ou libertar um resultado de outra empresa. A tabela de versões também tem uma chave estrangeira composta por empresa e resultado.

Os pedidos externos mantêm a associação ao pedido e à instituição correspondentes. A biblioteca e o MEDLIK continuam nas suas funções existentes.

## Ficheiros principais

    artifacts/lab-results/src/pages/laboratorio/Laboratorio.tsx
    artifacts/lab-results/src/pages/laboratorio/LancarResultados.tsx
    artifacts/lab-results/src/pages/laboratorio/CadastrarExames.tsx
    artifacts/lab-results/src/pages/laboratorio/ResultadosProntos.tsx
    artifacts/lab-results/src/pages/laboratorio/relatorios.ts
    artifacts/lab-results/src/pages/laboratorio/CircuitoLaboratorial.tsx
    artifacts/api-server/src/routes/lab-reports.ts
    migrations/20261027_laboratorio_resultados.sql

O instalador acrescenta a montagem das novas rotas em lab-workflow.ts, a verificação de impressão em institution.ts e o filtro dos resultados em revisão em laboratorio.ts. Nesses ficheiros, conserva as restantes rotas.

Em App.tsx ajusta apenas a importação do cadastro de exames. Conserva os menus, os botões de cores, o chat, o agente e as restantes integrações. As páginas Histórico e Biblioteca não são substituídas.

## Cópia de segurança e restauro

Antes da alteração, todos os ficheiros existentes que serão modificados são copiados para:

    backups/laboratorio/DATA_E_IDENTIFICADOR/

O Shell mostra o caminho exacto e o comando de restauro:

    node ~/workspace/atualizacao_laboratorio_20261028/instalar.mjs ~/workspace/NVUALASOFT_Integrado --restaurar CAMINHO_EXACTO_DA_COPIA

O restauro verifica alterações posteriores e recusa sobrescrevê-las. Não apaga as tabelas ou os documentos da base.

Se a estrutura do projecto diferir da versão integrada esperada, o instalador interrompe antes de escrever. Isto preserva alterações feitas noutras rotas, incluindo chamadas e notificações.

## Verificação

- 45 testes de servidor e operações na versão integrada com a actualização da Biblioteca, com PostgreSQL de teste em PGlite. Este pacote acrescenta cinco cenários de teste; a contagem total depende das actualizações já instaladas.
- Testes de edição de resultado legado, preservação integral do original, repetição de pedidos, conflitos de versões, separação de empresas, autoria, credenciais e revisão independente.
- Testes de entrega externa, bloqueio de impressão durante a revisão e edição do mesmo resultado de um pedido concluído.
- Testes da fila por factura e da restrição da configuração a perfis do laboratório.
- TypeScript da API e do frontend.
- Compilações da API e do frontend.
- Interacções React em jsdom para as duas páginas enviadas e o módulo integrado: configuração, unidades e referências, erro de sincronização, importação parcial, edição preenchida, conservação dos valores, motivo obrigatório, paciente fixo, gravação confirmada, erro de gravação e repetição.
- Regressão dos botões flutuantes nos quatro formatos de menu e do Histórico / Biblioteca.
- Instalador com simulação, instalação, repetição, conservação de código adicional e restauro protegido.

Os testes usam dados sintéticos. A instalação no Replit e a validação com a equipa do laboratório continuam necessárias. A implementação não representa homologação do MINSA nem validação clínica dos intervalos configurados.

