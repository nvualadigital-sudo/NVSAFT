# Laboratório — um módulo com setores configuráveis

> Requisitos a comparar com o código real. Este documento não afirma que o módulo já está implementado.

## Requisitos funcionais
- Setores: hematologia, bioquímica clínica, microbiologia, parasitologia, imunologia, serologia, hemoterapia/medicina transfusional, urinálise/líquidos biológicos, micologia, virologia, biologia molecular/PCR, toxicologia, coagulação/hemostase, anatomia patológica/citologia quando existente, colheitas/amostras e qualidade/reagentes/equipamentos.
- Pedido, identificação e rastreio de amostra, colheita, receção, rejeição justificada, processamento, validação e resultado.
- Intervalos de referência, unidades e alertas configurados e aprovados pelos responsáveis do laboratório.
- Lotes/validade de reagentes, calibração, manutenção e controlo de qualidade.
- Resultados críticos com comunicação segura, destinatário, hora e confirmação.
- Preservar versões e motivo de correções; não falsificar integração ou resultados.

## Requisitos transversais
- Validar permissões no servidor e aplicar menor privilégio.
- Tratar erros sem revelar segredos nem dados clínicos desnecessários.
- Registar alterações sensíveis com autoria, data/hora e motivo quando aplicável.
- Criar testes de unidade, integração e percurso conforme a stack existente.
- Documentar o estado real: existente, parcial, ausente, duplicado ou não utilizado comprovado.
- Não usar dados fictícios para simular operação real.
