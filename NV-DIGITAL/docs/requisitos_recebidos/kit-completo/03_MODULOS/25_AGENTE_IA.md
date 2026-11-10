# Agente IA — voz, escrita e fala

> Requisitos a comparar com o código real. Este documento não afirma que o módulo já está implementado.

## Requisitos funcionais
- Três modos: voz/escuta, escrita e fala/síntese de voz.
- Pedir permissão para microfone, mostrar estado ativo e permitir parar.
- Rever/corrigir transcrição antes de guardar ou executar comandos.
- Acesso igual ao do utilizador autenticado; não contornar permissões.
- Não diagnosticar, prescrever, validar resultados, autorizar transfusão, dar alta ou executar ações sensíveis autonomamente.
- Sem integração real, declarar ausente/parcial; nunca simular sucesso.

## Requisitos transversais
- Validar permissões no servidor e aplicar menor privilégio.
- Tratar erros sem revelar segredos nem dados clínicos desnecessários.
- Registar alterações sensíveis com autoria, data/hora e motivo quando aplicável.
- Criar testes de unidade, integração e percurso conforme a stack existente.
- Documentar o estado real: existente, parcial, ausente, duplicado ou não utilizado comprovado.
- Não usar dados fictícios para simular operação real.
