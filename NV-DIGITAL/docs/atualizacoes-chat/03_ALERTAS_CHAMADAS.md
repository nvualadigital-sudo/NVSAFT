# Chamadas: som, notificações e interface

Actualização da interface para o NVUALASOFT_Integrado com o pacote de chamadas anterior já instalado. Não é o projecto completo.

## Instalar

Carregue o ZIP como ficheiro dentro de ~/workspace/NVUALASOFT_Integrado. Termine chamadas que estejam em curso antes de aplicar a actualização.

Num Shell adicional, execute:

```bash
cd ~/workspace/NVUALASOFT_Integrado &&
unzip -n NVUALASOFT_Alertas_Chamadas.zip &&
python3 NVUALASOFT_Alertas_Chamadas/instalar.py
```

Mantenha a execução actual do software; não execute outro pnpm dev. Esta actualização altera somente ficheiros da interface e testes. Não há migração nova. O instalador guarda cópias anteriores em backups/alertas_chamadas_DATA_HORA.

Actualize o software com Ctrl+Shift+R. No canto inferior direito, procure Alertas. Clique em Activar alertas e depois Testar toque. Permita as notificações quando o navegador perguntar. Se estiver a usar o Preview embutido do Replit e a permissão não funcionar, abra o software num novo separador e repita a activação.

## Novidades

- Ecrã de chamada recebido/efectuada, com nome do colega, iniciais, animação de toque, indicação do estado e controlos maiores.
- Botões para atender, recusar, terminar, controlar microfone/câmara e minimizar/expandir.
- A minimização mantém os elementos de media montados; não termina a chamada nem desliga o áudio.
- Toque próprio de chamada recebida e som de retorno de chamada para quem está a chamar.
- Volume do toque e opção de o silenciar, separados do controlo do microfone.
- O toque pára durante o atendimento, recusa, cancelamento e fim da chamada. Pára também quando o servidor comunica que a chamada já não está a tocar.
- Aviso para activar o som quando o navegador está a bloquear a reprodução.
- Notificações do sistema para chamadas recebidas quando o separador está em segundo plano ou sem foco, se houver permissão e suporte. No primeiro plano, o ecrã da chamada é o aviso visual.
- A notificação usa uma identificação por chamada para não ser repetida a cada consulta ao servidor; ao atender/terminar, a notificação é fechada.
- O título do separador indica que há uma chamada recebida em segundo plano.
- Avisos de erro/resultado fora de uma chamada passam a ser compactos, em vez de bloquear todo o ecrã.
- Os sons são sintetizados localmente com Web Audio, sem ficheiros externos.

## Regras do navegador

O som pode exigir um clique do utilizador antes da primeira chamada. A aplicação tenta desbloquear o áudio na primeira interacção e disponibiliza sempre o controlo explícito de activação. O software não pode ultrapassar o silêncio do dispositivo, as definições de Não incomodar ou bloqueios do navegador.

A permissão de notificações só é pedida quando clica em Activar alertas. Se já a bloqueou, altere a permissão deste site no navegador. Alguns navegadores móveis não suportam notificações criadas pela página; nesses casos, o aviso dentro do software continua disponível.

O software tem de permanecer aberto. Não há notificações push quando a aplicação está fechada, nem garantia de execução em segundo plano se o sistema operativo suspender o navegador. Esta entrega não inclui service worker de notificações push.

A activação do áudio e as escolhas de volume/silêncio valem para esta sessão da aplicação; uma actualização da página pode exigir nova activação. As mensagens e o histórico continuam na base de dados.

O áudio da conversa utiliza WebRTC e é independente do toque. A configuração TURN do pacote anterior continua a ser necessária nas redes que não permitem ligação directa. Activar o toque não resolve uma falha de transmissão do áudio remoto.

## Teste recomendado

1. Em dois equipamentos, entre com dois utilizadores diferentes da mesma empresa.
2. Nos dois, abra Alertas, active os alertas, permita notificações e teste o toque. Confirme que os dispositivos não estão no silêncio.
3. No segundo equipamento, deixe o software aberto e passe para outro separador.
4. No primeiro, inicie uma chamada. Verifique o som de retorno e a interface.
5. No segundo, verifique a notificação e o toque de chamada recebida. Atenda e confirme que os toques param e que se ouvem mutuamente.
6. Teste recusar, cancelar, minimizar e o volume do toque. Uma notificação não deve ser repetida a cada segundo.

A validação automática cobre os estados do gerador de áudio, a limpeza dos osciladores, volume, falha de permissão, TypeScript, compilação e regressão da API. É necessário confirmar a reprodução audível e as notificações no navegador/equipamentos reais; os testes com áudio simulado não certificam a saída física do som.

Referências:
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static
