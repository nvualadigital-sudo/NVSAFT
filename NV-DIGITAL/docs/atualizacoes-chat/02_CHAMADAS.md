# Chamadas e comunicação — actualização do NVUALASOFT

Este é um complemento para o projecto NVUALASOFT_Integrado onde o chat já está a funcionar. Não é o projecto completo. Extraia para dentro da pasta existente: não apague nem substitua a pasta do projecto.

## Instalar no Replit

1. No Shell que está a executar o software, pressione Ctrl+C para parar essa execução.
2. Coloque o ZIP em ~/workspace. No Shell execute:

```bash
cd ~/workspace/NVUALASOFT_Integrado
unzip -n ../NVUALASOFT_Chamadas.zip
python3 NVUALASOFT_Chamadas/instalar.py
node scripts/migrate-direct.mjs
pnpm dev
```

Execute um comando de cada vez e pare se algum falhar. Se o ZIP estiver noutra pasta, ajuste apenas o caminho do unzip. Não inicie uma segunda execução de pnpm dev.

O instalador confirma que está no projecto correcto, verifica o conteúdo do pacote, cria cópias dos ficheiros anteriores em backups/chat_chamadas_DATA_HORA e acrescenta a montagem do serviço ao seu App.tsx e as rotas ao router existente. Os restantes módulos permanecem no lugar. Nenhum dado da base de dados é apagado pelo instalador.

O novo scripts/migrate-direct.mjs executa o mecanismo de migrações existente. Usa DATABASE_URL_UNPOOLED, se configurada; para o Neon, pode obter temporariamente a ligação directa a partir de DATABASE_URL, tal como o comando que já utilizou. O endereço e a palavra-passe não são impressos. DATABASE_URL não é alterada. Se ambas as ligações apontarem para bases diferentes, o comando pára para não migrar a base errada.

A migração 20261027_zz_chat_chamadas_social.sql acrescenta tabelas; não altera o histórico de mensagens existente. Esta entrega depende da migração anterior 20261027_z_chat_persistente.sql, já aplicada no seu projecto.

## O que fica ligado

- Chamadas individuais de voz ou vídeo entre utilizadores activos da mesma empresa.
- Convite, atender, recusar, cancelar e terminar. Uma chamada sem resposta expira em 60 segundos.
- Aviso visual de chamada recebida em qualquer módulo, enquanto a aplicação estiver aberta e o utilizador tiver acesso ao chat.
- Microfone, câmara, reprodução remota, controlos de silêncio/câmara e duração a partir da ligação WebRTC efectiva.
- Histórico de chamadas no servidor. O estado «aceite» regista o atendimento; não comprova por si só que o áudio foi ouvido.
- Sinalização autenticada de oferta, resposta e candidatos ICE. O servidor consulta a base de dados, com actualização a cada 1,5 segundos. Não depende de uma única instância de servidor ou de mensagens mantidas só em memória.
- Estados de texto visíveis na empresa durante 24 horas. A expiração retira-os da listagem; não é uma tarefa de eliminação física automática.
- Canais internos: todos os utilizadores da empresa podem consultar e aderir; apenas o criador publica no seu canal.
- Comunidades internas: adesão voluntária; apenas os membros consultam e publicam. São espaços de publicações, sem videoconferência de grupo.
- Eliminação das próprias publicações, protecção entre empresas e repetição segura dos pedidos de gravação.
- O botão de IA abre o assistente que o projecto já tinha. Para respostas reais, a instituição deve configurar AI_ASSISTANT_ENABLED=true e OPENAI_API_KEY no servidor. A chave nunca vai para o React; a autorização de processamento externo do assistente existente é preservada. Esta entrega não cria uma conta ou subscrição de IA.

## Chamadas dentro e fora da rede local

A sinalização é uma API HTTP no Replit; áudio/vídeo são transmitidos por WebRTC entre os equipamentos ou através de um relay TURN. Áudio e vídeo não são gravados na base de dados.

Sem STUN/TURN configurado, só são tentadas ligações directas. Estas podem funcionar em condições de rede compatíveis, mas não garantem comunicação entre redes distintas. Para uso fiável em Wi-Fi diferentes, dados móveis e redes com NAT/firewalls, configure um TURN acessível publicamente.

O pacote inclui um servidor Coturn em servidor-turn/compose.yml, para instalar numa VPS Linux com IP público e Docker. Não foi criado nem publicado um servidor externo na sua conta. Esse relay deve estar num host que exponha TCP/UDP; o endpoint HTTP do Replit não substitui um relay TURN.

Configuração no Replit, depois de instalar o relay:

```text
CHAT_STUN_URLS=stun:turn.seu-dominio.ao:3478
CHAT_TURN_URLS=turn:turn.seu-dominio.ao:3478?transport=udp,turn:turn.seu-dominio.ao:3478?transport=tcp
CHAT_TURN_SECRET=O_MESMO_SEGREDO_FORTE_CONFIGURADO_NO_COTURN
```

O backend emite credenciais TURN temporárias de duas horas. O segredo partilhado não é devolvido ao navegador. Use um segredo aleatório com pelo menos 32 caracteres. As credenciais temporárias são necessárias no cliente WebRTC.

A aplicação deve ser aberta por HTTPS num navegador compatível; autorize microfone e câmara quando solicitado. Se a pré-visualização embutida bloquear essas permissões, abra o software num novo separador. Em equipamentos onde a reprodução automática seja bloqueada, o botão «Activar som» permite a reprodução após uma acção do utilizador.

## Limites desta versão

Chamadas individuais apenas; não há salas de videoconferência, gravação de chamadas, notificações com a aplicação fechada, partilha de ecrã ou anexos nos estados/canais/comunidades. Use uma sessão activa por utilizador para atender chamadas; coordenação de atendimento simultâneo do mesmo utilizador em vários dispositivos não faz parte desta versão.

Uma chamada é apresentada como «Em chamada» apenas quando a ligação WebRTC comunica que conectou. A configuração TURN, as permissões e a transmissão efectiva devem ser confirmadas nos equipamentos reais. A aplicação aberta no navegador continua necessária para captar/reproduzir áudio e vídeo.

As ofertas e candidatos de ligação são dados temporários no servidor. Ao utilizar a API, sinais de chamadas terminadas há mais de cinco minutos são eliminados. O histórico de convites/atendimentos fica preservado. Não há tarefa de limpeza em segundo plano quando ninguém usa a API.

## Validação e teste na instituição

Consulte VERIFICACAO.txt para o resultado dos testes locais. Os testes verificam a API, base de dados, permissões e compilação. Não equivalem a uma chamada real entre dois equipamentos na sua rede.

1. Entre com dois utilizadores diferentes da mesma empresa, em dois equipamentos.
2. Abra o chat no primeiro e seleccione o colega. No segundo, pode permanecer noutro módulo.
3. Clique em chamada de voz e, no segundo, Atender. Autorize os microfones e confirme que ambos ouvem.
4. Termine, repita com vídeo e verifique as imagens remota e local. Teste Recusar e uma chamada não atendida.
5. Verifique o histórico em Chamadas e confirme que outro utilizador/empresa não o consegue consultar.
6. Teste uma rede diferente, depois de configurar TURN. Se a chamada ficar em «A ligar», verifique os endereços, segredo e portas do relay.
7. Publique um estado, crie um canal e uma comunidade e confirme as permissões com o segundo utilizador.

## Referências técnicas

- WebRTC — ligações e sinalização: https://webrtc.org/getting-started/peer-connections
- MDN — sinalização e vídeo: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling
- Coturn — imagem e portas: https://github.com/coturn/coturn/blob/master/docker/coturn/README.md
- Coturn — autenticação com segredo: https://github.com/coturn/coturn/blob/master/docker/coturn/turnserver.conf
