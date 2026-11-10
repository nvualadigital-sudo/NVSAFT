-- Additive update: preserve movements and issued documents.
ALTER TABLE public.movimentos ADD COLUMN request_id uuid;
CREATE UNIQUE INDEX nv_movimentos_request ON public.movimentos(empresa_id,request_id) WHERE request_id IS NOT NULL;
CREATE TABLE public.nv_document_signatories (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  kind text NOT NULL CHECK(kind IN ('clinical','nursing')),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id),
  revision integer NOT NULL DEFAULT 1,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(empresa_id,kind)
);
