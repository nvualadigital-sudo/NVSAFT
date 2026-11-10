# Modelo de dados e dicionário resumido

| Entidade | Chave / relação | Regra principal |
|---|---|---|
| pacientes | empresa_id + id | Cadastro central; BI/processo verificados na instituição |
| hospital_state | empresa_id + namespace | Documentos clínicos/enfermagem/agenda; revisão optimista |
| nv_settings | empresa_id | Perfil, serviços, sectores e especialidades activados |
| nv_professionals | empresa_id + funcionario_id | Cadastro profissional ligado à conta; credencial e estado |
| nv_grants | id, empresa_id, actor | Competência delegada com autor, motivo, revogação e validade |
| nv_audit | id, empresa_id | Cadeia SHA-256 canónica de eventos, sem texto clínico desnecessário |
| nv_lab_catalog | empresa_id + code + version | Rascunho, aprovação independente e retirada de versão anterior |
| nv_lab_orders | empresa_id + id; patient_id; episode_id | Prioridade, origem, indicação, snapshot e identificador de reenvio |
| nv_lab_tests | empresa_id + id; order_id | Análise com snapshot do catálogo e resultado publicado associado |
| nv_lab_containers | empresa_id + id; order_id; sample_id; parent_id | Recipiente físico, código opaco único, local/estado/revisão |
| nv_lab_container_tests | recipiente + análise | Análises associadas ao recipiente |
| nv_lab_events | recipiente + request_id | Eventos de colheita, impressão, transporte, recepção, rejeição e destino |
| nv_lab_values | análise + versão | Conteúdo versionado; introdução, validação técnica e libertação |
| nv_lab_communications | value_id | Tentativa, destinatário, canal, nota, readback e confirmação |
| nv_quality | sector + equipamento + lote | Controlo, validade, autor e bloqueio de libertação |
| nv_cases | empresa_id + id; patient_id opcional | Registos de serviços activados, responsável, estado e revisão |
| nv_case_events | case_id | Snapshot de cada versão com motivo e autoria |
| nv_chat_attachments | message_id + empresa_id | Conteúdo privado limitado aos participantes da mensagem |
| hospital_files / folders | empresa_id + id | Documentos internos, pastas, conteúdo e lixeira |
| hospital_shares | origem + destino + paciente | MEDLIK com fundamento e revogação |
| hospital_pharmacy / moves | empresa_id + produto/lote | Saldo e dispensa em transacção com a prescrição |
| faturas / movimentos | empresa_id + documento | Numeração, valores e movimentos confirmados no servidor |

Estados do recipiente: por_colher, colhida, etiquetada, em_transporte, recebida, aceite, aceite_ressalva, rejeitada, em_processamento, quarentena, armazenada, descartada. A API restringe as transições e preserva os eventos.

Uma rectificação cria outra versão. Até essa versão ser validada, a versão publicada é retirada da listagem corrente. O histórico permanece disponível no pedido. Resultados antigos não são reconstruídos como se tivessem uma cadeia de custódia inexistente; mantêm-se identificados como legado.

episode_id é conferido contra o atendimento clínico da instituição e o mesmo paciente. A ligação clínica continua a ser validada na aplicação porque o episódio legado ainda está num documento JSON.
