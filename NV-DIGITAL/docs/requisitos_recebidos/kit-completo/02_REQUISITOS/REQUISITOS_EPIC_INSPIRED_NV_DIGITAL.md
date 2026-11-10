# Requisitos empresariais inspirados em fluxos de EHR integrados

O NV.Digital deve adotar princípios de sistemas hospitalares integrados de grande escala — registo clínico longitudinal, ordens eletrónicas, filas de trabalho por função, resultados ligados ao processo clínico, auditoria e rastreabilidade — sem copiar a interface, código, marca ou propriedade intelectual do Epic.

## Requisitos obrigatórios transversais

- Um registo clínico longitudinal por paciente, com identificador único e mecanismos controlados de deteção/mesclagem de duplicados.
- Ordens clínicas eletrónicas com autoria, prioridade, estado, cancelamento e motivo.
- Filas de trabalho orientadas à função, unidade, prioridade e prazo.
- Alertas relevantes e configuráveis, com controlo de fadiga de alertas.
- Registo de auditoria para consulta, alteração, impressão, exportação e acesso a dados sensíveis.
- Permissões por função, unidade, contexto assistencial e necessidade de conhecer.
- Integração clínica e laboratorial com padrões abertos quando possível, após análise de compatibilidade.
- Indicadores de qualidade, segurança do paciente, tempos de resposta e carga operacional.
- Continuidade de serviço, cópias de segurança, recuperação de desastre e modo de contingência.
- Interface acessível em português, preparada para termos clínicos usados em Angola.

## Contexto das instituições

### Hospital dos Queimados Presidente Julius Nyerere

Configurar percursos especializados para urgência de queimados, avaliação da gravidade e superfície corporal queimada, feridas complexas, cirurgia, bloco operatório, anestesia, cuidados intensivos, medicina hiperbárica, microbiologia, transfusão, nutrição, controlo da dor, fisioterapia e reabilitação. As regras clínicas e escalas devem ser aprovadas pela equipa médica responsável.

### CETEP

Configurar percursos de triagem epidemiológica, avaliação de risco, isolamento, precauções de infeção, pedidos laboratoriais, gestão de amostras, notificações autorizadas, rastreio de contactos quando aplicável, acompanhamento e relatórios agregados. Acesso a informação epidemiológica identificável deve ser limitado e auditado.

## Implementação por etapas

1. Inventário e auditoria do código-fonte existente.
2. Mapeamento dos processos reais com as equipas de cada unidade.
3. Base comum: identidade, pacientes, permissões, auditoria, catálogo e integrações.
4. Laboratório e etiquetas com testes físicos de impressoras/leitores.
5. Percursos clínicos especializados de cada instituição.
6. Migração validada, formação, piloto controlado e entrada em produção aprovada.

Não marcar uma função como concluída apenas porque existe um ecrã ou botão. A função só está concluída após persistência real, validações, permissões, auditoria, testes e documentação.
