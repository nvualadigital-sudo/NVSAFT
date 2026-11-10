# Farmácia

> Requisitos a comparar com o código real. Este documento não afirma que o módulo já está implementado.

## Requisitos funcionais
- Catálogo, lote, validade, entradas, saídas, dispensa, devolução e recolha.
- Ligação segura à prescrição e administração quando disponível.
- Controlos especiais conforme legislação confirmada e política institucional.

## Requisitos transversais
- Validar permissões no servidor e aplicar menor privilégio.
- Tratar erros sem revelar segredos nem dados clínicos desnecessários.
- Registar alterações sensíveis com autoria, data/hora e motivo quando aplicável.
- Criar testes de unidade, integração e percurso conforme a stack existente.
- Documentar o estado real: existente, parcial, ausente, duplicado ou não utilizado comprovado.
- Não usar dados fictícios para simular operação real.
