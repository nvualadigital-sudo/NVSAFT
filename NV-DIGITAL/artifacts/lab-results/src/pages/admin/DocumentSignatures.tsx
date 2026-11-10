import { useEffect, useState } from "react";
import { hospitalApi } from "../../store/hospital";
import { prepareSignatureImage } from "../../utils/signatureImage";
type Kind = "clinical" | "nursing";
type State = {
  people: {
    id: string;
    name: string;
    role: string;
    active: boolean;
    verified: boolean;
    profileRevision: number;
    credential: string;
  }[];
  assignments: { kind: Kind; funcionario_id: string; revision: number }[];
  signatures: Record<string, any>;
};
export default function DocumentSignatures() {
  const [data, setData] = useState<State | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = async () =>
    setData(await hospitalApi<State>("GET", "/document-signatories"));
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-white p-5">
        <h3 className="font-bold">Assinaturas de Medicina e Enfermagem</h3>
        <p className="mt-2 text-sm text-slate-600">
          Seleccione os responsáveis da instituição e carregue as respectivas
          assinaturas e carimbos. A autoria individual dos documentos continua
          ligada ao profissional que os emite. Os documentos já emitidos
          conservam as assinaturas da data de emissão.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {notice && <p role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {!data && !error && <p>A carregar assinaturas…</p>}
      {data &&
        (["clinical", "nursing"] as Kind[]).map((kind) => (
          <SignatureCard
            key={
              kind +
              ":" +
              (data.assignments.find((x) => x.kind === kind)?.revision || 0)
            }
            kind={kind}
            data={data}
            reload={load}
            onSaved={setNotice}
          />
        ))}
    </section>
  );
}
function SignatureCard({
  kind,
  data,
  reload,
  onSaved,
}: {
  kind: Kind;
  data: State;
  reload: () => Promise<void>;
  onSaved: (message: string) => void;
}) {
  const assignment = data.assignments.find((x) => x.kind === kind),
    signed = data.signatures[kind];
  const [id, setId] = useState(assignment?.funcionario_id || ""),
    [patch, setPatch] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [images, setImages] = useState<Record<string, string>>({});
  const person = data.people.find((p) => p.id === id);
  const role = kind === "clinical" ? "medico" : "enfermeiro";
  useEffect(() => {
    let cancelled = false;
    setImages({});
    if (id)
      void hospitalApi<{ signatureData: string; stampData: string }>(
        "GET",
        "/document-signatories/professional/" + id + "/images",
      )
        .then((result) => {
          if (!cancelled) setImages(result);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message || "Não foi possível ler as imagens deste profissional.");
        });
    return () => {
      cancelled = true;
    };
  }, [id]);
  async function file(key: string, file: File | undefined) {
    if (!file) return;
    setError("");
    setMessage("");
    try {
      const prepared = await prepareSignatureImage(file);
      setPatch((p) => ({ ...p, [key]: prepared }));
      setConfirmed(false);
      setMessage("Imagem preparada. Confirme a identidade para guardar.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível preparar a imagem.");
    }
  }
  return (
    <form
      className="space-y-4 rounded-xl border bg-white p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        setMessage("");
        try {
          const draft = !person?.verified;
          await hospitalApi("PUT", "/document-signatories/" + kind + (draft ? "/draft-images" : ""), {
            funcionarioId: id,
            revision: assignment?.revision || 0,
            profileRevision: person?.profileRevision,
            confirmIdentity: confirmed,
            ...patch,
          });
          const success = draft
            ? "Imagens guardadas como rascunho. Verifique a cédula em Administração → Instituição e acessos → Profissionais antes da atribuição oficial."
            : "Responsável e assinatura institucional guardados.";
          setMessage(success);
          onSaved(success);
          setImages((prev) => ({ ...prev, ...patch }));
          setPatch({});
          setConfirmed(false);
          await reload();
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Não foi possível guardar.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="font-bold">
        {kind === "clinical" ? "Dr./Dra. Clínico(a)" : "Chefe de Enfermagem"}
      </h3>
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <label className="block text-sm">
        Profissional responsável
        <select
          className="mt-1 w-full rounded border p-2"
          required
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setPatch({});
            setConfirmed(false);
          }}
        >
          <option value="">Seleccionar funcionário da empresa</option>
          {data.people
            .filter((p) => p.role === role && p.active)
            .map((p) => (
              <option value={p.id} key={p.id}>
                {p.name} · {p.credential || "Sem cédula"}
                {p.verified ? "" : " · credencial por verificar"}
              </option>
            ))}
        </select>
      </label>
      {person && !person.verified && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Ainda não existe uma credencial profissional activa e verificada para este funcionário.
          Pode carregar e guardar as imagens agora como <strong>rascunho</strong>,
          mas só serão usadas nos documentos depois da verificação em
          <strong> Administração → Instituição e acessos → Profissionais</strong> e da atribuição nesta página.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["signatureData", "Assinatura"],
          ["stampData", "Carimbo"],
        ].map(([key, label]) => {
          const preview =
            patch[key] ??
            images[key] ??
            (id === assignment?.funcionario_id ? signed?.[key] : "");
          return (
            <label key={key} className="space-y-2 text-sm">
              <span className="block font-semibold">{label}</span>
              {preview && (
                <img
                  src={preview}
                  alt={label}
                  className="h-20 max-w-52 object-contain"
                />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                disabled={!person || busy}
                onChange={(e) => {
                  void file(key, e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
              <span className="block text-xs text-slate-500">PNG, JPG ou WebP até 10 MB. O sistema ajusta o tamanho antes de guardar.</span>
              <button
                type="button"
                className="ml-2 text-red-700"
                disabled={!person || busy}
                onClick={() => {
                  setPatch((p) => ({ ...p, [key]: "" }));
                  setConfirmed(false);
                }}
              >
                Remover
              </button>
            </label>
          );
        })}
      </div>
      {Object.keys(patch).length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Confirmo que estas imagens pertencem ao profissional seleccionado.
        </label>
      )}
      <button
        className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        disabled={busy || !person || (!person.verified && !Object.keys(patch).length)}
      >
        {busy ? "A guardar…" : person?.verified ? "Guardar responsável e assinatura" : "Guardar imagens em rascunho"}
      </button>
    </form>
  );
}
