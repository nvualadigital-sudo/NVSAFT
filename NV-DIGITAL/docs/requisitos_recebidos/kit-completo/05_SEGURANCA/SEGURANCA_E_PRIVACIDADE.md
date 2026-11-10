# Segurança, privacidade e integridade clínica

## Identidade e acesso
- Contas individuais; nunca contas partilhadas.
- Armazenamento de credenciais através de mecanismo seguro existente; nunca palavras-passe em texto simples.
- Autorização no servidor por função, ação, unidade, contexto e relação com o episódio quando aplicável.
- Administrador técnico sem acesso clínico automático.
- Revogação de sessões e acessos quando uma conta é suspensa ou o vínculo termina.
- Acesso de emergência, se aprovado, limitado, justificado, auditado e revisto.

## Dados clínicos
- Minimização de dados; só aceder ao necessário para a função.
- Não incluir informação clínica em URLs, logs, alertas externos ou dados de teste.
- Registos assinados preservam autoria e histórico; correções por adenda/versão.
- Resultados laboratoriais preservam estado, validação, versão e motivo de correção.
- Exportações e impressões protegidas por permissão e auditadas.
- Dados reais apenas em ambientes autorizados, com medidas de proteção aprovadas.

## Aplicação e infraestrutura
- Validar e normalizar entradas no servidor.
- Mitigar riscos de injeção, XSS, CSRF, controlo de acesso quebrado, upload malicioso, sessão e exposição de segredos.
- Segredos apenas em mecanismos de configuração protegidos; `.env.example` sem valores reais.
- Limites de upload, validação de conteúdo e armazenamento privado.
- Backups protegidos e testes de restauração documentados.
- Migrações e mudanças de dados com plano de reversão.
- Dependências e bibliotecas revistas antes de atualizações relevantes.

## IA, voz e chat
- O agente herda os direitos do utilizador autenticado e não pode contornar permissões.
- Consentimento/permissão explícita do microfone; indicador de escuta e controlo para parar.
- Não gravar continuamente em segundo plano.
- Rever transcrição antes de ações; confirmar operações sensíveis.
- Não executar autonomamente ações clínicas, transfusões, alta, prescrições, validações, pagamentos ou eliminações irreversíveis.
- Não enviar dados sensíveis a fornecedores externos sem avaliação, autorização e configuração adequadas.
- Chat não substitui documentação clínica oficial.

## Governança
- Confirmar políticas legais e institucionais aplicáveis com responsáveis qualificados.
- Registar acessos sensíveis e alterações críticas com proteção contra adulteração.
- Definir retenção, acesso, incidentes, restauração e resposta a violações.
- Não alegar conformidade legal ou certificação sem avaliação formal.
