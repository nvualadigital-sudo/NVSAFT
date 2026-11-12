# Processo clínico: código Bahmni adaptado ao NV-DIGITAL

Os componentes `PatientDetails` e `GenericServiceRequestTable` provêm do repositório oficial [Bahmni Apps Frontend](https://github.com/Bahmni/bahmni-apps-frontend), revisão `12a0173eecacf49acb95c29cccf3388a98d074e9`.

As cópias sem alteração estão em `upstream/`; `origins.json` regista os caminhos e os hashes Git de cada original. As adaptações utilizadas pela aplicação estão em `artifacts/lab-results/src/modules/bahmni-clinical/`. As cópias originais permitem comparar a estrutura de apresentação, a formação dos identificadores, o agrupamento por data e a ordenação de prioridades.

| Código de origem | Adaptação activa |
|---|---|
| `packages/bahmni-widgets/src/patientDetails/PatientDetails.tsx` | `PatientDetails.tsx` |
| `packages/bahmni-widgets/src/patientDetails/utils.ts` | `patient-utils.ts` |
| `packages/bahmni-widgets/src/genericServiceRequest/GenericServiceRequestTable.tsx` | `GenericServiceRequestTable.tsx` |
| `packages/bahmni-widgets/src/genericServiceRequest/utils.ts` | `request-utils.ts` |
| `packages/bahmni-widgets/src/genericServiceRequest/models.ts` | `request-models.ts` |

A dependência de serviços OpenMRS/FHIR e dos componentes Carbon/Bahmni foi substituída por adaptadores para as APIs e os componentes visuais do NV-DIGITAL. Não foi introduzido outro cadastro de pacientes, base de dados ou mecanismo de autenticação.

## Onde aparece

- Médicos: seleccionar uma consulta e abrir **Processo clínico**. A opção **Este atendimento** apresenta os registos com associação comprovada à consulta. **Histórico do paciente** inclui os outros episódios e resultados anteriores.
- Enfermagem: no espaço do paciente, utilizar **Abrir processo clínico integrado**. A vista é de consulta e utiliza as autorizações institucionais existentes.

O resumo reúne identificação, alergias e antecedentes registados, consultas, pedidos e valores laboratoriais, medicação prescrita e dispensada, documentos e observações de enfermagem. Os botões da área médica abrem os módulos existentes para continuar o trabalho.

## Fonte dos dados e limites da associação

`GET /api/hospital/clinical-overview/:patientId?episodeId=<uuid>` utiliza a empresa da sessão autenticada. Não aceita uma empresa escolhida pelo cliente. O servidor verifica o paciente central e a correspondência do episódio, selecciona registos pelos identificadores e devolve a versão mais recente de cada análise.

As respostas são `private, no-store`; a consulta é auditada sem incluir texto clínico no evento. A interface rejeita uma resposta de outro paciente, empresa ou episódio e ignora respostas antigas após mudar a selecção.

O circuito laboratorial activo já guarda `patient_id` e `episode_id`. Esta adaptação aproveita essa ligação. A análise inicial que apontava campos em falta no formulário legado `SolicitacoesExames.tsx` não descrevia toda a ligação existente no circuito activo. Nenhuma associação é inferida por semelhança de nomes.

Resultados legados sem episódio comprovado aparecem apenas no histórico do paciente. Não se repetem os relatórios já representados no circuito laboratorial. Registos de enfermagem sem relação explícita com a consulta também aparecem apenas no histórico; no atendimento, só é mostrada a triagem associada.

Esta entrega consulta o estado existente. Não altera resultados, prescrições, movimentos de stock, regras de libertação, documentos emitidos ou facturação. A ligação operacional entre prescrição, dispensa e administração continua nos módulos próprios; este resumo não converte texto de frequência em horários de administração.

Não são necessárias novas migrações para esta adaptação. São necessárias as migrações já existentes do sistema, incluindo a enfermagem integrada e o circuito laboratorial.

## Licença e código disponibilizado

Os cinco ficheiros derivados identificados acima conservam a MPL 2.0, o aviso original e o Healthcare Disclaimer do projecto de origem. `LICENSE.txt` e `NOTICE.txt` no directório do módulo preservam esses textos e a revisão de origem. A licença geral do NV-DIGITAL não substitui a licença destes ficheiros.

A interface oferece **Créditos e licenças dos componentes**, com descarga do código efectivamente compilado das adaptações, dos adaptadores visuais e do contrato de dados. A descarga não contém dados de pacientes. As restantes funcionalidades do NV-DIGITAL não foram importadas do Bahmni.

## Verificação

`tests/clinical-overview.test.ts` cobre empresas diferentes, pacientes homónimos, episódios diferentes, permissões, versões de resultados, conservação dos registos, auditoria mínima, valores zero, prioridades e datas de Luanda. Também verifica a renderização dos componentes e a identidade dos cinco ficheiros originais por hash Git.

Comandos de validação: `pnpm test` e `pnpm build`. A verificação visual deve incluir a área médica, o espaço de enfermagem e larguras de computador e telemóvel. Nesta entrega, a abertura de um navegador local foi bloqueada pelo ambiente de execução; o navegador remoto não conseguiu alcançar o servidor local. A conferência visual no navegador continua pendente e não é substituída pelos testes de renderização.
