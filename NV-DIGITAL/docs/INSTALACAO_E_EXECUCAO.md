# Instalação e execução — 28/10/2026

**Nota para a edição de 05/11/2026 (`2026.11.05-netlify.10`):** o pacote actualizado tem a pasta `NV-DIGITAL` e um instalador externo `actualizar.py`. Utilize as instruções no ficheiro `LEIA_PRIMEIRO.md` do novo ZIP. O nome `NVUALASOFT_Integrado.zip` indicado abaixo pertence à entrega histórica. Esta versão acrescenta a migração `20261105_nv_assistente_actions.sql` e o [NV-ASSISTENTE](NV_ASSISTENTE_IMPLEMENTADO_20261105.md). Mantenha apenas uma execução `pnpm dev`, na porta 3000.

Todos os pacotes anteriores de chat, chamadas, alertas, notificações, biblioteca e laboratório já estão aplicados neste projecto. Não volte a executar os instaladores dos ZIP parciais. O `README.md` da raiz contém os comandos rápidos.

## Preparar uma pasta nova

1. Pare o workflow antigo e qualquer `pnpm dev` no Shell. Preserve o código, os Secrets e uma cópia de segurança da base conforme `BACKUP_E_RESTAURO.md`.
2. Carregue `NVUALASOFT_Integrado.zip` para `~/workspace`. Extraia sem sobrepor a única cópia anterior:

```bash
cd ~/workspace
unzip -q NVUALASOFT_Integrado.zip -d entrega_20261028
cd ~/workspace/entrega_20261028/NVUALASOFT_Integrado
```

Se o destino existir, escolha um nome novo nos dois comandos. O ZIP tem uma pasta superior `NVUALASOFT_Integrado`. O `package.json` está dentro dela; execute pnpm nessa pasta.

3. Use Node.js 24 e pnpm >= 10.26:

```bash
node --version
pnpm --version
pnpm run install:app
```

`install:app` instala a raiz, interface/API e dependências partilhadas mantendo o lockfile congelado e as políticas de dependências. Não instala os workspaces opcionais de geração da especificação da API e utilitário de exemplo; os fontes continuam no ZIP. Assim dispensa `orval`, bloqueado no outro Replit e desnecessário para compilar/executar a aplicação já gerada. Se outro pacote necessário receber HTTP 403, conserve a mensagem e resolva a sua disponibilidade no alojamento; não desactive os controlos de integridade.

## Secrets e migração

| Nome | Utilização |
|---|---|
| `DATABASE_URL` | PostgreSQL da instalação correcta; pode ser pooled no Neon. |
| `DATABASE_URL_UNPOOLED` | Ligação directa da mesma base. Opcional se puder ser derivada do hostname Neon. |
| `SESSION_SECRET` | Segredo aleatório com pelo menos 32 caracteres. |
| `ALLOWED_ORIGINS` | Origem HTTPS real, separada por vírgulas quando houver várias. |
| `NV_DEV_PORT` | Apenas para ensaios isolados; `pnpm dev` usa por defeito a **única porta 3000**. `API_PORT`/`WEB_PORT` antigos são ignorados. |
| `CHAT_STUN_URLS` | URLs STUN opcionais, separadas por vírgula. |
| `CHAT_TURN_URLS` / `CHAT_TURN_SECRET` | URLs TURN e segredo partilhado com o Coturn, apenas no backend. |

Consulte `.env.example`. Nunca publique ligações, palavras-passe ou chaves e nunca use `VITE_` para segredos. Os Secrets do mesmo Replit são herdados pelo processo na nova pasta. Se usar `.env` local, transfira-o de forma privada; ele não vem neste ZIP.

```bash
pnpm db:migrate
```

`scripts/migrate-direct.mjs` escolhe a ligação directa, confirma o mesmo host/base de `DATABASE_URL` e invoca o migrador versionado. No Neon pode retirar `-pooler` do hostname só para esse processo. O migrador instala uma base vazia, aplica apenas migrações ausentes numa existente e recusa hashes alterados de migrações registadas. Não use schema push/force, não apague tabelas e não restaure dumps antigos sobre o banco actual.

Esta entrega **não executou** as novas migrações nem inspeccionou o estado actual do seu Neon. As migrações foram testadas localmente com dados fictícios. Os relatórios anteriores em `legado` não são uma confirmação do estado actual da produção.

## Validar e executar

Um comando de cada vez, avançando só quando não houver erro:

```bash
pnpm test
pnpm build
pnpm dev
```

Os testes usam uma base local de ensaio. A compilação verifica TypeScript e produz API/interface. `pnpm dev` inicia **Express e Vite no mesmo servidor HTTP, porta 3000**; a API responde em `/api` e a interface em `/`. Abra apenas a porta 3000 no Preview. No workflow Run use a pasta real escolhida:

```bash
cd ~/workspace/entrega_20261028/NVUALASOFT_Integrado && pnpm dev
```

Mantenha apenas uma execução. Se aparecer `EADDRINUSE`, pare a execução anterior na porta 3000. A porta 3001 já não é utilizada pelo `pnpm dev`. Se o terminal mostrar `read EIO`, pare o workflow, abra um Shell novo e execute a partir da pasta correcta; não cole os logs como parte do comando.

Entre novamente e actualize com Ctrl+Shift+R. Uma instalação existente conserva as contas da base. Numa instalação nova, configure `DEV_USERNAME`/`DEV_PASSWORD` nos Secrets para a conta técnica inicial, entre em `/admin` e crie a instituição e a sua conta. Não existe palavra-passe técnica predefinida.

## Laboratório e permissões

A gestão cria contas individuais, verifica as credenciais profissionais e atribui competências em Instituição e acessos. As migrações não concedem automaticamente permissões de validação.

Lançar Resultados guarda rascunhos/rectificações com autoria e motivo. Outro profissional autorizado faz a revisão técnica (`lab.validate.technical`); a libertação exige um profissional diferente do autor e do revisor (`lab.validate.release`). A correcção pendente bloqueia a entrega da versão actual; as versões anteriores ficam preservadas. A nova libertação gera um novo aviso no sino.

O circuito de amostras continua em Laboratório → Amostras, qualidade e catálogo técnico. Configure/aprove o catálogo real e teste recipientes, leitores, impressoras e qualidade antes da utilização clínica. Ver `LABORATORIO_VISUAL_E_EDICAO.md`.

## Chamadas e alertas

1. Use duas contas activas diferentes da mesma empresa em HTTPS. Autorize microfone/câmara nos dois navegadores.
2. Em Alertas, active som/notificações e teste o toque de 12 segundos. A recepção funciona noutros módulos enquanto a aplicação estiver aberta.
3. Faça uma chamada, deixe tocar, atenda e confirme a paragem do toque. Teste recusa, cancelamento, minimização e fim.
4. Entre redes diferentes, configure TURN segundo `infra/chat-turn/INSTALAR_TURN.md`. O exemplo não inclui relay publicado nem um segredo utilizável em operação.
5. No sino geral, active os alertas e confirme novas emissões, mensagens e tarefas acessíveis. Ler o alerta não confirma comunicação de crítico nem conclui tarefas.

O Preview embutido pode bloquear permissões; abra num separador próprio. Não há push com a aplicação fechada, SMS ou e-mail. As chamadas não são gravadas. Não foi efectuado um ensaio de áudio/vídeo entre equipamentos reais nesta entrega.

## Publicação

Depois da migração e aceitação local, produção usa `pnpm run install:app`, `pnpm build` e `pnpm start`, com `PORT` fornecida pela plataforma. O servidor compilado serve API e interface. A `.replit` incluída pressupõe o projecto na raiz; numa instalação aninhada adapte o directório do workflow e da publicação à pasta acima.

Instalação não equivale a homologação clínica/fiscal ou certificação MINSA. Consulte a matriz de âmbito e os critérios de aceitação. Preserve/exporte dados existentes apenas em navegadores antigos antes de limpar dispositivos.
