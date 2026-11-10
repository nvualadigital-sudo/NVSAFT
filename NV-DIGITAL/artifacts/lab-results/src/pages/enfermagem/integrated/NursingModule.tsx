import { CarePlanBoard } from "./CarePlanBoard";
import { ClinicalWorkbench, ClinicalCensus } from "./ClinicalWorkbench";
import { MedicationMap } from "./MedicationMap";
import { PatientClinicalWorkspace } from "./PatientClinicalWorkspace";
import type { Drug } from "./model";
import { PatientWristband } from "./PatientWristband";
import "./nursing.css";
import "./operational.css";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowRight,
  BedDouble,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  HeartPulse,
  Hospital,
  Layers3,
  Menu,
  Package,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
  AlertTriangle,
  ArrowLeftRight,
  WifiOff,
} from "lucide-react";
import {
  clinicalRequest,
  ClinicalApiError,
  type NursingConnection,
} from "./api";
import {
  type Bootstrap,
  type Care,
  type Dose,
  type Order,
  type Person,
  allowed,
  doseLabels,
  specialties,
} from "./model";
type Page =
  | "overview"
  | "patients"
  | "orders"
  | "pharmacy"
  | "mar"
  | "care"
  | "records"
  | "handover"
  | "safety";
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  value?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: string;
};
type Dialog = {
  title: string;
  subtitle: string;
  command: string;
  fields: Field[];
  payload?: Record<string, unknown>;
  revision: number;
  submit?: string;
  readOnly?: boolean;
};
const pages: {
  id: Page;
  label: string;
  icon: typeof Activity;
  group?: string;
}[] = [
  {
    id: "overview",
    label: "Central de enfermagem",
    icon: Layers3,
    group: "POSTO DE TRABALHO",
  },
  { id: "patients", label: "Pacientes e leitos", icon: BedDouble },
  { id: "orders", label: "Prescrição médica", icon: Stethoscope },
  { id: "pharmacy", label: "Farmácia clínica", icon: Package },
  { id: "mar", label: "Medicação · eMAR", icon: Pill },
  {
    id: "care",
    label: "Plano de cuidados",
    icon: ClipboardCheck,
    group: "CONTINUIDADE DOS CUIDADOS",
  },
  { id: "records", label: "Processo clínico", icon: HeartPulse },
  { id: "handover", label: "Passagem de turno", icon: ArrowLeftRight },
  { id: "safety", label: "Segurança e auditoria", icon: ShieldCheck },
];
const fmt = (v: string) =>
  new Date(v).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const time = (v: string) =>
  new Date(v).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
const localDate = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const choices = (rows: { id: string; name: string }[]) =>
  rows.map((x) => ({ value: x.id, label: x.name }));
const roleNames: Record<string, string> = {
  admin: "Administrador",
  medico: "Médico",
  enfermeiro: "Enfermeiro",
  chefe_enfermagem: "Chefe de enfermagem",
  farmaceutico: "Farmacêutico",
  auditor: "Auditor",
};
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`nc-badge ${tone}`}>{children}</span>;
}
function Empty({
  title,
  text,
  icon: Icon = ClipboardList,
}: {
  title: string;
  text: string;
  icon?: typeof Activity;
}) {
  return (
    <div className="nc-empty">
      <span>
        <Icon size={27} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="nc-panel">
      <div className="nc-panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function NursingModule(
  connection: NursingConnection & { embedded?: boolean; initialPage?: Page },
) {
  const [wristband, setWristband] = useState<Person | null>(null);
  const [data, setData] = useState<Bootstrap | null>(null),
    [page, setPage] = useState<Page>(connection.initialPage || "overview"),
    [patientId, setPatientId] = useState(""),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [connected, setConnected] = useState(false),
    [loadedAt, setLoadedAt] = useState(""),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [navOpen, setNavOpen] = useState(false);
  const conn = useRef(connection);
  conn.current = connection;
  const commandInFlight = useRef(false);
  const requestSeq = useRef(0),
    current = useRef<Bootstrap | null>(null);
  const refresh = async () => {
    if (commandInFlight.current) return;
    const seq = ++requestSeq.current;
    try {
      const next = await clinicalRequest(conn.current, "/bootstrap");
      if (seq !== requestSeq.current) return;
      if (
        current.current &&
        (current.current.actor.tenantId !== next.actor.tenantId ||
          current.current.actor.id !== next.actor.id)
      ) {
        setPatientId("");
        setWristband(null);
        setDialog(null);
      }
      current.current = next;
      setData(next);
      setConnected(true);
      setError("");
      setLoadedAt(new Date().toISOString());
    } catch (e) {
      if (seq === requestSeq.current) {
        setConnected(false);
        setError((e as Error).message);
        if (e instanceof ClinicalApiError && e.status === 401) {
          current.current = null;
          setData(null);
          setDialog(null);
          setWristband(null);
          setPatientId("");
        }
      }
    }
  };
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      requestSeq.current++;
    };
  }, [connection.baseUrl, connection.getAccessToken]);
  const a = data?.actor,
    s = data?.state;
  const can = (...roles: Parameters<typeof allowed>[1][]) =>
    allowed(a, ...roles);
  const open = (d: Omit<Dialog, "revision">) => {
    setError("");
    setDialog({ ...d, revision: s?.revision || 0 });
  };
  async function run(
    command: string,
    payload: Record<string, unknown>,
    revision = s?.revision,
  ) {
    if (!connected || busy || revision === undefined) return;
    setBusy(true);
    commandInFlight.current = true;
    setError("");
    ++requestSeq.current;
    try {
      const next = await clinicalRequest(conn.current, "/commands", {
        type: command,
        payload,
        revision,
        expectedTenantId: a?.tenantId,
        expectedActorId: a?.id,
        requestId: crypto.randomUUID(),
      });
      current.current = next;
      setData(next);
      setDialog(null);
      setNotice("Registo guardado e identificado no histórico.");
      setConnected(true);
      setLoadedAt(new Date().toISOString());
      setTimeout(() => setNotice(""), 4500);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ClinicalApiError && e.status === 401) {
        setConnected(false);
        setData(null);
        current.current = null;
        setDialog(null);
      }
      if (e instanceof ClinicalApiError && e.status === 409) {
        setDialog(null);
        commandInFlight.current = false;
        await refresh();
        setError(
          "O processo ou a sessão mudou. Reveja os dados e repita a operação.",
        );
      }
    } finally {
      commandInFlight.current = false;
      setBusy(false);
    }
  }
  const pt = s?.patients.find((p) => p.id === patientId);
  const person = (id: string) => s?.patients.find((p) => p.id === id);
  const order = (d: Dose) => s!.orders.find((o) => o.id === d.orderId)!;
  const drug = (o: Order) => s!.drugs.find((d) => d.id === o.drugId)!;
  const episode = (id: string) =>
    s?.episodes.find((e) => e.patientId === id && e.status !== "encerrado");
  const filtered = <T extends { patientId: string }>(rows: T[]) =>
    rows.filter((x) => !patientId || x.patientId === patientId);
  const doses =
    s?.doses.filter((d) => !patientId || order(d).patientId === patientId) ||
    [];
  const pending = doses.filter((d) =>
    ["dispensada", "aguarda_farmacia"].includes(d.status),
  );
  const patients =
    s?.patients.filter(
      (p) =>
        (!patientId || p.id === patientId) &&
        `${p.name} ${p.code}`.toLowerCase().includes(query.toLowerCase()),
    ) || [];
  const patientField: Field = {
    key: "patientId",
    label: "Paciente",
    type: "select",
    options: choices(s?.patients || []),
    value: patientId,
  };
  const newPatient = () =>
    open({
      title: "Novo processo clínico",
      subtitle: "Identificação única, partilhada pela equipa clínica.",
      command: "patient.create",
      fields: [
        { key: "name", label: "Nome completo" },
        { key: "birthDate", label: "Data de nascimento", type: "date" },
        {
          key: "sex",
          label: "Sexo",
          type: "select",
          options: ["Feminino", "Masculino", "Outro"].map((x) => ({
            value: x,
            label: x,
          })),
        },
        {
          key: "allergies",
          label: "Alergias conhecidas",
          hint: "Registe as alergias, «desconhecidas» ou «sem alergias conhecidas».",
        },
        {
          key: "conditions",
          label: "Antecedentes relevantes",
          type: "textarea",
          required: false,
        },
      ],
    });
  const newAdmission = () =>
    open({
      title: "Admitir paciente",
      subtitle: "Vincular o processo a uma especialidade, serviço e leito.",
      command: "episode.create",
      fields: [
        patientField,
        {
          key: "specialty",
          label: "Especialidade assistente",
          type: "specialty",
        },
        { key: "ward", label: "Serviço / unidade" },
        { key: "bed", label: "Leito" },
        {
          key: "diagnosis",
          label: "Diagnóstico / motivo de admissão",
          type: "textarea",
        },
      ],
    });
  const newOrder = () =>
    open({
      title: "Prescrever e assinar",
      subtitle:
        "As doses são definidas pelo prescritor. A farmácia recebe a prescrição imediatamente.",
      command: "order.create",
      fields: [
        patientField,
        {
          key: "episodeId",
          label: "Episódio activo",
          type: "select",
          options: (s?.episodes.filter((e) => e.status === "activo") || []).map(
            (e) => ({
              value: e.id,
              label: `${person(e.patientId)?.name} · ${e.specialty} · ${e.bed}`,
            }),
          ),
        },
        {
          key: "drugId",
          label: "Medicamento",
          type: "select",
          options: (s?.drugs || [])
            .filter((d) => !d.needsReview)
            .map((d) => ({
              value: d.id,
              label: `${d.name} · ${d.strength} (${d.unit})`,
            })),
        },
        {
          key: "dose",
          label: "Dose prescrita (com unidade)",
          hint: "Ex.: 500 mg. O módulo não calcula doses.",
        },
        {
          key: "units",
          label: "Unidades de stock por administração",
          type: "number",
          min: 0.001,
          step: "any",
        },
        {
          key: "route",
          label: "Via",
          type: "select",
          options: [
            "Oral",
            "IV",
            "IM",
            "SC",
            "Inalatória",
            "Tópica",
            "Rectal",
            "Oftálmica",
            "Otológica",
            "Outra",
          ].map((x) => ({ value: x, label: x })),
        },
        { key: "indication", label: "Indicação clínica" },
        {
          key: "start",
          label: "Primeira administração",
          type: "datetime-local",
          value: localDate(),
        },
        {
          key: "interval",
          label: "Intervalo (horas)",
          type: "number",
          min: 0.5,
          max: 168,
          step: "0.5",
        },
        {
          key: "count",
          label: "Número de administrações",
          type: "number",
          min: 1,
          max: 100,
        },
        {
          key: "instructions",
          label: "Instruções e monitorização",
          type: "textarea",
          required: false,
        },
        {
          key: "allergyReviewed",
          label:
            "Revi as alergias e validei dose, via, horários, interacções e adequação clínica.",
          type: "checkbox",
        },
      ],
      submit: "Assinar prescrição",
    });
  const newDrug = () =>
    open({
      title: "Cadastrar medicamento",
      subtitle: "Catálogo partilhado entre médico, farmácia e enfermagem.",
      command: "drug.create",
      fields: [
        { key: "name", label: "Designação" },
        { key: "ingredient", label: "Princípio activo" },
        { key: "strength", label: "Apresentação / concentração" },
        {
          key: "unit",
          label: "Unidade de stock",
          hint: "Ex.: comprimido, ampola, frasco.",
        },
        {
          key: "highAlert",
          label: "Exigir dupla verificação independente",
          type: "checkbox",
          required: false,
        },
      ],
    });
  const receive = () =>
    open({
      title: "Receber lote",
      subtitle:
        "Registar quantidade e validade. A dispensa apresenta primeiro os lotes com menor validade.",
      command: "batch.receive",
      fields: [
        {
          key: "drugId",
          label: "Medicamento",
          type: "select",
          options: choices(s?.drugs || []),
        },
        { key: "lot", label: "Lote" },
        { key: "expires", label: "Validade", type: "date" },
        {
          key: "quantity",
          label: "Quantidade em unidades de stock",
          type: "number",
          min: 0.001,
          step: "any",
        },
      ],
    });
  const dispense = (d: Dose) => {
    const o = order(d);
    open({
      title: "Validar e dispensar",
      subtitle: `${person(o.patientId)?.name} · ${drug(o).name} · ${o.dose} · ${o.route}`,
      command: "dose.dispense",
      payload: { doseId: d.id },
      fields: [
        {
          key: "batchId",
          label: `Lote para ${d.units} unidade(s) · ${fmt(d.due)}`,
          type: "select",
          options: s!.batches
            .filter(
              (b) =>
                b.drugId === o.drugId &&
                b.quantity >= d.units &&
                b.expires >= new Date().toISOString().slice(0, 10) &&
                b.expires >= d.due.slice(0, 10),
            )
            .sort((x, y) => x.expires.localeCompare(y.expires))
            .map((b) => ({
              value: b.id,
              label: `${b.lot} · ${b.quantity} disponíveis · validade ${b.expires}`,
            })),
        },
      ],
      submit: "Confirmar dispensa",
    });
  };
  const administer = (d: Dose, verify = false) => {
    const o = order(d),
      dg = drug(o);
    open({
      title: verify ? "Dupla verificação" : "Registar administração",
      subtitle: `${person(o.patientId)?.name} · ${dg.name} · ${o.dose} · ${o.route} · ${fmt(d.due)}`,
      command: verify ? "dose.verify" : "dose.administer",
      payload: { doseId: d.id },
      fields: [
        {
          key: "patientCode",
          label: "Leia ou introduza o código da pulseira",
          hint: "A identidade é conferida com o processo da prescrição.",
        },
        {
          key: "checks",
          label: "Confirmei paciente, medicamento, dose, via e horário.",
          type: "checkbox",
        },
        ...(!verify && dg.highAlert
          ? [
              {
                key: "witnessId",
                label: "Dupla verificação registada por",
                type: "select",
                options: s!.audit
                  .filter(
                    (e) =>
                      e.action === "dose.verify" &&
                      e.entityId === d.id &&
                      e.actorId !== a?.id,
                  )
                  .map((e) => ({ value: e.actorId, label: e.actor })),
              },
            ]
          : []),
        ...(!verify
          ? [
              {
                key: "note",
                label: "Observações / justificação do horário",
                type: "textarea",
                required: false,
              },
            ]
          : []),
      ],
      submit: verify ? "Confirmar verificação" : "Confirmar administração",
    });
  };
  const omit = (d: Dose) =>
    open({
      title: "Registar não administração",
      subtitle:
        "O motivo fica no eMAR. Doses já dispensadas ficam pendentes de devolução à farmácia.",
      command: "dose.omit",
      payload: { doseId: d.id },
      fields: [
        {
          key: "reason",
          label: "Motivo (recusa, indisponibilidade ou outra causa)",
          type: "textarea",
        },
      ],
    });
  const newRecord = (kind: string, selectedPatient = patientId) =>
    open({
      title: {
        vitais: "Registar sinais vitais",
        balanco: "Balanço hídrico",
        evolucao: "Evolução de enfermagem",
        incidente: "Registar incidente",
        triagem: "Triagem clínica",
        avaliacao: "Avaliação de enfermagem",
        dispositivo: "Dispositivos clínicos",
        procedimento: "Procedimento / curativo",
      }[kind]!,
      subtitle:
        "Registo datado e identificado pelo profissional com sessão activa.",
      command: "observation.create",
      payload: { kind, ...(kind === "evolucao" ? { format: "SOAPIER" } : {}) },
      fields: [
        { ...patientField, value: selectedPatient },
        ...(kind === "evolucao"
          ? [
              {
                key: "subjective",
                label: "S · Dados subjectivos",
                type: "clinical-text",
                hint: "Queixas e relato do paciente.",
              },
              {
                key: "objective",
                label: "O · Dados objectivos",
                type: "clinical-text",
                hint: "Observações e medições efectuadas.",
              },
              {
                key: "analysis",
                label: "A · Avaliação de enfermagem",
                type: "clinical-text",
              },
              {
                key: "plan",
                label: "P · Plano de cuidados",
                type: "clinical-text",
              },
              {
                key: "intervention",
                label: "I · Intervenções realizadas",
                type: "clinical-text",
              },
              {
                key: "evaluation",
                label: "E · Resultado observado",
                type: "clinical-text",
              },
              {
                key: "reassessment",
                label: "R · Reavaliação e continuidade",
                type: "textarea",
              },
            ]
          : kind === "vitais"
            ? [
                {
                  key: "systolic",
                  label: "PA sistólica (mmHg)",
                  type: "number",
                  min: 20,
                  max: 350,
                },
                {
                  key: "diastolic",
                  label: "PA diastólica (mmHg)",
                  type: "number",
                  min: 10,
                  max: 250,
                },
                {
                  key: "pulse",
                  label: "Frequência cardíaca (bpm)",
                  type: "number",
                  min: 10,
                  max: 300,
                },
                {
                  key: "temperature",
                  label: "Temperatura (°C)",
                  type: "number",
                  min: 25,
                  max: 45,
                  step: "0.1",
                },
                {
                  key: "spo2",
                  label: "SpO₂ (%)",
                  type: "number",
                  min: 0,
                  max: 100,
                },
                {
                  key: "respiration",
                  label: "Frequência respiratória (/min)",
                  type: "number",
                  min: 1,
                  max: 120,
                },
                {
                  key: "pain",
                  label: "Dor (0–10)",
                  type: "number",
                  min: 0,
                  max: 10,
                },
              ]
            : kind === "balanco"
              ? [
                  {
                    key: "direction",
                    label: "Sentido",
                    type: "select",
                    options: [
                      { value: "entrada", label: "Entrada" },
                      { value: "saida", label: "Saída" },
                    ],
                  },
                  {
                    key: "ml",
                    label: "Volume (mL)",
                    type: "number",
                    min: 0.1,
                    max: 50000,
                    step: "any",
                  },
                  { key: "source", label: "Origem / tipo de líquido" },
                ]
              : kind === "avaliacao"
                ? [
                    { key: "consciousness", label: "Estado de consciência" },
                    { key: "skin", label: "Integridade cutânea" },
                    { key: "mobility", label: "Mobilidade e autonomia" },
                    {
                      key: "fallRisk",
                      label: "Risco de queda e escala utilizada",
                    },
                    {
                      key: "pressureRisk",
                      label: "Risco de lesão por pressão e escala utilizada",
                    },
                    {
                      key: "note",
                      label: "Avaliação, necessidades e medidas de prevenção",
                      type: "textarea",
                    },
                  ]
                : kind === "dispositivo"
                  ? [
                      {
                        key: "device",
                        label: "Dispositivo (cateter, sonda, dreno…) ",
                      },
                      {
                        key: "deviceAction",
                        label: "Acção",
                        type: "select",
                        options: [
                          "Inserção",
                          "Manutenção",
                          "Avaliação",
                          "Retirada",
                        ].map((x) => ({ value: x, label: x })),
                      },
                      { key: "site", label: "Local / calibre / identificação" },
                      {
                        key: "note",
                        label: "Condição, cuidados e intercorrências",
                        type: "textarea",
                      },
                    ]
                  : kind === "procedimento"
                    ? [
                        {
                          key: "procedure",
                          label: "Procedimento / curativo realizado",
                        },
                        {
                          key: "note",
                          label: "Materiais, avaliação, execução e resposta",
                          type: "textarea",
                        },
                      ]
                    : kind === "triagem"
                      ? [
                          {
                            key: "complaint",
                            label: "Queixa principal",
                            type: "textarea",
                          },
                          {
                            key: "priority",
                            label: "Prioridade atribuída pelo profissional",
                            type: "select",
                            options: [
                              "Vermelho",
                              "Laranja",
                              "Amarelo",
                              "Verde",
                              "Azul",
                            ].map((x) => ({ value: x, label: x })),
                          },
                          {
                            key: "discriminator",
                            label: "Discriminador / fundamentação",
                            type: "textarea",
                          },
                        ]
                      : [
                          {
                            key: "note",
                            label:
                              kind === "evolucao"
                                ? "Evolução clínica (SOAPIER ou texto estruturado)"
                                : "Descrição do incidente e medidas tomadas",
                            type: "textarea",
                          },
                        ]),
      ],
    });
  const newCare = () =>
    open({
      title: "Plano individual de cuidados",
      subtitle:
        "Diagnóstico de enfermagem, resultado esperado, intervenção e reavaliação.",
      command: "care.create",
      fields: [
        patientField,
        { key: "diagnosis", label: "Diagnóstico de enfermagem" },
        { key: "goal", label: "Objectivo mensurável" },
        {
          key: "intervention",
          label: "Intervenção e frequência",
          type: "textarea",
        },
        {
          key: "due",
          label: "Executar até",
          type: "datetime-local",
          value: localDate(),
        },
      ],
    });
  const newHandover = () =>
    open({
      title: "Passagem de turno · SBAR",
      subtitle:
        "A recepção deve ser confirmada por outro profissional na sua própria sessão.",
      command: "handover.create",
      fields: [
        patientField,
        { key: "situation", label: "S · Situação actual", type: "textarea" },
        {
          key: "background",
          label: "B · Antecedentes relevantes",
          type: "textarea",
        },
        { key: "assessment", label: "A · Avaliação clínica", type: "textarea" },
        {
          key: "recommendation",
          label: "R · Recomendações e pendências",
          type: "textarea",
        },
      ],
    });
  const configureDrug = (d: Drug) =>
    open({
      title: "Validar medicamento do stock central",
      subtitle:
        "Confirme os dados clínicos da apresentação antes de permitir prescrição.",
      command: "drug.configure",
      payload: { drugId: d.id },
      fields: [
        { key: "name", label: "Designação", value: d.name },
        { key: "ingredient", label: "Princípio activo" },
        { key: "strength", label: "Apresentação / concentração" },
        { key: "unit", label: "Unidade de stock" },
        {
          key: "highAlert",
          label: "Exigir dupla verificação independente",
          type: "checkbox",
          required: false,
        },
      ],
    });
  function doseTable(rows: Dose[], mode: "pharmacy" | "mar" | "compact") {
    return rows.length ? (
      <div className="nc-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Paciente / prescrição</th>
              <th>Horário e dose</th>
              <th>Estado</th>
              <th>{mode === "compact" ? "Via" : "Acção"}</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice()
              .sort((x, y) => x.due.localeCompare(y.due))
              .map((d) => {
                const o = order(d),
                  dg = drug(o),
                  p = person(o.patientId);
                return (
                  <tr key={d.id}>
                    <td>
                      <button
                        className="nc-text-btn"
                        onClick={() => {
                          setPatientId(p!.id);
                          setPage("mar");
                        }}
                      >
                        {p?.name}
                      </button>
                      <span className="nc-cell-sub">
                        {dg.name} · {dg.strength}{" "}
                        {dg.highAlert && (
                          <b className="nc-risk-text">· Dupla verificação</b>
                        )}
                      </span>
                    </td>
                    <td>
                      <strong
                        className={
                          Date.parse(d.due) < Date.now() &&
                          ["dispensada", "aguarda_farmacia"].includes(d.status)
                            ? "nc-late"
                            : ""
                        }
                      >
                        {fmt(d.due)}
                      </strong>
                      <span className="nc-cell-sub">
                        {o.dose} · {o.route}
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          d.status === "administrada"
                            ? "green"
                            : d.status === "dispensada"
                              ? "blue"
                              : d.status === "aguarda_farmacia"
                                ? "amber"
                                : "neutral"
                        }
                      >
                        {doseLabels[d.status]}
                      </Badge>
                      {d.at && (
                        <span className="nc-cell-sub">
                          {d.administeredBy} · {fmt(d.at)}
                        </span>
                      )}
                      {d.note && <span className="nc-cell-sub">{d.note}</span>}
                    </td>
                    <td>
                      {mode === "compact" ? (
                        o.route
                      ) : (
                        <div className="nc-row-actions">
                          {mode === "pharmacy" &&
                            d.status === "aguarda_farmacia" &&
                            can("farmaceutico") && (
                              <button
                                disabled={!connected || busy}
                                className="nc-small primary"
                                onClick={() => dispense(d)}
                              >
                                Dispensar <ArrowRight size={13} />
                              </button>
                            )}
                          {mode === "pharmacy" &&
                            d.batchId &&
                            !d.returned &&
                            ["omitida", "suspensa"].includes(d.status) &&
                            can("farmaceutico") && (
                              <button
                                disabled={!connected || busy}
                                className="nc-small"
                                onClick={() =>
                                  open({
                                    title: "Conferir devolução",
                                    subtitle:
                                      "A reposição de stock só ocorre após conferência da farmácia.",
                                    command: "dose.return",
                                    payload: { doseId: d.id },
                                    fields: [
                                      {
                                        key: "reason",
                                        label: "Motivo e conferência",
                                        type: "textarea",
                                      },
                                      {
                                        key: "intact",
                                        label:
                                          "Embalagem íntegra e condições de conservação verificadas.",
                                        type: "checkbox",
                                      },
                                    ],
                                  })
                                }
                              >
                                Devolver
                              </button>
                            )}
                          {mode === "mar" &&
                            d.status === "dispensada" &&
                            can("enfermeiro", "chefe_enfermagem") && (
                              <>
                                <button
                                  disabled={!connected || busy}
                                  className="nc-small primary"
                                  onClick={() => administer(d)}
                                >
                                  <Check size={13} /> Administrar
                                </button>
                                {dg.highAlert && (
                                  <button
                                    disabled={!connected || busy}
                                    className="nc-small"
                                    onClick={() => administer(d, true)}
                                  >
                                    Dupla verificação
                                  </button>
                                )}
                              </>
                            )}
                          {mode === "mar" &&
                            ["dispensada", "aguarda_farmacia"].includes(
                              d.status,
                            ) &&
                            can("enfermeiro", "chefe_enfermagem") && (
                              <button
                                disabled={!connected || busy}
                                className="nc-small"
                                onClick={() => omit(d)}
                              >
                                Não administrar
                              </button>
                            )}
                          {mode === "pharmacy" &&
                            d.batchId &&
                            !d.returned &&
                            ["omitida", "suspensa"].includes(d.status) &&
                            can("farmaceutico") && (
                              <button
                                disabled={!connected || busy}
                                className="nc-small"
                                onClick={() =>
                                  open({
                                    title: "Registar perda",
                                    subtitle:
                                      "A unidade é encerrada sem reposição de stock.",
                                    command: "dose.discard",
                                    payload: { doseId: d.id },
                                    fields: [
                                      {
                                        key: "reason",
                                        label:
                                          "Motivo (expiração, dano ou conservação)",
                                        type: "textarea",
                                      },
                                    ],
                                  })
                                }
                              >
                                Registar perda
                              </button>
                            )}
                          {d.returned && (
                            <Badge
                              tone={
                                d.returnDisposition === "perda"
                                  ? "amber"
                                  : "green"
                              }
                            >
                              {d.returnDisposition === "perda"
                                ? "Perda registada"
                                : "Devolvida"}
                            </Badge>
                          )}
                          {d.pharmacist && (
                            <span className="nc-cell-sub">
                              Farmácia: {d.pharmacist}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="Sem administrações nesta vista"
        text="As doses aparecem aqui após a assinatura da prescrição médica."
        icon={Pill}
      />
    );
  }
  const navigatePatient = (
    id: string,
    target: "records" | "mar" | "care" | "handover" | "patients" = "records",
  ) => {
    setPatientId(id);
    setPage(target);
  };
  const assumeEpisode = (e: import("./model").Episode) =>
    open({
      title: "Assumir responsabilidade de enfermagem",
      subtitle: `${person(e.patientId)?.name} · ${e.ward} · Leito ${e.bed}`,
      command: "episode.assign",
      payload: { episodeId: e.id },
      fields:
        e.nurseId && e.nurseId !== a?.id
          ? [
              {
                key: "reason",
                label: "Motivo da mudança e passagem de responsabilidade",
                type: "textarea",
              },
            ]
          : [],
      submit: "Assumir paciente",
    });
  const careAction = (c: Care) =>
    open(
      c.status === "planeado"
        ? {
            title: "Confirmar intervenção",
            subtitle: c.intervention,
            command: "care.perform",
            payload: { careId: c.id },
            fields: [],
            submit: "Confirmar realização",
          }
        : {
            title: "Avaliar resultado",
            subtitle: c.goal,
            command: "care.evaluate",
            payload: { careId: c.id },
            fields: [
              {
                key: "outcome",
                label: "Resultado observado e continuidade dos cuidados",
                type: "textarea",
              },
            ],
          },
    );
  const doseAction = (d: Dose) => {
    if (d.status === "dispensada" && can("enfermeiro", "chefe_enfermagem")) {
      administer(d);
      return;
    }
    if (d.status === "aguarda_farmacia" && can("farmaceutico")) {
      dispense(d);
      return;
    }
    const o = order(d),
      dg = drug(o),
      p = person(o.patientId),
      batch = s?.batches.find((b) => b.id === d.batchId);
    open({
      title: "Rastreabilidade da dose",
      subtitle: `${p?.name} · ${p?.code}\n${dg.name} · ${dg.strength}\n${o.dose} · ${o.route} · previsto ${fmt(d.due)}\nEstado: ${doseLabels[d.status]}\nPrescritor: ${o.prescriber} · cédula ${o.registration}\nFarmácia: ${d.pharmacist || "Aguarda dispensa"} · Lote: ${batch?.lot || "—"}\nAdministração: ${d.administeredBy || "Não registada"} ${d.at ? fmt(d.at) : ""}\n${d.note || ""}`,
      command: "",
      fields: [],
      readOnly: true,
    });
  };
  function patientRows() {
    return (
      <ClinicalCensus
        state={s!}
        actor={a!}
        patients={patients}
        onPatient={navigatePatient}
        onRecord={newRecord}
        onAssume={assumeEpisode}
        disabled={!connected || busy}
      />
    );
  }
  const canPrimary = ["pharmacy", "safety"].includes(page)
    ? false
    : page === "orders"
      ? can("medico")
      : page === "care" || page === "handover"
        ? can("enfermeiro", "chefe_enfermagem")
        : can("medico", "enfermeiro", "chefe_enfermagem");
  const title = pages.find((p) => p.id === page)!;
  const shell = (
    <div className="nc-loading">
      <Hospital size={32} />
      <h1>O seu posto clínico, ligado à equipa.</h1>
      <p>
        Entre pelo sistema principal para continuar com a sua conta e as
        permissões da sua unidade.
      </p>
      {error && (
        <div className="nc-connection-error">
          <WifiOff size={18} />
          {error}
        </div>
      )}
      <button className="nc-btn primary" onClick={refresh}>
        <RefreshCw size={16} /> Verificar sessão existente
      </button>
      <small>NVUALASOFT · Módulo de enfermagem integrado</small>
    </div>
  );
  return (
    <div className={`nc-app ${connection.embedded ? "nc-embedded" : ""}`}>
      <aside className={`nc-sidebar ${navOpen ? "open" : ""}`}>
        <div className="nc-brand">
          <span>
            <Activity size={24} />
          </span>
          <div>
            NVUALASOFT<small>ENFERMAGEM · CLÍNICO</small>
          </div>
        </div>
        <div className="nc-unit">
          <Hospital size={17} />
          <div>
            <strong>{a?.tenantName || "A sua unidade"}</strong>
            <span>Enfermagem & equipa clínica</span>
          </div>
        </div>
        <nav aria-label="Módulo de enfermagem">
          {pages.map((p) => (
            <div key={p.id}>
              {p.group && <div className="nc-nav-label">{p.group}</div>}
              <button
                aria-label={p.label}
                className={page === p.id ? "active" : ""}
                onClick={() => {
                  setPage(p.id);
                  setNavOpen(false);
                }}
              >
                <p.icon size={18} />
                {p.label}
                {p.id === "mar" && pending.length > 0 && (
                  <span className="nc-nav-count">{pending.length}</span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="nc-sidebar-foot">
          <ShieldCheck size={19} />
          <div>
            Continuidade assistencial.
            <small>Identificação · registo · reavaliação</small>
          </div>
        </div>
        <div className="nc-user">
          <span className="nc-avatar">
            {a?.name
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join("") || "NV"}
          </span>
          <div>
            <strong>{a?.name || "Sessão do sistema principal"}</strong>
            <small>
              {a?.roles.map((r) => roleNames[r]).join(" · ") ||
                "Acesso integrado"}
            </small>
          </div>
        </div>
      </aside>
      <div className="nc-workspace">
        <header className="nc-header">
          <div className="nc-breadcrumb">
            <button
              className="nc-icon-btn nc-mobile-toggle"
              onClick={() => setNavOpen(!navOpen)}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <span>Clínico</span>
            <ChevronRight size={13} />
            <strong>Enfermagem</strong>
            <Badge tone="green">Enfermagem 2.0</Badge>
          </div>
          <div className="nc-header-right">
            <span className={`nc-connection ${connected ? "on" : ""}`}>
              <i />
              {connected ? "Ligado ao servidor" : "Sem ligação confirmada"}
            </span>
            <button
              title="Actualizar dados"
              aria-label="Actualizar dados"
              className="nc-icon-btn"
              onClick={refresh}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        {connection.embedded && (
          <nav className="nc-embedded-nav" aria-label="Áreas de enfermagem">
            {pages.map((p) => (
              <button
                key={p.id}
                className={page === p.id ? "active" : ""}
                onClick={() => setPage(p.id)}
              >
                <p.icon size={16} />
                {p.label}
              </button>
            ))}
          </nav>
        )}
        {!s ? (
          shell
        ) : (
          <main>
            <div className="op-print-identity">
              <strong>{a?.tenantName}</strong>
              <span>
                Enfermagem · leitura de{" "}
                {loadedAt ? new Date(loadedAt).toLocaleString("pt-PT") : "—"} ·
                revisão {s.revision}
              </span>
            </div>
            <div className="nc-page-head">
              <div>
                <div className="nc-eyebrow">
                  GESTÃO ASSISTENCIAL · PROCESSO DE ENFERMAGEM
                </div>
                <h1>
                  {title.label}
                  <span className="nc-title-dot" />
                </h1>
                <p>
                  {
                    {
                      overview:
                        "Censo assistencial, responsabilidade por paciente e execução dos cuidados do turno.",
                      patients:
                        "Do acolhimento à alta, o mesmo processo clínico.",
                      orders:
                        "Prescrição partilhada com a farmácia e a equipa de enfermagem.",
                      pharmacy:
                        "Validar, dispensar e acompanhar. Rastreabilidade até ao lote.",
                      mar: "Da prescrição à administração, com confirmação em cada etapa.",
                      care: "Planear, executar e avaliar os cuidados de cada paciente.",
                      records:
                        "Avaliação, constantes, evolução e continuidade dos cuidados no mesmo processo.",
                      handover:
                        "Continuidade de cuidados entre profissionais e turnos.",
                      safety: "Quem fez, quando fez e o que ficou registado.",
                    }[page]
                  }
                </p>
              </div>
              <div className="nc-head-actions">
                <button className="nc-btn" onClick={() => window.print()}>
                  <Printer size={16} /> Imprimir
                </button>
                {canPrimary && (
                  <button
                    disabled={!connected || busy}
                    className="nc-btn primary"
                    onClick={
                      page === "orders"
                        ? newOrder
                        : page === "care"
                          ? newCare
                          : page === "handover"
                            ? newHandover
                            : page === "records"
                              ? () => newRecord("evolucao")
                              : page === "overview"
                                ? () => newRecord("avaliacao")
                                : page === "mar"
                                  ? () => newRecord("incidente")
                                  : newPatient
                    }
                  >
                    <Plus size={17} />
                    {page === "orders"
                      ? "Nova prescrição"
                      : page === "care"
                        ? "Novo plano"
                        : page === "handover"
                          ? "Passar turno"
                          : page === "records"
                            ? "Nova evolução"
                            : page === "overview"
                              ? "Avaliar paciente"
                              : page === "mar"
                                ? "Registar intercorrência"
                                : "Novo paciente"}
                  </button>
                )}
                {page === "pharmacy" && can("farmaceutico") && (
                  <button
                    disabled={!connected || busy}
                    className="nc-btn primary"
                    onClick={receive}
                  >
                    <Plus size={17} /> Receber lote
                  </button>
                )}
              </div>
            </div>
            {error && !dialog && (
              <div className="nc-alert error" role="alert">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="nc-alert success" role="status">
                <CheckCheck size={18} />
                {notice}
              </div>
            )}
            <div className="nc-filterbar">
              <div className="nc-search">
                <Search size={17} />
                <input
                  aria-label="Pesquisar pacientes"
                  placeholder="Pesquisar nome ou nº de processo…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <label className="nc-filter-label">
                Processo{" "}
                <select
                  aria-label="Filtrar processo"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                >
                  <option value="">Todos os pacientes</option>
                  {s.patients
                    .filter((p) =>
                      `${p.name} ${p.code}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.code}
                      </option>
                    ))}
                </select>
              </label>
              <span className="nc-updated">
                {loadedAt ? `Dados de ${time(loadedAt)}` : "A carregar"}
              </span>
            </div>
            {pt && page !== "records" && (
              <div className="nc-patient-banner">
                <span className="nc-avatar">
                  {pt.name
                    .split(" ")
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <strong>{pt.name}</strong>
                  <span>
                    {pt.code} · Nasc. {pt.birthDate} ·{" "}
                    {episode(pt.id)?.ward || "Sem admissão"}{" "}
                    {episode(pt.id)?.bed}
                  </span>
                </div>
                <Badge tone="amber">Alergias: {pt.allergies}</Badge>
                <button className="nc-small" onClick={() => setWristband(pt)}>
                  Pulseira QR
                </button>
                {can("medico", "enfermeiro", "chefe_enfermagem") && (
                  <button
                    disabled={!connected || busy}
                    className="nc-small"
                    onClick={() =>
                      open({
                        title: "Actualizar segurança do paciente",
                        subtitle: "A alteração fica identificada na auditoria.",
                        command: "patient.update",
                        payload: { patientId: pt.id },
                        fields: [
                          {
                            key: "allergies",
                            label: "Alergias conhecidas",
                            value: pt.allergies,
                          },
                          {
                            key: "conditions",
                            label: "Antecedentes",
                            value: pt.conditions,
                            required: false,
                          },
                        ],
                      })
                    }
                  >
                    Rever alergias
                  </button>
                )}
                <button
                  className="nc-icon-btn"
                  aria-label="Limpar paciente seleccionado"
                  onClick={() => setPatientId("")}
                >
                  <X size={17} />
                </button>
              </div>
            )}
            {page === "overview" && (
              <ClinicalWorkbench
                state={s}
                actor={a!}
                patients={patients}
                onPatient={navigatePatient}
                onRecord={newRecord}
                onAssume={assumeEpisode}
                onDose={doseAction}
                onCare={careAction}
                disabled={!connected || busy}
              />
            )}
            {page === "patients" && (
              <>
                <div className="nc-section-actions">
                  <p>
                    <BedDouble size={18} /> Admissões, transferências de
                    responsabilidade e alta
                  </p>
                  {can("medico", "enfermeiro", "chefe_enfermagem") && (
                    <button
                      disabled={!connected || busy}
                      className="nc-btn"
                      onClick={newAdmission}
                    >
                      <Plus size={16} /> Admitir no leito
                    </button>
                  )}
                </div>
                <Panel
                  title="Processos clínicos"
                  subtitle={`${patients.length} paciente(s) nesta vista`}
                >
                  {patientRows()}
                </Panel>
                {pt && episode(pt.id) && (
                  <Panel
                    title="Fluxo de alta"
                    subtitle="Autorização médica seguida da confirmação de saída pela enfermagem"
                  >
                    <div className="nc-card-body">
                      <p>{episode(pt.id)!.diagnosis}</p>
                      {can("medico", "enfermeiro", "chefe_enfermagem") &&
                        episode(pt.id)!.status === "activo" && (
                          <button
                            className="nc-btn"
                            disabled={!connected || busy}
                            onClick={() =>
                              open({
                                title: "Transferir paciente",
                                subtitle:
                                  "O processo e as prescrições mantêm-se no mesmo episódio.",
                                command: "episode.transfer",
                                payload: { episodeId: episode(pt.id)!.id },
                                fields: [
                                  {
                                    key: "specialty",
                                    label: "Especialidade",
                                    type: "specialty",
                                  },
                                  { key: "ward", label: "Serviço de destino" },
                                  { key: "bed", label: "Leito de destino" },
                                  {
                                    key: "reason",
                                    label:
                                      "Motivo e passagem de responsabilidade",
                                    type: "textarea",
                                  },
                                ],
                              })
                            }
                          >
                            Transferir serviço / leito
                          </button>
                        )}
                      <p>{episode(pt.id)!.dischargeNote}</p>
                      {can("medico") && episode(pt.id)!.status === "activo" && (
                        <button
                          disabled={!connected || busy}
                          className="nc-btn"
                          onClick={() =>
                            open({
                              title: "Autorizar alta médica",
                              subtitle:
                                "As prescrições do episódio e doses pendentes serão suspensas. A farmácia deverá conferir devoluções.",
                              command: "discharge.authorize",
                              payload: { episodeId: episode(pt.id)!.id },
                              fields: [
                                {
                                  key: "note",
                                  label: "Resumo de alta e seguimento",
                                  type: "textarea",
                                },
                              ],
                            })
                          }
                        >
                          Autorizar alta
                        </button>
                      )}
                      {can("enfermeiro", "chefe_enfermagem") &&
                        episode(pt.id)!.status === "alta_autorizada" && (
                          <button
                            disabled={!connected || busy}
                            className="nc-btn primary"
                            onClick={() =>
                              open({
                                title: "Confirmar saída",
                                subtitle:
                                  "Registe orientações e a entrega dos cuidados. O leito será libertado.",
                                command: "discharge.finish",
                                payload: { episodeId: episode(pt.id)!.id },
                                fields: [
                                  {
                                    key: "note",
                                    label: "Orientações e confirmação da saída",
                                    type: "textarea",
                                  },
                                ],
                              })
                            }
                          >
                            Confirmar saída
                          </button>
                        )}
                    </div>
                  </Panel>
                )}
              </>
            )}
            {page === "orders" && (
              <Panel
                title="Prescrições médicas"
                subtitle="Todas as especialidades · autoria e cédula verificadas na sessão"
              >
                {filtered(s.orders).length ? (
                  <div className="nc-order-grid">
                    {filtered(s.orders)
                      .slice()
                      .reverse()
                      .map((o) => (
                        <article className="nc-order" key={o.id}>
                          <div className="nc-order-top">
                            <span className="nc-stat-icon teal">
                              <Pill size={19} />
                            </span>
                            <Badge
                              tone={o.status === "activa" ? "green" : "neutral"}
                            >
                              {o.status === "activa" ? "Activa" : "Suspensa"}
                            </Badge>
                          </div>
                          <h3>{drug(o).name}</h3>
                          <p>
                            {drug(o).strength} · {o.dose} · {o.route}
                          </p>
                          <strong>{person(o.patientId)?.name}</strong>
                          <span className="nc-cell-sub">{o.specialty}</span>
                          <dl>
                            <div>
                              <dt>Início</dt>
                              <dd>{fmt(o.start)}</dd>
                            </div>
                            <div>
                              <dt>Aprazamento</dt>
                              <dd>
                                {o.count} doses · {o.interval}h
                              </dd>
                            </div>
                            <div>
                              <dt>Indicação</dt>
                              <dd>{o.indication}</dd>
                            </div>
                          </dl>
                          {o.instructions && <p>{o.instructions}</p>}
                          <footer>
                            <span>
                              {o.prescriber}
                              <small>Cédula {o.registration}</small>
                            </span>
                            {o.status === "activa" && can("medico") && (
                              <button
                                disabled={!connected || busy}
                                className="nc-small"
                                onClick={() =>
                                  open({
                                    title: "Suspender prescrição",
                                    subtitle:
                                      "A suspensão bloqueia doses pendentes e permite devolver unidades dispensadas.",
                                    command: "order.suspend",
                                    payload: { orderId: o.id },
                                    fields: [
                                      {
                                        key: "reason",
                                        label: "Fundamentação clínica",
                                        type: "textarea",
                                      },
                                    ],
                                  })
                                }
                              >
                                Suspender
                              </button>
                            )}
                          </footer>
                        </article>
                      ))}
                  </div>
                ) : (
                  <Empty
                    title="Sem prescrições registadas"
                    text="O médico pode criar a primeira prescrição após a admissão e o cadastro do medicamento."
                    icon={Stethoscope}
                  />
                )}
              </Panel>
            )}
            {page === "pharmacy" && (
              <>
                <div className="nc-section-actions">
                  <p>
                    <ShieldCheck size={18} /> Dispensa por administração · lote
                    e validade rastreáveis
                  </p>
                  {can("farmaceutico") && (
                    <button
                      disabled={!connected || busy}
                      className="nc-btn"
                      onClick={newDrug}
                    >
                      <Plus size={16} /> Cadastrar medicamento
                    </button>
                  )}
                </div>
                <Panel
                  title="Fila de validação e devoluções"
                  subtitle="Apenas doses pendentes e devoluções por conferir"
                >
                  {doseTable(
                    doses.filter(
                      (d) =>
                        d.status === "aguarda_farmacia" ||
                        (d.batchId &&
                          !d.returned &&
                          ["omitida", "suspensa"].includes(d.status)),
                    ),
                    "pharmacy",
                  )}
                </Panel>
                <Panel
                  title="Inventário por lote"
                  subtitle="Stock disponível após dispensa e devoluções"
                >
                  {s.drugs.length ? (
                    <div className="nc-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Medicamento</th>
                            <th>Apresentação</th>
                            <th>Lote</th>
                            <th>Validade</th>
                            <th>Disponível</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.drugs.flatMap((d) => {
                            const batches = s.batches.filter(
                              (b) => b.drugId === d.id,
                            );
                            return batches.length
                              ? batches
                                  .slice()
                                  .sort((a, b) =>
                                    a.expires.localeCompare(b.expires),
                                  )
                                  .map((b) => (
                                    <tr key={b.id}>
                                      <td>
                                        <strong>{d.name}</strong>
                                        {d.needsReview &&
                                          can("farmaceutico") && (
                                            <button
                                              className="nc-small"
                                              disabled={!connected || busy}
                                              onClick={() => configureDrug(d)}
                                            >
                                              Validar apresentação
                                            </button>
                                          )}
                                        <span className="nc-cell-sub">
                                          {d.ingredient}{" "}
                                          {d.highAlert
                                            ? "· Dupla verificação"
                                            : ""}
                                        </span>
                                      </td>
                                      <td>{d.strength}</td>
                                      <td>{b.lot}</td>
                                      <td>
                                        <Badge
                                          tone={
                                            b.expires <
                                            new Date()
                                              .toISOString()
                                              .slice(0, 10)
                                              ? "red"
                                              : "green"
                                          }
                                        >
                                          {b.expires}
                                        </Badge>
                                      </td>
                                      <td>
                                        <strong>{b.quantity}</strong> {d.unit}
                                      </td>
                                    </tr>
                                  ))
                              : [
                                  <tr key={d.id}>
                                    <td>
                                      <strong>{d.name}</strong>
                                      {d.needsReview && can("farmaceutico") && (
                                        <button
                                          className="nc-small"
                                          disabled={!connected || busy}
                                          onClick={() => configureDrug(d)}
                                        >
                                          Validar apresentação
                                        </button>
                                      )}
                                      <span className="nc-cell-sub">
                                        {d.ingredient}
                                      </span>
                                    </td>
                                    <td>{d.strength}</td>
                                    <td colSpan={3}>
                                      Sem lotes · aguarda recepção
                                    </td>
                                  </tr>,
                                ];
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="Catálogo por configurar"
                      text="Cadastre as apresentações utilizadas na unidade e receba os respectivos lotes."
                      icon={Package}
                    />
                  )}
                </Panel>
              </>
            )}
            {page === "mar" && (
              <>
                <MedicationMap state={s} doses={doses} onDose={doseAction} />
                <details className="op-mar-history">
                  <summary>
                    Histórico em lista e registo de não administração{" "}
                    <span>{doses.length} doses</span>
                  </summary>
                  {doseTable(doses, "mar")}
                </details>
              </>
            )}
            {page === "care" && (
              <CarePlanBoard
                state={s}
                actor={a!}
                patientId={patientId}
                onAction={careAction}
                disabled={!connected || busy}
              />
            )}
            {page === "records" && (
              <PatientClinicalWorkspace
                key={patientId || "picker"}
                state={s}
                actor={a!}
                patient={pt}
                patients={patients}
                onPatient={navigatePatient}
                onRecord={newRecord}
                onWristband={setWristband}
                onHandover={() => setPage("handover")}
                disabled={!connected || busy}
              />
            )}
            {page === "handover" && (
              <Panel
                title="Passagens SBAR"
                subtitle="Situação · antecedentes · avaliação · recomendações"
              >
                {filtered(s.handovers).length ? (
                  <div className="nc-handover-grid">
                    {filtered(s.handovers)
                      .slice()
                      .reverse()
                      .map((h) => (
                        <article className="nc-handover" key={h.id}>
                          <div className="nc-handover-title">
                            <div>
                              <h3>{person(h.patientId)?.name}</h3>
                              <small>
                                {h.author} · {fmt(h.at)}
                              </small>
                            </div>
                            <Badge tone={h.acceptedBy ? "green" : "amber"}>
                              {h.acceptedBy ? "Recebida" : "Aguarda recepção"}
                            </Badge>
                          </div>
                          {[
                            ["S", "Situação", h.situation],
                            ["B", "Antecedentes", h.background],
                            ["A", "Avaliação", h.assessment],
                            ["R", "Recomendações", h.recommendation],
                          ].map(([l, t, v]) => (
                            <div className="nc-sbar" key={l}>
                              <b>{l}</b>
                              <div>
                                <strong>{t}</strong>
                                <p>{v}</p>
                              </div>
                            </div>
                          ))}
                          <footer>
                            {h.acceptedBy ? (
                              <span>
                                <CheckCheck size={16} /> Recebida por{" "}
                                {h.acceptedBy} · {fmt(h.acceptedAt!)}
                              </span>
                            ) : can("enfermeiro", "chefe_enfermagem") &&
                              h.authorId !== a!.id ? (
                              <button
                                disabled={!connected || busy}
                                className="nc-btn primary"
                                onClick={() =>
                                  open({
                                    title: "Receber passagem de turno",
                                    subtitle:
                                      "Confirma que tomou conhecimento da situação clínica e pendências?",
                                    command: "handover.accept",
                                    payload: { handoverId: h.id },
                                    fields: [],
                                    submit: "Confirmar recepção",
                                  })
                                }
                              >
                                Confirmar recepção
                              </button>
                            ) : (
                              <small>
                                Outro profissional deve confirmar a recepção.
                              </small>
                            )}
                          </footer>
                        </article>
                      ))}
                  </div>
                ) : (
                  <Empty
                    title="Um turno bem entregue"
                    text="Registe a situação clínica e as pendências. A equipa que recebe confirma na sua própria sessão."
                    icon={ArrowLeftRight}
                  />
                )}
              </Panel>
            )}
            {page === "safety" && (
              <>
                <div className="nc-section-actions">
                  <p>
                    <ShieldCheck size={18} /> Registos identificados e
                    permissões verificadas no servidor
                  </p>
                  {can("medico", "enfermeiro", "chefe_enfermagem") && (
                    <button
                      disabled={!connected || busy}
                      className="nc-btn"
                      onClick={() => newRecord("incidente")}
                    >
                      <Plus size={16} /> Registar incidente
                    </button>
                  )}
                </div>
                <div className="nc-safety-cards">
                  <div>
                    <ShieldCheck size={24} />
                    <h3>Identificação antes de administrar</h3>
                    <p>
                      Código do paciente e conferência de medicamento, dose, via
                      e horário.
                    </p>
                  </div>
                  <div>
                    <Package size={24} />
                    <h3>Rastreabilidade da medicação</h3>
                    <p>
                      Prescritor, lote, farmácia e administração no mesmo
                      processo.
                    </p>
                  </div>
                  <div>
                    <Users size={24} />
                    <h3>Responsabilidade individual</h3>
                    <p>
                      Dupla verificação e recepção SBAR com sessões de
                      profissionais distintos.
                    </p>
                  </div>
                </div>
                <Panel
                  title="Histórico de auditoria"
                  subtitle="Sequência de operações confirmadas pelo servidor · âmbito da unidade"
                >
                  {s.audit.length ? (
                    <div className="nc-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Data / hora</th>
                            <th>Profissional</th>
                            <th>Operação</th>
                            <th>Registo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.audit
                            .slice()
                            .reverse()
                            .map((e) => (
                              <tr key={e.id}>
                                <td>{fmt(e.at)}</td>
                                <td>{e.actor}</td>
                                <td>
                                  <Badge>{e.action}</Badge>
                                </td>
                                <td>{e.detail}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="Histórico ainda sem operações"
                      text="Cada alteração confirmada será registada com data e autor."
                      icon={ShieldCheck}
                    />
                  )}
                </Panel>
                <p className="nc-method-note">
                  A pesquisa de alergias verifica o texto do princípio activo
                  registado. Não existe uma base clínica de interacções nem
                  ajuste automático de doses; a validação clínica compete aos
                  profissionais. A triagem é atribuída pelo profissional e não
                  corresponde a uma implementação certificada do protocolo
                  Manchester.
                </p>
              </>
            )}
            <footer className="nc-footer">
              <span>
                <Activity size={14} /> NVUALASOFT <b>Enfermagem</b>
              </span>
              <span>
                {a!.tenantName} · Revisão {s.revision}
              </span>
            </footer>
          </main>
        )}
      </div>
      {wristband && (
        <PatientWristband
          patient={wristband}
          onClose={() => setWristband(null)}
        />
      )}
      {dialog && (
        <div
          className="nc-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setDialog(null);
          }}
        >
          <section
            className={`nc-modal ${dialog.command === "observation.create" ? "op-clinical-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nc-dialog-title"
          >
            <div className="nc-modal-heading">
              <span className="nc-stat-icon teal">
                <ClipboardList size={23} />
              </span>
              <button
                className="nc-icon-btn"
                onClick={() => !busy && setDialog(null)}
                aria-label="Fechar formulário"
              >
                <X size={21} />
              </button>
            </div>
            <h2 id="nc-dialog-title">{dialog.title}</h2>
            <p>{dialog.subtitle}</p>
            <ClinicalForm
              key={`${dialog.command}-${dialog.revision}`}
              dialog={dialog}
              busy={busy}
              connected={connected}
              error={error}
              onCancel={() => setDialog(null)}
              onSave={(p) => run(dialog.command, p, dialog.revision)}
            />
          </section>
        </div>
      )}
    </div>
  );
}
function ClinicalForm({
  dialog,
  busy,
  connected,
  error,
  onSave,
  onCancel,
}: {
  dialog: Dialog;
  busy: boolean;
  connected: boolean;
  error: string;
  onSave: (p: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const first = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = first.current;
    el?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
      if (e.key === "Tab") {
        const controls = Array.from(
          el
            ?.closest(".nc-modal")
            ?.querySelectorAll<HTMLElement>("input,select,textarea,button") ||
            [],
        ).filter((x) => !(x as HTMLButtonElement).disabled);
        const head = controls[0],
          tail = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === head) {
          e.preventDefault();
          tail?.focus();
        } else if (!e.shiftKey && document.activeElement === tail) {
          e.preventDefault();
          head?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [busy]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      p: Record<string, unknown> = { ...dialog.payload };
    dialog.fields.forEach((f) => {
      const v = form.get(f.key);
      p[f.key] =
        f.type === "checkbox"
          ? v === "on"
          : f.type === "number"
            ? Number(v)
            : f.type === "datetime-local"
              ? new Date(String(v)).toISOString()
              : String(v || "");
    });
    onSave(p);
  }
  return (
    <form onSubmit={submit}>
      <div className="nc-form-grid" ref={first}>
        {dialog.fields.map((f) => (
          <label
            className={`${["textarea", "checkbox", "specialty"].includes(f.type || "") ? "wide" : ""} ${f.type === "checkbox" ? "nc-check-field" : ""}`}
            key={f.key}
          >
            {f.type === "checkbox" ? (
              <>
                <input
                  type="checkbox"
                  aria-label={f.label}
                  name={f.key}
                  required={f.required !== false}
                />
                <span>{f.label}</span>
              </>
            ) : (
              <>
                <span>
                  {f.label}
                  {f.required !== false && <b> *</b>}
                </span>
                {f.type === "select" ? (
                  <select
                    aria-label={f.label}
                    name={f.key}
                    defaultValue={f.value || ""}
                    required={f.required !== false}
                  >
                    <option value="">Seleccionar…</option>
                    {f.options?.map((o, i) => (
                      <option key={`${o.value}-${i}`} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : ["textarea", "clinical-text"].includes(f.type || "") ? (
                  <textarea
                    aria-label={f.label}
                    name={f.key}
                    rows={3}
                    required={f.required !== false}
                  />
                ) : f.type === "specialty" ? (
                  <>
                    <input
                      aria-label={f.label}
                      name={f.key}
                      list="nc-specialties"
                      placeholder="Seleccionar ou escrever uma especialidade"
                      required
                    />
                    <datalist id="nc-specialties">
                      {specialties.map((x) => (
                        <option key={x} value={x} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <input
                    aria-label={f.label}
                    name={f.key}
                    type={f.type || "text"}
                    defaultValue={f.value || ""}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    required={f.required !== false}
                  />
                )}
                {f.hint && <small>{f.hint}</small>}
              </>
            )}
          </label>
        ))}
      </div>
      {error && (
        <div className="nc-alert error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}
      <div className="nc-modal-footer">
        <span>
          <ShieldCheck size={14} /> Identificado pela sessão activa
        </span>
        <div>
          <button
            type="button"
            className="nc-btn"
            disabled={busy}
            onClick={onCancel}
          >
            {dialog.readOnly ? "Fechar" : "Cancelar"}
          </button>
          {!dialog.readOnly && (
            <button
              type="submit"
              className="nc-btn primary"
              disabled={busy || !connected}
            >
              {busy ? "A guardar…" : dialog.submit || "Guardar registo"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
