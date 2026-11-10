-- Pedidos dirigidos e conversas MedLink, sem partilha global do processo clínico.
ALTER TABLE public.hospital_shares
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'partilha';
ALTER TABLE public.hospital_shares
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'partilhado';
ALTER TABLE public.hospital_shares
  ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS hospital_share_request_idempotency
  ON public.hospital_shares(source_empresa_id,created_by,request_id)
  WHERE request_id IS NOT NULL;

ALTER TABLE public.hospital_shares
  ADD CONSTRAINT medlink_request_type_check CHECK(request_type IN ('partilha','exame','consulta'));
ALTER TABLE public.hospital_shares
  ADD CONSTRAINT medlink_status_check CHECK(status IN ('partilhado','pendente','aceite','recusado','em_execucao','concluido','cancelado'));

CREATE TABLE IF NOT EXISTS public.hospital_share_messages (
  id uuid PRIMARY KEY,
  share_id uuid NOT NULL REFERENCES public.hospital_shares(id),
  sender_empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  sender text NOT NULL CHECK(length(sender) BETWEEN 1 AND 200),
  sender_name text NOT NULL CHECK(length(sender_name) BETWEEN 1 AND 200),
  body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(share_id,sender_empresa_id,sender,request_id)
);
CREATE INDEX IF NOT EXISTS hospital_share_messages_latest
  ON public.hospital_share_messages(share_id,created_at DESC,id DESC);
