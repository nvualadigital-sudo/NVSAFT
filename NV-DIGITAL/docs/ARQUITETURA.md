# Arquitectura implementada

A aplicação mantém Node 24/pnpm, React/Vite/Tailwind, Express e PostgreSQL com pg/Drizzle. As páginas residem em artifacts/lab-results/src/pages. Não foi criado um segundo software de farmácia ou uma aplicação paralela.

## Responsabilidades

- store/AppContext: cadastro, resultados publicados e finanças. A actualização periódica não desmonta formulários já abertos.
- store/hospital: estado institucional com controlo de revisão, sem falsa gravação offline.
- components/hospital: apresentação comum, cabeçalho, temas e assistente.
- routes/hospital: clínica, enfermagem, biblioteca, MEDLIK, farmácia e registos já existentes.
- routes/lab-workflow: catálogo versionado, pedidos, recipientes, eventos, CQ, versões/validação e comunicação crítica.
- routes/institution: serviços activados, profissionais, competências, sessões, auditoria, percursos especializados e indicadores.
- routes/chat-tools: envio atómico com anexo privado e comprovativo de visualização.
- routes/chat-live, chat-calls e chat-social: mensagens/grupos/preferências, sinalização WebRTC e estados/canais/comunidades. ChatCallService fica no Shell, fora da navegação da página de chat.
- routes/notifications e store/notificationFeed: feed institucional por função e sessão, leitura por utilizador e avisos de novas versões libertadas, sem conteúdo clínico.
- routes/library: biblioteca institucional, pastas/etiquetas/favoritos, cópia/movimento, lixeira e quotas.
- routes/lab-reports: rascunhos/correcções manuais com versões e libertação independente; catálogo técnico e rastreabilidade mantidos em lab-workflow.
- lib/governance: erros de domínio, validação, transacções por instituição e cadeia de auditoria.
- lib/api-zod/src/hospital-domain: contrato partilhado dos serviços e campos; evita duplicar nomes/regras básicas na interface e API.

A sessão determina empresa_id. O corpo de um pedido não concede acesso a outra instituição. O MEDLIK é uma partilha explícita e revogável de conteúdo escolhido. Um perfil Julius Nyerere/CETEP não cria uma instituição nem abre acesso às outras.

## Persistência e concorrência

Cadastro, finanças, farmácia e novos dados laboratoriais usam PostgreSQL. Estado clínico/enfermagem legado continua em documentos JSON com revisão optimista e protecção de registos concluídos; a normalização integral desses documentos é uma evolução ainda pendente. Os novos fluxos laboratoriais e de serviços usam tabelas próprias. As transacções novas obtêm bloqueio por instituição para preservar numeração, versão e cadeia de auditoria.

O banco tem relações compostas para referências institucionais. Há também validações na API; não se afirma que o simples uso de empresa_id ou ocultação de menus seja uma implementação de RLS. Os acessos directos ao banco devem ser restritos por funções de infraestrutura.

## Organização médica e laboratório

Médicos usam um único Atendimento Clínico. A especialidade é seleccionada internamente a partir da configuração institucional. Os antigos wrappers de especialidade foram conservados como compatibilidade, sem entradas duplicadas no menu.

Laboratório é uma área única. Sectores só podem aprovar catálogos depois de activados. Cada versão conserva requisitos de colheita e valores configurados/aprovados localmente; não foram inventados intervalos clínicos. O pedido guarda a identificação do paciente à criação e o catálogo usado. Uma alíquota tem recipiente próprio e a mesma amostra; uma nova colheita tem nova amostra, mantendo o histórico da rejeição.

A impressão é um pedido auditado. A confirmação da etiqueta exige leitura do código e identificação. O navegador não prova que a impressora física funcionou. Não se usa uma notificação como prova de recepção de resultado crítico.
