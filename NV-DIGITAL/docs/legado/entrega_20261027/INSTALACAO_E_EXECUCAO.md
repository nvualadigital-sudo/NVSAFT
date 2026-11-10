# Instalação e execução

1. Preservar uma cópia do código e os Secrets actuais. Importar o conteúdo do projecto numa área de validação do Replit. Não importar bancos antigos por cima do banco já migrado.
2. Na raiz, usar Node.js 24 e executar pnpm install --frozen-lockfile.
3. Configurar DATABASE_URL do PostgreSQL, SESSION_SECRET com pelo menos 32 caracteres aleatórios e ALLOWED_ORIGINS com a origem real. Para migrações usar DATABASE_URL_UNPOOLED directa. Consultar .env.example, que não contém credenciais reais.
4. Executar pnpm db:migrate. O bootstrap cria uma instalação vazia; numa instalação existente cria apenas o que falta e regista hashes no ledger. As migrações de integração anteriores e a nova de rastreabilidade já foram aplicadas ao projecto Neon autorizado. Não usar drizzle push/force nem restaurar um dump antigo.
5. Executar pnpm test e pnpm build. Para desenvolvimento usar pnpm dev (interface porta 3000, API porta 3001). Para produção usar pnpm start com PORT da plataforma; o servidor publica a API e a interface compilada.
6. Entrar de novo. As sessões antigas sem identificador revogável não são aceites. A clínica mantém contas existentes. Numa instalação nova, configurar DEV_USERNAME/DEV_PASSWORD nos Secrets, entrar em /admin e criar a instituição e a sua conta; não há palavra-passe técnica predefinida.
7. Na conta institucional: criar contas individuais em Funcionários; registar/verificar credenciais em Instituição e acessos; activar serviços, sectores e especialidades; delegar competências temporárias aos profissionais. Nenhum sector é activado apenas por constar no kit.
8. Configurar o catálogo laboratorial real com protocolo, requisitos e referências aprovados. Outro profissional autorizado aprova a versão. Registar CQ por sector/equipamento/lote antes das validações que o exigem.
9. Homologar o percurso com dados fictícios e os equipamentos locais. Só publicar/activar para uso clínico depois da aceitação institucional.

## Primeira utilização do circuito laboratorial

Médico/enfermeiro abre pedido no cadastro central (o episódio é conferido quando indicado). O sistema cria recipientes. No ponto de colheita, confirmar nome e segundo identificador, registar colheita/local anatómico, pedir impressão, conferir a etiqueta, ler o código e confirmar a aplicação. Registar transporte/recepção, aceitar ou rejeitar com motivo, iniciar processamento, introduzir resultado, validar tecnicamente e libertar por profissionais distintos conforme catálogo. Documentar a comunicação dos críticos e a confirmação/readback. O resultado validado entra no Histórico e no processo da instituição.

O lançamento antigo de resultados não permite criar/reescrever resultados por fora deste percurso. Os resultados legados continuam disponíveis; não foram fabricados pedidos/amostras retroactivos. Pedidos de parceiros legados exigem conferência/associação explícita ao cadastro e ao resultado, sem correspondência automática por nome.

## IA, voz e ficheiros

AI_ASSISTANT_ENABLED e AI_DOCUMENTS_ENABLED vêm desligados. Activar só depois de aprovar fornecedor/tratamento externo e configurar OPENAI_API_KEY. O assistente não recebe pacientes automaticamente. O upload financeiro lê JSON/CSV de um registo ou QR de imagem reconhecido; um BI cifrado/assinado depende de integração oficial. Não há extracção de nome/preço/stock a partir de dados inventados.

## Publicação

A alteração do schema Neon não substitui o código que está a executar no Replit. Este trabalho não publicou nem substituiu directamente os ficheiros do Replit; instalar e executar este ZIP é necessário. A cópia de segurança cifrada/restauro de ensaio está descrita em BACKUP_E_RESTAURO.md.
