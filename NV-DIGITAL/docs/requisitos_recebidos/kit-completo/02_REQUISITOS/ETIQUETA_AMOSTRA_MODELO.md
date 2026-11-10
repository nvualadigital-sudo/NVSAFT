# Modelo textual de etiqueta de amostra — referência para protótipo

> Modelo ilustrativo; o formato final deve ser validado com o laboratório, a biossegurança, o equipamento e a política de identificação de pacientes.

**INSTITUIÇÃO / UNIDADE:** [Hospital Julius Nyerere ou CETEP]  
**PACIENTE:** [Nome completo]  
**ID CLÍNICO:** [Identificador único]  
**PEDIDO / ACESSO:** [Número único do pedido]  
**AMOSTRA:** [Identificador único do recipiente]  
**TIPO / ORIGEM:** [Ex.: sangue venoso, exsudado de ferida]  
**COLHEITA:** [AAAA-MM-DD HH:MM]  
**CÓDIGO DE BARRAS:** [representação gerada pelo sistema, sem codificar dados excessivos]

## Regras

- Imprimir uma etiqueta para cada recipiente físico.
- Para alíquotas, gerar identificadores distintos ligados à amostra de origem.
- O sistema deve escolher o modelo por recipiente, setor e impressora configurada.
- A etiqueta deve permanecer legível durante transporte, refrigeração e processamento.
- Não usar este modelo textual como etiqueta operacional até ser testado com impressora e leitor reais.
