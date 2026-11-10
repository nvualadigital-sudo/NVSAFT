# Verificação da edição completa NV-ASSISTENTE

**Revisão:** `2026.11.05-netlify.10`.

- Empacotado o código completo do NV-DIGITAL com API, interface, migrações, testes e documentação.
- Conferido o instalador em modo simulação nas edições completas anteriores; o instalador compara hashes e pára quando encontra alterações desconhecidas.
- O NV-ASSISTENTE inclui o painel de esfera, sessão de voz do navegador, comandos locais e confirmação transaccional de mensagem à equipa.
- **Validação local:** `pnpm test`: 211 testes passaram, 0 falhas; `pnpm build`: verificação de TypeScript e compilação da API/frontend concluídas. Permanecem por fazer os ensaios manuais em browser com microfone autorizado/recusado e a implantação na instituição.
- `pnpm dev` mantém uma única porta local 3000 para interface e API; a Netlify utiliza uma API Node remota.
- Não foram executadas alterações em bases Neon de produção nem deploys externos. Não foi atribuída certificação AGT/MINSA, nem implementado WebRTC dedicado à IA.
