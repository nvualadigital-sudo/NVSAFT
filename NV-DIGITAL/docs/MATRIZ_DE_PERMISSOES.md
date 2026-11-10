# Permissões efectivamente aplicadas

A sessão é verificada em cada pedido. empresa_id provém do JWT e sessão revogável do servidor. Menus não substituem autorização. Esta matriz descreve o código; deve ser revista e aprovada pelos responsáveis institucionais.

| Operação | Funções / condições na API |
|---|---|
| Gestão técnica de empresas | developer; sem leitura clínica automática |
| Configuração institucional, profissionais, delegação e sessões | admin / gestor da instituição |
| Consultar circuito laboratorial | admin, gestor, técnico, médico, enfermeiro |
| Criar pedido laboratorial | admin, gestor, médico, enfermeiro; paciente/episódio da instituição |
| Catálogo em rascunho / processamento / resultado manual | admin, gestor, técnico |
| Aprovar catálogo | Função laboratorial + lab.catalog.approve + credencial vigente; autor diferente |
| Validar tecnicamente | Função autorizada + lab.validate.technical + credencial vigente; diferente de quem introduziu |
| Libertar resultado | Função autorizada + lab.validate.release + credencial vigente; validação técnica prévia; outro validador quando catálogo exige |
| CQ | Função laboratorial + lab.quality + credencial vigente |
| Aceitar com ressalva | Função laboratorial + lab.exception + credencial vigente |
| Vigilância identificável | Serviço activado + função assistencial + epidemiology.manage vigente |
| Libertar ciclo de esterilização | Serviço activado + operations.approve; outro autor; conclusão aprovada |
| Registos de serviços | Serviço activado + funções definidas no contrato partilhado |
| Auditoria | admin/gestor ou audit.read; verificação de cadeia reservada à gestão |
| Biblioteca | Sessão institucional; ficheiros/pastas da própria empresa |
| Chat / anexo directo | Empresa e participantes; um terceiro da mesma empresa não descarrega anexo privado |
| MEDLIK | admin/gestor/médico; origem ou destinatário explícito; revogação bloqueia leitura futura no destino |
| Farmácia | admin/gestor/farmacêutico para movimentos; saldo e prescrição verificados |
| Finanças | Funções financeiras/recepção conforme operação; sem acesso ao conteúdo clínico no carregamento geral |
| Exportar resultado | admin, gestor, médico, técnico, enfermeiro; versão actual libertada; evento auditado |

A credencial laboral e a autorização delegada são verificadas no momento do uso. Expiração/revogação bloqueia o acesso. Suspensão/desligamento bloqueia a conta, revoga sessões e competências. Não há autoconcessão de competência nem autoaprovação do catálogo/resultado.

Admin e gestor são responsáveis institucionais neste produto, com direitos amplos de supervisão; developer é a administração técnica. Não existe ainda a separação completa entre administração institucional não clínica, direcção clínica, RH, auditoria de processos e equipas por episódio. A relação de cuidado por equipa/serviço não é um motor ABAC completo. Não declarar que a matriz-alvo dos kits foi integralmente homologada.

MFA/SSO, acesso de emergência temporário e dupla aprovação administrativa de concessões permanecem pendentes. Não foi criado um botão de break-glass que contorne permissões.
