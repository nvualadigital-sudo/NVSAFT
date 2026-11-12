# Publicação do NV-DIGITAL na Vercel

O repositório `NVSAFT` contém a aplicação dentro de `NV-DIGITAL/`. A pasta raiz do projecto Vercel deve ser `NV-DIGITAL`, com maiúsculas e hífen. Não é `NV-DIGITAL/artifacts/lab-results`: a raiz precisa também de incluir `api/`, as bibliotecas partilhadas e `vercel.json`.

## Definições do projecto

Em Settings → Build and Deployment:

| Campo | Valor |
|---|---|
| Root Directory | `NV-DIGITAL` |
| Framework Preset | `Other` (a configuração `framework: null` já o define) |
| Output Directory | `artifacts/lab-results/dist/public` (definido em `vercel.json`) |
| Node.js | `24.x`, conforme `package.json` |
| Install Command | Usar o definido em `vercel.json`, com pnpm 11.25.0 e dependências de compilação |
| Build Command | Usar o definido em `vercel.json`, que compila API e interface |

As definições da pasta raiz na conta Vercel não são alteradas por este commit. Depois de as conferir, faça uma nova publicação de produção sem reutilizar a cache anterior. Confirme que o domínio `nvsaft.vercel.app` está associado ao projecto e à publicação de produção correctos.

## Variáveis privadas

Configure `DATABASE_URL`, `SESSION_SECRET` (pelo menos 32 caracteres), `NODE_ENV=production` e `ALLOWED_ORIGINS=https://nvsaft.vercel.app` no ambiente Production. Para o acesso de desenvolvedor já utilizado, configure também `DEV_USERNAME` e `DEV_PASSWORD`. As palavras-passe, ligações e chaves privadas não devem ser guardadas no repositório ou em variáveis `VITE_*`.

## Aceitação após publicar

1. `/` deve apresentar a aplicação e carregar os ficheiros estáticos.
2. `/admin` deve abrir a página de acesso directamente e após actualizar o navegador.
3. `/api/healthz` deve responder com JSON da API, em vez de HTML ou `NOT_FOUND` da plataforma.
4. Só depois, verificar a ligação à base correcta e testar o início de sessão numa conta autorizada.

Esta correcção ajusta o arranque CommonJS da função API e a configuração de compilação. Não executa migrações remotas, não concede permissões e não activa emissão fiscal. A exportação SAF-T ainda exige o seu validador Python/lxml no ambiente onde for executada; este ajuste de publicação não instala um runtime Python na função Node da Vercel.
