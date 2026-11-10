# Toques em ciclo e notificações gerais

Actualização para o NVUALASOFT_Integrado com o pacote de chamadas já instalado. Este ZIP não é o projecto completo. Preserve a pasta existente do software.

## Instalação

1. No Shell que executa o software, pressione Ctrl+C para parar essa execução.
2. Carregue NVUALASOFT_Notificacoes.zip como ficheiro para ~/workspace.
3. No Shell, execute:

```bash
cd ~/workspace/NVUALASOFT_Integrado &&
unzip -n ../NVUALASOFT_Notificacoes.zip &&
python3 NVUALASOFT_Notificacoes/instalar.py &&
node scripts/migrate-direct.mjs &&
pnpm dev
```

O bloco só avança se cada etapa tiver sucesso. Não execute outro pnpm dev se o anterior ainda estiver aberto. Se o ZIP estiver na pasta NVUALASOFT_Integrado, retire apenas ../ do comando unzip.

O instalador cria backups, actualiza os ficheiros indicados no manifesto e acrescenta a nova rota sem substituir todo o router. Não modifica App.tsx, menus ou botões flutuantes.

A migração nova 20261027_zzz_notificacoes.sql acrescenta leitura por utilizador e metadados de versão/data de emissão de resultados. Não copia medições para a tabela de notificações nem altera resultados clínicos. Um trigger regista mudanças de versão dos resultados emitidos, sem gerar mensagens fictícias. O comando de migração reutiliza a ligação directa do Neon, como nas actualizações anteriores.

## Som das chamadas

Na chamada real, o toque repete-se enquanto está a chamar ou a receber, com pausas como numa linha telefónica. O retorno para quem chama passou a ter dois segundos de tom num ciclo de cinco segundos. O toque termina quando a chamada é atendida, recusada, cancelada ou termina sem resposta. Não deve continuar por cima da conversa depois de atendida.

O botão antigo Testar toque era uma amostra curta. Nesta entrega passa a Testar toque (12 segundos), repetindo o toque ao longo desses 12 segundos; existe também Parar teste. Se chegar uma chamada durante o teste, o toque real assume o controlo e não é cortado pelo temporizador da amostra.

O navegador precisa de permissão para reproduzir som, o dispositivo não pode estar no silêncio e a aplicação deve continuar aberta. O software não pode ultrapassar suspensões do navegador pelo sistema operativo. O áudio da conversa continua a depender da ligação WebRTC e da configuração TURN nas redes que a exigem.

## Notificações gerais

O sino apresenta itens reais, isolados por empresa e função do utilizador:

- Resultado pronto: resultado com libertação registada no fluxo laboratorial.
- Resultado emitido: resultado com data de emissão e parâmetros preenchidos, sem presumir que houve libertação clínica pelo novo fluxo.
- Resultado crítico ainda sem confirmação de comunicação, apenas para funções clínicas autorizadas.
- Pedidos laboratoriais recentes ainda pendentes, para administração, gestão e técnicos.
- Tarefas atribuídas ao utilizador, respeitando permissões delegadas.
- Stock no mínimo, lote fora de validade ou validade próxima, para funções autorizadas de farmácia/gestão/finanças.
- Mensagens por ler em conversas acessíveis e chamadas não atendidas do próprio utilizador.

Os alertas de resultados não incluem o nome do paciente nem medições. Resultados sem associação válida a um paciente da instituição não entram na lista. As notificações de ambiente de trabalho usam texto genérico e não incluem dados clínicos.

As listagens consultam janelas e limites: até 100 resultados emitidos, 40 críticos, 30 pedidos dos últimos sete dias, 40 tarefas, 40 itens de stock, 30 mensagens dos últimos trinta dias e 20 chamadas dos últimos sete dias. É um centro operacional de alertas, não um arquivo integral de eventos.

Há contador de não lidas, filtros, marcação individual ou em conjunto e acesso ao módulo relacionado. A leitura fica na base de dados por utilizador. Uma nova versão de resultado emitido volta a aparecer como não lida. Ler um alerta não conclui a tarefa, não marca a mensagem do chat como lida e não confirma a comunicação de um resultado crítico.

O feed é partilhado entre os sinos do cabeçalho e da barra lateral para evitar alertas duplicados na mesma sessão. Consulta o servidor a cada cinco segundos e quando se regressa à janela. No primeiro carregamento, o histórico aparece no sino sem disparar uma sequência de sons antigos; só novos itens recebidos depois desse carregamento geram avisos. Alertas de stock podem voltar a aparecer quando o estado do lote ou a quantidade muda.

## Activar e testar

Depois do arranque, actualize a página com Ctrl+Shift+R.

- No sino geral, clique em Activar som e notificações. Permita as notificações se o navegador perguntar. Deve ouvir uma confirmação curta.
- Em Alertas, use Testar toque (12 segundos) e confirme vários ciclos, não apenas a primeira sequência.
- Faça uma chamada com dois utilizadores diferentes da mesma empresa e confirme que o toque se repete até atender. Depois de atendida, só deve ouvir o colega.
- Com o software aberto, emita/liberte um resultado de teste autorizado e confirme o sino na sessão de outro utilizador com a função adequada. O botão de leitura deve alterar o contador e continuar lido após voltar a entrar.
- Para verificar as notificações do sistema, deixe o software aberto e passe para outro separador. As permissões do navegador e do sistema operativo continuam a ser necessárias. Se o Preview embutido bloquear a permissão, abra o software num novo separador.

Os avisos gerais fazem um som curto, diferente do toque de chamada. Não interrompem sonoramente uma chamada em curso. As notificações não enviam e-mail, SMS ou mensagens a pacientes. Não há notificações push com o software fechado.

## Verificação

Consulte VERIFICACAO.txt. Os testes automáticos de som utilizam um contexto simulado e relógio controlado para verificar repetição por mais de dois segundos, paragem e temporizadores. O teste audível e de notificações no equipamento real permanece necessário.
