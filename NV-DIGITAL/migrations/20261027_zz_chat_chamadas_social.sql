CREATE TABLE IF NOT EXISTS public.nv_chat_calls (
 id uuid PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 caller text NOT NULL, callee text NOT NULL CHECK(caller<>callee),
 kind text NOT NULL CHECK(kind IN ('voice','video')),
 status text NOT NULL DEFAULT 'ringing' CHECK(status IN ('ringing','accepted','ended','rejected','missed')),
 request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 accepted_at timestamptz, ended_at timestamptz,
 caller_seen timestamptz NOT NULL DEFAULT now(),callee_seen timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,caller,request_id)
);
CREATE INDEX IF NOT EXISTS nv_chat_calls_lookup ON public.nv_chat_calls(empresa_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.nv_chat_call_signals (
 id bigserial PRIMARY KEY, empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 call_id uuid NOT NULL REFERENCES public.nv_chat_calls(id), actor text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('offer','answer','ice')), payload jsonb NOT NULL,
 request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,call_id,actor,request_id)
);
CREATE INDEX IF NOT EXISTS nv_chat_signal_lookup ON public.nv_chat_call_signals(empresa_id,call_id,id);
CREATE TABLE IF NOT EXISTS public.nv_chat_spaces (
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 kind text NOT NULL CHECK(kind IN ('channel','community')),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120), description text NOT NULL DEFAULT '',
 creator text NOT NULL,request_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,creator,request_id)
);
CREATE TABLE IF NOT EXISTS public.nv_chat_space_members (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),space_id uuid NOT NULL REFERENCES public.nv_chat_spaces(id),
 actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(empresa_id,space_id,actor)
);
CREATE TABLE IF NOT EXISTS public.nv_chat_posts (
 id uuid PRIMARY KEY,empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 space_id uuid REFERENCES public.nv_chat_spaces(id),author text NOT NULL,author_name text NOT NULL,
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),request_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz,
 UNIQUE(empresa_id,author,request_id)
);
CREATE INDEX IF NOT EXISTS nv_chat_posts_lookup ON public.nv_chat_posts(empresa_id,space_id,created_at DESC);
