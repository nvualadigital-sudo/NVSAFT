# NV.Digital / NVUALASOFT — projecto completo consolidado

**Actualização 05/11/2026 — `2026.11.05-netlify.10` (NV-ASSISTENTE):** interface de esfera luminosa, conversa por texto, reconhecimento e leitura de voz pelo navegador mediante consentimento, comando «Olá NV» em sessão explícita, navegação por módulos autorizados e confirmação transaccional para enviar uma mensagem à equipa. Conversação aberta opcional via OpenAI ou Neon AI Gateway, sem dados clínicos identificáveis e sem autonomia para actos médicos/fiscais. Mantém a versão completa `.9`, Chat, MedLink e **uma só porta 3000 no `pnpm dev`**. Leia primeiro [a documentação específica](docs/NV_ASSISTENTE_IMPLEMENTADO_20261105.md). A versão não executa migrações remotas nem publica automaticamente a API/Netlify.

**Actualização 05/11/2026 — `2026.11.05-netlify.9` (pacote completo, porta única 3000):** consolida a edição Chat/MedLink `.8` com as melhorias de facturação rápida e validação laboratorial, sem regressar aos sectores antigos do POS. **`pnpm dev` usa apenas `http://localhost:3000` para a interface, API `/api` e actualização automática**, sem API na 3001. Mantém a migração MedLink, a edição histórica e as permissões excepcionais controladas. O instalador protege ficheiros que tenham sido alterados localmente. Leia [docs/PORTA_3000_CONSOLIDACAO_20261105.md](docs/PORTA_3000_CONSOLIDACAO_20261105.md) antes de actualizar.

**Actualização 05/11/2026 — `2026.11.05-netlify.8`:** Chat com identificação dinâmica da instituição, mensagens em ordem cronológica e interface/apresentação de chamadas modernizadas. O **MedLink** foi ampliado com pedidos de exames e consultas a parceiros, estados e mensagens institucionais auditadas com isolamento entre empresas. Exige a nova migração SQL `20261105_medlink_pedidos_mensagens.sql`. O áudio/vídeo entre empresas e a abertura automática de agenda/pedido no parceiro **ainda não estão disponíveis**; as chamadas internas existentes foram preservadas. Consulte [docs/MEDLINK_CHAT_20261105.md](docs/MEDLINK_CHAT_20261105.md) e [docs/ACTUALIZAR_NETLIFY.md](docs/ACTUALIZAR_NETLIFY.md).

**Actualização 05/11/2026 — `2026.11.05-netlify.7`:** conserva as correcções anteriores de facturação/AGT, laboratório, assinaturas PNG/JPG/WebP, IDs de apresentação e nomeação excepcional de substituto autorizado; corrige agora o catálogo do POS com **Comércio (EXAMES-LAB)** e **Farmácia**, categorias dinâmicas dos produtos da empresa e mensagens sobre falta de receitas/lotes da Farmácia. Consulte [docs/POS_CATALOGO_FARMACIA_20261105.md](docs/POS_CATALOGO_FARMACIA_20261105.md), [docs/NOMEACAO_TECNICO_SUBSTITUTO_20261105.md](docs/NOMEACAO_TECNICO_SUBSTITUTO_20261105.md), [docs/CORRECOES_ASSINATURAS_IDS_20261105.md](docs/CORRECOES_ASSINATURAS_IDS_20261105.md) e [docs/ACTUALIZAR_NETLIFY.md](docs/ACTUALIZAR_NETLIFY.md). Não utilize ZIPs antigos sobre esta revisão.

**Aviso para quem actualiza:** as instruções históricas mais abaixo referem versões anteriores. Para esta edição, use o instalador `actualizar.py` da raiz do ZIP e os passos de `LEIA_PRIMEIRO.md` (fora da pasta `NV-DIGITAL`).

Entrega de 28/10/2026. Este ZIP contém a aplicação completa: interface, API, bibliotecas partilhadas, migrações, testes e configurações. As actualizações do laboratório, biblioteca, App.tsx, chat/chamadas/notificações, Facturação Integrada, Escalas/Salários e correcções clínicas já estão integradas. Não é necessário aplicar os ZIP de actualização anteriores.

## Alterações incluídas

| Área | Conteúdo reunido |
|---|---|
| Aplicação | Quatro organizações de menu, sete cores, modo claro/escuro e botões flutuantes de cores, agente e chat; preferências por empresa e conta. |
| Laboratório | Visual dos ficheiros recebidos, cadastro de exames/parâmetros, pesquisa de resultados prontos, edição com motivo e versões, revisão técnica e libertação independentes. Circuito de amostras, qualidade e rastreabilidade conservado. |
| Histórico / biblioteca | Entrega autorizada de resultados; documentos internos por empresa, pastas, pesquisa, grelha/lista/colunas, etiquetas, favoritos pessoais, cópia/movimento, lixeira, recuperação e exportação ZIP. |
| Chat | Conversas de equipa, mensagens directas e grupos, anexos privados, gravação de mensagem de voz no navegador, pesquisa, paginação, respostas, reacções e preferências persistentes. |
| Chamadas | Voz/vídeo WebRTC entre contas da mesma empresa, recepção em qualquer módulo, aceitar/recusar/terminar, microfone, câmara, minimização, chamadas perdidas e sinalização autenticada. |
| Alertas | Toque repetido durante a chamada, teste de 12 segundos, volume e silêncio; sino geral com filtros e leitura por utilizador. Uma nova correcção laboratorial libertada gera um novo aviso não lido. |
| Profissionais / documentos | Ficha profissional separada do acesso, categorias e especialidades, assinatura/carimbo individuais, verificação independente e autoria conservada de documentos médicos/enfermagem. |
| Seguradoras / endereços | Contratos e actos, repartição por pagador ligada à facturação nativa, extractos e XLSX/CSV/PDF; países e catálogo de Angola em cascata. |
| RH | Escala mensal, publicação/reabertura, perfis salariais, cálculo, aprovação independente, recibos e PDF/XLSX de revisões guardadas. |
| Restante aplicação | Recepção, pacientes, médicos/especialidades, enfermagem, farmácia, facturação/finanças, administração, serviços hospitalares e partilha explícita MEDLIK conservados no mesmo projecto. |

As restrições entre instituições são aplicadas na API. A empresa A não recebe os dados da empresa B nas rotas exercitadas pelos testes. O MEDLIK mantém a partilha deliberada com destinatário e fundamento, sem abrir acesso geral a outra empresa.

## Actualizar o Codespaces existente

Esta revisão integra os cinco ficheiros enviados em `NVUALASOFT_Ficheiros_Actuais.zip`. Conserva a página nativa de facturação, o pacote de Escalas/Salários, o Login, `App.tsx` e as credenciais. As correcções clínicas e a ligação das seguradoras à facturação estão descritas em [docs/ATUALIZACAO_CLINICA_20261028.md](docs/ATUALIZACAO_CLINICA_20261028.md). Validação actual: [docs/VALIDACAO_ATUALIZACAO_20261028.md](docs/VALIDACAO_ATUALIZACAO_20261028.md).

Para actualizar o projecto em utilização, use **NVUALASOFT_Atualizacao_Clinica.zip**, não copie ficheiros de `payload` manualmente. A facturação mantém o âmbito de homologação já existente. A emissão/regularização fiscal real continua dependente da activação fiscal; ensaios não entram nos mapas reais. Os cadastros, contratos e documentos clínicos não são dados de demonstração.

```bash
cd /workspaces/NV-DIGITAL &&
node scripts/parar-dev.mjs &&
unzip -oq NVUALASOFT_Atualizacao_Clinica.zip -d atualizacao_clinica_v2 &&
node atualizacao_clinica_v2/NVUALASOFT_Atualizacao_Clinica/instalar.mjs . &&
pnpm run install:app &&
pnpm db:migrate &&
pnpm test &&
pnpm build &&
pnpm dev
```

A extracção actualiza apenas a pasta do instalador. A aplicação só é alterada após a verificação completa e a cópia de segurança. Os `&&` impedem continuar se uma etapa falhar. O instalador não se liga à base de dados; `pnpm db:migrate` é executado no seu ambiente com a ligação actual. Não foi feita uma migração remota nesta entrega.

## Instalar no Replit

Pare primeiro o workflow antigo e os processos `pnpm dev` que estejam a executar. Preserve o projecto e os Secrets existentes. Extraia para uma **pasta nova**; se `entrega_20261028` já existir, escolha outro nome. No Shell:

```bash
cd ~/workspace
unzip -q NVUALASOFT_Integrado.zip -d entrega_20261028
cd ~/workspace/entrega_20261028/NVUALASOFT_Integrado
pnpm run install:app
```

Use Node.js 24 e pnpm 10.26 ou posterior. `install:app` usa o lockfile congelado e instala a aplicação e as ferramentas de validação. O gerador opcional da especificação da API continua no código; a instalação normal não precisa de descarregar `orval`, cujo download foi bloqueado no outro Replit.

Confirme os Secrets `DATABASE_URL`, `SESSION_SECRET` e `ALLOWED_ORIGINS`. Se existir, `DATABASE_URL_UNPOOLED` deve ser a ligação directa **da mesma base**. Os nomes das opções estão em `.env.example`, sem credenciais. Depois, na mesma pasta, execute cada comando e só avance se terminar sem erro:

```bash
pnpm db:migrate
pnpm test
pnpm build
pnpm dev
```

A migração usa a ligação directa, verifica o destino e aplica o que faltar; não restaure dumps antigos por cima da base actual. **Esta entrega não executou as novas migrações no seu Neon nem publicou o código no Replit.**

Para o botão Run do Replit, configure o comando para a pasta em que acabou de instalar:

```bash
cd ~/workspace/entrega_20261028/NVUALASOFT_Integrado && pnpm dev
```

Use apenas uma execução. **A interface e a API partilham a porta 3000.** Se estiver ocupada, pare a execução antiga antes de arrancar a nova. Os detalhes de instalação, contas iniciais e publicação estão em [docs/INSTALACAO_E_EXECUCAO.md](docs/INSTALACAO_E_EXECUCAO.md).

## Localizar os ficheiros

| Ficheiro/pasta | Conteúdo |
|---|---|
| `artifacts/lab-results/src/App.tsx` | Organização geral, navegação, cores, botões flutuantes e serviço global de chamadas. |
| `artifacts/lab-results/src/pages/` | Páginas de todos os módulos. |
| `artifacts/lab-results/src/pages/comunicacao/` | Chat, chamadas, estados, canais/comunidades e MEDLIK. |
| `artifacts/api-server/src/routes/` | API e autorização no servidor, incluindo laboratório, biblioteca, chat e notificações. |
| `migrations/` | Schema base e migrações versionadas, sem alterar os hashes dos SQL recebidos. |
| `tests/` | Testes de API, isolamento, permissões, versões, migração e outros comportamentos. |
| `infra/chat-turn/` | Exemplo de servidor TURN para chamadas entre redes. |
| `docs/CONSOLIDACAO_20261028.md` | Origem dos pacotes, alterações de integração e limites verificados. |
| `docs/VERIFICACAO.md` | Resultados da validação desta entrega. |
| `MANIFESTO_SHA256.txt` | Integridade dos ficheiros incluídos no ZIP. |

## Activar os alertas

Abra a aplicação num separador do navegador, entre novamente e use **Alertas → Activar alertas → Testar toque (12 segundos)**. No sino geral, use **Activar som e notificações**. Permita o som e as notificações quando o navegador pedir.

O toque repete-se enquanto chama e pára quando a chamada é atendida, recusada, cancelada ou expira. A aplicação precisa de continuar aberta. Voz/vídeo requer microfone/câmara autorizados e, nas redes que o exijam, um servidor TURN configurado. O exemplo está incluído; nenhum relay foi provisionado nesta entrega. Confirme som, permissões e chamada entre dois dispositivos no equipamento real.

## Validação e âmbito

Instalação limpa, 125 testes sem falhas, verificações TypeScript e compilação da interface/API concluídos. Foram exercitados os componentes reais do laboratório, biblioteca e Shell num DOM controlado; o Shell inclui a recepção e recusa de chamada nos quatro menus. Esses ensaios não substituem testes audíveis, WebRTC entre equipamentos e aceitação pelos profissionais.

O pacote não inclui credenciais, dumps, dados de pacientes ou `node_modules`. Os documentos históricos e as interfaces recebidas foram preservados em `docs/legado` e `docs/referencias-laboratorio`. O checklist oficial de homologação MINSA não foi fornecido; esta entrega não atribui certificação MINSA/AGT. O âmbito e as limitações dos outros módulos permanecem em [docs/ESTADO_DOS_MODULOS.md](docs/ESTADO_DOS_MODULOS.md).

### Netlify

Para publicar a interface na Netlify com o servidor Node e a base Neon existentes, siga [Actualizar na Netlify](docs/ACTUALIZAR_NETLIFY.md). O guia separa migração, publicação da API e actualização da interface.
