-- Extensão aditiva: mantém o histórico existente e não altera os restantes módulos.
CREATE TABLE IF NOT EXISTS public.nv_chat_groups (
  id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  creator text NOT NULL, members jsonb NOT NULL, request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(empresa_id,creator,request_id)
);
ALTER TABLE public.hospital_messages ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.nv_chat_groups(id);
ALTER TABLE public.hospital_messages ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.hospital_messages(id);
ALTER TABLE public.hospital_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.hospital_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE TABLE IF NOT EXISTS public.nv_chat_preferences (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id), actor text NOT NULL,
  conversation text NOT NULL, data jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY(empresa_id,actor,conversation)
);
CREATE TABLE IF NOT EXISTS public.nv_chat_reactions (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  message_id uuid NOT NULL REFERENCES public.hospital_messages(id),
  actor text NOT NULL, emoji text NOT NULL CHECK(length(emoji) BETWEEN 1 AND 32),
  PRIMARY KEY(empresa_id,message_id,actor,emoji)
);
CREATE INDEX IF NOT EXISTS nv_chat_group_messages ON public.hospital_messages(empresa_id,group_id,created_at);
