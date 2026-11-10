# Testes e critérios de aceitação

## Testes reproduzíveis

```bash
pnpm test
pnpm build
```

A suite cobre API HTTP real com sessões JWT e PostgreSQL embutido PGlite, instalação/repetição/rollback de migrações, importação de documentos, cálculos financeiros e cifragem de backup. Não envia dados clínicos ao Neon de produção nem a fornecedores de IA.

Os casos críticos cobertos incluem empresa errada, paciente/recipiente errado, reimpressão, leitura duplicada, alíquota, rejeição/nova colheita, volume insuficiente, CQ reprovado, autor a tentar validar o próprio resultado, rectificação com versão, crítico sem confirmação, ficheiro privado para terceiro, conflito de agenda, suspensão de profissional, revogação de sessão, saldo/stock atómico, recibo insuficiente, duplicação de reenvio e alteração de auditoria. A leitura de CSV/JSON preserva os valores e recusa documentos não reconhecidos.

## Aceitação por completar com a instituição

- Aprovar a matriz de funções e competências; testar cada perfil, serviço e situação de substituição.
- Usar pacientes fictícios com nomes semelhantes e verificar a identidade junto de tubos, frascos e alíquotas reais.
- Ensaiar impressão/leitura em todos os modelos de impressora, etiqueta, recipiente e leitor; confirmar durabilidade e tamanho.
- Aprovar o catálogo, valores críticos, retenção e protocolos por sector; ensaiar analítica manual e integrações reais.
- Testar resultados críticos sem resposta, escalonamento e confirmação presencial/telefónica documentada.
- Validar cuidados, medicamentos, queimados, vigilância/isolamento, cirurgia, maternidade e alta com os profissionais responsáveis.
- Ensaiar falha de rede/energia/impressora, contingência e reconciliação sem códigos reutilizados.
- Testar backup/restauro integral num destino isolado, migração dos dados legados e contagens/vínculos.
- Executar testes de carga, segurança, vulnerabilidades, navegador, teclado, contraste e leitores de ecrã.
- Confirmar documentos oficiais/relatórios nacionais e assinar o aceite por clínica, enfermagem, laboratório, farmácia, TI, protecção de dados e direcção.

As caixas de aceitação clínica/hardware não foram marcadas como concluídas por existir código ou compilação. Ver ESTADO_DOS_MODULOS.md e VERIFICACAO.md.
