import { useEffect, useState } from "react";
import { readClinical } from "../medicos/clinica/store";
import {
  AtendEnfermagem,
  nowLocal,
  NursingSession,
  todayLocal,
  useNursingStore,
  WardEvent,
  WardKind,
  WardState,
  WardStay,
} from "./shared";

export function useWard({
  patients,
  scope,
  session,
  onNew,
  onOpen,
}: {
  patients: AtendEnfermagem[];
  scope: string;
  session: NursingSession;
  onNew: () => void;
  onOpen: (p: AtendEnfermagem) => void;
}) {
  const [state, save, error] = useNursingStore<WardState>(scope + ":operacao", {
    events: [],
    beds: [],
    stays: [],
  });
  const [tab, setTab] = useState("leitos");
  const [patientId, setPatientId] = useState("");
  const [query, setQuery] = useState("");
  const [day, setDay] = useState(todayLocal());
  const [message, setMessage] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [draft, setDraft] = useState({
    when: nowLocal(),
    title: "",
    note: "",
    amount: "",
    direction: "entrada",
    prescription: "",
    sourcePrescriptionId: "",
    centralRxId: "",
    centralItemId: "",
    dose: "",
    route: "",
    situation: "",
    background: "",
    assessment: "",
    recommendation: "",
    pa: "",
    fc: "",
    fr: "",
    temp: "",
    spo2: "",
    glicemia: "",
    dor: "",
  });
  useEffect(() => {
    setDraft((p) => ({
      ...p,
      sourcePrescriptionId: "",
      centralRxId: "",
      centralItemId: "",
      title: "",
      note: "",
      prescription: "",
      dose: "",
      route: "",
    }));
  }, [patientId]);
  const [bedForm, setBedForm] = useState({ ward: "", room: "", bed: "" });
  const [targetBed, setTargetBed] = useState("");
  const [completion, setCompletion] = useState<{
    id: string;
    status: "concluido" | "nao_realizado";
  } | null>(null);
  const [completionReason, setCompletionReason] = useState("");
  const [identityChecked, setIdentityChecked] = useState(false);
  const [orderChecked, setOrderChecked] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const selected = patients.find((p) => String(p.idEnf) === patientId);
  const author = session.username || "";
  const apply = async (fn: (prev: WardState) => WardState) => {
    try {
      await save(fn);
      setMessage("Registo confirmado no servidor.");
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao guardar.");
      return false;
    }
  };
  const update = (key: keyof typeof draft, value: string) =>
    setDraft((p) => ({ ...p, [key]: value }));
  const activeStays = state.stays.filter((x) => !x.closed);
  const filteredPatients = patients.filter((p) =>
    `${p.nomePaciente} ${p.codigoAtendimento} ${p.quarto} ${p.leito}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const events = state.events
    .filter(
      (e) =>
        (!patientId || String(e.patientId) === patientId) &&
        e.kind === tab &&
        e.when.slice(0, 10) === day,
    )
    .sort((a, b) => a.when.localeCompare(b.when));
  const overdue = state.events.filter(
    (e) => e.status === "pendente" && new Date(e.when).getTime() < clock,
  );
  const totals = state.events
    .filter(
      (e) =>
        e.kind === "balanco" &&
        e.when.slice(0, 10) === day &&
        String(e.patientId) === patientId,
    )
    .reduce(
      (acc, e) => ({
        ...acc,
        [e.direction || "entrada"]:
          acc[e.direction || "entrada"] + (e.amount || 0),
      }),
      { entrada: 0, saida: 0 },
    );
  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
  const field = (label: string, key: keyof typeof draft, type = "text") => (
    <label className="space-y-1 text-sm" key={key}>
      <span>{label}</span>
      <input
        className={inputClass}
        type={type}
        readOnly={
          (!!draft.sourcePrescriptionId || !!draft.centralRxId) &&
          ["title", "dose", "route", "prescription"].includes(key)
        }
        step="any"
        value={draft[key]}
        onChange={(e) => update(key, e.target.value)}
      />
    </label>
  );
  async function addRecord() {
    if (!selected || !author.trim()) {
      setMessage(
        "Seleccione o paciente e entre com um utilizador identificado.",
      );
      return;
    }
    if (!draft.when || !Number.isFinite(new Date(draft.when).getTime())) {
      setMessage("Indique data e hora válidas.");
      return;
    }
    const kind = tab as WardKind;
    if (
      !["cuidados", "medicacao"].includes(kind) &&
      new Date(draft.when).getTime() > Date.now() + 60000
    ) {
      setMessage("Registos realizados não podem ter data futura.");
      return;
    }
    let title = draft.title.trim(),
      note = draft.note.trim();
    let values: Record<string, string> | undefined;
    if (kind === "sinais") {
      values = {};
      for (const key of [
        "pa",
        "fc",
        "fr",
        "temp",
        "spo2",
        "glicemia",
        "dor",
      ] as const)
        if (draft[key].trim()) values[key] = draft[key].trim();
      if (!Object.keys(values).length) {
        setMessage("Preencha pelo menos uma medição.");
        return;
      }
      for (const [key, value] of Object.entries(values)) {
        if (key === "pa") {
          if (!/^\d{2,3}\/\d{2,3}$/.test(value)) {
            setMessage("PA: use o formato 120/80.");
            return;
          }
        } else {
          const n = Number(value);
          if (
            !Number.isFinite(n) ||
            n < 0 ||
            (key === "spo2" && n > 100) ||
            (key === "dor" && n > 10)
          ) {
            setMessage("Verifique os valores das medições.");
            return;
          }
        }
      }
      title = "Medições de sinais vitais";
    }
    if (kind === "balanco") {
      if (
        !draft.amount.trim() ||
        !Number.isFinite(Number(draft.amount)) ||
        Number(draft.amount) <= 0
      ) {
        setMessage("Indique um volume positivo em mL.");
        return;
      }
      if (!title) {
        setMessage("Identifique a origem da entrada ou saída.");
        return;
      }
    }
    if (
      kind === "medicacao" &&
      (!draft.prescription.trim() || !draft.dose.trim() || !draft.route.trim())
    ) {
      setMessage(
        "Identifique a prescrição, a dose e a via conforme a ordem médica existente.",
      );
      return;
    }
    if (kind === "turno") {
      if (
        ![
          draft.situation,
          draft.background,
          draft.assessment,
          draft.recommendation,
        ].every((v) => v.trim())
      ) {
        setMessage("Preencha os quatro campos da passagem de turno.");
        return;
      }
      title = "Passagem de turno";
      note = `Situação: ${draft.situation}\nAntecedentes: ${draft.background}\nAvaliação: ${draft.assessment}\nRecomendações e pendências: ${draft.recommendation}\n${note}`;
    }
    if (!title || (["evolucao", "ocorrencia"].includes(kind) && !note)) {
      setMessage("Preencha o título e a descrição do registo.");
      return;
    }
    if (kind === "medicacao" && draft.sourcePrescriptionId) {
      const order = state.events.find(
        (e) =>
          e.id === draft.sourcePrescriptionId &&
          e.patientId === selected.idEnf &&
          e.kind === "prescricao",
      );
      if (!order || state.events.some((e) => e.values?.suspende === order.id)) {
        setMessage("Prescrição indisponível ou suspensa.");
        return;
      }
      if (
        new Date(draft.when) < new Date(order.values?.inicio || order.when) ||
        (order.values?.fim && new Date(draft.when) > new Date(order.values.fim))
      ) {
        setMessage("Horário fora da validade da prescrição.");
        return;
      }
      if (
        state.events.some(
          (e) => e.prescriptionId === order.id && e.when === draft.when,
        )
      ) {
        setMessage(
          "Já existe um horário para esta prescrição nesta data/hora.",
        );
        return;
      }
    }
    if (kind === "medicacao" && draft.centralRxId) {
      const clinical = readClinical(session.empresaId!);
      const rx = clinical.prescriptions.find((r) => r.id === draft.centralRxId);
      const item = rx?.items.find((i) => i.id === draft.centralItemId);
      if (
        !rx ||
        !item ||
        rx.wardPatientId !== selected.idEnf ||
        rx.cancelled ||
        new Date(draft.when).getTime() <
          new Date(rx.created).getTime() - 60000 ||
        new Date(rx.validUntil) < new Date(draft.when)
      ) {
        setMessage(
          "Prescrição médica indisponível, suspensa ou fora da validade.",
        );
        return;
      }
      if (
        state.events.some(
          (e) =>
            e.centralRxId === rx.id &&
            e.centralItemId === item.id &&
            e.when === draft.when,
        )
      ) {
        setMessage("Já existe uma administração agendada para este horário.");
        return;
      }
    }
    const event: WardEvent = {
      id: crypto.randomUUID(),
      patientId: selected.idEnf,
      kind,
      when: draft.when,
      created: new Date().toISOString(),
      author,
      title,
      note,
      status: ["cuidados", "medicacao"].includes(kind)
        ? "pendente"
        : "concluido",
      ...(values ? { values } : {}),
      ...(kind === "balanco"
        ? {
            amount: Number(draft.amount),
            direction: draft.direction as "entrada" | "saida",
          }
        : {}),
      ...(kind === "medicacao"
        ? {
            prescription: draft.prescription.trim(),
            prescriptionId: draft.sourcePrescriptionId || undefined,
            centralRxId: draft.centralRxId || undefined,
            centralItemId: draft.centralItemId || undefined,
            dose: draft.dose.trim(),
            route: draft.route.trim(),
          }
        : {}),
    };
    if (await apply((prev) => ({ ...prev, events: [...prev.events, event] })))
      setDraft((p) => ({
        ...p,
        title: "",
        note: "",
        amount: "",
        situation: "",
        background: "",
        assessment: "",
        recommendation: "",
      }));
  }
  async function finishRecord() {
    if (!completion || !author) {
      setMessage("É necessário um utilizador identificado.");
      return;
    }
    const item = state.events.find((e) => e.id === completion.id);
    if (!item || item.status !== "pendente") return;
    if (
      completion.status === "concluido" &&
      new Date(item.when).getTime() > Date.now()
    ) {
      setMessage("Não é possível concluir antes do horário agendado.");
      return;
    }
    if (completion.status === "nao_realizado" && !completionReason.trim()) {
      setMessage("Registe o motivo da não realização.");
      return;
    }
    if (item.centralRxId && completion.status === "concluido") {
      const rx = readClinical(session.empresaId!).prescriptions.find(
        (r) => r.id === item.centralRxId,
      );
      if (!rx || rx.cancelled || new Date(rx.validUntil) < new Date()) {
        setMessage(
          "A prescrição médica foi suspensa, expirou ou não está disponível.",
        );
        return;
      }
    }
    if (item.prescriptionId && completion.status === "concluido") {
      const order = state.events.find((e) => e.id === item.prescriptionId);
      if (
        !order ||
        state.events.some((e) => e.values?.suspende === item.prescriptionId) ||
        (order.values?.fim && new Date(order.values.fim) < new Date())
      ) {
        setMessage(
          "Prescrição indisponível, suspensa ou fora da validade. Confira a ordem médica.",
        );
        return;
      }
    }
    if (
      item.kind === "medicacao" &&
      completion.status === "concluido" &&
      (!identityChecked || !orderChecked)
    ) {
      setMessage(
        "Confirme a identificação do paciente e a conferência da prescrição.",
      );
      return;
    }
    if (
      await apply((prev) => ({
        ...prev,
        events: prev.events.map((e) =>
          e.id === item.id
            ? {
                ...e,
                status: completion.status,
                completed: new Date().toISOString(),
                completedBy: author,
                reason: completionReason.trim(),
              }
            : e,
        ),
      }))
    )
      setCompletion(null);
  }
  async function assignBed() {
    if (!selected || !author) {
      setMessage("Seleccione um paciente e um utilizador identificado.");
      return;
    }
    const bed = state.beds.find((b) => b.id === targetBed);
    if (!bed || bed.blocked || activeStays.some((s) => s.bedId === bed.id)) {
      setMessage("Seleccione um leito livre.");
      return;
    }
    const previous = activeStays.find((s) => s.patientId === selected.idEnf);
    const when = new Date().toISOString();
    await apply((prev) => ({
      ...prev,
      stays: [
        ...prev.stays.map((s) =>
          s === previous
            ? { ...s, closed: when, outcome: "Transferência interna" }
            : s,
        ),
        { patientId: selected.idEnf, bedId: bed.id, admitted: when },
      ],
      events: [
        ...prev.events,
        {
          id: crypto.randomUUID(),
          patientId: selected.idEnf,
          kind: "ocorrencia",
          when: nowLocal(),
          created: when,
          author,
          title: previous ? "Transferência de leito" : "Entrada na enfermaria",
          note: `Destino: ${bed.ward} / ${bed.room} / ${bed.bed}`,
          status: "concluido",
        },
      ],
    }));
  }
  async function closeStay(stay: WardStay, outcome: string) {
    if (!author) {
      setMessage("Utilizador não identificado.");
      return;
    }
    const pending = state.events.filter(
      (e) => e.patientId === stay.patientId && e.status === "pendente",
    );
    if (pending.length) {
      setMessage(
        `Resolva as ${pending.length} tarefas pendentes deste paciente antes da saída.`,
      );
      return;
    }
    const reason = window.prompt(
      `${outcome}: indique a referência da autorização e o destino, quando aplicável.`,
    );
    if (!reason?.trim()) return;
    await apply((prev) => ({
      ...prev,
      stays: prev.stays.map((s) =>
        s === stay ? { ...s, closed: new Date().toISOString(), outcome } : s,
      ),
      events: [
        ...prev.events,
        {
          id: crypto.randomUUID(),
          patientId: stay.patientId,
          kind: "ocorrencia",
          when: nowLocal(),
          created: new Date().toISOString(),
          author,
          title: outcome,
          note: reason.trim(),
          status: "concluido",
        },
      ],
    }));
  }
  return {
    patients,
    scope,
    session,
    onNew,
    onOpen,
    state,
    save,
    error,
    tab,
    setTab,
    patientId,
    setPatientId,
    query,
    setQuery,
    day,
    setDay,
    message,
    setMessage,
    clock,
    setClock,
    draft,
    setDraft,
    bedForm,
    setBedForm,
    targetBed,
    setTargetBed,
    completion,
    setCompletion,
    completionReason,
    setCompletionReason,
    identityChecked,
    setIdentityChecked,
    orderChecked,
    setOrderChecked,
    selected,
    author,
    apply,
    update,
    activeStays,
    filteredPatients,
    events,
    overdue,
    totals,
    inputClass,
    field,
    addRecord,
    finishRecord,
    assignBed,
    closeStay,
  };
}
