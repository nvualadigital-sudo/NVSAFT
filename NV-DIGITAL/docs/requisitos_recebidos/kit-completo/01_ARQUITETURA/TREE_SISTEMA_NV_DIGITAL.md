# TREE DO SISTEMA — NV.Digital | Gestão Hospitalar

> **Tipo de documento:** árvore-alvo de arquitetura, ficheiros e pastas propostos.  
> **Importante:** este TREE descreve a estrutura que deve orientar a organização do projeto real. Não afirma que todos estes ficheiros já existam ou estejam implementados. O GPT deve comparar esta árvore com o código-fonte recebido e adaptar os nomes à stack real, sem substituir o projeto por uma aplicação nova nem criar ficheiros vazios só para preencher a árvore.

## Regras de utilização do TREE
1. Primeiro, analisar o ZIP/repositório real do NV.Digital.
2. Registar a árvore real atual em `docs/ESTADO_ATUAL_TREE.md`.
3. Usar este documento como arquitetura-alvo, assinalando cada item como **EXISTE**, **PARCIAL**, **CRIAR**, **NÃO APLICÁVEL** ou **CANDIDATO A REMOÇÃO**.
4. Preservar nomes, pastas e padrões úteis já existentes quando forem compatíveis com a arquitetura.
5. Não criar módulos duplicados: todos os médicos usam um único `atendimento-clinico`; o laboratório é um único módulo com setores.
6. Não remover código ou dados sem evidência, testes e plano de reversão.
7. A árvore final entregue deve refletir os ficheiros reais que foram implementados, não uma estrutura fictícia.

## Árvore-alvo detalhada

```text
NV.Digital/
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── .gitignore
├── .editorconfig
├── .env.example
├── package.json                         # apenas se a stack real usar Node.js
├── lockfile                              # manter o lockfile real da stack
├── [ficheiros de configuração da stack existente]
│
├── docs/
│   ├── TREE_SISTEMA_NV_DIGITAL.md        # este documento
│   ├── ESTADO_ATUAL_TREE.md              # árvore real encontrada na auditoria
│   ├── MAPA_DO_PROJETO.md
│   ├── ARQUITETURA.md
│   ├── ESTADO_DOS_MODULOS.md
│   ├── AUDITORIA_E_LIMPEZA.md
│   ├── MATRIZ_DE_PERMISSOES.md
│   ├── SEGURANCA_E_PRIVACIDADE.md
│   ├── MODELO_DE_DADOS.md
│   ├── API_E_INTEGRACOES.md
│   ├── BACKUP_E_RESTAURO.md
│   ├── TESTES_E_CRITERIOS.md
│   ├── HISTORICO_DE_ALTERACOES.md
│   ├── INSTALACAO_E_EXECUCAO.md
│   └── decisions/
│       └── README.md                     # decisões arquiteturais quando necessárias
│
├── src/                                  # nomes adaptados à stack real
│   ├── app/                              # arranque, composição e configuração
│   │   ├── routes/
│   │   ├── providers/
│   │   ├── middleware/
│   │   ├── navigation/
│   │   └── app-config/
│   │
│   ├── core/                             # capacidades transversais partilhadas
│   │   ├── auth/
│   │   │   ├── authentication/
│   │   │   ├── authorization/
│   │   │   ├── sessions/
│   │   │   └── policies/
│   │   ├── audit/
│   │   ├── errors/
│   │   ├── logging/
│   │   ├── validation/
│   │   ├── permissions/
│   │   ├── notifications/
│   │   ├── files/
│   │   ├── search/
│   │   └── configuration/
│   │
│   ├── modules/
│   │   ├── administracao-seguranca/
│   │   │   ├── utilizadores/
│   │   │   ├── profissionais/
│   │   │   ├── funcoes-cargos/
│   │   │   ├── perfis-acesso/
│   │   │   ├── permissoes-modulo/
│   │   │   ├── permissoes-acao/
│   │   │   ├── unidades-servicos/
│   │   │   ├── sessoes-autenticacao/
│   │   │   └── auditoria-acessos/
│   │   │
│   │   ├── recursos-humanos/
│   │   │   ├── cadastro-profissionais/
│   │   │   ├── categorias-profissionais/
│   │   │   ├── especialidades/
│   │   │   ├── departamentos/
│   │   │   ├── turnos-escalas/
│   │   │   └── situacao-profissional/
│   │   │
│   │   ├── dashboard/
│   │   ├── pacientes-arquivo-clinico/
│   │   ├── agendamentos/
│   │   ├── atendimento-clinico/          # módulo único para todas as especialidades
│   │   ├── enfermagem/
│   │   ├── urgencia-emergencia/
│   │   ├── internamento-leitos/
│   │   ├── bloco-operatorio/
│   │   ├── maternidade/
│   │   ├── laboratorio/                  # módulo único com setores configuráveis
│   │   │   ├── hematologia/
│   │   │   ├── bioquimica-clinica/
│   │   │   ├── microbiologia/
│   │   │   ├── parasitologia/
│   │   │   ├── imunologia/
│   │   │   ├── serologia/
│   │   │   ├── hemoterapia-medicina-transfusional/
│   │   │   ├── urinanalise-liquidos-biologicos/
│   │   │   ├── micologia/
│   │   │   ├── virologia/
│   │   │   ├── biologia-molecular-pcr/
│   │   │   ├── toxicologia/
│   │   │   ├── coagulacao-hemostase/
│   │   │   ├── anatomia-patologica-citologia/  # opcional, se existir
│   │   │   ├── colheitas-amostras/
│   │   │   └── qualidade-reagentes-equipamentos/
│   │   ├── imagiologia/
│   │   ├── farmacia/
│   │   ├── stock-compras-fornecedores/
│   │   ├── banco-de-sangue/              # integrar com hemoterapia quando adequado
│   │   ├── faturacao-caixa/
│   │   ├── convenios-seguros/
│   │   ├── equipamentos-manutencao/
│   │   ├── esterilizacao/
│   │   ├── nutricao-refeicoes/
│   │   ├── ambulancia-transporte/
│   │   ├── documentos-arquivo/
│   │   ├── notificacoes/
│   │   ├── relatorios-indicadores/
│   │   ├── agente-ia/                    # voz, escrita e fala
│   │   ├── chat/                         # separado do agente
│   │   └── configuracoes-temas/
│   │
│   ├── shared/                           # componentes partilhados, sem lógica duplicada
│   │   ├── ui/
│   │   ├── forms/
│   │   ├── tables/
│   │   ├── dialogs/
│   │   ├── navigation/
│   │   ├── accessibility/
│   │   ├── hooks-or-composables/         # adaptar à stack
│   │   ├── types-or-models/              # adaptar à stack
│   │   └── utilities/
│   │
│   ├── design-system/
│   │   ├── tokens/
│   │   ├── themes/
│   │   ├── components/
│   │   ├── icons/
│   │   └── styles/
│   │       └── nv-digital.css            # adaptar/integrar CSS existente
│   │
│   ├── integrations/                     # criar apenas integrações necessárias
│   │   ├── laboratory/
│   │   ├── imaging-pacs-dicom/
│   │   ├── email-sms/
│   │   ├── payment/
│   │   └── ai-speech/
│   │
│   └── [camadas backend/API conforme a arquitetura real]
│       ├── controllers-or-handlers/
│       ├── application-services/
│       ├── domain/
│       ├── repositories/
│       └── jobs-or-workers/
│
├── database/                             # adaptar à tecnologia existente
│   ├── schema/
│   ├── migrations/
│   ├── seeds/                            # apenas dados não sensíveis e aprovados
│   └── data-dictionary/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── authorization/
│   ├── security/
│   ├── accessibility/
│   ├── end-to-end/
│   └── fixtures/                         # nunca usar dados reais de pacientes
│
├── scripts/                              # só scripts necessários e documentados
├── infrastructure/                      # só se fizer parte do projeto
├── public-or-static/                     # nome conforme stack
└── [configuração de build/deploy da stack existente]
```

## Responsabilidade das áreas

### Administração e Segurança
- Utilizadores e contas individuais.
- Profissionais e respetivas credenciais.
- Funções, cargos, perfis e permissões por módulo/ação.
- Unidades e serviços.
- Sessões, autenticação e revogação de acesso.
- Auditoria de acessos e alterações.
- Administração técnica sem acesso clínico automático.

### Recursos Humanos
- Cadastro e situação profissional.
- Categorias e especialidades.
- Departamentos, unidades, turnos e escalas.
- Vínculos, ausências e estado profissional, conforme âmbito real.
- Desligamento ou suspensão com revisão dos acessos associados.

### Gestão Hospitalar
- Atendimento clínico único para todas as especialidades.
- Enfermagem, urgência, internamento e demais serviços.
- Laboratório como módulo principal com setores.
- Farmácia, imagiologia, faturação e restantes módulos usados pela instituição.
- Agente IA e chat separados, ambos sujeitos às permissões do utilizador.

## Regras para os ficheiros dentro de cada módulo

A estrutura interna deve seguir a stack existente. Quando aplicável, cada módulo pode ter:

```text
nome-do-modulo/
├── README.md
├── routes-or-pages/
├── components/
├── application-or-services/
├── domain-or-models/
├── repositories-or-data-access/
├── validation/
├── permissions/
├── tests/
└── index-or-module-entry
```

**Não criar automaticamente todas estas subpastas** se o framework não as usar. Criar apenas ficheiros necessários, com código real, ligações funcionais e testes. Evitar pastas e ficheiros vazios.

## Registo da árvore real
Depois de receber o código-fonte, criar `docs/ESTADO_ATUAL_TREE.md` com:
- a árvore integral real de ficheiros e pastas;
- a finalidade conhecida de cada área;
- o estado de cada componente;
- ficheiros de configuração e comandos confirmados;
- ficheiros sensíveis/segredos que não devem entrar no ZIP final;
- diferenças entre árvore real e árvore-alvo;
- itens propostos para criar, consolidar ou remover, com evidências.

A árvore final deve ser gerada a partir do repositório final efetivamente testado.
