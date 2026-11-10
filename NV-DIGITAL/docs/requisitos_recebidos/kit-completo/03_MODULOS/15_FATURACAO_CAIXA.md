# Faturação e caixa

> Requisitos a comparar com o código real. Este documento não afirma que o módulo já está implementado.

## Requisitos funcionais
- Tabela de preços configurável, atos, faturas, recibos, pagamentos, descontos, reembolsos e fecho.
- Moeda e regras contabilísticas confirmadas; Kz quando aplicável.
- Segregação de funções, reconciliação, aprovações e auditoria.
- Não mostrar transação como concluída sem persistência confirmada.

## Requisitos transversais
- Validar permissões no servidor e aplicar menor privilégio.
- Tratar erros sem revelar segredos nem dados clínicos desnecessários.
- Registar alterações sensíveis com autoria, data/hora e motivo quando aplicável.
- Criar testes de unidade, integração e percurso conforme a stack existente.
- Documentar o estado real: existente, parcial, ausente, duplicado ou não utilizado comprovado.
- Não usar dados fictícios para simular operação real.
