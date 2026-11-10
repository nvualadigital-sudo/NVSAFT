## 05/11/2026 — 2026.11.05-netlify.10 — NV-ASSISTENTE

- Adicionado um único painel de assistência com esfera luminosa, identidade da instituição activa, conversação em texto, síntese de voz e reconhecimento de voz dependente do navegador e do consentimento.
- Activação «Olá NV» apenas durante escuta explicitamente iniciada; fechar ou parar termina a captação de áudio.
- Navegação local com verificação das páginas autorizadas; mensagem à equipa preparada na API e executada uma única vez após confirmação explícita, isolada por empresa/utilizador e auditada.
- Migração `20261105_nv_assistente_actions.sql`, testes de confirmação/expiração/isolamento, suporte opcional ao Neon AI Gateway ou OpenAI.
- Sem acesso autónomo a pacientes ou actos clínicos/fiscais; não inclui uma sessão de áudio Realtime dedicada. `pnpm dev` mantém exclusivamente a porta 3000.
- Preservados Chat, MedLink, AGT/facturação e todas as funcionalidades da edição completa `.9`. Neon/Netlify de produção não foram alteradas por esta entrega.

## 2026-11-05 — Chat institucional e MedLink (.8)

- Chat: ordem cronológica de mensagens, nome da instituição activa no título/notificações e apresentação visual mais leve; chamadas internas WebRTC preservadas.
- MedLink: novo fluxo de pedidos de exames e consultas com destino individual, estados de acompanhamento e mensagens entre as duas instituições autorizadas.
- Mensagens e alteração de estados protegidas por autenticação, validação da empresa de origem/destino, restrições de papel e auditoria. Nova migração SQL de pedidos/mensagens.
- Mantidas todas as correcções anteriores (Laboratório, AGT/facturação, Farmácia/POS, recursos humanos, assinaturas e IDs curtos).
- **Não incluído:** chamadas WebRTC entre instituições, SMS por operadora ou integração automática na agenda/LIS do parceiro. Não executadas alterações na Neon ou serviços publicados.

## 2026-10-28 — Integração dos ficheiros actuais e facturação nativa

- Conservados a entrada BillingModule, Escalas/Salários, os scripts e as integrações recebidas nos cinco ficheiros actuais.
- Correcções clínicas integradas sem substituir App.tsx, Login, temas, chat ou credenciais.
- Seguros associados ao motor nativo: cálculo por linha, cobertura conservada, caixa aberto, recibos parciais por pagador e notas de crédito por acto.
- Facturas emitidas imutáveis; saldos derivados do diário. Separação explícita entre arquivo real e ensaios, incluindo extractos e exportações.
- Fechada a rota de recebimentos antiga e bloqueado movimento manual que lançaria um ensaio na contabilidade real.
- Instalador revisto para a versão actual de Facturação Integrada e Escalas/Salários, com cópia e integração de alterações compatíveis.

## 2026-10-28 — Profissionais, documentos, seguradoras e endereços

- Separação entre conta de acesso, categoria, especialidades, cédula e cargo; cadastro de clínico geral e restantes categorias profissionais.
- Assinaturas/carimbos por profissional, verificação independente, emissão médica/enfermagem com autor e cabeçalho conservados e desactivação sem apagar histórico.
- Contratos e preços por acto, cobertura conservada, responsabilidade por pagador, recebimentos parciais com recibo e caixa idempotente, glosas e notas de crédito.
- Extractos por seguradora e paciente, incluindo facturas particulares; produção filtrada e exportação XLSX/CSV/PDF com modelos por seguradora.
- Divisão administrativa de Angola da Lei 14/24; países, residência e naturalidade separados, complementos locais com revisão e moradas antigas conservadas.
- Actualização incremental com comparação de três versões e cópias antes de escrever; migrações novas sem modificar as anteriores.

# Alterações

Ver docs/HISTORICO_DE_ALTERACOES.md.
## 2026-11-05 — Edição consolidada e auditada (.4)

- Reunidos os avanços de Medicina Dentária/Estomatologia, fila de triagem de Enfermagem, resumo clínico médico, contexto das prescrições e controlo de correspondência de medicamentos com as correcções anteriores do Laboratório, Finanças, Farmácia/POS, passes e assinaturas.
- Recuperada a possibilidade de Histórico/PDF provisório para profissionais durante a revisão, sem antecipar publicação ao paciente.
- Preservados os modelos de passes, a conta corrente corrigida, a folha única de remunerações e as assinaturas clínicas por função.
- Adicionado teste de dispensa que rejeita medicamento divergente, além dos cenários clínicos/odontológicos.
- Relatório técnico: `docs/AUDITORIA_CONSOLIDADA_20261105.md`.

# 05/11/2026 — 2026.11.05-netlify.9

- Consolidação das edições paralelas Facturação Rápida/Resultados e Chat/MedLink, preservando os sectores correctos do POS, numeração curta e assinaturas PNG/JPEG/WebP.
- Desenvolvimento com Express API + Vite/HMR na **mesma porta 3000** (`pnpm dev`), sem servidor HTTP na 3001.
- Fluxo de verificação dos profissionais e nomeação de técnicos substitutos, incluindo privilégio excepcional controlado `lab.validate.solo`, e autorização especial para resultados críticos.
- PDF de resultado definitivo identifica o utilizador que autorizou a libertação; documentos provisórios mantêm indicação de revisão.
- Melhoria das consultas da facturação e do estado no frontend, mantendo compatibilidade com a base e migrações anteriores.
- Guia de instalação e compatibilidade entre versões e declaração expressa do que não foi publicado na Neon/Netlify nem homologado na AGT.

