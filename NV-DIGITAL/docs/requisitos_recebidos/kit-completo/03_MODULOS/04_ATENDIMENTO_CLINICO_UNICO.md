# Atendimento clínico — módulo único para todos os médicos

> Requisitos a comparar com o código real. Este documento não afirma que o módulo já está implementado.

## Requisitos funcionais
- Um único módulo para médicos de todas as categorias e especialidades.
- Especialidade e contexto selecionados dentro do módulo, por configuração e credencial.
- Consulta, anamnese, sinais vitais, exame, diagnóstico, plano, pedidos, prescrição, procedimentos, evolução e alta/encaminhamento conforme autorização.
- Assinatura e retificação auditadas; sem apagar silenciosamente registos assinados.
- Não inventar protocolos nem dar acesso por cargo sem validar credenciais.

## Requisitos transversais
- Validar permissões no servidor e aplicar menor privilégio.
- Tratar erros sem revelar segredos nem dados clínicos desnecessários.
- Registar alterações sensíveis com autoria, data/hora e motivo quando aplicável.
- Criar testes de unidade, integração e percurso conforme a stack existente.
- Documentar o estado real: existente, parcial, ausente, duplicado ou não utilizado comprovado.
- Não usar dados fictícios para simular operação real.
