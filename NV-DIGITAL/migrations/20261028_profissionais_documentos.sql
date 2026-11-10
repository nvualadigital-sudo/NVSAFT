-- Additive registry: existing clinical/nursing/laboratory records remain intact.
CREATE TABLE IF NOT EXISTS public.nv_professional_documents (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  id uuid NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('medical','prescription','nursing')),
  patient_id integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  issuer jsonb NOT NULL DEFAULT '{}'::jsonb,
  institution jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','issued','voided')),
  revision integer NOT NULL DEFAULT 1,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  issued_at timestamptz,
  voided_at timestamptz,
  void_reason text NOT NULL DEFAULT '',
  PRIMARY KEY (empresa_id,source_kind,id),
  FOREIGN KEY (empresa_id,patient_id) REFERENCES public.pacientes(empresa_id,id)
);
CREATE INDEX IF NOT EXISTS nv_professional_documents_recent ON public.nv_professional_documents(empresa_id,source_kind,created_at DESC);
