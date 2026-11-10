# NV.Digital — Laboratório, etiquetas e rastreabilidade de amostras

## Objetivo

Definir requisitos para um fluxo laboratorial integrado inspirado em boas práticas de sistemas hospitalares empresariais (incluindo os princípios de fluxo de trabalho e rastreabilidade observados em sistemas como Epic Beaker), sem copiar software, interface proprietária, código ou materiais protegidos. A configuração final deve ser validada pelas equipas clínicas, laboratoriais, de biossegurança e de informática das instituições.

## Regra essencial

**Nenhuma amostra deve ser colhida, transferida, processada ou descartada sem identificação verificável e ligação inequívoca ao paciente e ao pedido.** O código de barras identifica a amostra/pedido; não substitui a verificação de pelo menos dois identificadores do paciente conforme a política clínica aprovada.

## Fluxo ponta a ponta

1. Profissional autorizado abre o processo correto do paciente e confirma dois identificadores.
2. Médico ou profissional autorizado cria o pedido eletrónico: análises, prioridade, diagnóstico/indicação, origem, tipo de amostra e instruções de colheita.
3. O sistema valida requisitos da análise: recipiente, volume, aditivo, temperatura, proteção da luz, prazo e critérios de rejeição, segundo o catálogo laboratorial aprovado.
4. O sistema gera um identificador único de pedido e identificadores únicos para cada recipiente/amostra. Pedidos com vários tubos geram uma etiqueta por recipiente.
5. As etiquetas são impressas no ponto de colheita ou local autorizado, em impressora compatível. A impressão fica registada com utilizador, hora, local e impressora.
6. Antes da colheita, o profissional verifica a identidade do paciente e digitaliza a pulseira/código do paciente, quando disponível. Regista quem colheu, data/hora, local anatómico ou origem, tipo de amostra e eventuais dificuldades.
7. A etiqueta é aplicada imediatamente ao recipiente correto, junto do paciente, nunca previamente em recipientes sem confirmação. A equipa confere os dados legíveis e o código de barras.
8. Na entrega, receção laboratorial digitaliza cada recipiente e regista data/hora, responsável, condição da embalagem e temperatura quando aplicável.
9. Cada setor regista receção, triagem, aceitação/rejeição, processamento, alíquotas, encaminhamento, análise, validação técnica, validação clínica e emissão do resultado.
10. Os resultados são ligados ao processo clínico; valores críticos geram alerta e exigem registo de comunicação ao profissional responsável.
11. A amostra fica com localização e estado rastreáveis até armazenamento, devolução, transferência ou descarte documentado.

## Conteúdo mínimo recomendado da etiqueta

O desenho varia por instituição, tipo de recipiente e impressora. Incluir, quando tecnicamente possível e aprovado:

- Nome completo do paciente, em texto legível;
- Segundo identificador aprovado (por exemplo, número clínico/processo ou data de nascimento, conforme política local);
- Identificador único da amostra/recipiente e/ou número de acesso laboratorial;
- Código de barras 1D ou 2D validado para os leitores disponíveis;
- Tipo de amostra ou código curto, quando o espaço permitir;
- Data/hora da colheita, se exigida pelo procedimento;
- Identificação da instituição/unidade, sem expor dados excessivos;
- Etiqueta adicional para alíquota, com identificador próprio ligado à amostra-mãe.

Não colocar diagnósticos sensíveis ou informação clínica desnecessária na etiqueta. O código deve conter apenas os identificadores técnicos necessários; os detalhes são consultados no sistema com controlo de acesso. Confirmar legibilidade, resistência à humidade/frio e compatibilidade com tubos, frascos, lâminas, sacos e criotubos.

## Etiquetas por cenário

- **Hematologia/bioquímica:** uma etiqueta individual por tubo, associada ao pedido e ao tipo de tubo necessário.
- **Microbiologia:** etiqueta por recipiente; registar local de colheita, material, hora e condições especiais quando aplicável.
- **Hemoculturas:** identificar cada frasco e conjunto; registar local e hora de colheita, sem perder a ligação entre frascos.
- **Anatomia patológica/citologia:** identificar cada frasco, recipiente, lâmina ou bloco; usar número de caso, parte/local anatómico e sequência (A, B, C...) ligados ao pedido cirúrgico.
- **Virologia/PCR:** etiqueta por tubo; rastrear extração, alíquotas e execução analítica sem reutilizar identificadores.
- **Transfusão/hemoterapia:** identificação reforçada à cabeceira, dupla verificação conforme protocolo e rastreabilidade entre paciente, amostra, prova de compatibilidade e unidade de sangue.
- **CETEP/saúde pública:** rastrear origem da amostra, unidade notificadora, evento/caso quando legalmente autorizado, cadeia de transporte e laboratório de referência; limitar acessos a dados epidemiológicos sensíveis.
- **Queimados/feridas:** permitir origem anatómica e local da colheita, tipo de amostra, data/hora e prioridade clínica, sem substituir a descrição no pedido.

## Estados da amostra

Pedido criado → por colher → colhida → etiqueta confirmada → em transporte → recebida → em triagem → aceite ou rejeitada → em processamento → análise em curso → resultado preliminar (se aplicável) → validada → resultado comunicado → armazenada → descartada/arquivada.

Cada transição deve guardar utilizador, data/hora, local e motivo quando necessário. Estados não podem ser alterados silenciosamente; correções devem gerar auditoria.

## Regras de segurança e exceções

- Bloquear ou colocar em quarentena amostras sem etiqueta, com etiqueta ilegível, discrepância de identificadores, recipiente incorreto, volume insuficiente ou condições inadequadas, de acordo com o procedimento validado.
- Não permitir que a reimpressão crie uma nova amostra por engano. Reimpressões devem manter o identificador original e registar motivo, operador e hora.
- A impressão de etiqueta de substituição exige confirmação de dois identificadores e registo de auditoria.
- Proibir a reutilização de códigos de amostra, mesmo após o encerramento do caso.
- Se o leitor falhar, exigir motivo de exceção e dupla verificação manual; não transformar a exceção numa prática habitual.
- Manter plano de contingência para falha de rede/energia/impressora, com formulários controlados e reconciliação posterior.
- Implementar perfis de acesso, autenticação, trilho de auditoria, cópias de segurança, cifragem e políticas de retenção.

## Ecrãs e filas de trabalho necessárias

1. Catálogo de análises e requisitos de colheita.
2. Pedidos pendentes por serviço, prioridade e hora prevista.
3. Lista de colheitas por enfermaria/consulta/urgência/bloco operatório.
4. Confirmação de identidade e leitura da pulseira.
5. Impressão/reimpressão de etiquetas e estado da impressora.
6. Receção laboratorial com leitura de código de barras.
7. Triagem, aceitação/rejeição e motivos padronizados.
8. Alíquotas, recipientes derivados e relação amostra-mãe/filha.
9. Filas por setor laboratorial e equipamento.
10. Resultados, validação, resultados críticos e confirmação de comunicação.
11. Armazenamento, localização física e descarte.
12. Auditoria e relatório de amostras extraviadas, atrasadas, rejeitadas ou sem estado atualizado.

## Equipamentos e integrações a prever

- Impressoras térmicas de etiquetas para laboratório e pontos de colheita;
- Etiquetas e ribbons compatíveis com frio, humidade e produtos laboratoriais;
- Leitores de código de barras 1D/2D;
- Impressoras móveis quando justificadas pelo fluxo clínico;
- Pulseiras com código de barras, se aprovadas pela instituição;
- Integração com analisadores laboratoriais, sistemas de imagiologia e outros sistemas através de interfaces documentadas e validadas;
- APIs/HL7/FHIR quando aplicáveis e suportados pelos sistemas envolvidos; nunca presumir compatibilidade sem teste;
- Monitorização de impressoras, falhas de leitura, filas de mensagens e reconciliação de resultados.

## Indicadores de qualidade

- Percentagem de amostras com identificação completa;
- Taxa de amostras rejeitadas por motivo;
- Número de incidentes de identificação/troca;
- Tempo entre pedido, colheita, receção, análise e validação;
- Percentagem de colheitas com registo de profissional, data e hora;
- Percentagem de amostras rastreáveis em todas as etapas;
- Resultados críticos comunicados dentro do prazo definido;
- Número de reimpressões e exceções de leitura;
- Amostras sem localização ou estado atualizado.

## Critérios de aceitação antes de entrar em produção

- Testes com tubos, frascos, lâminas e recipientes reais usados pelas unidades;
- Testes de leitura de códigos em todas as impressoras e leitores selecionados;
- Testes de impressão, reimpressão, cancelamento e amostras derivadas;
- Testes de discrepância de paciente, duplicação de pedido, perda de rede e recuperação;
- Validação do catálogo de análises e regras de aceitação pelo laboratório;
- Aprovação formal por laboratório, enfermagem, médicos, qualidade, biossegurança, TI e responsáveis de proteção de dados;
- Formação e simulação antes de ativar em produção.

## Nota de implementação

Este documento é uma especificação funcional, não prova que a função já existe no código. A implementação deve ser integrada no projeto real NV.Digital, testada e validada localmente antes de utilização clínica. Nunca usar dados reais de pacientes em testes não autorizados.
