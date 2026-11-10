# Segurança e privacidade — implementação e operação

## Medidas no código

- JWT HS256 com chave configurada, validade de 12 horas, sessão guardada/revogável no banco e estado activo da conta/empresa conferido.
- Token no sessionStorage da aba; sessão visual termina após 15 minutos de inactividade, com aviso. Logout revoga a sessão.
- Âmbito institucional imposto no servidor, referências compostas onde aplicável e testes de acesso entre empresas.
- Credenciais profissionais e competências temporárias verificadas para validação laboratorial; suspensão revoga sessões e autorizações.
- Biblioteca e anexos privados; tipo/tamanho/conteúdo verificados; descarga como attachment e nosniff. Biblioteca: 10 MB/ficheiro e 500 MB/empresa. Chat: 5 MB/anexo.
- Resultados publicados imutáveis por endpoints antigos. Rectificação versionada, autoria e aprovação independente no circuito novo.
- Auditoria de acesso/alterações nos novos fluxos, cadeia SHA-256 canónica e verificação de consistência. Auditoria anterior permanece em hospital_audit; não foi inventado um histórico retroactivo.
- Ficheiros de backup cifrados com AES-256-GCM e chave separada; restauro de ensaio recusa a origem e um destino com tabelas.
- HTTP headers, limites de login, validação de entrada, erros sem mensagens do fornecedor de IA/segredos e sem cache clínico offline partilhado.
- Dados de recepção/finanças minimizados; notas médicas não são enviadas à função financeira; farmácia não recebe documentos e notas de consulta no workspace geral.

## Responsabilidades ainda necessárias no alojamento

TLS, disco/base cifrados, contas individuais, segredos fortes, MFA para privilégios, controlo de administradores do banco, auditoria externa protegida, antivírus de uploads, actualizações, monitorização, restauro completo, continuidade e resposta a incidentes. A cadeia no mesmo banco não impede que um administrador com controlo total reescreva tudo; guardar checkpoints fora do banco com acesso separado.

Backups contêm dados e credenciais de acesso armazenadas no banco. Nunca incluir cópias, chaves, ligações de produção, fotografias clínicas ou dados identificáveis em ZIPs de código. Não remover arquivos locais de navegadores antigos antes de exportar e reconciliar dados que só existam nesses dispositivos.

## Normas institucionais

Os prazos de retenção, critérios laboratoriais, regras de transfusão, escalas/protocolos de triagem, credenciamento, exportação e partilha devem ser aprovados pelos responsáveis competentes. Não foi atribuída certificação legal, clínica, fiscal, de cibersegurança ou de interoperabilidade.

A IA está desligada por defeito. Texto/documentos só podem seguir ao fornecedor após aprovação institucional e confirmação explícita por pedido. Não são carregados pacientes automaticamente no assistente. O serviço de voz do navegador pode recorrer a processamento externo e informa o utilizador antes da escuta.

## Credencial encontrada no material antigo

Foi retirado gerar-schema.js: não era referenciado pelos manifests e continha uma ligação de base de dados com credenciais como fallback. Não se copiou essa ligação para a entrega. A credencial que constava no material antigo deve ser alterada no Neon e actualizada nos Secrets do alojamento; remover o script não revoga a credencial. Não foi efectuada rotação automática que pudesse interromper o sistema em execução.
