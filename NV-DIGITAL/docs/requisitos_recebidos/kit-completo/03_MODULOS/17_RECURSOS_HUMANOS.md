# Recursos humanos e profissionais

> Requisitos a comparar com o código real. Este documento não afirma que o módulo já está implementado.

## Requisitos funcionais
- Cadastro de profissionais, categoria, especialidade, credencial, unidade, departamento, vínculo, situação e escalas.
- Conta de autenticação separada do cadastro profissional e ligada por identificador estável.
- Suspensão/desligamento deve acionar revisão e revogação de acessos.
- Dados pessoais visíveis apenas a funções autorizadas.

## Requisitos transversais
- Validar permissões no servidor e aplicar menor privilégio.
- Tratar erros sem revelar segredos nem dados clínicos desnecessários.
- Registar alterações sensíveis com autoria, data/hora e motivo quando aplicável.
- Criar testes de unidade, integração e percurso conforme a stack existente.
- Documentar o estado real: existente, parcial, ausente, duplicado ou não utilizado comprovado.
- Não usar dados fictícios para simular operação real.
