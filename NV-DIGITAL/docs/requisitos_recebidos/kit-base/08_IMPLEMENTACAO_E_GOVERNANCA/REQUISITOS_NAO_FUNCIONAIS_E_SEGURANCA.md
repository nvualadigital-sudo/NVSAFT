# Requisitos não funcionais, segurança e operação

## Segurança e privacidade
- Acesso por função e por unidade; menor privilégio e separação de funções.
- Autenticação forte para perfis privilegiados; política de sessão, bloqueio e recuperação segura de conta.
- Registo de auditoria protegido contra alteração para leituras sensíveis, alterações clínicas, impressão/exportação, fusões de paciente e acesso de emergência.
- Encriptação em trânsito e em repouso, gestão segura de segredos, cópias de segurança encriptadas e testes de restauro.
- Ambientes separados: desenvolvimento, teste/validação e produção; nunca copiar dados reais para teste sem autorização e desidentificação apropriada.
- Controlo de exportação e impressão, encerramento de sessão em terminais partilhados e proteção de ecrãs.
- Plano de resposta a incidentes, gestão de vulnerabilidades, atualização, continuidade e recuperação de desastre.
- Acesso de emergência (“break glass”) apenas quando configurado, com motivo obrigatório, duração limitada e revisão posterior.

## Disponibilidade e continuidade
Definir com cada unidade metas de disponibilidade, RTO/RPO, horários de manutenção, procedimentos offline, formulários de contingência e reconciliação após restauro. Testar falhas de energia, rede, servidor, impressora e leitor de códigos de barras.

## Usabilidade e acessibilidade
Suportar português, datas/horas locais, impressão legível, atalhos e operação em ecrãs de posto clínico. Confirmar compatibilidade com computadores e equipamentos realmente disponíveis. Não depender apenas de cor para comunicar alertas.

## Dados e qualidade
- Dicionário de dados, identificadores estáveis, regras de validação e migrações versionadas.
- Política de retenção e eliminação aprovada institucionalmente.
- Detetar duplicados, campos inconsistentes, datas impossíveis e resultados sem pedido associado.
- Métricas de desempenho, erros, filas de integração e falhas de impressão.

## Inteligência artificial
O agente pode ajudar a redigir, resumir e pesquisar informação autorizada, mas deve indicar fontes/contexto, respeitar permissões e permitir revisão humana. Não deve confirmar diagnósticos, prescrever, alterar resultados, fechar episódios nem enviar notificações clínicas críticas sem autorização explícita e regras aprovadas. Registar utilização relevante e evitar enviar dados de saúde a serviços externos não aprovados.
