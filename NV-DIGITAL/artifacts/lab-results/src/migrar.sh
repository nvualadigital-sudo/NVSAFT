#!/bin/bash
set -e

export PGPASSWORD='COLA_AQUI_A_SENHA_DO_NEON'
NEON_HOST="ep-fragrant-glitter-ajlvlmlh.c-3.us-east-2.aws.neon.tech"
NEON_USER="neondb_owner"
NEON_DB="neondb"

# Cola aqui a connection string INTEIRA de produção do Replit (copiada do botão clipboard)
REPLIT_URL="COLA_AQUI_O_DATABASE_URL_DE_PRODUCAO"

echo "Testando Neon..."
psql -h "$NEON_HOST" -U "$NEON_USER" -d "$NEON_DB" -c "select 1;"

echo "Testando Replit..."
psql "$REPLIT_URL" -c "select 1;"