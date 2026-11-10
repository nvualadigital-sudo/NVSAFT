# Recomendações recebidas, fontes e homologação MINSA

## Origem dos requisitos

Os dois ZIP entregues são kits de requisitos/arquitectura. Não contêm um ofício assinado, checklist de inspecção, caderno de encargos ou relatório de não conformidades do MINSA. A revisão implementa o âmbito documentado em ESTADO_DOS_MODULOS.md e conserva os requisitos originais para confrontação.

## Fontes institucionais consultadas em 27/10/2026

- MINSA: https://minsa.gov.ao/web/noticias/hospital-presidente-julius-nyerere:-um-mes-a-salvar-vidas-e-a-transformar-a-resposta-aos-doentes-queimados-em-angola — contexto dos serviços de queimados, cirurgia, UTI, laboratório e acompanhamento multidisciplinar. É uma notícia institucional, não uma especificação de software nem aprovação deste produto.
- Portal MINSA: https://minsa.gov.ao/ — ponto de partida para publicações e protocolos. Não foi confirmado um checklist público que permita declarar este ZIP integralmente homologado.
- APD: https://apd.ao/ao/legislacao/ e https://apd.ao/ao/dados-sensiveis/ — os acessos consultados redireccionaram para manutenção. Não foi presumido o teor de uma norma indisponível nem emitido parecer jurídico.

## Rastreabilidade por exigência

| Grupo de exigências dos kits | Implementação / evidência | Aceitação ainda necessária |
|---|---|---|
| Empresa A separada da B | Filtro de sessão, referências institucionais, testes de workspace, laboratório, biblioteca, chat, MEDLIK e exportação | Avaliação de segurança independente e segregação de infraestrutura |
| Identificação de paciente/amostra | Snapshot, código opaco, dois identificadores, transições e rejeição/recolheita auditadas | Política de identificação aprovada, materiais e leitores reais |
| Laboratório e resultados | Catálogo aprovado/versionado, CQ, validação independente, rectificação e comunicação crítica | Catálogo e protocolos locais; assinatura; ensaios com profissionais/equipamentos |
| Perfis especializados | Activação por instituição e registos de queimados/vigilância | Aprovação clínica dos formulários, protocolos e acesso por equipa |
| Dados e auditoria | Histórico, controlo de revisão, cadeia verificável e exportações auditadas | Retenção, auditoria externa protegida e processo de incidentes |
| Continuidade | Migrações testadas; cópia cifrada e comando de restauro isolado | Ensaio real de recuperação, RPO/RTO e contingência física |
| Interoperabilidade e notificações | MEDLIK explícito; sem envio automático | Contratos, padrões, endpoints e ensaios oficiais de cada sistema |
| Interface | Menus, temas e Dashboard com dados reais | Navegador real, acessibilidade, contraste, dispositivos e utilizadores |
| Entrada em produção | Código e comandos completos; schema aplicado no Neon | Instalação/publicação do código no Replit, formação e aceite formal |

A recepção do caderno/checklist oficial com referência e versão é necessária para fechar a correspondência item a item com as exigências concretas que estão a ser cobradas. Este pacote não deve ser apresentado como certificado ou homologado pelo MINSA/AGT.
