CREATE TABLE IF NOT EXISTS public.nv_notification_reads (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),actor text NOT NULL,
 notification_id text NOT NULL CHECK(length(notification_id) BETWEEN 1 AND 200),
 read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,actor,notification_id)
);
-- Identity/time of an emitted result; no clinical values are copied to this table.
CREATE TABLE IF NOT EXISTS public.nv_result_notification_versions (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),result_id integer NOT NULL,
 revision bigint NOT NULL DEFAULT 1,emitted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,result_id),
 FOREIGN KEY(empresa_id,result_id) REFERENCES public.resultados(empresa_id,id) ON DELETE CASCADE
);
INSERT INTO public.nv_result_notification_versions(empresa_id,result_id)
 SELECT empresa_id,id FROM public.resultados WHERE data_emissao<>'' AND
 CASE WHEN jsonb_typeof(parametros)='array' THEN jsonb_array_length(parametros)>0 ELSE false END
 ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.nv_track_emitted_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.data_emissao='' THEN RETURN NEW; END IF;
 IF jsonb_typeof(NEW.parametros) IS DISTINCT FROM 'array' THEN RETURN NEW; END IF;
 IF jsonb_array_length(NEW.parametros)=0 THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.parametros IS NOT DISTINCT FROM OLD.parametros AND NEW.data_emissao IS NOT DISTINCT FROM OLD.data_emissao AND NEW.paciente_id IS NOT DISTINCT FROM OLD.paciente_id THEN RETURN NEW; END IF;
 END IF;
 INSERT INTO public.nv_result_notification_versions(empresa_id,result_id) VALUES(NEW.empresa_id,NEW.id)
 ON CONFLICT(empresa_id,result_id) DO UPDATE SET revision=nv_result_notification_versions.revision+1,emitted_at=now();
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS nv_track_emitted_result ON public.resultados;
CREATE TRIGGER nv_track_emitted_result AFTER INSERT OR UPDATE ON public.resultados FOR EACH ROW EXECUTE FUNCTION public.nv_track_emitted_result();
