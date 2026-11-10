CREATE TABLE IF NOT EXISTS public.nv_insurance_contracts (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), id uuid NOT NULL,
 insurer_id text NOT NULL, data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS public.nv_insurance_claims (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), invoice_id integer NOT NULL,
 patient_id integer NOT NULL, insurer_id text NOT NULL, beneficiary_id text NOT NULL,
 snapshot jsonb NOT NULL, service_date date NOT NULL, due_date date NOT NULL,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,invoice_id),
 FOREIGN KEY(empresa_id,patient_id) REFERENCES public.pacientes(empresa_id,id),
 FOREIGN KEY(empresa_id,invoice_id) REFERENCES public.faturas(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS public.nv_receivable_entries (
 id bigserial PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 invoice_id integer NOT NULL, party_type text NOT NULL CHECK(party_type IN ('insurer','patient')),
 party_id text NOT NULL, occurred_on date NOT NULL, kind text NOT NULL CHECK(kind IN ('invoice','payment','credit')),
 debit numeric(16,2) NOT NULL DEFAULT 0, credit numeric(16,2) NOT NULL DEFAULT 0,
 reference text NOT NULL, request_id uuid, details jsonb NOT NULL DEFAULT '{}',
 actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(debit>=0 AND credit>=0 AND ((debit>0 AND credit=0) OR (credit>0 AND debit=0))),
 FOREIGN KEY(empresa_id,invoice_id) REFERENCES public.faturas(empresa_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS nv_receivable_idempotency ON public.nv_receivable_entries(empresa_id,request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS nv_receivable_statement ON public.nv_receivable_entries(empresa_id,party_type,party_id,occurred_on,id);
CREATE TABLE IF NOT EXISTS public.nv_insurance_disputes (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), id uuid NOT NULL, invoice_id integer NOT NULL,
 amount numeric(16,2) NOT NULL CHECK(amount>0), reason text NOT NULL,
 status text NOT NULL CHECK(status IN ('open','contested','resolved')),
 resolution text NOT NULL DEFAULT '', credit_invoice_id integer, revision integer NOT NULL DEFAULT 1,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,id),
 FOREIGN KEY(empresa_id,invoice_id) REFERENCES public.nv_insurance_claims(empresa_id,invoice_id)
);
CREATE TABLE IF NOT EXISTS public.nv_insurance_templates (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), insurer_id text NOT NULL,
 data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, updated_by text NOT NULL,
 PRIMARY KEY(empresa_id,insurer_id)
);
