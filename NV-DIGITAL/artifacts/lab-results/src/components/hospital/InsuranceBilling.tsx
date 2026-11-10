import { useEffect, useRef, useState } from "react";
import type {
  InsuranceContract,
  InsuranceQuote,
  InsuranceSelection,
} from "@workspace/api-zod";
import { hospitalApi } from "../../store/hospital";
type ActLine = {
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  ivaIsento: boolean;
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const input = "w-full rounded border border-border bg-background p-2 text-sm";
export default function InsuranceBilling<L extends ActLine>({
  patientId,
  lines,
  selection,
  onChange,
  onPrices,
  onReady,
  rate,
  discount,
  date,
  professional,
  fixedDiscount = 0,
  engine = "integrated",
}: {
  patientId: string;
  lines: L[];
  selection: InsuranceSelection | null;
  onChange: (s: InsuranceSelection | null) => void;
  onPrices: (lines: L[]) => void;
  onReady: (ready: boolean) => void;
  rate: number;
  discount: number;
  date: string;
  professional: string;
  fixedDiscount?: number;
  engine?: "integrated" | "legacy";
}) {
  const [members, setMembers] = useState<any[]>([]),
    [contracts, setContracts] = useState<InsuranceContract[]>([]),
    [message, setMessage] = useState(""),
    [quote, setQuote] = useState<InsuranceQuote | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setMembers([]);
    setMessage("");
    if (patientId)
      void Promise.all([
        hospitalApi<any>(
          "GET",
          "/insurance/patients/" + patientId + "/eligibility",
        ),
        hospitalApi<InsuranceContract[]>("GET", "/insurance/contracts"),
      ])
        .then(([m, c]) => {
          if (live) {
            setMembers(m.beneficiaries);
            setContracts(c);
          }
        })
        .catch((e) => {
          if (live) setMessage(e.message);
        });
    return () => {
      live = false;
    };
  }, [patientId]);
  const fingerprint = JSON.stringify({
    lines,
    selection,
    rate,
    discount,
    date,
    patientId,
    fixedDiscount,
    engine,
  });
  const currentFingerprint = useRef(fingerprint);
  currentFingerprint.current = fingerprint;
  useEffect(() => {
    setQuote(null);
    onReady(false);
  }, [fingerprint]);
  const member = members.find((m) => m.id === selection?.beneficiaryId),
    contract = contracts.find((c) => c.id === selection?.contractId);
  const patch = (values: Partial<InsuranceSelection>) => {
    if (selection) onChange({ ...selection, ...values });
  };
  function activate() {
    const member = members.find((m) => m.activo && m.insurer?.activa);
    if (!member) return;
    const c = contracts.find(
      (c) => c.insurerId === member.seguradoraId && c.active,
    );
    onChange({
      beneficiaryId: member.id,
      contractId: c?.id || "",
      authorization: "",
      serviceDate: today(),
      acts: lines.map((l) => ({
        code:
          c?.rates.find(
            (r) =>
              r.description.toLocaleLowerCase() ===
              l.descricao.toLocaleLowerCase(),
          )?.code || "",
        professional,
      })),
    });
  }
  function mapping(index: number, key: "code" | "professional", value: string) {
    if (selection)
      patch({
        acts: lines.map((_, i) =>
          i === index
            ? {
                code: selection.acts[i]?.code || "",
                professional: selection.acts[i]?.professional || professional,
                [key]: value,
              }
            : selection.acts[i] || { code: "", professional },
        ),
      });
  }
  async function simulate() {
    if (!selection) return;
    const requestedFingerprint = fingerprint;
    setBusy(true);
    setMessage("");
    try {
      const result = await hospitalApi<InsuranceQuote>(
        "POST",
        "/insurance/quote",
        {
          pacienteId: Number(patientId),
          insurance: {
            ...selection,
            acts: lines.map(
              (_, i) => selection.acts[i] || { code: "", professional },
            ),
          },
          linhas: lines,
          ivaTaxa: rate,
          desconto: discount,
          descontoValor: fixedDiscount,
          engine,
          data: date,
        },
      );
      if (requestedFingerprint !== currentFingerprint.current) return;
      setQuote(result);
      onReady(true);
    } catch (e) {
      if (requestedFingerprint !== currentFingerprint.current) return;
      setMessage((e as Error).message);
      onReady(false);
    } finally {
      setBusy(false);
    }
  }
  if (!patientId || (!members.length && !selection && !message)) return null;
  return (
    <section className="mt-4 border border-border rounded-xl p-4 space-y-3">
      <label className="text-sm font-semibold flex gap-2">
        <input
          type="checkbox"
          checked={!!selection}
          disabled={
            !selection && !members.some((m) => m.activo && m.insurer?.activa)
          }
          onChange={(e) => (e.target.checked ? activate() : onChange(null))}
        />
        Facturar ao seguro deste atendimento
      </label>
      {!members.length && (
        <p className="text-xs text-muted-foreground">
          Sem vínculo de seguro. Associe o cartão ao cadastro único do paciente
          em Pacientes ou Seguradoras.
        </p>
      )}
      {selection && (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs">
              Vínculo / cartão
              <select
                className={input}
                value={selection.beneficiaryId}
                onChange={(e) => {
                  const m = members.find((m) => m.id === e.target.value);
                  patch({
                    beneficiaryId: e.target.value,
                    contractId:
                      contracts.find(
                        (c) => c.insurerId === m?.seguradoraId && c.active,
                      )?.id || "",
                    acts: [],
                  });
                }}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.insurer?.nome} · {m.cartao} · {m.plano}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Contrato e tabela de preços
              <select
                className={input}
                value={selection.contractId}
                onChange={(e) =>
                  patch({ contractId: e.target.value, acts: [] })
                }
              >
                <option value="">Seleccionar contrato</option>
                {contracts
                  .filter(
                    (c) => c.insurerId === member?.seguradoraId && c.active,
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.start} a {c.end})
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs">
              Data de realização dos actos
              <input
                className={input}
                type="date"
                max={today()}
                value={selection.serviceDate}
                onChange={(e) => patch({ serviceDate: e.target.value })}
              />
            </label>
            <label className="text-xs">
              Autorização{" "}
              {contract?.requiresAuthorization ? "(obrigatória)" : ""}
              <input
                className={input}
                value={selection.authorization}
                onChange={(e) => patch({ authorization: e.target.value })}
              />
            </label>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div className="grid sm:grid-cols-3 gap-2 border-t pt-2" key={i}>
                <span className="text-sm">
                  {i + 1}. {l.descricao || "Linha por preencher"}
                </span>
                <label className="text-xs">
                  Código contratado
                  <select
                    className={input}
                    value={selection.acts[i]?.code || ""}
                    onChange={(e) => mapping(i, "code", e.target.value)}
                  >
                    <option value="">Seleccione o acto</option>
                    {contract?.rates.map((r) => (
                      <option value={r.code} key={r.code}>
                        {r.code} · {r.description} ·{" "}
                        {r.price.toLocaleString("pt-AO")} Kz
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Profissional responsável
                  <input
                    className={input}
                    value={selection.acts[i]?.professional ?? professional}
                    onChange={(e) => mapping(i, "professional", e.target.value)}
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="border border-border rounded px-3 py-2 text-sm"
              disabled={busy || !contract}
              onClick={() => {
                onChange({
                  ...selection,
                  acts: lines.map(
                    (_, i) => selection.acts[i] || { code: "", professional },
                  ),
                });
                onPrices(
                  lines.map((l, i) => {
                    const r = contract?.rates.find(
                      (r) => r.code === selection.acts[i]?.code,
                    );
                    return r
                      ? { ...l, precoUnitario: r.price, codigoActo: r.code }
                      : l;
                  }),
                );
                setMessage(
                  "Preços contratados aplicados; confirme os códigos e simule a repartição.",
                );
              }}
            >
              Aplicar preços contratados
            </button>
            <button
              type="button"
              className="bg-primary text-primary-foreground rounded px-3 py-2 text-sm disabled:opacity-50"
              disabled={busy || !lines.length}
              onClick={() => void simulate()}
            >
              {busy ? "A validar…" : "Validar cobertura e repartir valores"}
            </button>
          </div>
          {quote && (
            <div
              role="status"
              className="bg-muted rounded-lg p-3 text-sm space-y-1"
            >
              <p>
                Total: <strong>{quote.total.toLocaleString("pt-AO")} Kz</strong>
              </p>
              <p>
                Seguradora:{" "}
                <strong>
                  {quote.insurerAmount.toLocaleString("pt-AO")} Kz
                </strong>{" "}
                · Paciente:{" "}
                <strong>
                  {quote.patientAmount.toLocaleString("pt-AO")} Kz
                </strong>
              </p>
              <p className="text-xs">
                Vencimento da seguradora: {quote.dueDate}. A emissão conserva
                esta versão do vínculo, contrato, actos e cobertura.
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Emita como Factura / Emitida. Os pagamentos parciais de cada pagador
            são registados em Seguradoras → Cobrança, com recibo. Uma simulação
            não confirma uma autorização junto da seguradora.
          </p>
        </>
      )}
      {message && (
        <p role="alert" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
