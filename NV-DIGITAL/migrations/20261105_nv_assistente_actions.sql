-- Pedidos de acções do NV-ASSISTENTE: âmbito institucional e confirmação explícita.
CREATE TABLE IF NOT EXISTS public.nv_ai_action_requests (
  id uuid PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  actor text NOT NULL,
  tool text NOT NULL CHECK (tool IN ('chat.send_team')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  result jsonb,
  UNIQUE (empresa_id,id)
);
CREATE INDEX IF NOT EXISTS nv_ai_actions_actor_idx
  ON public.nv_ai_action_requests(empresa_id,actor,created_at DESC);
