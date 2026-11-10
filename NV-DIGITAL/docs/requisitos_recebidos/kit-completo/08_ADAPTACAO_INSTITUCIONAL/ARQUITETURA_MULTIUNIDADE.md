# NV.Digital para duas unidades especializadas

## Princípio de desenho
Um único produto NV.Digital com configuração institucional separada por unidade, sem misturar dados clínicos do Hospital dos Queimados Presidente Julius Nyerere com os do CETEP. A implementação deve suportar uma instalação partilhada apenas se a avaliação de segurança, governação e requisitos legais o permitir; caso contrário, manter instâncias separadas com integrações controladas.

## Componentes partilháveis
- Identidade e acesso, com organização/unidade, função, serviço e permissões por contexto.
- Registo de auditoria, notificações, agenda, arquivo, relatórios administrativos e gestão de utilizadores.
- Base clínica comum para pacientes, encontros, alergias, medicação, pedidos, resultados e documentos, com segregação e acesso contextual.
- Laboratório, farmácia, stock, faturação, recursos humanos, manutenção e gestão de equipamentos, ativados conforme a necessidade real de cada unidade.

## Configurações exclusivas
- Julius Nyerere: queimaduras, feridas complexas, cirurgia reconstrutiva, cuidados intensivos, medicina hiperbárica, reabilitação e continuidade pós-alta.
- CETEP: triagem epidemiológica, precauções/isolamento, doenças infecciosas, vigilância, notificações e seguimento de acordo com normas autorizadas.

## Requisitos técnicos mínimos
- Tenant/unidade em cada registo aplicável; controlo de acesso no servidor, não apenas na interface.
- Não permitir pesquisas, exportações ou dashboards cruzarem unidades sem permissão explícita e auditada.
- Dicionários, formulários, protocolos, tipos de atendimento e relatórios configuráveis por unidade.
- Integrações via APIs autenticadas, com registo de consentimento/base legal, minimização de dados e tratamento de falhas.
- Backups testados, recuperação de desastre, logs protegidos, encriptação em trânsito e em repouso, gestão de segredos e plano de resposta a incidentes.

## Fases de implementação
1. Inventariar o código real do NV.Digital e identificar stack, módulos, base de dados, autenticação e testes.
2. Elaborar árvore real do repositório e mapa de lacunas por instituição.
3. Validar fluxos com Direção Clínica, Enfermagem, Laboratório, Farmácia, TI, proteção de dados e controlo de infeções.
4. Implementar primeiro identidade/permissões/auditoria e fluxos clínicos críticos.
5. Migrar apenas dados autorizados, com validação, reconciliação e plano de reversão.
6. Testar em ambiente controlado com dados fictícios; isto é teste de aceitação, não uma demo entregue como produto.
7. Só entrar em produção após testes, formação, validação clínica, segurança e aprovação institucional.

## Limite importante
Este kit é uma especificação adaptada. Sem o ZIP/repositório real do NV.Digital, não é possível afirmar que o software foi alterado ou que existe uma aplicação pronta para uso clínico.
