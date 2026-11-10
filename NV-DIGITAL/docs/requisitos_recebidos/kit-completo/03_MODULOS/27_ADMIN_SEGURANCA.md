# Administração, utilizadores, funções e segurança

> Requisitos a comparar com o código real. Este documento não afirma que o módulo já está implementado.

## Requisitos funcionais
- Contas individuais, funções, permissões por módulo/ação/unidade/contexto.
- Conceder, revogar, expirar, suspender e reativar acessos com auditoria.
- Administrador técnico sem acesso clínico automático.
- Autenticação reforçada e segregação de funções para ações sensíveis.
- Auditoria de acesso e alteração; sessões e tentativas de acesso.
- Verificação de autorização no servidor em todas as operações.

## Requisitos transversais
- Validar permissões no servidor e aplicar menor privilégio.
- Tratar erros sem revelar segredos nem dados clínicos desnecessários.
- Registar alterações sensíveis com autoria, data/hora e motivo quando aplicável.
- Criar testes de unidade, integração e percurso conforme a stack existente.
- Documentar o estado real: existente, parcial, ausente, duplicado ou não utilizado comprovado.
- Não usar dados fictícios para simular operação real.
