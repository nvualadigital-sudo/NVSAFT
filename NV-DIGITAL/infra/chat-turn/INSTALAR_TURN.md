# Servidor de relay TURN — VPS Linux

Este componente é separado da API HTTP do Replit. Exige uma VPS Linux sua, com Docker Compose e um IP público. Não existe um relay publicado por esta entrega.

1. Copie compose.yml e EXEMPLO_ENV.txt para uma pasta da VPS.
2. Crie .env com TURN_PUBLIC_IP, TURN_REALM e TURN_SECRET reais. TURN_REALM pode ser o domínio turn da instituição. O DNS desse domínio deve apontar para o IP público desta VPS.
3. Gere um segredo aleatório, por exemplo com `openssl rand -hex 32`, e coloque o mesmo valor em TURN_SECRET da VPS e CHAT_TURN_SECRET dos Secrets do Replit. Não publique o segredo.
4. Proteja .env com `chmod 600 .env` e inicie com `docker compose up -d`.
5. No firewall da VPS e do fornecedor, permita TCP e UDP 3478 e UDP 49160–49200. O host usa network_mode: host, pelo que as portas não são publicadas pelo Docker: devem ser acessíveis no host.
6. Confirme o arranque com `docker compose logs --tail=50` e configure CHAT_TURN_URLS/CHAT_STUN_URLS no Replit conforme o LEIA_PRIMEIRO.

Se a VPS estiver atrás de NAT, configure correctamente o mapeamento de IP público/privado do Coturn; o exemplo destina-se a um host cujo IP público seja directamente encaminhado. Para redes que só permitem tráfego TLS na porta 443, configure também um listener TURN com TLS, domínio e certificado válidos, e utilize uma URL turns: correspondente. Esse listener TLS não está configurado neste exemplo.

O exemplo usa TURN por TCP/UDP 3478 e credenciais temporárias HMAC. As portas TLS/DTLS do próprio relay estão desactivadas no compose base; os fluxos de áudio/vídeo WebRTC mantêm a encriptação DTLS-SRTP. Não existe gravação de áudio/vídeo neste servidor.

A gama de portas e as quotas do exemplo devem ser dimensionadas para o número de chamadas da instituição. O segredo está no ambiente da VPS e nos Secrets do backend. O navegador recebe apenas credenciais temporárias com validade de duas horas.
