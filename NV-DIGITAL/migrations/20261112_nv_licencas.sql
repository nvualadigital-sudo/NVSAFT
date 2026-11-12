-- Licenças de módulos por empresa: não altera contratos existentes.
CREATE TABLE IF NOT EXISTS public.nv_licencas (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano text NOT NULL DEFAULT 'personalizado',
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','suspenso','cancelado')),
  inicio date NOT NULL DEFAULT CURRENT_DATE,
  fim date,
  valor_mensal numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_mensal >= 0),
  moeda text NOT NULL DEFAULT 'AOA',
  observacoes text NOT NULL DEFAULT '',
  actualizado_por text NOT NULL DEFAULT '',
  actualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nv_licencas_periodo CHECK (fim IS NULL OR fim >= inicio)
);
CREATE TABLE IF NOT EXISTS public.nv_licencas_auditoria (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  operador text NOT NULL,
  anterior jsonb,
  novo jsonb NOT NULL,
  data timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nv_licencas_auditoria_empresa_data ON public.nv_licencas_auditoria(empresa_id, data DESC);
