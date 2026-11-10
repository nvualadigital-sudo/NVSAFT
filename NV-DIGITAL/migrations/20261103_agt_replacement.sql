-- Relações de substituição em homologação, sem reescrever documentos emitidos.
CREATE UNIQUE INDEX IF NOT EXISTS nv_agt_job_company_id ON public.nv_agt_jobs(empresa_id,id);
CREATE TABLE IF NOT EXISTS public.nv_agt_replacements (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 original_id integer NOT NULL,
 replacement_id integer NOT NULL,
 rejection_job_id uuid NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 8 AND 300),
 actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,original_id),
 UNIQUE(empresa_id,replacement_id),
 FOREIGN KEY(empresa_id,original_id) REFERENCES public.faturas(empresa_id,id),
 FOREIGN KEY(empresa_id,replacement_id) REFERENCES public.faturas(empresa_id,id),
 FOREIGN KEY(empresa_id,rejection_job_id) REFERENCES public.nv_agt_jobs(empresa_id,id),
 CHECK(replacement_id>original_id)
);
DROP TRIGGER IF EXISTS nv_guard_agt_replacement ON public.nv_agt_replacements;
CREATE TRIGGER nv_guard_agt_replacement BEFORE UPDATE OR DELETE ON public.nv_agt_replacements FOR EACH ROW EXECUTE FUNCTION public.nv_guard_agt_event();
