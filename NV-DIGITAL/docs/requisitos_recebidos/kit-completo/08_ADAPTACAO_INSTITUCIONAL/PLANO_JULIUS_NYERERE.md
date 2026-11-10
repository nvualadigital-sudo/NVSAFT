# Perfil institucional — Hospital dos Queimados Presidente Julius Nyerere

## Finalidade
Adaptar o NV.Digital para uma unidade hospitalar de referência especializada em queimaduras, feridas complexas, cirurgia reconstrutiva, cuidados intensivos, diagnóstico e reabilitação. Este documento define requisitos-alvo; não significa que estes módulos já existam ou estejam implementados no código real.

## Contexto público de referência
O Hospital dos Queimados Presidente Julius Nyerere está localizado no Kilamba, Luanda, e entrou em funcionamento em 1 de agosto de 2026. O MINSA descreve serviços como urgência, bloco operatório, cuidados intensivos, UTI de queimados, imagiologia, laboratório, endoscopia, fisioterapia e reabilitação, psicologia e unidade neonatal. Fonte institucional: https://minsa.gov.ao/web/noticias/hospital-presidente-julius-nyerere%3A-um-mes-a-salvar-vidas-e-a-transformar-a-resposta-aos-doentes-queimados-em-angola

## Módulos e fluxos prioritários
1. **Urgência e triagem de queimados** — hora de chegada, mecanismo (térmica, química, elétrica ou outra), avaliação inicial, extensão/profundidade registadas por profissional habilitado, sinais vitais, alergias, prioridade clínica e encaminhamento.
2. **Unidade de tratamento de queimados** — plano de cuidados, evolução seriada da ferida, registo de penso/procedimentos, fotografias clínicas apenas com autorização e controlo de acesso, dor, infeção suspeita, balanço hídrico e alertas clínicos configuráveis.
3. **Cuidados intensivos** — monitorização, dispositivos, balanço hídrico, ventilação e escalas clínicas aprovadas localmente; integrações com dispositivos só após validação técnica.
4. **Bloco operatório e cirurgia reconstrutiva** — lista cirúrgica, avaliação pré-operatória, consentimento, checklist de segurança, equipa, materiais, registo operatório e seguimento pós-operatório.
5. **Feridas complexas e consulta externa** — encaminhamento, fotografias seriadas protegidas, plano de penso, seguimento e alertas de retorno.
6. **Medicina hiperbárica** — avaliação, prescrição médica, sessões, contraindicações verificadas por profissionais, monitorização e registo de intercorrências. O sistema não deve decidir autonomamente se o tratamento é indicado.
7. **Imagiologia, laboratório e transfusão** — pedidos, colheitas, resultados validados, rastreabilidade de amostras e hemocomponentes, alertas críticos e confirmação de leitura.
8. **Reabilitação, fisioterapia, psicologia e nutrição** — avaliação multidisciplinar, metas funcionais, plano terapêutico, evolução e preparação da alta.
9. **Internamento e gestão de camas** — localização, isolamento quando indicado, transferências, limpeza/preparação do leito e previsão de alta.
10. **Alta e continuidade de cuidados** — resumo clínico, medicação reconciliada, cuidados da ferida, sinais de alarme, consultas de seguimento e referenciação.
11. **Ensino e investigação** — formação, protocolos aprovados, auditoria clínica e dados de investigação pseudonimizados; aprovação ética e autorização institucional obrigatórias.

## Dados e regras específicas
- Modelar a evolução de queimaduras e feridas ao longo do tempo, sem substituir a avaliação clínica.
- Separar dados de identificação, notas clínicas, imagens clínicas, dados de investigação e relatórios administrativos por permissões.
- Alertas e escalas clínicas devem ser configuráveis e aprovados pela Direção Clínica; nunca usar IA como diagnóstico autónomo.
- Registar autor, data/hora, alteração anterior e motivo para alterações a prescrições, resultados e notas.
- Aplicar regras de acesso mínimo, autenticação forte, registo de auditoria e procedimentos de indisponibilidade.
- O número de camas, salas, equipamentos e serviços deve ser configurável, não fixado no código. Confirmar a capacidade operacional real com a instituição antes da entrada em produção.
