BEGIN;
CREATE TABLE IF NOT EXISTS reception_visits (
 id uuid PRIMARY KEY, empresa_id text NOT NULL, dia date NOT NULL,
 numero integer NOT NULL CHECK(numero>0), paciente_id text NOT NULL,
 paciente_nome text NOT NULL, processo text NOT NULL DEFAULT '',
 destino text NOT NULL CHECK(destino IN ('enfermagem','consulta','laboratorio')),
 tipo text NOT NULL CHECK(tipo IN ('normal','retorno','preferencial')),
 estado text NOT NULL DEFAULT 'aguardando' CHECK(estado IN ('aguardando','chamado','encaminhado','concluido','cancelado')),
 chegada_em timestamptz NOT NULL DEFAULT now(), chamado_em timestamptz,
 actualizado_em timestamptz NOT NULL DEFAULT now(), versao integer NOT NULL DEFAULT 1,
 request_id uuid NOT NULL, request_hash text NOT NULL, criado_por text NOT NULL,
 UNIQUE(empresa_id,dia,numero), UNIQUE(empresa_id,request_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS reception_active_patient ON reception_visits(empresa_id,paciente_id,dia) WHERE estado IN ('aguardando','chamado','encaminhado');
CREATE INDEX IF NOT EXISTS reception_day ON reception_visits(empresa_id,dia,chegada_em);
CREATE TABLE IF NOT EXISTS reception_audit (
 id uuid PRIMARY KEY, visita_id uuid NOT NULL REFERENCES reception_visits(id), empresa_id text NOT NULL,
 actor text NOT NULL, estado_anterior text, estado_novo text NOT NULL, motivo text NOT NULL DEFAULT '', em timestamptz NOT NULL DEFAULT now()
);
COMMIT;
CREATE TABLE IF NOT EXISTS public.hospital_records(id uuid PRIMARY KEY,empresa_id uuid NOT NULL REFERENCES public.empresas(id),kind text NOT NULL,data jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS hospital_record_kind ON public.hospital_records(empresa_id,kind,created_at);
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS stock numeric NOT NULL DEFAULT 0;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS stock_minimo numeric NOT NULL DEFAULT 0;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS passaporte text NOT NULL DEFAULT '';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS observacoes text NOT NULL DEFAULT '';
