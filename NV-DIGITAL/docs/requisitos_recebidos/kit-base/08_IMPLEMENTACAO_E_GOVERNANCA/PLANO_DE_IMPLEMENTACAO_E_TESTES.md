# Plano de implementação, validação e entrada em produção

## Fase 0 — Levantamento do projeto real
Inventariar stack, repositório, banco de dados, módulos existentes, dependências, testes, autenticação, integrações e dívida técnica. Gerar TREE real e mapa “existente / incompleto / ausente / planeado”. Não substituir o projeto sem análise.

## Fase 1 — Fundação
Autenticação, perfis, permissões por unidade, auditoria, cadastro único de paciente, episódios, catálogo, configurações, cópias de segurança e monitorização.

## Fase 2 — Circuito clínico mínimo
Admissão, triagem, consultas, prescrições, pedidos de exames, resultados, internamento, transferência, alta e relatórios básicos. Validar com profissionais de ambas as unidades.

## Fase 3 — Laboratório e etiquetas
Catálogo, pedido, recipientes, impressão, leitores, colheita, transporte, receção, rejeição, alíquotas, processamento, validação, resultados críticos, qualidade e arquivo. Testar todos os tipos de etiqueta e impressora pretendidos.

## Fase 4 — Especialização
Fluxos de queimados e reabilitação no Julius Nyerere; vigilância, isolamento e notificação no CETEP; integrar equipamentos apenas após especificações dos fabricantes e testes documentados.

## Fase 5 — Piloto controlado
Executar ambiente de validação com dados fictícios, testes de aceitação assinados, formação por perfil, plano de contingência e suporte. Só passar a produção após aprovação clínica, laboratorial, segurança, TI e direção.

## Casos de teste críticos
1. Dois pacientes com nomes semelhantes.
2. Pulseira/etiqueta de paciente errado detetada antes da colheita.
3. Tubo com etiqueta duplicada, ilegível ou incompatível.
4. Várias amostras e alíquotas de um mesmo pedido.
5. Reimpressão com motivo e auditoria.
6. Amostra rejeitada, nova colheita e comunicação ao serviço.
7. Amostra urgente e cadeia de custódia.
8. Resultado crítico sem resposta inicial e escalonamento.
9. Analisador indisponível e introdução manual sujeita a dupla verificação.
10. Falha de rede/impressora e reconciliação de contingência.
11. Utilizador de uma unidade tenta abrir registo não autorizado da outra.
12. Utilizador termina vínculo e perde acesso imediatamente.
13. Restauro de cópia de segurança e verificação da integridade.
14. Notificação epidemiológica com acesso restrito e exportação auditada.
15. Alteração de resultado após validação com histórico completo e motivo obrigatório.

## Critério de go-live
Não declarar o sistema pronto só porque abre ou porque os ecrãs estão construídos. Exigir testes funcionais, de segurança, desempenho, restauro, impressão/leitura, integração, migração, formação e aprovação documentada dos responsáveis.
