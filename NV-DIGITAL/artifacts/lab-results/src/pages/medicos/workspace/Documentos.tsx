import { useState } from "react";
import { printProfessional } from "../../../components/hospital/ProfessionalDocument";
import {
  buttonStyle,
  commitClinical,
  inputStyle,
  isLocalDate,
  MedicalDocument,
  useClinical,
} from "../clinica/store";
import { MedicalProps } from "./MedicoWorkspace";
const kinds = [
  "Relatório médico",
  "Atestado médico",
  "Declaração de presença",
  "Justificativa de faltas",
  "Encaminhamento / referência",
  "Resumo de alta",
  "Declaração para acompanhante",
  "Parecer médico",
  "Outro documento",
];
export default function Documentos({
  session,
  visit,
  onMessage,
}: MedicalProps) {
  const { state } = useClinical(session.empresaId!);
  const [kind, setKind] = useState(kinds[0]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [draftId, setDraftId] = useState("");
  const [checked, setChecked] = useState(false);
  const list = state.documents.filter((d) => d.visitId === visit.id);
  async function save(finalize = false) {
    try {
      if (visit.owner !== session.username)
        throw new Error(
          "Somente o médico responsável deste episódio pode emitir documentos.",
        );
      if (!title.trim() || !text.trim())
        throw new Error("Preencha título e texto do documento.");
      if ((from && !isLocalDate(from)) || (to && !isLocalDate(to)))
        throw new Error("Datas inválidas no período do documento.");
      if ((from && !to) || (!from && to) || (from && to && from > to))
        throw new Error("Verifique o início e o fim do período.");
      if (finalize && !checked)
        throw new Error("Confirme a revisão do conteúdo antes de emitir.");
      const id = draftId || crypto.randomUUID();
      const document: MedicalDocument = {
        id,
        visitId: visit.id,
        patient: visit.patient,
        kind,
        title: title.trim(),
        text: text.trim(),
        from,
        to,
        doctor: visit.doctor,
        registration: visit.registration,
        created: new Date().toISOString(),
        ...(finalize ? { finalized: new Date().toISOString() } : {}),
      };
      await commitClinical(
        session.empresaId!,
        session.username!,
        finalize ? "Documento finalizado" : "Rascunho guardado",
        id,
        (s) => {
          const old = s.documents.find((d) => d.id === id);
          if (old?.finalized || old?.voided)
            throw new Error(
              "Documento já emitido/anulado. Crie outro documento para rectificar.",
            );
          return {
            ...s,
            documents: old
              ? s.documents.map((d) =>
                  d.id === id ? { ...document, created: old.created } : d,
                )
              : [...s.documents, document],
          };
        },
      );
      setDraftId(finalize ? "" : id);
      if (finalize) {
        setText("");
        setTitle("");
        setChecked(false);
      }
      onMessage(
        finalize
          ? "Documento emitido no servidor. Disponível para impressão e assinatura do profissional."
          : "Rascunho guardado.",
      );
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Falha ao guardar.");
    }
  }
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-bold">Documentos médicos</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Tipo de documento
            <select
              className={inputStyle}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {kinds.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Título
            <input
              className={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Início do período, se aplicável
            <input
              className={inputStyle}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Fim do período, se aplicável
            <input
              className={inputStyle}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-sm">
          Texto do médico
          <textarea
            rows={12}
            className={inputStyle}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            className={buttonStyle}
            onClick={async () => {
              setTitle(kind);
              setText(
                `Paciente: ${visit.patient.nome}\n\n${kind === "Relatório médico" || kind === "Resumo de alta" ? `História clínica: ${visit.subjective}\n\nAchados: ${visit.objective}\n\nAvaliação e diagnóstico: ${visit.assessment}\n${visit.diagnosis}\n\nConduta: ${visit.plan}\n\nOrientações: ${visit.followup}` : "[Redigir o conteúdo factual e a conclusão do médico. Não emitir com este campo por preencher.]"}`,
              );
              setChecked(false);
            }}
          >
            Preparar estrutura para revisão
          </button>
          <button
            className={buttonStyle}
            onClick={async () => {
              setDraftId("");
              setTitle("");
              setText("");
              setFrom("");
              setTo("");
              setChecked(false);
            }}
          >
            Novo documento
          </button>
        </div>
        <label className="block text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />{" "}
          Revisei identificação, factos clínicos, período e informações
          necessárias para este documento.
        </label>
        <div className="flex gap-3">
          <button className={buttonStyle} onClick={() => save()}>
            Guardar rascunho
          </button>
          <button
            className={buttonStyle}
            onClick={async () => {
              if (text.includes("[Redigir")) {
                onMessage("Complete o conteúdo factual antes de emitir.");
                return;
              }
              save(true);
            }}
          >
            Finalizar documento
          </button>
        </div>
      </div>
      {list.map((d) => (
        <article
          className="space-y-3 rounded-xl border bg-white p-4"
          key={d.id}
        >
          <strong>{d.title}</strong>
          <p className="text-sm">
            {d.kind} ·{" "}
            {d.voided ? "ANULADO" : d.finalized ? "Emitido" : "Rascunho"} ·{" "}
            {new Date(d.created).toLocaleString("pt-PT")}
          </p>
          <p className="whitespace-pre-wrap text-sm">{d.text}</p>
          <div className="flex flex-wrap gap-2">
            {!d.finalized && !d.voided && (
              <button
                className={buttonStyle}
                onClick={async () => {
                  setDraftId(d.id);
                  setKind(d.kind);
                  setTitle(d.title);
                  setText(d.text);
                  setFrom(d.from);
                  setTo(d.to);
                  setChecked(false);
                }}
              >
                Continuar rascunho
              </button>
            )}
            <button
              className={buttonStyle}
              onClick={async () => {
                try {
                  await printProfessional("medical", d.id);
                } catch (e) {
                  onMessage(
                    e instanceof Error ? e.message : "Falha ao imprimir.",
                  );
                }
              }}
            >
              Imprimir / guardar PDF
            </button>
            <button
              disabled={!!d.voided}
              className={buttonStyle}
              onClick={async () => {
                if (visit.owner !== session.username) {
                  onMessage(
                    "Somente o médico responsável pode anular este documento.",
                  );
                  return;
                }
                const reason = window.prompt(
                  "Motivo da anulação do documento:",
                );
                if (!reason?.trim()) return;
                try {
                  await commitClinical(
                    session.empresaId!,
                    session.username!,
                    "Documento anulado",
                    d.id,
                    (s) => ({
                      ...s,
                      documents: s.documents.map((x) =>
                        x.id === d.id
                          ? {
                              ...x,
                              voided: new Date().toISOString(),
                              voidReason: reason,
                            }
                          : x,
                      ),
                    }),
                  );
                } catch (e) {
                  onMessage(e instanceof Error ? e.message : "Falha.");
                }
              }}
            >
              Anular preservando histórico
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
