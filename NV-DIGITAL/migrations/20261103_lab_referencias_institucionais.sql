-- Referências operacionais públicas, sem alterar chaves técnicas nem códigos emitidos.
CREATE TABLE public.nv_lab_numbering (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id),
  prefix text NOT NULL CHECK(prefix ~ '^[A-Z][A-Z0-9]{1,9}$'),
  last_number bigint NOT NULL DEFAULT 0 CHECK(last_number >= 0)
);
CREATE TABLE public.nv_lab_reference_reservations (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  reference text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('processo','pedido','amostra','historico')),
  PRIMARY KEY (empresa_id,reference)
);

CREATE FUNCTION public.nv_lab_default_prefix(company_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(
    left(substring(translate(upper(company_name),
      'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ','AAAAAEEEEIIIIOOOOOUUUUCN')
      FROM '[A-Z][A-Z0-9]+'),10),
    'LAB')
$$;

CREATE FUNCTION public.nv_lab_canonical_reference(original text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE WHEN upper(btrim(original)) ~ '^[A-Z][A-Z0-9]{1,9}/[0-9]{1,19}$' THEN
    split_part(upper(btrim(original)), '/', 1) || '/' ||
    lpad(suffix,greatest(3,length(suffix)),'0')
  END
  FROM (SELECT coalesce(nullif(ltrim(split_part(btrim(original),'/',2),'0'),''),'0') AS suffix) n
$$;

-- Reserve historical short numbers, including alternate padding, without rewriting any row.
INSERT INTO public.nv_lab_reference_reservations(empresa_id,reference,kind)
SELECT empresa_id,reference,'historico'
FROM (
  SELECT empresa_id,public.nv_lab_canonical_reference(processo) AS reference FROM public.pacientes
  UNION ALL SELECT empresa_id,public.nv_lab_canonical_reference(n_amostra) FROM public.pacientes
  UNION ALL SELECT empresa_id,public.nv_lab_canonical_reference(accession) FROM public.nv_lab_orders
  UNION ALL SELECT empresa_id,public.nv_lab_canonical_reference(code) FROM public.nv_lab_containers
) history
WHERE reference IS NOT NULL
ON CONFLICT DO NOTHING;

-- Short references are reusable across separate companies only.
ALTER TABLE public.nv_lab_orders DROP CONSTRAINT IF EXISTS nv_lab_orders_accession_key;
ALTER TABLE public.nv_lab_orders ADD CONSTRAINT nv_lab_orders_company_accession_key UNIQUE(empresa_id,accession);
ALTER TABLE public.nv_lab_containers DROP CONSTRAINT IF EXISTS nv_lab_containers_code_key;
ALTER TABLE public.nv_lab_containers ADD CONSTRAINT nv_lab_containers_company_code_key UNIQUE(empresa_id,code);

CREATE FUNCTION public.nv_next_lab_reference(org uuid, reference_kind text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE candidate text;
DECLARE prefix_value text;
DECLARE n bigint;
BEGIN
  LOOP
    -- The unique row locks the allocation for this company until the transaction commits.
    INSERT INTO public.nv_lab_numbering(empresa_id,prefix,last_number)
      SELECT id,public.nv_lab_default_prefix(nome),1 FROM public.empresas WHERE id=org
    ON CONFLICT(empresa_id) DO UPDATE SET last_number=public.nv_lab_numbering.last_number+1
    RETURNING prefix,last_number INTO prefix_value,n;
    IF NOT FOUND THEN RAISE EXCEPTION 'Empresa inexistente.' USING ERRCODE='23503'; END IF;
    candidate := prefix_value || '/' || lpad(n::text,greatest(3,length(n::text)),'0');
    INSERT INTO public.nv_lab_reference_reservations(empresa_id,reference,kind)
      VALUES(org,candidate,reference_kind) ON CONFLICT DO NOTHING;
    IF FOUND THEN RETURN candidate; END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION public.nv_assign_lab_reference()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original text;
DECLARE normalized text;
DECLARE ref_kind text := TG_ARGV[0];
BEGIN
  CASE ref_kind
    WHEN 'processo' THEN original := NEW.processo;
    WHEN 'pedido' THEN original := NEW.accession;
    WHEN 'amostra' THEN original := NEW.code;
  END CASE;
  IF nullif(btrim(original),'') IS NULL THEN
    original := public.nv_next_lab_reference(NEW.empresa_id,ref_kind);
  ELSE
    -- Used by controlled SQL imports only. Application writes request an automatic reference.
    normalized := public.nv_lab_canonical_reference(original);
    IF normalized IS NOT NULL THEN
      INSERT INTO public.nv_lab_reference_reservations(empresa_id,reference,kind)
        VALUES(NEW.empresa_id,normalized,'historico');
    END IF;
  END IF;
  CASE ref_kind
    WHEN 'processo' THEN NEW.processo := original;
    WHEN 'pedido' THEN NEW.accession := original;
    WHEN 'amostra' THEN NEW.code := original;
  END CASE;
  RETURN NEW;
END;
$$;

CREATE TRIGGER nv_assign_patient_process BEFORE INSERT ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.nv_assign_lab_reference('processo');
CREATE TRIGGER nv_assign_lab_order BEFORE INSERT ON public.nv_lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.nv_assign_lab_reference('pedido');
CREATE TRIGGER nv_assign_lab_container BEFORE INSERT ON public.nv_lab_containers
  FOR EACH ROW EXECUTE FUNCTION public.nv_assign_lab_reference('amostra');

CREATE INDEX nv_lab_containers_company_order_idx ON public.nv_lab_containers(empresa_id,order_id);
CREATE INDEX nv_lab_tests_company_result_idx ON public.nv_lab_tests(empresa_id,result_id) WHERE result_id IS NOT NULL;
