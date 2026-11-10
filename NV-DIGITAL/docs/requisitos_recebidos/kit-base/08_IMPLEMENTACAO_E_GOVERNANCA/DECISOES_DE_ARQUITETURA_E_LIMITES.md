# Decisões de arquitetura e limites do pacote

1. O NV.Digital é um produto próprio; a referência ao Epic significa inspiração em padrões de fluxo de trabalho hospitalar, não cópia de código, marca, interface proprietária ou conteúdo protegido.
2. A arquitetura final depende da inspeção do código-fonte existente. Não escolher ou impor stack novo antes desse levantamento.
3. “Documentado” não significa “implementado”. Cada módulo deve ter estado explícito: implementado e testado; parcialmente implementado; planeado; bloqueado por integração/equipamento; ou não aplicável.
4. Impressoras, leitores, analisadores, PACS/RIS e sistemas externos exigem modelo, protocolo, licença e testes concretos. Não prometer integração universal.
5. Etiquetas, catálogo de exames, intervalos de referência, valores críticos, regras de rejeição, prazos de retenção e protocolos clínicos devem ser aprovados pelos responsáveis clínicos/laboratoriais e conformes às regras locais.
6. A partilha entre Julius Nyerere e CETEP deve ser controlada por finalidade e permissões, não uma abertura irrestrita de todos os processos.
7. Antes de produção: avaliação de segurança e privacidade, testes com dados fictícios, formação, plano de continuidade, apoio técnico e aprovação formal.

## Próximo artefacto após receber o código-fonte
- TREE real e inventário de módulos.
- Matriz de requisitos versus ficheiros existentes.
- Lista priorizada de defeitos e lacunas.
- Plano de migração incremental sem destruir funcionalidades existentes.
- Testes reproduzíveis e critérios de aceitação por módulo.
