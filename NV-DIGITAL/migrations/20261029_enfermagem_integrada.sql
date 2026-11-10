-- Additive migration: preserves existing authentication, patients, pharmacy and clinical records.
CREATE TABLE IF NOT EXISTS public.nursing_integrated_state (
 empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id),
 body jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.nursing_integrated_requests (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 request_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,request_id)
);
