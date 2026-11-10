# Matriz inicial de profissionais, funções e permissões

**Esta é uma matriz-base para discussão e implementação, não uma autorização clínica automática.** Deve ser validada pela direção clínica, administração, responsáveis de laboratório/farmácia, segurança e responsáveis legais da instituição. Aplicar menor privilégio e permissões por unidade/contexto.

## Ações
- **V**: consultar/ver.
- **C**: criar/registar.
- **E**: editar antes de assinar/fechar, quando permitido.
- **VAL**: validar/assinar resultado ou registo dentro da competência.
- **APR**: aprovar uma operação.
- **EXP**: exportar/imprimir.
- **ADM**: administrar configuração/permissões.
- **—**: negar por defeito; conceder exceção apenas com justificação formal.

Legenda abreviada de perfis: MED=médico; ENF=enfermagem; LAB=técnico de laboratório; RL=responsável de laboratório; FAR=farmacêutico; IMG=técnico de imagiologia; REC=receção; FIN=faturação/caixa; RH=recursos humanos; DIR=gestão/direção; DCL=direção clínica; SYS=administração técnica; AUD=auditor autorizado.

## Matriz indicativa por área
| Área | MED | ENF | LAB | RL | FAR | IMG | REC | FIN | RH | DIR | DCL | SYS | AUD |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cadastro administrativo de pacientes | V/C/E* | V/C/E* | V mínimo | V mínimo | V mínimo | V mínimo | V/C/E | V mínimo | — | V agregado | V conforme função | — por defeito | V auditado |
| Processo clínico / notas médicas | V/C/E/VAL* | V/C/E* limitado | — | — | — | — | — | — | — | — por defeito | V/VAL* | — por defeito | V auditado* |
| Registos de enfermagem | V conforme cuidado | V/C/E/VAL* | — | — | — | — | — | — | — | — por defeito | V/VAL* | — por defeito | V auditado* |
| Pedidos de exames | V/C | V/C conforme protocolo | — | V | — | — | — | — | — | V agregado | V conforme função | — | V auditado |
| Laboratório: amostras e processamento | V resultados autorizados | V limitado | V/C/E* | V/C/E/VAL* | — | — | — | — | — | V agregado | V conforme função | — | V auditado* |
| Laboratório: validar resultados | —/conforme competência | — | VAL se autorizado | VAL | — | — | — | — | — | — | V/VAL conforme credencial | — | V auditado |
| Hemoterapia / transfusão | Conforme competência | Conforme competência | V/C/E conforme setor | VAL conforme credencial | — | — | — | — | — | — | Supervisão autorizada | — | V auditado* |
| Farmácia e dispensa | Prescrever/ver | Administração conforme competência | — | — | V/C/E/VAL* | — | — | — | — | V agregado | V conforme função | — | V auditado |
| Imagiologia | Pedir/ver relatório | V conforme cuidado | — | — | — | V/C/E/VAL conforme competência | — | — | — | V agregado | V conforme função | — | V auditado |
| Agendamento | V/C/E próprios | V/C/E conforme função | — | — | — | — | V/C/E | — | — | V agregado | V agregado | — | V auditado |
| Internamento/leitos | V/C/E conforme cuidado | V/C/E conforme cuidado | — | — | — | — | V/C/E administrativo limitado | — | — | V agregado | V/VAL conforme função | — | V auditado |
| Faturação e caixa | V limitado | — | — | — | V conforme dispensa | — | V/C limitado | V/C/E/VAL/APR* | — | V/APR conforme função | — | — por defeito | V auditado |
| Stock e compras | — | Requisição limitada | Requisição laboratório | V conforme setor | V/C/E conforme setor | Requisição limitada | — | V/C/E/APR* | — | V/APR | — | — por defeito | V auditado |
| RH e escalas | V próprio | V próprio | V próprio | V próprio | V próprio | V próprio | — | — | V/C/E/VAL* | V/APR conforme função | — | — | V auditado* |
| Relatórios operacionais | V limitado | V limitado | V setor | V setor | V setor | V setor | V administrativo | V financeiro | V RH | V agregado | V clínico autorizado | — | V auditado |
| Utilizadores e permissões | — | — | — | — | — | — | — | — | V limitado | Aprovação conforme política | — | ADM técnico sem acesso clínico automático | Auditoria apenas |
| Configuração do sistema | — | — | — | — | — | — | — | — | — | Configuração funcional delegada | Configuração clínica delegada | ADM técnica | V auditado |
| Exportação de dados | Exceção justificada | Exceção justificada | Setor autorizado | Setor autorizado | Setor autorizado | Setor autorizado | Dados administrativos mínimos | Dados financeiros autorizados | Dados RH autorizados | Agregados | Clínica autorizada | Não automático | Exportação auditada |

`*` significa condicionado a contexto, competência, unidade, estado do registo e política institucional. A matriz final deve ser mais granular do que esta tabela indicativa.

## Regras obrigatórias
1. A autorização deve ser verificada no servidor em cada chamada, não apenas na interface.
2. Utilizadores são individuais; não usar contas partilhadas.
3. Administrador técnico não ganha automaticamente acesso a conteúdo clínico.
4. O profissional só vê pacientes e episódios autorizados pelo seu contexto, função e relação de cuidado, conforme política institucional.
5. Registos assinados não podem ser editados silenciosamente; usar adenda/retificação com autoria e motivo.
6. Separar quem solicita, executa e aprova em operações financeiras e de risco elevado quando a política exigir.
7. A concessão e revogação de permissões deve ser auditada; acessos temporários devem expirar automaticamente.
8. Suspender conta deve bloquear novas sessões e revogar sessões ativas conforme o sistema.
9. Exportações, impressões e consultas sensíveis devem gerar eventos de auditoria proporcionais.
10. O acesso de emergência (“break glass”), se aprovado pela instituição, deve exigir motivo, ser limitado, gerar alerta e ser revisto.
11. Nunca usar apenas o cargo para conceder acesso irrestrito; combinar função, ação, unidade e contexto.
12. Os nomes dos cargos e o âmbito profissional têm de corresponder à realidade e às credenciais verificadas da instituição.
