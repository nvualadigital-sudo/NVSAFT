# NVUALASOFT — Histórico & Biblioteca

Actualização de 27/10/2026 para NVUALASOFT_Integrado. Aplica a organização do componente enviado ao Histórico e aos documentos institucionais. O pacote contém código funcional ligado à API e uma migração adicional; não é uma aplicação independente.

## Instalar no Replit

1. Pare o workflow NV.Digital pelo botão Stop.
2. Carregue NVUALASOFT_Historico_Biblioteca.zip para ~/workspace.
3. No Shell execute:

    cd ~/workspace
    unzip -nq NVUALASOFT_Historico_Biblioteca.zip -d atualizacao_biblioteca_20261027
    node atualizacao_biblioteca_20261027/instalar.mjs ~/workspace/NVUALASOFT_Integrado
    cd ~/workspace/NVUALASOFT_Integrado
    pnpm run db:migrate
    pnpm test
    pnpm build

4. Reinicie o workflow NV.Digital. Se executa manualmente, use pnpm dev uma única vez, com o workflow parado.
5. Entre na sua instituição e abra Histórico → Arquivos / Biblioteca. A opção Biblioteca no menu abre o mesmo módulo e os mesmos documentos.

Execute cada linha apenas depois de a anterior terminar sem erro. Não crie outro projecto nem extraia um segundo NVUALASOFT_Integrado.

A migração usa o Secret DATABASE_URL_UNPOOLED já configurado, com ligação directa à base pretendida, sem -pooler no hostname. Não coloque a ligação no código nem a envie no chat. Este pacote e o instalador não alteraram a sua base Neon; a alteração é executada pelo comando db:migrate no seu ambiente. A migração cria apenas hospital_library_meta, mantendo hospital_files, hospital_folders e os respectivos conteúdos.

Para verificar o destino antes de instalar:

    node ~/workspace/atualizacao_biblioteca_20261027/instalar.mjs ~/workspace/NVUALASOFT_Integrado --dry-run

Não é necessário reinstalar dependências; são usadas as já existentes no projecto integrado.

## O que está incluído

- Cabeçalho Histórico & Biblioteca, dois separadores e três cartões com contagens dos resultados reais.
- Pesquisa por paciente, processo, referência, exame ou parâmetro, filtros de emissão e paginação.
- Consulta do resultado e impressão / gravação como PDF após autorização e registo de auditoria no servidor.
- A janela de impressão é reservada no clique para evitar o bloqueio de popups após o pedido de autorização; os dados só são escritos quando o servidor autoriza.
- Biblioteca com barra lateral verde escura, navegação activa vermelha e acções em verde petróleo.
- Início, Biblioteca da empresa, Recentes, Actividade, Favoritos, Etiquetas e Lixeira.
- Pastas e subpastas, caminho de navegação, pesquisa por nome / descrição / autor, lista, grelha e colunas.
- Filtros por tipo, datas e tamanho; ordenação por nome, tipo, alteração ou tamanho.
- Carregamento de ficheiros e de pastas, arrastar ficheiros para a área de documentos e progresso confirmado por ficheiro.
- Pré-visualização de PDF, PNG, JPEG e texto; download dos originais. DOCX e XLSX são descarregados para consulta no programa local.
- Renomear, mover, duplicar, descrição, etiquetas, favoritos pessoais e selecção de vários itens.
- Lixeira reversível. Ao restaurar uma pasta, documentos que já estavam na lixeira antes dela continuam na lixeira.
- Eliminação definitiva disponível apenas para administração / gestão, depois da passagem pela lixeira.
- Ligações internas que exigem autenticação na instituição correspondente.
- Exportação ZIP dos documentos seleccionados, incluindo subpastas e manifesto.
- Registo de actividade das últimas 100 operações da instituição.
- Pedidos repetidos de carregamento com a mesma chave não criam um segundo ficheiro; alterações concorrentes incompatíveis devolvem conflito.

## Empresas e permissões

Cada consulta, download e alteração usa a empresa da sessão autenticada. Enviar um id ou ligação de outra empresa não permite ler, mover, copiar ou eliminar o seu documento. Os favoritos pertencem ao utilizador da instituição; as pastas, etiquetas e descrições são partilhadas entre os seus colegas com acesso ao módulo.

Esta biblioteca é interna à empresa. O envio autorizado entre hospitais continua no MEDLIK. Não se criam links públicos fictícios nem se publica conteúdo do servidor no navegador de outra empresa.

A impressão de resultados conserva as verificações existentes do laboratório e da versão validada. As permissões e credenciais profissionais continuam a ser verificadas no servidor; um resultado não validado pode ser consultado por quem tem acesso ao histórico, mas não obtém emissão autorizada. O Histórico não elimina resultados nem contorna o circuito de rectificação.

## Limites implementados

- 10 MB por ficheiro.
- 500 MB por instituição, incluindo o conteúdo ainda na lixeira.
- PDF, PNG, JPEG, TXT, CSV, DOCX e XLSX.
- Até 300 ficheiros por carregamento, 100 itens por alteração em lote e 50 MB de conteúdos por exportação ZIP.
- Em carregamento parcial, a interface informa quantos ficheiros foram confirmados. Repita apenas os ainda não confirmados.
- A vista Colunas apresenta o caminho de pastas; com filtros ou pesquisa, os resultados passam para a lista.
- As vistas Início / Recentes ordenam documentos pela última alteração; não representam histórico pessoal de abertura.
- Actualização automática a cada 30 segundos enquanto a página estiver visível; existe também Actualizar.

Não se usa IndexedDB/localStorage para guardar documentos. Os ficheiros que existam apenas na biblioteca antiga do navegador precisam de ser descarregados na versão antiga e carregados na instituição correcta. O instalador não os atribui automaticamente a uma empresa.

A exportação ZIP serve para descarregar documentos. O restauro integral da base continua a usar as rotinas próprias de backup do projecto.

## Ficheiros do módulo

    artifacts/lab-results/src/pages/laboratorio/Historico.tsx
    artifacts/lab-results/src/pages/admin/Biblioteca.tsx
    artifacts/lab-results/src/pages/admin/biblioteca/BibliotecaWorkspace.tsx
    artifacts/lab-results/src/pages/admin/biblioteca/api.ts
    artifacts/lab-results/src/pages/admin/biblioteca/ui.tsx
    artifacts/lab-results/src/pages/admin/biblioteca/workspace.css
    artifacts/api-server/src/routes/library.ts
    migrations/20261027_biblioteca_organizada.sql

O instalador liga library.ts em hospital.ts e acrescenta os testes à preparação existente, preservando as restantes rotas e testes. Se encontrar uma estrutura incompatível, interrompe antes de escrever. Não substitui App.tsx, .replit, os menus, os botões flutuantes, o chat, o agente ou os restantes módulos.

## Cópia de segurança e restauro

Antes da escrita, o instalador guarda todos os ficheiros existentes que irá alterar em:

    backups/biblioteca/DATA_E_IDENTIFICADOR/

A pasta exacta e o comando de restauro aparecem no Shell. Para restaurar os ficheiros:

    node ~/workspace/atualizacao_biblioteca_20261027/instalar.mjs ~/workspace/NVUALASOFT_Integrado --restaurar CAMINHO_EXACTO_DA_COPIA

O restauro verifica se houve alterações posteriores e recusa sobrescrevê-las. Não apaga tabelas ou documentos do banco. Não elimine hospital_library_meta: uma versão anterior pode ignorá-la e a actualização posterior volta a usar os metadados.

## Verificação efectuada

- 40 testes de servidor e operações passaram sobre PostgreSQL de teste em PGlite, incluindo isolamento entre empresas, favoritos pessoais, conflitos de edição, reenvio de upload, cópia de subpastas, restauro, permissões de eliminação, etiquetas e quota.
- TypeScript de API e frontend passou.
- Compilações da API e frontend passaram. Permanecem avisos anteriores de sourcemaps nos componentes label/avatar/select, sem impedir a compilação.
- Interacções React verificadas em jsdom: pesquisa do histórico, PDF autorizado / recusado, separadores, vistas, pesquisa de documentos, favoritos, gravação confirmada / recusada, foco do diálogo, descrição, ligação interna e lixeira / restauro.
- Regressão dos botões flutuantes nos quatro formatos de menu: cores, claro / escuro, agente, chat e preferências por conta / instituição.
- Instalador verificado com a base integrada: simulação sem escrita, aplicação, repetição sem alterações, preservação de outras rotas, recusa de estrutura incompatível e restauro com protecção de alterações posteriores.

A validação acima é local, com dados de teste. Não substitui a validação na instalação Replit nem corresponde a homologação do MINSA.

