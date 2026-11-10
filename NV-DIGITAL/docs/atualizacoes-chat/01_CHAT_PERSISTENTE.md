# Chat ligado à base de dados — NVUALASOFT Integrado

Este pacote foi preparado para a versão NVUALASOFT_Integrado.zip de 27/10/2026. Mantém o modelo visual de «Texto colado(9).txt», com a navegação, cores, painéis, emojis, galeria, estatísticas, temas e idiomas. Substitui as mensagens de exemplo e o armazenamento local por utilizadores e registos reais do servidor.

## Instalação no Replit

1. Pare o projecto e guarde uma cópia dos dois ficheiros que serão substituídos:
   - artifacts/lab-results/src/pages/comunicacao/Chat.tsx
   - artifacts/api-server/src/routes/index.ts
2. Coloque NVUALASOFT_Chat_DB.zip na pasta raiz do projecto, onde estão package.json, artifacts e migrations. Extraia o ZIP nessa pasta e aceite substituir os ficheiros. No terminal dessa pasta:

```bash
unzip -o NVUALASOFT_Chat_DB.zip
pnpm run db:migrate
pnpm run build
```

3. Depois de os comandos terminarem com sucesso, reinicie pelo botão Run ou execute `pnpm dev`.
4. Entre com dois utilizadores da mesma instituição em dispositivos ou sessões diferentes. Abra Comunicação → Chat, escolha o colega, envie uma mensagem e confirme a recepção. Termine a sessão e volte a entrar: o histórico deve continuar disponível.

A migração usa a configuração DATABASE_URL_UNPOOLED (ou DATABASE_URL directa) já existente no servidor. Não coloque a palavra-passe da base de dados no React. Se estiver configurada apenas uma ligação com «-pooler», o comando de migração exige primeiro a ligação directa, conforme o mecanismo que o projecto já utiliza.

Não é necessário trocar App.tsx nesta versão: já importa ./pages/comunicacao/Chat. Se alterou esse import na sua instalação, aponte-o para esse caminho e mantenha `<ChatApp session={session} />`.

## Conteúdo do pacote

| Ficheiro | Acção |
|---|---|
| artifacts/lab-results/src/pages/comunicacao/Chat.tsx | Substituir a página actual |
| artifacts/api-server/src/routes/index.ts | Substituir para registar a nova API; mantém as rotas da versão integrada |
| artifacts/api-server/src/routes/chat-live.ts | Acrescentar a API do chat |
| migrations/20261027_z_chat_persistente.sql | Acrescentar e executar com db:migrate |
| tests/chat-live.test.ts | Acrescentar testes da integração |
| VERIFICACAO_CHAT.txt | Resultado da validação nesta entrega |

É necessário instalar o conjunto: trocar apenas o ficheiro React deixa a página sem as novas rotas.

## Funcionalidades ligadas ao servidor

- Contactos activos da mesma instituição; nova conversa por selecção de um desses contactos.
- Canal geral da equipa, mensagens directas e grupos com membros autorizados.
- Histórico no PostgreSQL da instituição, incluindo as mensagens existentes nas tabelas anteriores.
- Actualização automática a cada 4 segundos enquanto o separador está visível; actualização ao regressar ao separador.
- Envio confirmado no servidor; pedidos repetidos após uma falha de rede usam a mesma chave para evitar duplicação.
- Mensagens com até 4000 caracteres, respostas, edição e eliminação das próprias mensagens, reacções e encaminhamento para outra conversa autorizada.
- Anexos até 5 MB: PDF, PNG, JPEG, TXT e áudio WebM/OGG/MP4. A gravação depende da disponibilidade de microfone e MediaRecorder no dispositivo, em HTTPS ou localhost.
- Transferência autenticada de anexos, sem endereços públicos para os ficheiros.
- Confirmações de leitura em conversas directas e contagem de mensagens não lidas.
- Histórico paginado: botão para carregar mensagens anteriores. A pesquisa e as estatísticas incidem nas mensagens carregadas; carregue as anteriores para as incluir.
- Tema, idioma, papel de parede e preferências de conversa guardados no servidor por utilizador. Imagens de papel de parede: PNG/JPEG até 500 KB.
- Bloquear um contacto impede novos envios pela nova API. Limpar ou eliminar a conversa da lista limpa apenas a vista do próprio utilizador; não apaga o histórico dos colegas.

Os grupos usam as tabelas existentes de mensagens e anexos e acrescentam tabelas de membros, preferências e reacções. A migração é aditiva e não elimina pacientes, facturas nem mensagens.

As conversas guardadas no antigo localStorage não são importadas automaticamente: o ficheiro anterior misturava contactos e mensagens de demonstração. Esse conteúdo antigo não é apagado do dispositivo.

## Limites desta entrega

Chamadas reais de voz/vídeo, estados, canais externos, comunidades e assistente de IA não foram ligados a serviços externos. Os controlos não simulam uma chamada ou resposta de IA bem sucedida. Os grupos internos e o canal da equipa funcionam na base de dados.

O navegador continua a apresentar a aplicação web. O histórico e os anexos dependem do servidor e da base de dados, não do armazenamento do navegador. Sem ligação ao servidor, a página apresenta o erro e não confirma uma gravação que não aconteceu.

Não foram alteradas a base de dados em produção nem a instalação activa no Replit. A validação foi feita localmente com PostgreSQL PGlite, testes HTTP, TypeScript e compilação de produção. A verificação com duas sessões na instalação real continua necessária após a substituição.
