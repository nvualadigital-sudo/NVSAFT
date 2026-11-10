> Registo da consolidação anterior. A validação desta revisão está em [VALIDACAO_ATUALIZACAO_20261028.md](VALIDACAO_ATUALIZACAO_20261028.md): 125 testes de API/domínio, compilação, oito cenários de interface e nove cenários de instalação/restauro.

# Verificação da entrega consolidada — 28/10/2026

## Executado nesta entrega

- Instalação limpa: lockfile congelado, seis workspaces da aplicação/validação, 457 pacotes, sem o gerador opcional `orval`. Node.js 24.22.1 e pnpm 11.25.0. Scripts permitidos de bcrypt/esbuild e políticas de dependências concluídos.
- `pnpm test` na instalação limpa: **66 testes, 66 aprovados, zero falhas, cancelamentos ou testes ignorados**. PGlite/Supertest com dados fictícios e sessões locais, sem consulta a produção.
- `pnpm build` na instalação limpa: TypeScript, API e interface concluídos. Vite 7.3.5, 2569 módulos. Persistem avisos de sourcemap Radix sem impedir a compilação.
- Migrações: instalação vazia, repetição com preservação de dados, recusa de hash alterado e rollback em falha. Os SQL dos pacotes recebidos mantêm os seus bytes/hashes.
- Chat: autenticação, isolamento institucional, acesso a conversas/grupos/anexos, autoria e alterações de mensagens na API.
- Chamadas/social: participantes, sinalização, transições, expiração, credenciais temporárias TURN e restrições de canais/estados/comunidades na API. Som com contexto/relógio controlados: repetição, paragem e amostra de 12 segundos.
- Notificações: leitura por utilizador, isolamento, funções, ausência de conteúdo clínico e independência da confirmação de críticos. Correcção manual pendente não aparece pronta; após nova libertação reaparece não lida.
- Laboratório: arquivo original de legados, correcção com motivo, concorrência/repetição, paciente fixo, pedido externo, permissões e revisão/libertação independentes. Exportação recusa versão actual pendente.
- Biblioteca: metadados, pastas/etiquetas/favoritos, concorrência, upload idempotente, cópia/movimento, ciclos, recuperação preservando a lixeira anterior, quota e acesso institucional.
- React em DOM controlado: Shell nos quatro menus, chamada recebida fora do chat, recusa, prioridade sonora, definição do teste de 12 segundos, botões flutuantes, cores, agente e preferências institucionais; laboratório/biblioteca com fixtures para interacções e falhas.

Logs em `evidencias/entrega_20261028`. Os ensaios DOM usam API simulada; não representam uma sessão de navegador com o banco real.

## Não executado nesta entrega

- Publicação no Replit ou novas migrações no Neon; o estado actual da produção não foi consultado.
- Chamada audível de voz/vídeo entre equipamentos, eco/latência, microfone/câmara reais, notificações do sistema operativo ou provisionamento de TURN.
- Ensaio físico de impressoras, etiquetas, leitores, analisadores ou equipamentos clínicos.
- Homologação com profissionais, checklist oficial MINSA/AGT, auditoria independente, carga, MFA/SSO, assinatura qualificada ou integrações bancárias/HL7/FHIR/PACS.
- Restauro integral do banco hospitalar ou RTO/RPO no alojamento. O teste de cifragem não o substitui.
- Chamada real ao fornecedor de IA; assistente desligado sem configuração/aprovação institucional.

O relatório anterior está em `legado/entrega_20261027/VERIFICACAO.md`. Os seus números/afirmações históricos não são uma nova verificação da produção.
