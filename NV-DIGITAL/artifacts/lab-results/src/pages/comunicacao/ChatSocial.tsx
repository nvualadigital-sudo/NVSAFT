import { useCallback, useEffect, useRef, useState } from "react";
import { hospitalApi } from "../../store/hospital";

type Space = {
  id: string;
  name: string;
  description: string;
  kind: string;
  creator: string;
  joined: boolean;
  member_count: number;
};
type Post = {
  id: string;
  author: string;
  author_name: string;
  body: string;
  created_at: string;
  expires_at?: string;
};
const call = <T,>(method: string, path: string, body?: unknown) =>
  hospitalApi<T>(method, "/chat-social" + path, body);
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Falha no servidor.";
export default function ChatSocial({
  kind,
  username,
}: {
  kind: "status" | "channel" | "community";
  username?: string;
}) {
  const [spaces, setSpaces] = useState<Space[]>([]),
    [posts, setPosts] = useState<Post[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const [body, setBody] = useState(""),
    [name, setName] = useState(""),
    [description, setDescription] = useState("");
  const [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [pages, setPages] = useState(1),
    [hasMore, setHasMore] = useState(false);
  const live = useRef(true),
    seq = useRef(0),
    pending = useRef<{ signature: string; id: string } | null>(null),
    saving = useRef(false);
  const current = spaces.find((s) => s.id === selected);
  const load = useCallback(async () => {
    const id = ++seq.current;
    try {
      if (kind === "status") {
        const result = await call<Post[]>("GET", "/status");
        if (live.current && id === seq.current) setPosts(result);
      } else {
        const items = await call<Space[]>("GET", "/spaces?kind=" + kind);
        if (!live.current || id !== seq.current) return;
        setSpaces(items);
        const active = items.find((s) => s.id === selected);
        if (active && (active.kind === "channel" || active.joined)) {
          const rows: Post[] = [];
          let more = false;
          for (let page = 0; page < pages; page++) {
            const result = await call<Post[]>(
              "GET",
              "/spaces/" + active.id + "/posts?offset=" + page * 100,
            );
            rows.unshift(...result);
            more = result.length === 100;
            if (!more) break;
          }
          if (live.current && id === seq.current) {
            setPosts(rows);
            setHasMore(more);
          }
        } else if (live.current && id === seq.current) setPosts([]);
      }
      if (live.current && id === seq.current) setError("");
    } catch (e) {
      if (live.current && id === seq.current) setError(errorText(e));
    }
  }, [kind, selected, pages]);
  useEffect(() => {
    live.current = true;
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    return () => {
      live.current = false;
      seq.current++;
      clearInterval(timer);
    };
  }, [load]);
  async function action(fn: () => Promise<unknown>) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      if (live.current) setError(errorText(e));
    } finally {
      saving.current = false;
      if (live.current) setBusy(false);
    }
  }
  async function write(path: string, payload: Record<string, unknown>) {
    const signature = JSON.stringify({ path, payload });
    if (pending.current?.signature !== signature)
      pending.current = { signature, id: crypto.randomUUID() };
    const result = await call("POST", path, {
      ...payload,
      requestId: pending.current.id,
    });
    pending.current = null;
    return result;
  }
  const inputStyle = {
    width: "100%",
    padding: 9,
    border: "1px solid #94a3b8",
    borderRadius: 8,
    background: "var(--WDS-surface-default)",
    color: "var(--WDS-content-default)",
    marginBottom: 8,
  };
  const buttonStyle = {
    padding: "8px 12px",
    border: 0,
    borderRadius: 8,
    background: "#1f4e79",
    color: "white",
    cursor: "pointer",
    marginRight: 6,
  };
  const canPost =
    kind === "status" ||
    (current &&
      (current.kind === "community"
        ? current.joined
        : current.creator === username));
  return (
    <div className="chat-list" style={{ padding: 16, textAlign: "left" }}>
      {error && (
        <p
          role="alert"
          style={{
            padding: 10,
            background: "#fff1f2",
            color: "#9f1239",
            marginBottom: 12,
          }}
        >
          {error}
          <button onClick={() => void load()} style={buttonStyle}>
            Tentar novamente
          </button>
        </p>
      )}
      {kind !== "status" && !selected && (
        <>
          <button style={buttonStyle} onClick={() => setCreating((v) => !v)}>
            {creating
              ? "Cancelar"
              : kind === "channel"
                ? "Criar canal"
                : "Criar comunidade"}
          </button>
          {creating && (
            <form
              style={{ marginTop: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  await write("/spaces", { kind, name, description });
                  setName("");
                  setDescription("");
                  setCreating(false);
                });
              }}
            >
              <input
                aria-label="Nome"
                placeholder="Nome"
                style={inputStyle}
                maxLength={120}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
              <textarea
                aria-label="Descrição"
                placeholder="Descrição"
                style={inputStyle}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
              />
              <button style={buttonStyle} disabled={busy || !name.trim()}>
                Criar
              </button>
            </form>
          )}
          {!spaces.length && !error && (
            <p style={{ marginTop: 20 }}>
              Ainda não existem {kind === "channel" ? "canais" : "comunidades"}{" "}
              nesta empresa.
            </p>
          )}
          {spaces.map((s) => (
            <button
              key={s.id}
              style={{
                display: "block",
                width: "100%",
                padding: 12,
                marginTop: 8,
                textAlign: "left",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "var(--WDS-surface-default)",
                color: "inherit",
                cursor: "pointer",
              }}
              onClick={() => {
                setSelected(s.id);
                setPages(1);
                setBody("");
              }}
            >
              <strong>{s.name}</strong>
              <p style={{ fontSize: 12, marginTop: 5 }}>{s.description}</p>
              <p style={{ fontSize: 12 }}>
                {s.member_count} membro(s) ·{" "}
                {s.joined ? "Aderiu" : "Disponível para adesão"}
              </p>
            </button>
          ))}
        </>
      )}
      {selected && current && (
        <>
          <button
            style={buttonStyle}
            onClick={() => {
              setSelected(null);
              setPosts([]);
              setBody("");
            }}
          >
            Voltar
          </button>
          <h3 style={{ fontSize: 18, margin: "12px 0" }}>{current.name}</h3>
          <p style={{ fontSize: 13, marginBottom: 10 }}>
            {current.description}
          </p>
          {current.creator !== username && (
            <button
              disabled={busy}
              style={buttonStyle}
              onClick={() =>
                void action(async () => {
                  await call("POST", "/spaces/" + current.id + "/membership", {
                    join: !current.joined,
                  });
                })
              }
            >
              {current.joined ? "Sair" : "Aderir"}
            </button>
          )}
          {current.kind === "community" && !current.joined && (
            <p style={{ marginTop: 12 }}>
              Adira para consultar e publicar nesta comunidade.
            </p>
          )}
        </>
      )}
      {kind === "status" && (
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          Estados de texto da empresa. Ficam visíveis durante 24 horas.
        </p>
      )}
      {canPost && (
        <form
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await write("/posts", { spaceId: selected, body });
              setBody("");
            });
          }}
        >
          <textarea
            aria-label={kind === "status" ? "Novo estado" : "Nova publicação"}
            placeholder={
              kind === "status"
                ? "Partilhar um estado…"
                : "Escrever publicação…"
            }
            style={inputStyle}
            rows={3}
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={busy}
          />
          <button style={buttonStyle} disabled={busy || !body.trim()}>
            {busy ? "A guardar…" : "Publicar"}
          </button>
        </form>
      )}
      {(kind === "status" || selected) && (
        <>
          {hasMore && kind !== "status" && (
            <button
              style={{ ...buttonStyle, marginTop: 12 }}
              onClick={() => setPages((p) => p + 1)}
            >
              Publicações anteriores
            </button>
          )}
          {!posts.length &&
            !error &&
            (kind === "status" ||
              current?.joined ||
              current?.kind === "channel") && (
              <p style={{ marginTop: 20 }}>Ainda não há publicações.</p>
            )}
          {posts.map((p) => (
            <article
              key={p.id}
              style={{
                marginTop: 14,
                padding: 12,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
              }}
            >
              <strong>{p.author_name}</strong>
              <p
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  margin: "8px 0",
                  fontSize: 14,
                }}
              >
                {p.body}
              </p>
              <p style={{ fontSize: 11, opacity: 0.7 }}>
                {new Date(p.created_at).toLocaleString("pt-PT")}
                {p.expires_at
                  ? " · Expira em " +
                    new Date(p.expires_at).toLocaleTimeString("pt-PT")
                  : ""}
              </p>
              {p.author === username && (
                <button
                  disabled={busy}
                  style={{
                    ...buttonStyle,
                    marginTop: 8,
                    background: "#9f1239",
                  }}
                  onClick={() =>
                    void action(async () => {
                      await call("DELETE", "/posts/" + p.id);
                    })
                  }
                >
                  Eliminar
                </button>
              )}
            </article>
          ))}
        </>
      )}
    </div>
  );
}
