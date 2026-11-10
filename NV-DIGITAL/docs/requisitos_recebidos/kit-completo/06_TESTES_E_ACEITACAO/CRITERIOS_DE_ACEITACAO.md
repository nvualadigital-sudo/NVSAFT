# Critérios de aceitação e plano de testes

## Antes de desenvolver
- [ ] Inventário da stack e árvore real do projeto.
- [ ] Forma de executar/testar verificada nos ficheiros existentes.
- [ ] Estado de cada módulo documentado com caminhos/evidências.
- [ ] Autenticação, autorização e base de dados atuais mapeadas.
- [ ] Ponto de restauro/branch/backup confirmado.
- [ ] Candidatos a limpeza documentados sem remoção prematura.

## Funcionalidade e dados
- [ ] Nenhuma demo ou dado fictício apresentado como real.
- [ ] Operações ligadas a backend/API e persistência reais.
- [ ] Validações no servidor e erros claros.
- [ ] Relações entre paciente, episódio, pedido, amostra, resultado, prescrição, dispensa, leito e pagamento consistentes.
- [ ] Registos assinados não podem ser alterados silenciosamente.
- [ ] Fluxos de laboratório preservam rastreabilidade e versões.

## Permissões
- [ ] Matriz validada por responsáveis institucionais.
- [ ] Testes por perfil, ação, unidade e contexto.
- [ ] Acesso indevido negado no servidor.
- [ ] Revogação, suspensão e expiração testadas.
- [ ] Administração técnica não implica acesso clínico.
- [ ] Autoaprovação bloqueada nos fluxos que exigem segregação.
- [ ] Exportações e acessos sensíveis auditados.

## Agente e chat
- [ ] Modos de voz, escrita e fala identificados.
- [ ] Microfone só funciona após permissão e tem indicador/controlo de paragem.
- [ ] Transcrição pode ser revista.
- [ ] Agente não executa ações sensíveis autonomamente.
- [ ] Chat é separado e respeita permissões.
- [ ] Integrações inexistentes são identificadas como ausentes, não simuladas.

## Interface
- [ ] Menu lateral com submenus, estados ativos e adaptação móvel.
- [ ] Temas globais com preferência persistente pelo mecanismo existente.
- [ ] Botões legíveis, estados claros e confirmação para ações destrutivas.
- [ ] Teclado, foco visível, rótulos e leitores de ecrã verificados.
- [ ] Contraste e responsividade testados.
- [ ] Não copiar marca/logótipo da imagem de referência; usar NV.Digital.

## Limpeza
- [ ] Uso dinâmico, rotas, permissões, integrações, jobs e relatórios verificados.
- [ ] Código só removido com evidência, teste e plano de reversão.
- [ ] Eliminação de código separada de eliminação de dados.
- [ ] Testes executados depois de cada grupo de alterações.
- [ ] Alterações e falhas documentadas.

## Entrega
- [ ] Documentação reflete o código real.
- [ ] Comandos de execução baseados na stack real.
- [ ] Testes reportados honestamente.
- [ ] Nenhum segredo incluído no ZIP final.
- [ ] ZIP final corresponde ao projeto real modificado, não apenas a este kit.
