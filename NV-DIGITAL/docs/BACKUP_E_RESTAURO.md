# Backup, restauro e contingência

## Ferramentas fornecidas

Requer pg_dump/pg_restore compatíveis com a versão do PostgreSQL, ligação directa e BACKUP_PASSPHRASE forte com pelo menos 32 caracteres, guardada separadamente. Não usar as chaves dos testes. O ficheiro fica cifrado e com modo de acesso 0600; o comando não imprime a ligação ou conteúdo.

```bash
pnpm backup create /caminho-seguro/nv-digital.nvb
```

A cópia usa o schema public da aplicação e preserva vínculos/dados. Outros schemas do mesmo projecto não são incluídos. Limite desta ferramenta: 512 MB de dump em memória; volumes maiores devem usar a solução de backup contínuo da infraestrutura.

Para um ensaio, configurar RESTORE_TEST_DATABASE_URL com uma base isolada e vazia, diferente da origem, e RESTORE_CONFIRM=RESTORE_TO_ISOLATED_DATABASE:

```bash
pnpm backup restore-test /caminho-seguro/nv-digital.nvb
```

O comando valida a autenticação criptográfica, recusa a origem e tabelas já existentes no destino e executa pg_restore numa transacção. Não oferece uma eliminação automática do banco de produção. Uma recuperação real requer decisão operacional, isolamento das escritas e um destino verificado pelos responsáveis.

## Evidência e limites

O teste automatizado verifica cifragem/decifragem, chave errada, adulteração e ausência do texto em claro no arquivo cifrado. As migrações são instaladas do zero e repetidas com dados preservados em PostgreSQL embutido. Não foi executado pg_dump/pg_restore do hospital nem um exercício real de recuperação no alojamento; não afirmar RTO/RPO ou restauro de produção testados.

Definir e documentar RPO/RTO, responsáveis, frequência, retenção, cópias externas, custódia da chave e calendário de ensaios. Verificar contagens, resultados, facturas, ficheiros e acessos depois de um restauro.

## Contingência operacional

A aplicação não confirma gravações quando o servidor não as confirmou. Usar formulários numerados aprovados em falha de energia/rede/impressora, com dois identificadores, hora, responsável e rastreio do recipiente. Reconciliar por profissional autorizado depois do restabelecimento, sem reutilizar códigos nem inventar colheitas ou validações. O procedimento físico e os formulários locais precisam de aprovação institucional.
