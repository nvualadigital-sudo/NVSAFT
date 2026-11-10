# NV.Digital — projecto integrado

Código completo do NVUALASOFT revisto a partir dos dois kits Julius Nyerere/CETEP e da imagem de referência. Mantém cadastro, atendimento clínico, enfermagem, farmácia, finanças, biblioteca, chat e MEDLIK no mesmo projecto, com dados persistidos no servidor e âmbito por instituição.

## Instalar

1. Preservar o código e os Secrets actuais. Importar este projecto no Replit, na raiz onde se encontra package.json.
2. Usar Node.js 24 e executar `pnpm install --frozen-lockfile`.
3. Configurar `DATABASE_URL`, `DATABASE_URL_UNPOOLED` directa para migrações, `SESSION_SECRET` forte (pelo menos 32 caracteres) e `ALLOWED_ORIGINS`. Os nomes estão em `.env.example`, sem valores reais. Nunca colocar segredos em variáveis VITE_.
4. Executar `pnpm db:migrate`. O banco Neon autorizado já recebeu as migrações anteriores e a de rastreabilidade. O bootstrap também suporta um banco vazio. Não restaurar dumps antigos nem usar schema push/force.
5. Executar `pnpm test` e `pnpm build`. Para desenvolver: `pnpm dev`. Para produção: `pnpm start`, com os Secrets e PORT configurados.
6. Entrar novamente; configurar serviços/sectores/credenciais em Administração → Instituição e acessos. Aprovar o catálogo real com outro profissional antes de usar o novo circuito laboratorial.

A migração do banco foi aplicada no Neon. A instalação/publicação do novo código no Replit não foi executada daqui. Ver [instruções completas](docs/INSTALACAO_E_EXECUCAO.md).

## Organização

- `artifacts/lab-results/src/pages`: recepcao, laboratorio, medicos, enfermagem, farmacia, financas, admin, gestao e comunicacao.
- `artifacts/api-server/src`: API autenticada, regras, transacções e autorização.
- `lib`: schema/ligação PostgreSQL, contratos e clientes partilhados.
- `migrations`: SQL versionado, incluindo instalação vazia.
- `tests`: testes HTTP, segurança, migração, backup, importação e cálculo financeiro.
- `docs`: comparação dos ZIP, estado por requisito, arquitectura, permissões, instalação, backup, migrações e aceitação.

## Novos percursos

Pedido laboratorial → recipiente → identificação/colheita → impressão/leitura da etiqueta → transporte/recepção → aceitação/rejeição → processamento/CQ → validação independente → comunicação crítica → arquivo. O resultado validado entra no Histórico. Rectificações preservam as versões; o lançamento antigo não contorna este percurso.

Os serviços especializados são activados por instituição: queimados, vigilância/isolamento, bloco operatório, maternidade, manutenção, esterilização, transporte, dietas, reabilitação, hiperbárica e escalas. São registos e fluxos com persistência e autoria no âmbito descrito na matriz; não representam a totalidade de um ERP hospitalar especializado.

O chat tem anexos privados, pesquisa, paginação e visto. O assistente comum é separado, fica desligado sem fornecedor aprovado e não altera registos. A biblioteca mantém documentos internos por empresa. O MEDLIK partilha apenas conteúdo escolhido com destinatário e fundamento explícitos; a revogação bloqueia novas leituras no destino.

## Evidência e limites

Consultar [verificação](docs/VERIFICACAO.md), [estado dos módulos](docs/ESTADO_DOS_MODULOS.md), [correspondência MINSA](docs/MINSA_RASTREABILIDADE.md) e [critérios de aceitação](docs/TESTES_E_CRITERIOS.md).

Os kits recebidos não incluem um checklist oficial de homologação MINSA. Não se atribui certificação MINSA/AGT, assinatura qualificada, integração com analisadores/PACS, compatibilidade transfusional, facturação fiscal homologada ou ligação bancária. Esses itens e os ensaios com profissionais/equipamentos constam como pendentes, sem botões que simulem sucesso.

Foram preservados os dados existentes do Neon (24 pacientes, 11 facturas e 31 resultados na verificação). Um resultado e uma factura têm paciente inexistente e continuam retidos para revisão; não foram ligados a outra pessoa por suposição. Dados apenas em navegadores antigos não vêm no ZIP: preservar/exportar antes de limpar dispositivos. Ver [revisão de dados](docs/REVISAO_DADOS.md).

As versões de interface substituídas estão em docs/legado para reversão/consulta e não integram a execução activa. O pacote não contém credenciais, dumps, node_modules ou dados de pacientes.
