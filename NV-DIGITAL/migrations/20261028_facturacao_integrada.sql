-- Integração NVUALASOFT: conserva os identificadores e registos já existentes.
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS billing_meta jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS billing_meta jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS public.nv_billing_settings (
 empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id), data jsonb NOT NULL DEFAULT '{}'::jsonb,
 revision bigint NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS public.nv_billing_sequences (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), serie text NOT NULL, tipo text NOT NULL,
 ano integer NOT NULL, ultimo bigint NOT NULL DEFAULT 0, last_issued_at timestamptz,
 PRIMARY KEY(empresa_id,serie,tipo,ano));
CREATE TABLE IF NOT EXISTS public.nv_cash_sessions (
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id), terminal text NOT NULL,
 actor text NOT NULL, opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
 opening numeric(18,2) NOT NULL CHECK(opening>=0), counted numeric(18,2), expected numeric(18,2),
 data jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE UNIQUE INDEX IF NOT EXISTS nv_cash_terminal_open ON public.nv_cash_sessions(empresa_id,terminal) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nv_cash_actor_open ON public.nv_cash_sessions(empresa_id,actor) WHERE closed_at IS NULL;
CREATE TABLE IF NOT EXISTS public.nv_cash_entries (
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id), session_id uuid NOT NULL REFERENCES public.nv_cash_sessions(id),
 actor text NOT NULL, kind text NOT NULL CHECK(kind IN ('sale','withdrawal','supply')),
 amount numeric(18,2) NOT NULL CHECK(amount>0), reason text NOT NULL, invoice_id integer REFERENCES public.faturas(id),
 created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS nv_cash_entries_session ON public.nv_cash_entries(empresa_id,session_id);
CREATE TABLE IF NOT EXISTS public.nv_billing_requests (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), id uuid NOT NULL, actor text NOT NULL, payload jsonb NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(empresa_id,id));
CREATE TABLE IF NOT EXISTS public.nv_billing_prints (
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id), invoice_id integer NOT NULL REFERENCES public.faturas(id),
 actor text NOT NULL, format text NOT NULL CHECK(format IN ('a4','58mm','80mm')), copy_no integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS nv_billing_print_invoice ON public.nv_billing_prints(empresa_id,invoice_id);
CREATE TABLE IF NOT EXISTS public.nv_billing_agt_queue (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), invoice_id integer NOT NULL REFERENCES public.faturas(id),
 state text NOT NULL DEFAULT 'preparacao' CHECK(state IN ('preparacao','pendente','submetido','validado','rejeitado')),
 request_id text, payload jsonb NOT NULL, response jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,invoice_id));
-- Defesa adicional contra alterações por rotas antigas; pagamentos usam recibos separados.
CREATE OR REPLACE FUNCTION public.nv_guard_billing_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.billing_meta->>'managed'='nvuala-v1' AND OLD.estado <> 'rascunho' THEN
   RAISE EXCEPTION 'Documento imutável. Utilize recibo ou nota de crédito.';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nv_guard_billing_document ON public.faturas;
CREATE TRIGGER nv_guard_billing_document BEFORE UPDATE OR DELETE ON public.faturas FOR EACH ROW EXECUTE FUNCTION public.nv_guard_billing_document();

CREATE UNIQUE INDEX IF NOT EXISTS nv_billing_number_unique ON public.faturas(empresa_id,numero) WHERE billing_meta->>'managed'='nvuala-v1';
