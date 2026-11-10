# Banco de sangue

> Requisitos a comparar com o código real. Este documento não afirma que o módulo já está implementado.

## Requisitos funcionais
- Pode integrar o setor de hemoterapia do laboratório para evitar duplicação.
- Dadores, colheitas, testes, componentes, compatibilidade, reservas, transfusões e rastreabilidade conforme serviço existente.
- Ações restritas a profissionais qualificados e processos aprovados.

## Requisitos transversais
- Validar permissões no servidor e aplicar menor privilégio.
- Tratar erros sem revelar segredos nem dados clínicos desnecessários.
- Registar alterações sensíveis com autoria, data/hora e motivo quando aplicável.
- Criar testes de unidade, integração e percurso conforme a stack existente.
- Documentar o estado real: existente, parcial, ausente, duplicado ou não utilizado comprovado.
- Não usar dados fictícios para simular operação real.
