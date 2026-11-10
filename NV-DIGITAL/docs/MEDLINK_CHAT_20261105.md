# Chat e MedLink — actualização 05/11/2026

Versão do código: `2026.11.05-netlify.8`.

## Chat da instituição

- Conserva as mensagens, grupos, ficheiros, respostas, pesquisa, notificações e chamadas internas existentes.
- Mensagens apresentadas na sequência cronológica de envio (data/hora e identificador para desempate). A ordenação aplica-se quando a conversa é carregada; os dados de origem permanecem imutáveis.
- Cabeçalhos e notificações deixam de identificar a aplicação como «LAICISA». O nome da instituição actualmente autenticada aparece quando disponível; de outro modo aparece «NV-DIGITAL».
- Apresentação com cores institucionais verde-petróleo, cabeçalhos mais leves, cartões e cantos arredondados. As funções antigas continuam no mesmo componente.
- O painel das chamadas internas mantém voz/vídeo WebRTC e o toque contínuo já existente, com apresentação ajustada ao tema.

## MedLink — colaboração entre instituições

- O parceiro é escolhido no directório de empresas activas. Um pedido relaciona **exactamente uma instituição de origem e uma instituição destinatária**.
- Um utilizador autorizado escolhe paciente da sua instituição, tipo de pedido (`exame`, `consulta`, `partilha`), assunto, informação clínica mínima e fundamento para a comunicação. A interface exige confirmação da autorização, e a API valida o paciente/empresa e perfis de acesso.
- Os pedidos de **exames** e **consultas** começam em `pendente`. O destino pode `aceite`/`recusado`, avançar para `em_execucao` e `concluido`. A origem pode cancelar um pedido em curso. A alteração tem registo de auditoria.
- Ambos os intervenientes, quando autorizados, podem enviar mensagens de texto na conversa específica de um pedido, ordenadas cronologicamente. A recuperação de mensagens mostra as últimas 200, mas em ordem de envio. O envio possui identificador de repetição para evitar duplicados acidentais.
- Apenas `admin`, `gestor` e `medico` têm acesso à partilha de dados e mensagens clínicas. O isolamento das conversas entre empresas é validado na API; não é feito por filtros da interface.
- Revogar o acesso impede novas leituras e mensagens ao parceiro; os eventos continuam no histórico de auditoria.
- O novo esquema SQL é `migrations/20261105_medlink_pedidos_mensagens.sql`. Foi exercitado em Postgres local de teste. **Não foi aplicado automaticamente à Neon de produção.**

## O que não deve ser confundido com funcionalidade já publicada

1. As mensagens MedLink são **mensagens internas do software**, não SMS enviados através de operadora móvel. SMS telefónico exigiria um fornecedor e consentimento/configuração próprios.
2. As chamadas WebRTC do Chat continuam a funcionar **dentro da mesma empresa**. A conversa MedLink entre empresas **ainda não tem chamadas de voz/vídeo**; serão necessárias sinalização institucional dedicada, escolha/autorização do destinatário, notificações e testes reais de ICE/TURN, sem abrir contactos globais entre todas as instituições.
3. Os pedidos de exames/consultas têm registo, mensagens e estados, mas **não criam automaticamente** uma marcação/solicitação no laboratório ou agenda do parceiro. Isso exigirá concordância do parceiro e vinculação institucional dos episódios.
4. Não há interoperabilidade FHIR/IHE certificada nem transferência automática de ficha clínica integral. A partilha é deliberada e limitada ao texto do pedido.
5. Esta edição não publicou o código no Netlify, não reiniciou a API e não executou migrações numa base remota.

## Fluxo de validação no ambiente de ensaio

1. Criar branch/backup na Neon; configurar a API de teste para apontar a essa branch.
2. Aplicar `pnpm db:migrate` e confirmar `pnpm db:status` sem migrações pendentes.
3. Autenticar como médico da empresa A e criar pedido de exame para B, usando paciente **fictício** da empresa A e fundamento registado.
4. Em sessão separada como médico da empresa B, abrir *Recebidos*, aceitar pedido e responder na conversa. Verificar as mensagens em ordem e marcar o estado `em_execucao` / `concluido`.
5. Com empresa C e perfil não clínico, conferir recusa de acesso ao pedido e a todas as mensagens.
6. Revogar a partilha em A, verificar que B deixa de receber o conteúdo. Verificar logs de auditoria em A/B.
7. Conferir o Chat interno antes e depois, incluindo envio, histórico, som, notificações, aceitar/terminar chamadas e segurança da mesma empresa.

**Segurança operacional:** não use pacientes reais na branch de ensaio sem autorização e protecção de dados. Não divulgue `DATABASE_URL`, sessões nem credenciais no Netlify ou no ZIP.
