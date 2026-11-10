# Histórico — revisão de 27/10/2026

- Lidos os dois kits complementares; preservados os textos e registada comparação e estado por módulo.
- Mantida a stack e o projecto real. Atendimento clínico único no menu; especialidade seleccionada internamente.
- Adicionadas 16 tabelas para configuração, credenciais, competências, auditoria, laboratório, serviços e anexos de chat.
- Implementado o circuito laboratorial com snapshot institucional, catálogo aprovado, recipientes, alíquotas, colheita, etiquetas QR, leitura, recepção, rejeição, recolheita, CQ, versões, dupla validação, críticos e destino/retensão.
- Adicionados registos institucionais activáveis: queimados, vigilância/isolamento, cirurgia, maternidade, equipamentos, esterilização, transporte, dietas, reabilitação, hiperbárica e escalas.
- Adicionados perfis profissionais, credenciais, delegação expirada/revogável, sessões e verificação de auditoria. Suspensão revoga acessos. Reforçadas leituras administrativas e retirados hashes de palavras-passe das respostas de sucursais.
- Novo Dashboard com indicadores do servidor, filtros, gráficos, agenda, leitos e alertas; sete temas e cabeçalho responsivo. Não foram usados os números da imagem como dados reais.
- Chat com pesquisa/paginação, anexos privados e visto. Assistente comum separado, opcional, sem execução de operações e com confirmação de processamento externo/voz.
- Removida a simulação de extracção de documentos na facturação. JSON/CSV/QR são lidos e validados; formatos não reconhecidos dão erro. A versão anterior está em docs/legado/faturacao-antes-da-leitura-real.zip e não é executada.
- Configuração da facturação passa a aguardar o servidor; exportação financeira é auditada e não é apresentada como backup completo. Resumos financeiros excluem recibos/proformas/rascunhos e mantêm notas de crédito; datas cruzam meses/anos correctamente.
- Agenda valida conflitos no servidor, não permite apagar histórico e exige motivo de cancelamento. Atualização periódica não desmonta formulários abertos.
- Removidos do menu o modelo informativo de enfermagem e os placeholders hospitalar/escolar; conservados ficheiros de compatibilidade/documentação sem criar módulos de fachada.
- Migrações versionadas com bootstrap de instalação vazia e ledger de hashes; backup cifrado e restauro isolado sem apagamento automático de produção.

Não foram apagados dados nem inventadas associações dos dois registos órfãos anteriores. Não houve publicação no Replit nem certificação MINSA/AGT. Os limites e critérios de aceitação estão expressos nos documentos de verificação.
