-- Resultados manuais e rectificações: versões preservadas, sem apagar os resultados existentes.
CREATE TABLE IF NOT EXISTS public.nv_lab_report_versions (
 id uuid PRIMARY KEY,
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 resultado_id integer NOT NULL,
 version integer NOT NULL CHECK(version >= 0),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 reason text NOT NULL DEFAULT '',
 origin text NOT NULL CHECK(origin IN ('manual','legado')),
 entered_by text,
 technical_by text,
 technical_at timestamptz,
 technical_note text NOT NULL DEFAULT '',
 released_by text,
 released_at timestamptz,
 release_note text NOT NULL DEFAULT '',
 request_id uuid,
 payload_hash text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,id),
 UNIQUE(empresa_id,resultado_id,version),
 UNIQUE(empresa_id,request_id),
 FOREIGN KEY(empresa_id,resultado_id) REFERENCES public.resultados(empresa_id,id)
);
CREATE INDEX IF NOT EXISTS nv_lab_report_versions_latest ON public.nv_lab_report_versions(empresa_id,resultado_id,version DESC);
