CREATE TABLE IF NOT EXISTS public.nv_patient_geography (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 patient_id integer NOT NULL,
 data jsonb NOT NULL,
 version text NOT NULL,
 updated_by text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,patient_id),
 FOREIGN KEY(empresa_id,patient_id) REFERENCES public.pacientes(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS public.nv_localities (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 id uuid NOT NULL,
 parent_id text NOT NULL,
 name text NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','approved')),
 created_by text NOT NULL,
 approved_by text,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,id),
 UNIQUE(empresa_id,parent_id,name)
);
