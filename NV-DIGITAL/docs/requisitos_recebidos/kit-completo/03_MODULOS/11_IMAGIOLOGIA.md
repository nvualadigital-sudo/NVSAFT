# Imagiologia

> Requisitos a comparar com o código real. Este documento não afirma que o módulo já está implementado.

## Requisitos funcionais
- Pedidos, agenda, preparação, execução, relatório e entrega segura.
- Modalidades configuráveis conforme serviços reais.
- Avaliar integração DICOM/PACS/RIS apenas quando suportada pela infraestrutura.

## Requisitos transversais
- Validar permissões no servidor e aplicar menor privilégio.
- Tratar erros sem revelar segredos nem dados clínicos desnecessários.
- Registar alterações sensíveis com autoria, data/hora e motivo quando aplicável.
- Criar testes de unidade, integração e percurso conforme a stack existente.
- Documentar o estado real: existente, parcial, ausente, duplicado ou não utilizado comprovado.
- Não usar dados fictícios para simular operação real.
