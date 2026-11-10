# Publicar ou actualizar o NV-DIGITAL na Netlify

**Última edição `2026.11.05-netlify.10` — NV-ASSISTENTE:** use `NV-DIGITAL_Completo_NV_ASSISTENTE_Porta_3000_20261105.zip`, incluindo o novo `20261105_nv_assistente_actions.sql`. O instalador protege as edições `.8`, `.9` e mudanças locais desconhecidas com uma simulação obrigatória. Este ZIP inclui o frontend e o backend; para a Netlify, **migre primeiro uma branch de teste Neon e publique a API Node** antes do site estático. A porta única 3000 é para o modo `pnpm dev`, não converte a Netlify num alojamento Node. Detalhes e limites em [NV_ASSISTENTE_IMPLEMENTADO_20261105.md](NV_ASSISTENTE_IMPLEMENTADO_20261105.md). Os exemplos históricos abaixo referem o ZIP `.9` e não devem ser reutilizados como nome de ficheiro nesta edição.

**Edição actual `2026.11.05-netlify.9` — ZIP completo com porta única no desenvolvimento:** reúne Chat/MedLink, melhorias de facturação e resultados, catálogo POS correcto e permissões laboratoriais. Use `NV-DIGITAL_Completo_Unificado_Porta_3000_20261105.zip` e o respectivo `actualizar.py` (com `--check` primeiro). `pnpm dev` abre somente a porta 3000, mas **a publicação Netlify continua a exigir um serviço de API Node externo**: a Netlify é alojamento estático e o ZIP não substitui o serviço API. Veja [PORTA_3000_CONSOLIDACAO_20261105.md](PORTA_3000_CONSOLIDACAO_20261105.md).

**Edição actual `2026.11.05-netlify.8`:** inclui todas as correcções anteriores e melhora o Chat/MedLink (consultas e exames a parceiros, mensagens institucionais, estados e apresentação). O menu apresenta «MedLink». Consulte [MEDLINK_CHAT_20261105.md](MEDLINK_CHAT_20261105.md). **Esta edição exige a migração** `20261105_medlink_pedidos_mensagens.sql` numa branch de teste antes da produção. Utilize `NVUALASOFT_Completo_Chat_MedLink_20261105.zip`, extraia para `/tmp/nv-medlink-20261105` e valide primeiro com `actualizar.py --check`. Mensagens interinstitucionais não são SMS por operadora; chamadas de voz/vídeo entre empresas continuam pendentes.

**Edição actual `2026.11.05-netlify.7`:** conserva as consolidações anteriores e corrige os sectores/categorias do POS financeiro, explicando quando não existem receitas e lotes no POS de formação da Farmácia. Consulte [POS_CATALOGO_FARMACIA_20261105.md](POS_CATALOGO_FARMACIA_20261105.md) e [NOMEACAO_TECNICO_SUBSTITUTO_20261105.md](NOMEACAO_TECNICO_SUBSTITUTO_20261105.md). Utilize `NVUALASOFT_Completo_POS_Catalogo_20261105.zip`, pasta `/tmp/nv-pos-20261105` e execute o `actualizar.py` incluído primeiro em modo `--check`.

Esta edição (`2026.11.05-netlify.4`) reúne as [melhorias clínicas e de Medicina Dentária com as correcções de resultados, facturação/POS, conta corrente, remunerações, passes e assinaturas](AUDITORIA_CONSOLIDADA_20261105.md), conservando a [numeração curta do Laboratório por empresa](LABORATORIO_NUMERACAO.md). O ZIP contém o projecto completo e um instalador para integrar as alterações na instalação existente.

A Netlify publica a interface. A API Express continua num serviço Node.js com acesso à base Neon. Este pacote contém os dois códigos, as migrações e a configuração da Netlify. Use o servidor de API que já tem, se estiver operacional. **Publicar apenas a interface não actualiza a API nem cria as tabelas novas.**

## 1. Actualizar o código no Codespaces

1. Abra a raiz do repositório ligado à Netlify (a pasta com `package.json` e `pnpm-workspace.yaml`). Crie uma branch de actualização ou preserve o seu trabalho local antes de integrar.
2. Descarregue o ZIP e extraia-o para uma pasta temporária. A raiz do código para uma instalação nova é `NV-DIGITAL/` dentro do ZIP. Para actualizar a instalação existente, use o instalador da pasta exterior:

   ```bash
   cd /workspaces/NVDIGITAL
   unzip -nq NV-DIGITAL_Completo_Unificado_Porta_3000_20261105.zip -d /tmp/nv-unificado-20261105
   python3 /tmp/nv-unificado-20261105/actualizar.py . --check
   python3 /tmp/nv-unificado-20261105/actualizar.py .
   git status --short
   ```

   Use o nome real da pasta do seu repositório: pode ser `/workspaces/NVDIGITAL` ou `/workspaces/NV-DIGITAL`. O modo sem opções compara todos os ficheiros com as versões de origem reconhecidas, incluindo a edição de Fluxo Clínico/Dentária e a anterior edição Laboratório. Se souber exactamente qual o seu pacote base, poderá optar por `--sobre-laboratorio`, `--sobre-netlify` ou `--sobre-consolidado` para limitar a actualização. **Se houver conflitos**, não execute a instalação até rever os caminhos listados.

   A simulação deve passar antes de executar a linha seguinte. O instalador guarda uma cópia local dos ficheiros substituídos. Se encontrar uma alteração incompatível num ficheiro a actualizar, identifica o caminho e pára sem escrever. Concilie essa diferença na sua branch. Não copie o ZIP por cima da raiz existente nem faça commit do ZIP, do `.env` ou dos backups.

As opções `--sobre-laboratorio`, `--sobre-netlify` e `--sobre-consolidado` verificam a base reconhecida e deixam intactos os ficheiros que não mudaram desde essa base. O ficheiro `nursingRouter.ts` não é alterado por estes modos. A remoção dos componentes duplicados Salários/Honorários é indicada na simulação e conserva a cópia original no backup; não apaga os registos financeiros. Outras partes do cadastro de enfermagem recebem a numeração central; alterações locais nesses ficheiros são detectadas antes da escrita.

## 2. Actualizar a base e a API

1. Faça cópia da base antes de migrar. Ensaie primeiro com uma base de teste. Confirme que `DATABASE_URL_UNPOOLED` aponta para a ligação directa da mesma base que a API usa em `DATABASE_URL`.
2. No Codespaces, com as ligações configuradas em Secrets ou no `.env` local:

   ```bash
   pnpm install --frozen-lockfile
   pnpm db:status
   pnpm db:migrate
   pnpm db:status
   pnpm --filter @workspace/api-server build
   ```

   `db:status` não altera a base. Se houver migrações por aplicar, apresenta a lista e termina com código 2; nesse caso execute a linha `pnpm db:migrate` e repita a verificação. Se houver conflitos de hashes, pare para conciliar os ficheiros, sem apagar o histórico de migrações. Na base consultada na auditoria faltavam as cinco migrações enumeradas no relatório; esta edição acrescenta uma sexta para movimentos e assinaturas.

3. Publique o código desta versão no serviço **que executa a API Node**, com Node 24, compilação `pnpm --filter @workspace/api-server build` e arranque `pnpm start` a partir da raiz. O serviço fornece `PORT` ou usa 3000. Mantenha a ligação da base e a chave de sessão existentes. Para validar SAF-T no servidor, disponibilize Python 3 e lxml conforme a documentação AGT; o build da interface não precisa de credenciais fiscais.
4. No **servidor da API**, configure:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | Ligação Neon da API, privada |
   | `SESSION_SECRET` | Chave privada de pelo menos 32 caracteres; preserve a já em uso |
   | `NODE_ENV` | `production` |
   | `ALLOWED_ORIGINS` | Origem pública exacta da Netlify ou domínio personalizado; separar origens autorizadas com vírgulas |
   | `PORTAL_ORIGIN` | Origem HTTPS exacta em que o paciente abre o portal, sem caminho |

   O Portal do Paciente usa a origem indicada para proteger a sessão. Configure os domínios de teste no backend de teste. As credenciais TURN, IA e AGT permanecem apenas no backend e devem ser mantidas se já configuradas. **Não copie segredos para variáveis `VITE_*` nem para a Netlify neste modo de publicação.**

5. Antes de actualizar a interface, verifique a API externa (substitua o endereço):

   ```bash
   pnpm check:netlify --api https://api.exemplo.ao
   ```

   A rota `/api/readyz` deve indicar a versão e responder HTTP 200. HTTP 503 significa que a API ainda não confirmou a ligação ou as migrações desta versão. A rota antiga `/api/healthz` continua disponível para sondagem do processo.

## 3. Actualizar o site Netlify

No **site Netlify existente**, em **Project configuration**, confirme que o repositório e a branch correspondem aos que pretende publicar. Em **Build settings**, use a raiz do repositório como Base directory e deixe Package directory vazio quando o projecto está nessa raiz. O `netlify.toml` já define:

- Build command: `pnpm build:netlify`
- Publish directory: `artifacts/lab-results/dist/public`
- Node: 24; instalação pnpm com o lockfile fixo.

Em **Environment variables** do site, crie **`NV_NETLIFY_API_ORIGIN`** com a origem HTTPS da API actualizada, por exemplo `https://api.exemplo.ao`, **sem `/api` no fim**. A variável antiga `VITE_API_URL` é reconhecida como alternativa. O build gera as regras da API antes do fallback de páginas. Se usar Deploy Preview ou uma branch de ensaio, dê-lhes um valor de API separado e aponte para uma base de teste.

Reveja as alterações e faça commit/push para a branch ligada. Deixe a publicação automática correr depois de a API e a base estarem actualizadas; se a publicação automática estiver parada, desencadeie o deploy no site existente. Não faça upload manual do ZIP de código no Netlify Drop.

## 4. Conferir a actualização publicada

```bash
pnpm check:netlify https://o-seu-site.netlify.app
```

O comando verifica a versão da interface, a versão e prontidão da API, a abertura do portal e a recusa de pedidos sem sessão. Depois, confirme login de um utilizador de teste e faça uma venda em **Farmácia → Balcão POS**. A formação não altera o stock clínico e a produção fiscal continua bloqueada.

Em **Histórico/PDF**, confirme que uma versão em revisão abre e imprime com a indicação **DOCUMENTO PROVISÓRIO**, sem a assinatura do director como autorização. Depois da revisão e libertação, confirme a impressão final. Confira **Configurações → Assinaturas clínicas**, **Serviços hospitalares → Recursos humanos** e os modelos do **Criador de Passes** com funcionários de teste.

No Laboratório, abra **Numeração** e confirme o prefixo institucional. Siga a [conferência de processo, pedido, etiqueta e relatório](LABORATORIO_NUMERACAO.md#conferência-na-instituição-de-teste) com um paciente de teste. Os números anteriores devem permanecer inalterados.

Se operações de equipa de longa duração excederem o limite do proxy da Netlify, pode definir `NV_NETLIFY_STAFF_DIRECT=1` e recompilar. A equipa passa a chamar directamente a origem HTTPS da API, com `ALLOWED_ORIGINS` configurado; o portal continua na mesma origem do site.

- **A interface abre e `/api/readyz` devolve HTML:** verifique se a Netlify publicou a pasta certa e compilou a versão deste `netlify.toml`.
- **`/api/readyz` dá 401 ou 404:** confirme o endereço configurado e actualize o backend. Uma API anterior pode ainda responder a `/api/healthz`.
- **Portal abre mas não permite iniciar sessão:** confirme `PORTAL_ORIGIN`, a ligação ao backend e os cookies em HTTPS. Não reutilize a origem de produção para testes noutro domínio.

Documentação: [monorepos na Netlify](https://docs.netlify.com/build/configure-builds/monorepos/), [proxy e fallback SPA](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/), [configuração do pnpm](https://docs.netlify.com/build/configure-builds/manage-dependencies/).
