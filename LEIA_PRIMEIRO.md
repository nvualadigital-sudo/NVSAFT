# NV-DIGITAL — pacote completo com NV-ASSISTENTE

**Edição:** `2026.11.05-netlify.10` · 05/11/2026 · porta única 3000 no desenvolvimento.

Este arquivo contém todo o projecto, não só o assistente. Preserva o Chat, o MedLink, a facturação/AGT, os POS, Enfermagem, Medicina, Laboratório, Configurações e módulos prévios. A nova funcionalidade é apresentada em `NV-DIGITAL/docs/NV_ASSISTENTE_IMPLEMENTADO_20261105.md`.

## Actualizar o projecto existente no GitHub Codespaces

1. Guarde as suas alterações, faça um backup da base de dados e crie uma branch de ensaio. Não cole credenciais no Chat.
2. Extraia este ZIP numa pasta nova (fora do repositório que usa diariamente).
3. Na raiz do projecto existente, execute primeiro a simulação. **Se a simulação indicar conflitos, pare e envie os caminhos apresentados para conciliação.**

```bash
cd /workspaces/NVDIGITAL
unzip -nq NV-DIGITAL_Completo_NV_ASSISTENTE_Porta_3000_20261105.zip -d /tmp/nv-assistente-20261105
python3 /tmp/nv-assistente-20261105/actualizar.py . --check
python3 /tmp/nv-assistente-20261105/actualizar.py .
```

Se o nome do seu projecto for `/workspaces/NV-DIGITAL`, use esse caminho no `cd`. Se o ZIP não estiver na raiz do repositório, use o seu caminho real no `unzip`.

O instalador exige o projecto existente, compara os hashes das versões conhecidas e guarda os originais dos ficheiros alterados em `backups/`. Nunca apaga os seus registos na Neon. A edição `.9` e as duas edições `.8` usadas na integração são fontes reconhecidas. Não sobrescreva manualmente o repositório com a pasta `NV-DIGITAL` incluída no ZIP.

4. Com os Secrets já configurados no Codespaces, ensaie as migrações numa branch de teste Neon. Só depois actualize a base real:

```bash
pnpm install --frozen-lockfile
pnpm db:status
pnpm db:migrate
pnpm test
pnpm build
pnpm dev
```

**Nota:** `pnpm db:status` devolve código 2 se existirem migrações pendentes; isso indica que deve executar `pnpm db:migrate` após a verificação do destino. A nova migração do assistente é `20261105_nv_assistente_actions.sql`.

## Uma só porta 3000

- `pnpm dev` arranca a interface, o servidor Node/API e a actualização automática em `http://localhost:3000`. API em `/api`.
- Se aparecer `EADDRINUSE`, pare primeiro o processo antigo. Não abra outra API na porta 3001.
- A publicação na Netlify continua a necessitar de uma **API Node publicada separadamente** e da migração na Neon antes de publicar o frontend. O facto de haver uma só porta local não transforma a Netlify num servidor Node.

## Activação do NV-ASSISTENTE

Abra o botão flutuante do assistente no NV-DIGITAL. A conversação em texto, os comandos de navegação e a preparação/confirmação de mensagens internas funcionam sem um fornecedor de IA externo. A activação de voz usa o reconhecimento nativo do navegador **apenas após autorização**; não capta som permanentemente.

Para conversação livre, no **backend** configure `AI_ASSISTANT_ENABLED=true` e uma opção: `OPENAI_API_KEY` ou `NEON_AI_GATEWAY_TOKEN` + `NEON_AI_GATEWAY_BASE_URL`. Chaves e ligações da Neon ficam em Secrets, nunca no código ou em `VITE_*`.

O assistente **não** emite facturas AGT, não valida resultados, não prescreve e não partilha dados clínicos com um fornecedor de IA. O streaming Realtime de áudio com voz premium não faz parte desta edição: requer aprovação separada do fornecedor e política de privacidade.

**Esta entrega não publicou a Netlify, não alterou a Neon real e não certifica a conformidade AGT.**
