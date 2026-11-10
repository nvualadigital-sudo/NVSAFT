-- Metadados institucionais e favoritos pessoais; os ficheiros existentes permanecem nas tabelas originais.
CREATE TABLE IF NOT EXISTS public.hospital_library_meta (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  namespace text NOT NULL CHECK (length(namespace) BETWEEN 1 AND 200),
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, namespace)
);
