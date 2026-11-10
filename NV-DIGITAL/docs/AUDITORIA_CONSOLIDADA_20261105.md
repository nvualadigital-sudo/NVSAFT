# NV-DIGITAL — Auditoria comparativa e consolidação (05/11/2026)

Versão: `2026.11.05-netlify.4`. Comparados os conteúdos integrais de:

- `NVUALASOFT_Completo_Netlify_Fluxo_Clinico_Dentaria_20261105.zip`, fornecido pelo utilizador;
- `NVUALASOFT_Completo_Netlify_Laboratorio.zip`, versão correctiva anterior.

**Diagnóstico:** o pacote com Fluxo Clínico/Dentária introduziu trabalho funcional novo, mas derivava de uma linha anterior à correcção financeira/laboratorial. Algumas funcionalidades que já tinham sido corrigidas desapareceram. Esta versão usa a edição correctiva como base e incorpora as alterações clínicas seleccionadas, sem reinstalar as regressões.

## Melhoria presente no ZIP do utilizador

| Área | Código identificado | Resultado |
|---|---|---|
| Medicina Dentária/Estomatologia | `DentistryAssessmentEditor.tsx` e `dentistry.ts`; formulário integrado em `Consulta.tsx` | Odontograma FDI de 32 dentes, faces, estados, avaliação periodontal, anamnese oral e procedimentos, com versões anteriores |
| Triagem → Médico | `FilaTriagem.tsx`, `clinica/triage.ts`, `MedicoWorkspace.tsx` | Lê observações da Enfermagem integrada pelo servidor; mostra prioridades e associa pelo ID do paciente do cadastro central |
| Episódio de Enfermagem | `ResumoEnfermagem.tsx` | O médico consulta registos de Enfermagem associados ao paciente/episódio |
| Prescrições | `Prescricoes.tsx`, `clinica/store.ts`, `Farmacia.tsx` | Especialidade, diagnóstico, processo e alergias visíveis; dispensa orientada para o medicamento prescrito |
| Enfermagem | `PatientClinicalWorkspace.tsx` | Consulta das prescrições, validade, quantidade e estado da dispensa |
| Segurança da dispensa | `hospital.ts` | Transacção rejeita saída de lote cujo nome normalizado não coincida com o medicamento prescrito |

Essas funcionalidades têm código real, não apenas desenhos. Não foram verificadas com dispositivos físicos ou uma sessão real multiutilizador na produção.

## Regressões detectadas na versão enviada e recuperadas

| Pedido da conversa “Ajuda com GitHub” | Problema no ZIP enviado | Estado desta consolidação |
|---|---|---|
| Histórico/PDF disponível durante revisão técnica | Versões em revisão voltavam a ser ocultadas; a exportação interna era recusada | **Recuperado.** Profissional autorizado consulta e imprime cópia **EM REVISÃO — DOCUMENTO PROVISÓRIO**; paciente/portal só vê final validado |
| Facturação e Farmácia/POS: erro ao consultar a base | Faltavam o diagnóstico de migrações e ficheiros correctivos existentes na versão anterior | **Recuperado o código e migrações.** Necessária aplicação das migrações pendentes na Neon de destino; não equivale a produção já corrigida |
| Conta corrente com erros graves | Regressão no formulário, validação, idempotência e fuga de conversão monetária | **Recuperado.** Validação de valores/datas, lançamentos auditados, confirmação antes de apagar, cálculos em cêntimos e extracção escapada |
| Honorários iguais a folha de salários | `Honorarios.tsx` reapareceu no Financeiro | **Unificado.** Remunerações em Serviços hospitalares → Recursos Humanos; dados legados continuam acessíveis sem duplicar contas |
| Salários duplicados na Administração | `Salarios.tsx` reapareceu | **Removida a entrada duplicada.** A folha de RH permanece |
| Preservar a estrutura original dos passes | Modelos anteriores desapareceram do ZIP enviado | **Recuperados.** Criador com 80 modelos, frente/verso, cores, QR, código de barras, CSV, PDF e PNG |
| Assinaturas de Dr./Dra. Clínico(a) e Chefe de Enfermagem | Rota, interface e migração de assinaturas ausentes | **Recuperadas.** Atribuição a profissional activo, credencial verificada, gravação e autoria conservada nos documentos |
| Número de amostra/processo por empresa | Os ficheiros anteriores de numeração já estavam presentes em ambos os pacotes | **Mantido.** Prefixos de empresa e numeração sequencial; validar exemplos em instituição de teste |

## O que foi verificado nesta consolidação

- Instalação de dependências com `pnpm install --frozen-lockfile` concluída.
- `pnpm test`: **199 testes aprovados, zero falhas**, com base local de ensaio e dados fictícios. Inclui testes de facturação, POS, consulta/revisão do Laboratório, assinaturas, conta corrente, RH, segurança e quatro cenários novos de fila médica/odontograma.
- `pnpm build`: verificação TypeScript, compilação da API e compilação do frontend aprovadas. Há avisos de tamanho de alguns ficheiros JS compilados, sem impedir o build.
- **Não foram efectuadas escritas na base Neon real, nem publicação no GitHub/Netlify.** A existência de código/migração não prova a conclusão do deploy.

## Limites que continuam importantes

1. Executar primeiro `pnpm db:status` no ambiente da **API**. Aplicar migrações com `DATABASE_URL_UNPOOLED` numa branch Neon de teste antes de produção. A última migração deste pacote é `20261105_fluxos_financeiros_assinaturas.sql`.
2. Confirmar com utilizadores reais de teste: recepção → triagem → consulta → prescrição → dispensa → registo de Enfermagem. A associação é feita por ID central, nunca por semelhança do nome.
3. O mecanismo actual de compatibilidade medicamento–lote compara o nome normalizado. Substituições genéricas/nomes comerciais exigem validação farmacêutica e uma tabela aprovada de equivalências antes de automatizar.
4. A versão do odontograma fica no estado clínico existente. Para integração formal com imagem dentária, radiologia e procedimentos codificados será preciso desenho de dados e validação clínica adicionais.
5. Rever permissões no ambiente da clínica, impressão de PDF/etiquetas e modelos de passes numa impressora real.
6. Fiscalidade: geração de dossier/ambiente de formação não significa homologação pela AGT. O modo de produção fiscal mantém o bloqueio previsto no projecto.
7. O instalador é deliberadamente conservador: **não sobrepõe ficheiros locais de conteúdo desconhecido**. Usar `--check` antes de actualizar e manter uma branch de cópia.

## Como instalar

Ver o `LEIA_PRIMEIRO.md` na raiz deste pacote e `docs/ACTUALIZAR_NETLIFY.md`. O ZIP inclui o código completo da API e do frontend, migrações e instalador com simulação, backup e protecção contra conflitos. Não inclui credenciais, base de pacientes, dependências instaladas nem homologação.
