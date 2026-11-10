# Pacientes e arquivo clínico

> Requisitos a comparar com o código real. Este documento não afirma que o módulo já está implementado.

## Requisitos funcionais
- Identificação única, deteção de duplicados e fluxo auditado de fusão.
- Histórico longitudinal, alergias, antecedentes, notas, documentos e resultados.
- Acesso contextual e registo de consultas sensíveis.
- Registos assinados preservam histórico e só mudam por retificação/adenda.

## Requisitos transversais
- Validar permissões no servidor e aplicar menor privilégio.
- Tratar erros sem revelar segredos nem dados clínicos desnecessários.
- Registar alterações sensíveis com autoria, data/hora e motivo quando aplicável.
- Criar testes de unidade, integração e percurso conforme a stack existente.
- Documentar o estado real: existente, parcial, ausente, duplicado ou não utilizado comprovado.
- Não usar dados fictícios para simular operação real.
