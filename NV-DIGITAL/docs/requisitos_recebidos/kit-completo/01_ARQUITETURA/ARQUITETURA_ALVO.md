# Arquitetura-alvo do NV.Digital

## Princípios
1. A arquitetura real do repositório tem prioridade sobre esta proposta.
2. Não migrar stack por preferência estética.
3. Separar interface, domínio, persistência e integrações conforme o framework existente.
4. Definir fronteiras de módulos e serviços partilhados; evitar duplicar cadastro, permissões, notificações e auditoria.
5. Autorização no servidor e trilho de auditoria para operações sensíveis.
6. Migrações versionadas e plano de recuperação.
7. Módulos opcionais só são ativados se forem utilizados pela instituição.
8. Sem dados fictícios em ambientes que se apresentem como produção.

## Árvore lógica sugerida
```text
NV.Digital/
├── docs/
├── frontend-or-ui/          # nomear segundo a stack existente
├── backend-or-api/          # se separado no projeto real
├── shared/                  # apenas se a stack suportar código partilhado
├── database/
│   ├── migrations/
│   └── schema/
├── integrations/
├── tests/
└── configuration/
```
Esta árvore é conceptual. Não criar pastas vazias nem mover ficheiros sem necessidade.

## Entidades e relações de domínio a mapear
- Pessoa/Paciente e identificador institucional.
- Profissional, credenciais profissionais, vínculo, unidade e especialidade.
- Conta de utilizador, função, permissão e sessão.
- Episódio de atendimento, consulta, nota clínica, diagnóstico e procedimento.
- Pedido de exame, amostra, análise, resultado e versão/validação.
- Prescrição, dispensa, lote e movimento de stock.
- Leito, internamento e movimentação.
- Fatura, linha, pagamento, caixa e aprovação.
- Notificação, conversa, mensagem e anexo.
- Evento de auditoria e registo de consentimento quando aplicável.

## Integração
Mapear contratos e autenticação de cada integração existente. Não inventar endpoints nem presumir acesso a PACS, DICOM, SMS, email, pagamentos, dispositivos ou serviços de IA. Implementar adaptadores isolados e testes de contrato quando aplicável.
