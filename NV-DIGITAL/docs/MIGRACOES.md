# Migrações e estado do banco

Projecto Neon: polished-shadow-95732809. Banco: neondb. Produção: br-polished-brook-aykd1ohl.

| Ficheiro | Estado | SHA-256 |
|---|---|---|
| 00000000_schema_base.sql | Bootstrap para instalações vazias; testado localmente | 1fb6d14a243442d3320cccb2023be82a08d0c655ad9d4824e444678d1f2aacf5 |
| 20261021_hospital_integrado.sql | Aplicada no Neon em 27/10/2026 após ensaio em branch | a595dbcde75ca9afc5976a959c6e57f7bdeb455295c2f4587d021a43b99451e1 |
| 20261021_recepcao.sql | Aplicada no Neon em 27/10/2026 após ensaio em branch | 255a5eded6fd8f42667d02887138a858403a8e5c809ff61c7e690a7183570cdc |
| 20261027_emitente_snapshot.sql | Aplicada no Neon em 27/10/2026 após ensaio em branch | da655b0f87ec521312af7386e5a7d9c0aa9a541dd5e41326035a638edb2798cf |
| 20261027_rastreabilidade_institucional.sql | Aplicada no Neon em 27/10/2026 após ensaio em branch | 6d6bd8f01bb7d047aef069866279e7e3eff8b0926d6f28f098212d363be7b30b |

A migração de rastreabilidade criou 16 tabelas e 24 chaves estrangeiras; os novos pedidos/competências ficaram vazios. O ensaio ocorreu no branch br-shy-hat-ay7ydeuf, removido depois da aplicação; migration_id fa0cfc88-6c4e-4760-9efd-41835de7a546.

Antes e depois: 24 pacientes, 11 facturas e 31 resultados. Não foram inseridos pacientes de teste em produção nem alterados schemas de outras aplicações. As duas referências órfãs anteriores mantêm-se para revisão documental (REVISAO_DADOS.md).

A reversão do código não deve eliminar as novas tabelas nem o histórico. Parar escritas e planear uma migração compensatória se for necessária alteração de dados. O script pnpm db:migrate recusa uma ligação -pooler e a alteração de uma migração já registada.

O schema está actualizado; a aplicação precisa de ser instalada/publicada separadamente no Replit.
