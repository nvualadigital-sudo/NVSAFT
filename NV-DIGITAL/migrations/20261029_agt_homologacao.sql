-- Sandbox fiscal. Não activa produção, não altera documentos históricos.
CREATE TABLE IF NOT EXISTS public.nv_agt_profiles (
 empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id), data jsonb NOT NULL DEFAULT '{}'::jsonb,
 revision integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.nv_agt_series (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), tipo text NOT NULL,
 code text NOT NULL, year integer NOT NULL, first_no numeric(15,0) NOT NULL,
 last_no numeric(15,0) NOT NULL, next_no numeric(15,0) NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT now(), evidence jsonb NOT NULL,
 PRIMARY KEY(empresa_id,tipo,code), CHECK(first_no>=1 AND last_no>=first_no AND next_no>=first_no)
);
CREATE TABLE IF NOT EXISTS public.nv_agt_jobs (
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id), actor text NOT NULL,
 request_key uuid NOT NULL, input_hash text NOT NULL, operation text NOT NULL,
 payload jsonb NOT NULL, payload_hash text NOT NULL, invoice_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
 status text NOT NULL CHECK(status IN ('preparado','a_enviar','envio_incerto','recebido','processando','validado','parcial','rejeitado','cancelado','respondido')),
 response jsonb, agt_request_id text, next_poll_at timestamptz, attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,request_key)
);
CREATE INDEX IF NOT EXISTS nv_agt_jobs_empresa ON public.nv_agt_jobs(empresa_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.nv_agt_events (
 id bigserial PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id), job_id uuid REFERENCES public.nv_agt_jobs(id),
 actor text NOT NULL, action text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nv_agt_events_empresa ON public.nv_agt_events(empresa_id,id DESC);
CREATE OR REPLACE FUNCTION public.nv_guard_agt_payload() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'O pedido AGT é imutável. Conserve o histórico.'; END IF;
 IF OLD.id IS DISTINCT FROM NEW.id OR OLD.empresa_id IS DISTINCT FROM NEW.empresa_id
 OR OLD.actor IS DISTINCT FROM NEW.actor OR OLD.request_key IS DISTINCT FROM NEW.request_key
 OR OLD.input_hash IS DISTINCT FROM NEW.input_hash OR OLD.operation IS DISTINCT FROM NEW.operation
 OR OLD.payload IS DISTINCT FROM NEW.payload OR OLD.payload_hash IS DISTINCT FROM NEW.payload_hash
 OR OLD.invoice_ids IS DISTINCT FROM NEW.invoice_ids THEN
   RAISE EXCEPTION 'O conteúdo do pedido AGT é imutável. Cancele a preparação ainda não enviada.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nv_guard_agt_payload ON public.nv_agt_jobs;
CREATE TRIGGER nv_guard_agt_payload BEFORE UPDATE OR DELETE ON public.nv_agt_jobs FOR EACH ROW EXECUTE FUNCTION public.nv_guard_agt_payload();
CREATE OR REPLACE FUNCTION public.nv_guard_agt_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'A auditoria AGT é imutável.'; END $$;
DROP TRIGGER IF EXISTS nv_guard_agt_event ON public.nv_agt_events;
CREATE TRIGGER nv_guard_agt_event BEFORE UPDATE OR DELETE ON public.nv_agt_events FOR EACH ROW EXECUTE FUNCTION public.nv_guard_agt_event();
CREATE OR REPLACE FUNCTION public.nv_guard_final_proforma() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.billing_meta->>'managed'='nvuala-v1' AND OLD.billing_meta->>'proformaFinalizada'='true' THEN
   RAISE EXCEPTION 'Pró-forma finalizada é imutável. Crie um novo documento.';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nv_guard_final_proforma ON public.faturas;
CREATE TRIGGER nv_guard_final_proforma BEFORE UPDATE OR DELETE ON public.faturas FOR EACH ROW EXECUTE FUNCTION public.nv_guard_final_proforma();
