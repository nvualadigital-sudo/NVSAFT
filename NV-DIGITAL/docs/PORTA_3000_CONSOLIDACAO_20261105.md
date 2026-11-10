# Consolidação NV-DIGITAL .9 — servidor de desenvolvimento na porta 3000

## Entrega

Esta edição conserva as funcionalidades e migrações do Chat/MedLink `.8` e recupera as melhorias compatíveis da edição paralela `Faturacao_Rapida_Resultados_20261105`, incluindo:

- Facturação: actualização incremental da interface após rascunhos e carregamentos mais leves, sem modificar documentos fiscais emitidos.
- Laboratório: botão de validação, visualização de histórico/PDF interno durante revisão, identificação do profissional que libertou o resultado, permissões por ficha de funcionário verificadas no servidor e possibilidade excepcional de substituto nomeado.
- POS: preservados apenas **Comércio (EXAMES-LAB)** e **Farmácia**, com categorias lidas do catálogo institucional; sem regressão para «Restaurante»/«Serviços».
- Assinaturas: preservado o carregamento seguro de PNG, JPEG e WebP, imagens vinculadas ao profissional com credenciais verificadas.
- Chat/MedLink: mantidas as mensagens cronológicas, chamadas internas, pedidos de consulta/exame a instituições parceiras e histórico auditado. Chamadas de voz/vídeo entre instituições ainda requerem uma implementação própria; mensagens entre empresas não são SMS de operadora.
- Numeração curta: preservados os números de processo/pedido/amostra por instituição sem alterar as chaves técnicas da base.

## Uma porta no ambiente de desenvolvimento

O `pnpm dev` deixa de abrir dois processos HTTP (API 3001 + Vite 3000): passa a levantar um **único servidor HTTP na porta 3000**, com a API Express em `/api`, frontend Vite em `/` e hot reload na mesma porta. O arranque verifica `DATABASE_URL`, `SESSION_SECRET` e se a porta 3000 está livre.

```bash
pnpm run install:app
pnpm db:status
pnpm db:migrate
pnpm test
pnpm build
pnpm dev
```

Abra `http://localhost:3000`; a API pode ser conferida em `http://localhost:3000/api/healthz`. Para uso em Codespaces/Replit, exponha **apenas a porta 3000** e pare os processos anteriores. `NV_DEV_PORT` existe apenas para diagnósticos isolados; `API_PORT` e `WEB_PORT` não são necessários.

`pnpm start` em produção continua a servir interface compilada e API no mesmo servidor Node. **Netlify é diferente**: a interface é estática e usa o serviço API externo HTTPS configurado em `NV_NETLIFY_API_ORIGIN`; não pode tornar a API num processo da própria Netlify apenas mudando a porta local.

## Atualizar uma instalação existente

O ZIP fornece uma pasta `NV-DIGITAL/` integral e o instalador `actualizar.py` fora dela. No Codespaces, **não extraia a pasta de código directamente por cima da instalação activa**. Utilize uma branch de teste e faça primeiro uma simulação:

```bash
unzip -nq NV-DIGITAL_Completo_Unificado_Porta_3000_20261105.zip -d /tmp/nv-unificado-20261105
python3 /tmp/nv-unificado-20261105/actualizar.py . --check
python3 /tmp/nv-unificado-20261105/actualizar.py .
```

Os caminhos existentes que tenham alterações locais não reconhecidas bloqueiam toda a operação. Isto é intencional: reveja e concilie esses ficheiros na branch em vez de forçar a sobrescrita. O instalador guarda uma cópia dos ficheiros modificados; não modifica os dados Neon. Os scripts SQL versionados devem ser ensaiados numa branch de teste da base e só depois aplicados na base correcta pelo processo habitual de migração.

## Validação de produção

Os testes automatizados não homologam a AGT. A emissão efectiva depende das configurações e validações fiscais, certificados e endpoints oficiais. Antes de submeter, teste emissão, notas de crédito, sequências, QR, SAF-T (Python `lxml` disponível no servidor) e homologação com dados de ensaio. Uma migração bem-sucedida ou um build correcto **não significa** certificação fiscal.
