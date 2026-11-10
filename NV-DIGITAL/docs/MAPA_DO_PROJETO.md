# Inventário antes da revisão dos kits

A base é o projecto NVUALASOFT integrado entregue nesta conversa. O ZIP anterior é o ponto de restauro. Stack verificada nos manifests: Node 24, pnpm, TypeScript, React/Vite/Tailwind, Express, pg/Drizzle e JWT com sessões revogáveis. Testes: node:test + Supertest + PGlite. Não foi criada outra aplicação.

`artifacts/lab-results/src/pages` contém as áreas de recepção, laboratório, médicos, enfermagem, farmácia, finanças, administração e comunicação. `store/AppContext` carrega o cadastro e faturação central; `store/hospital` sincroniza documentos com revisão. `artifacts/api-server/src/routes` contém as operações autenticadas. `lib/db` é a ligação PostgreSQL e o schema legado; `migrations` contém alterações SQL versionadas.

Lacunas constatadas: rastreabilidade física não modelada, catálogo sem aprovação/vigência, resultados legados sem dupla validação, leituras clínicas demasiado abrangentes para algumas funções, menu médico redundante, serviços especializados ainda sem registo estruturado. A ausência de equipamento, ofício MINSA, especificações de analisadores e protocolos aprovados impede afirmar homologação institucional.

Ordem: autorização e auditoria; entidades laboratoriais e transações; interface de trabalho e etiquetas; serviços institucionais; organização visual; testes e matriz final. Preservar o cadastro, sessões, farmácia, faturação, biblioteca, chat e MEDLIK existentes.
