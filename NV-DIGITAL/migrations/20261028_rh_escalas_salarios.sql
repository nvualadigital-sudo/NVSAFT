CREATE TABLE public.nv_hr_rosters (
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id), month text NOT NULL,
 department text NOT NULL, revision integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho','publicada')),
 data jsonb NOT NULL, actor text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(empresa_id,month,department));
CREATE TABLE public.nv_hr_profiles (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), worker_id uuid NOT NULL REFERENCES public.funcionarios(id),
 revision integer NOT NULL DEFAULT 1, data jsonb NOT NULL, actor text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(empresa_id,worker_id));
CREATE TABLE public.nv_hr_payroll (
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id), month text NOT NULL, revision integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho','aprovada','paga')), data jsonb NOT NULL,
 prepared_by text NOT NULL, approved_by text, approved_at timestamptz, payment_reference text, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,month));
CREATE TABLE public.nv_hr_requests (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id), id uuid NOT NULL, actor text NOT NULL, payload jsonb NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(empresa_id,id));
CREATE TABLE public.nv_hr_history (
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id), kind text NOT NULL, reference text NOT NULL,
 actor text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX nv_hr_history_reference ON public.nv_hr_history(empresa_id,kind,reference);
CREATE OR REPLACE FUNCTION public.nv_hr_frozen_payroll() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('aprovada','paga') THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Folha aprovada não pode ser eliminada.'; END IF;
  IF OLD.status='paga' OR NEW.data IS DISTINCT FROM OLD.data OR NEW.month<>OLD.month OR NEW.empresa_id<>OLD.empresa_id OR NEW.status<>'paga' THEN RAISE EXCEPTION 'Folha aprovada é imutável.'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER nv_hr_frozen_payroll BEFORE UPDATE OR DELETE ON public.nv_hr_payroll FOR EACH ROW EXECUTE FUNCTION public.nv_hr_frozen_payroll();

CREATE UNIQUE INDEX IF NOT EXISTS nv_hr_worker_tenant_key ON public.funcionarios(empresa_id,id);
ALTER TABLE public.nv_hr_profiles ADD CONSTRAINT nv_hr_profile_tenant_worker FOREIGN KEY(empresa_id,worker_id) REFERENCES public.funcionarios(empresa_id,id);
