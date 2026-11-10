# NV.Digital — Etiquetas e rastreabilidade de amostras

## 1. Princípio obrigatório
Cada recipiente físico deve ter um identificador único, legível por pessoas e por leitor de código de barras. O código identifica a amostra/recipiente no sistema; não deve expor diagnóstico, nome completo ou outros dados sensíveis no código visível. O código de barras não substitui a confirmação da identidade do paciente.

## 2. Identificadores separados
- **Paciente:** identificador institucional único (MPI/ID do paciente).
- **Pedido:** número único do pedido laboratorial.
- **Amostra:** identificador único da colheita/material recebido.
- **Recipiente:** identificador individual de cada tubo, frasco, lâmina ou contentor.
- **Alíquota:** identificador próprio, com relação explícita à amostra de origem.
- **Episódio:** atendimento/internamento ao qual o pedido pertence.

Nunca reutilizar identificadores. Uma nova colheita gera nova amostra; uma alíquota não deve ser confundida com uma nova colheita.

## 3. Conteúdo mínimo recomendado da etiqueta
- Nome completo do paciente, conforme política institucional, ou identificador alternativo aprovado quando necessário.
- Número institucional do paciente (MRN/ID).
- Código único da amostra/recipiente em código de barras 1D ou 2D.
- Tipo de amostra/material e/ou código do teste, quando útil e seguro.
- Data/hora da colheita; em etiquetas pequenas, pode ser apresentada de forma compacta.
- Estado especial de manuseamento apenas quando clinicamente necessário e conforme política local.
- Instituição/unidade ou código do local de colheita quando há múltiplas unidades.

A etiqueta deve ser validada com o laboratório e testada em impressoras e recipientes reais. A disposição final, tamanho, simbologia e dados obrigatórios devem seguir a legislação e os procedimentos aprovados pela instituição.

## 4. Fluxo operacional
1. Profissional confirma o paciente com pelo menos dois identificadores aprovados (por exemplo, nome completo e ID/data de nascimento), nunca apenas número de cama.
2. Médico/profissional autorizado cria pedido com testes, prioridade, indicação clínica e local de colheita.
3. Sistema associa tubos/recipientes requeridos a cada teste e verifica incompatibilidades de material, recipiente, volume e conservação.
4. No momento da colheita, profissional volta a confirmar a identidade, regista coletor, data/hora, local e circunstâncias necessárias.
5. Etiqueta é impressa junto do paciente e aplicada imediatamente ao recipiente correto. Proibir etiquetar tubos antecipadamente em lote para pacientes diferentes.
6. Leitura do código valida paciente, pedido, recipiente e testes associados. O sistema alerta para recipiente errado, etiqueta duplicada, pedido cancelado ou amostra já recebida.
7. Transporte regista origem, destino, responsável, hora de saída/chegada e condições relevantes (temperatura, cadeia de custódia, se aplicável).
8. Receção laboratorial verifica identidade, integridade, volume, recipiente, tempo e condições. Aceitar, aceitar com ressalva ou rejeitar conforme critérios aprovados.
9. Cada mudança de localização/estado é auditada; processamento, alíquotas, equipamento, lote de reagente, controlo de qualidade e técnico são ligados à amostra quando aplicável.
10. Resultado passa por validação técnica e clínica conforme regras do laboratório. Resultados críticos geram comunicação documentada e confirmação de receção.
11. Armazenamento, localização física, temperatura, prazo de retenção e descarte são registados de acordo com procedimento aprovado.

## 5. Estados sugeridos
Rascunho; pedido confirmado; aguardando colheita; colhida; etiquetada; em transporte; recebida; em triagem; aceite; aceite com ressalva; rejeitada; em processamento; pendente de repetição; resultado preliminar; validada; comunicada; armazenada; esgotada; descartada; cancelada.

## 6. Rejeição e exceções
Motivos configuráveis: identificação ausente/incompatível, recipiente incorreto, amostra hemolisada/coagulada quando impeditivo, volume insuficiente, fuga/derrame, prazo excedido, temperatura inadequada, pedido inexistente, etiqueta ilegível/duplicada ou amostra inadequada. A decisão depende do tipo de teste e da política validada; não aplicar uma regra universal a todos os exames.

Cada rejeição deve registar motivo, profissional, data/hora, comunicação ao serviço, necessidade de nova colheita e eventual exceção autorizada. Exceções nunca devem apagar o histórico original.

## 7. Reimpressão e falhas
- Reimpressão exige motivo e utilizador autenticado; guardar data/hora, impressora, cópia e motivo.
- A etiqueta reimpressa deve continuar a referir-se ao mesmo identificador, mas o sistema deve sinalizar risco de etiquetas duplicadas e instruir a inutilização segura da anterior.
- Se o sistema ou a impressora estiver indisponível, usar procedimento de contingência numerado, aprovado, com reconciliação posterior e prevenção de duplicados.
- Não permitir editar silenciosamente a identidade de uma amostra já recebida/processada; usar correção controlada com dupla verificação e auditoria.

## 8. Equipamento e integração
- Impressoras térmicas de etiquetas compatíveis com ambiente clínico; rolos/etiquetas resistentes a humidade, frio e manuseamento conforme o uso.
- Leitores 1D/2D; testar leitura em tubos curvos, etiquetas refrigeradas e superfícies húmidas.
- Integração com analisadores por interfaces suportadas pelo fabricante, middleware ou padrões acordados; validar resultados e unidades antes de produção.
- Preparar arquitetura para HL7 v2 e/ou FHIR quando aplicável; não afirmar interoperabilidade sem testes de conformidade.

## 9. Indicadores de qualidade
- Percentagem de amostras rejeitadas por identificação/etiquetagem.
- Percentagem de recipientes rastreáveis em todas as etapas.
- Taxa de reimpressão de etiquetas.
- Tempo entre colheita, receção e processamento.
- Percentagem de resultados críticos comunicados dentro do prazo definido.
- Número de amostras sem localização ou com eventos de rastreabilidade em falta.

## 10. Critérios de aceitação
O módulo só é aceite após testes com pacientes fictícios em ambiente de teste, leitores e impressoras reais, vários recipientes, alíquotas, amostras rejeitadas, reimpressão, falhas de rede e reconciliação de contingência. Nenhum teste de aceitação deve usar dados reais identificáveis sem autorização e salvaguardas apropriadas.
