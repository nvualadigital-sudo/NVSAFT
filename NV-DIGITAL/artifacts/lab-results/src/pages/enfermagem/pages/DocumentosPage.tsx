import { useState, useEffect } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { NURSING_DOCUMENT_KINDS } from "@workspace/api-zod";
import { api } from "../../../store/api";
import { hospitalApi } from "../../../store/hospital";
import { printProfessional } from "../../../components/hospital/ProfessionalDocument";
import { useEnfermagemContext } from "../EnfermagemContext";

const input = "w-full border rounded-lg p-2 text-sm bg-white";
const button =
  "rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50";
const blank = () => ({
  id: crypto.randomUUID(),
  revision: 0,
  patientId: "",
  kind: NURSING_DOCUMENT_KINDS[0] as string,
  title: "",
  text: "",
  from: "",
  to: "",
});
export default function DocumentosPage() {
  const { session } = useEnfermagemContext();
  const [rows, setRows] = useState<any[]>([]),
    [patients, setPatients] = useState<any[]>([]),
    [profile, setProfile] = useState<any>(null),
    [form, setForm] = useState(blank),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = async () =>
    setRows(await hospitalApi<any[]>("GET", "/professional-documents/nursing"));
  useEffect(() => {
    let current = true;
    void Promise.all([
      hospitalApi<any[]>("GET", "/professional-documents/nursing"),
      api.pacientes.list(),
      hospitalApi<any>("GET", "/professionals/me"),
    ])
      .then(([docs, people, who]) => {
        if (current) {
          setRows(docs);
          setPatients(people);
          setProfile(who);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [session.empresaId]);
  async function save(finalize: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!form.patientId || !form.title.trim() || !form.text.trim())
        throw new Error("Seleccione o paciente e preencha título e conteúdo.");
      const result = await hospitalApi<any>(
        "POST",
        "/professional-documents/nursing",
        { ...form, patientId: Number(form.patientId), finalize, reviewed },
      );
      if (finalize) {
        setForm(blank());
        setReviewed(false);
      } else setForm({ ...form, revision: result.revision });
      setMessage(
        finalize
          ? "Documento emitido com a identificação profissional registada."
          : "Rascunho guardado.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <TabsContent value="documentos">
      <div className="space-y-4">
        <header className="rounded-xl border bg-white p-4">
          <h2 className="font-bold text-lg">Documentos de enfermagem</h2>
          <p className="text-sm">
            {profile?.name} ·{" "}
            {profile?.profile?.category || "Categoria por registar"} ·{" "}
            {profile?.profile?.credential || "Cédula por registar"}
          </p>
          {!profile?.canIssue && (
            <p className="text-sm text-amber-800 mt-2">
              Para emitir, a conta individual de enfermagem precisa de
              credencial vigente verificada por outro responsável em Instituição
              e acessos. Pode preparar rascunhos.
            </p>
          )}
        </header>
        {(error || message) && (
          <p
            role={error ? "alert" : "status"}
            className="rounded border p-3 bg-amber-50"
          >
            {error || message}
          </p>
        )}
        <section className="rounded-xl border bg-white p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label>
              Paciente do cadastro central
              <select
                disabled={form.revision > 0}
                className={input}
                value={form.patientId}
                onChange={(e) =>
                  setForm({ ...form, patientId: e.target.value })
                }
              >
                <option value="">Seleccionar paciente</option>
                {patients.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.nome} · {p.processo || p.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Modelo
              <select
                className={input}
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                {NURSING_DOCUMENT_KINDS.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
            </label>
            <label>
              Título
              <input
                className={input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Início do período
              <input
                type="date"
                className={input}
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
              />
            </label>
            <label>
              Fim do período
              <input
                type="date"
                className={input}
                value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
              />
            </label>
          </div>
          <label className="block">
            Conteúdo revisto pelo profissional
            <textarea
              rows={8}
              className={input}
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            Conferi paciente, conteúdo e período; autorizo a emissão com a minha
            identificação profissional.
          </label>
          <div className="flex gap-2">
            <button
              className={button}
              disabled={busy}
              onClick={() => void save(false)}
            >
              Guardar rascunho
            </button>
            <button
              className={`${button} bg-teal-700 text-white`}
              disabled={busy || !reviewed || !profile?.canIssue}
              onClick={() => void save(true)}
            >
              Emitir documento
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                setForm(blank());
                setReviewed(false);
              }}
            >
              Novo documento
            </button>
          </div>
        </section>
        <section className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border bg-white p-4 space-y-2"
            >
              <strong>{row.payload.title}</strong>
              <p className="text-sm">
                {row.payload.patient?.nome} · {row.payload.kind} ·{" "}
                {row.state === "issued"
                  ? "Emitido"
                  : row.state === "voided"
                    ? "Anulado"
                    : "Rascunho"}
              </p>
              <p className="text-sm">
                {row.issuer?.name || row.created_by} ·{" "}
                {row.issuer?.credential || ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {row.state === "draft" &&
                  row.created_by === session.username && (
                    <button
                      className={button}
                      onClick={() => {
                        setForm({
                          id: row.id,
                          revision: row.revision,
                          patientId: String(row.patient_id),
                          ...row.payload,
                        });
                        setReviewed(false);
                      }}
                    >
                      Continuar rascunho
                    </button>
                  )}
                <button
                  className={button}
                  onClick={() =>
                    void printProfessional("nursing", row.id).catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  Imprimir / guardar PDF
                </button>
                {row.state === "issued" &&
                  row.created_by === session.username && (
                    <button
                      className={button}
                      onClick={async () => {
                        const reason = window.prompt("Motivo da anulação:");
                        if (!reason?.trim()) return;
                        try {
                          await hospitalApi(
                            "POST",
                            `/professional-documents/nursing/${row.id}/void`,
                            { reason },
                          );
                          await load();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Anular com motivo
                    </button>
                  )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </TabsContent>
  );
}
