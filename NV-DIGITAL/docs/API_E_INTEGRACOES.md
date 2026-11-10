# API e integrações

Base /api. Todos os endpoints seguintes exigem Bearer token institucional, com as condições de MATRIZ_DE_PERMISSOES.md.

| Grupo | Endpoints principais |
|---|---|
| Instituição | GET/PUT /hospital/institution |
| Acessos | GET /hospital/access; POST /hospital/access/grants; POST /hospital/access/grants/:id/revoke; POST /hospital/access/sessions/:id/revoke |
| Profissionais | PUT /hospital/professionals/:id com revision |
| Auditoria | GET /hospital/audit?after=; GET /hospital/audit/verify |
| Catálogo | GET/POST /hospital/lab/catalog; POST /hospital/lab/catalog/:id/approve |
| Pedidos | GET/POST /hospital/lab/orders; GET /hospital/lab/orders/:id; POST /hospital/lab/orders/:id/cancel |
| Leitura e etapas | GET /hospital/lab/scan/:code; POST /hospital/lab/containers/:id/action com revision e requestId |
| Resultados | POST /hospital/lab/tests/:id/values; POST /hospital/lab/values/:id/validate; POST /hospital/lab/values/:id/communication |
| Qualidade | GET/POST /hospital/lab/quality; GET /hospital/lab/indicators |
| Serviços | GET /hospital/services/:kind; PUT /hospital/services/:kind/:id com revision; GET .../:id/history |
| Painel | GET /hospital/overview?days=7/30/90; GET /hospital/notifications |
| Chat | GET /hospital/chat?peer=&q=&page=; POST /hospital/chat/send; POST /hospital/chat/read; GET /hospital/chat/attachments/:id |
| Exportação | POST /hospital/result-export/:id |
| IA opcional | GET /ai/status; POST /ai/assistente com aprovação explícita de envio externo |

Pedidos, mensagens e etapas de amostras têm identificador de reenvio; revisões/versões impedem sobrescrita silenciosa entre postos. Há paginação de pedidos, chat, serviços e auditoria. Os documentos clínicos legados continuam a ser carregados por instituição e devem ser normalizados/paginados numa evolução de escala.

## Integrações externas

Não foram ligados analisadores, HL7/FHIR de terceiros, PACS/RIS/DICOM, sistema oficial de notificação epidemiológica, SMS/email/WhatsApp, banco/TPA ou AGT. O código opaco pode ser lido por leitores que funcionem como teclado; formato, resistência da etiqueta e hardware precisam de ensaio. A etiqueta QR usa apenas o identificador técnico do recipiente.

O portal de parceiros e os pedidos legados são preservados; não se inferem ligações de identidade apenas pelo nome. A passagem desses pedidos ao circuito novo exige conferência do cadastro, catálogo e associação explícita ao resultado validado. Não existe certificação de interoperabilidade universal.

O assistente opcional chama o fornecedor configurado apenas depois da activação institucional e da confirmação do utilizador. Não consulta automaticamente o banco, não tem ferramentas de execução e não altera registos. Voz depende das APIs e permissões do navegador.
