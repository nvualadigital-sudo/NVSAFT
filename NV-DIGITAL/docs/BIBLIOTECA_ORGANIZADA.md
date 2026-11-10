# NVUALASOFT — Histórico & Biblioteca

Actualização de 27/10/2026 para NVUALASOFT_Integrado. Aplica a organização do componente enviado ao Histórico e aos documentos institucionais. O pacote contém código funcional ligado à API e uma migração adicional; não é uma aplicação independente.

## Instalação desta entrega completa

As alterações já estão integradas. Siga o README da raiz e INSTALACAO_E_EXECUCAO.md. Não aplique novamente o ZIP parcial. A migração continua a ser executada no seu ambiente com `pnpm db:migrate`; esta entrega não migrou o seu Neon.

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

A integração em hospital.ts e os testes já estão aplicados. Os outros módulos foram conservados.

## Cópia de segurança e verificação

Preserve a instalação anterior e uma cópia de segurança privada da base. Os comandos dos antigos instaladores só se aplicam aos patches históricos, preservados em legado/patches_integrados.

A entrega completa passou em 66 testes, TypeScript, compilação e interacções DOM de Histórico/Biblioteca. Consulte VERIFICACAO.md e evidencias/entrega_20261028. A validação local usa dados sintéticos; não substitui aceitação no Replit e pela instituição.
