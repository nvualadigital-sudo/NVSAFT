import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Barcode, ClipboardList, Printer, Receipt, Wallet } from "lucide-react";
import {
  billingRequest,
  command,
} from "../../modules/faturacao/store/AppContext";
import { inputNumber } from "../../modules/faturacao/utils/billingNumbers";
import {
  formatCurrency,
  openInvoicePrint,
  printIssuedInvoice,
} from "../../modules/faturacao/utils/faturaGenerator";
import { button, input } from "../comunicacao/shared";

type Item = {
  id: string;
  name: string;
  dose: string;
  unit: string;
  remaining: number;
};
type Prescription = {
  id: string;
  patient: string;
  validUntil: string;
  items: Item[];
};
type Lot = {
  id: string;
  code: string;
  name: string;
  lot: string;
  expiry: string;
  quantity: number | null;
  availableToInitialize: number;
  price: number;
};
type Sale = {
  id: number;
  numero: string;
  total: number;
  patient?: string;
  troco?: number;
};
type State = {
  prescriptions: Prescription[];
  lots: Lot[];
  sales: Sale[];
  session: { id: string; terminal: string; valorEsperado: number } | null;
  otherCashOpen: boolean;
};
type CartLine = { itemId: string; lotId: string; quantity: number };
type Quote = { subtotal: number; iva: number; total: number; ivaTaxa: number };
const card = "rounded-xl border border-slate-200 bg-white p-4 space-y-3";
const subtle =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40";
const fmt = (n: number) => formatCurrency(n, "AOA");
const key = (s: string) =>
  s.normalize("NFKC").trim().toLocaleLowerCase("pt").replace(/\s+/g, " ");
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Operação não confirmada.";

export default function PharmacyPOS() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false),
    lock = useRef(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [terminal, setTerminal] = useState("01"),
    [opening, setOpening] = useState("0");
  const [closing, setClosing] = useState(""),
    [closeForm, setCloseForm] = useState(false);
  const [differenceReason, setDifferenceReason] = useState("");
  const [manager, setManager] = useState(""),
    [password, setPassword] = useState("");
  const [seed, setSeed] = useState(""),
    [seedQty, setSeedQty] = useState("");
  const [search, setSearch] = useState("");
  const [rxId, setRxId] = useState(""),
    [itemId, setItemId] = useState("");
  const [lotId, setLotId] = useState(""),
    [qty, setQty] = useState("1");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [quote, setQuote] = useState<{
    signature: string;
    values: Quote;
  } | null>(null);
  const [method, setMethod] = useState("Numerário");
  const [received, setReceived] = useState(""),
    [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false),
    [autoPrint, setAutoPrint] = useState(true);
  const [format, setFormat] = useState<"80mm" | "58mm" | "a4">("80mm");
  const [sale, setSale] = useState<Sale | null>(null);
  const load = useCallback(async () => {
    setState(await billingRequest<State>("GET", "/pharmacy-pos"));
  }, []);
  useEffect(() => {
    void load().catch((e) => setError(errorMessage(e)));
  }, [load]);
  async function perform(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const update = async () => {
    await load().catch(() =>
      setError(
        "Operação registada. Actualize o balcão para ver os novos saldos.",
      ),
    );
  };
  const rx = state?.prescriptions.find((r) => r.id === rxId);
  const item = rx?.items.find((i) => i.id === itemId);
  const matching =
    state?.lots.filter(
      (l) => item && key(l.name) === key(item.name) && (l.quantity ?? 0) > 0,
    ) ?? [];
  const readyLots =
    state?.lots.filter(
      (l) => l.quantity === null && l.availableToInitialize > 0,
    ) ?? [];
  const order = {
    prescriptionId: rxId,
    items: cart,
    discountAmount: inputNumber(discount),
  };
  const signature = JSON.stringify(order);
  const prices = quote?.signature === signature ? quote.values : undefined;
  const diff =
    state?.session && closing !== ""
      ? Math.round(
          (inputNumber(closing) - state.session.valorEsperado) * 100,
        ) !== 0
      : false;
  function addLine(e: FormEvent) {
    e.preventDefault();
    const lot = matching.find((l) => l.id === lotId);
    const quantity = inputNumber(qty);
    if (!item || !lot || !Number.isFinite(quantity) || quantity <= 0) {
      setError("Seleccione o medicamento, o lote e uma quantidade positiva.");
      return;
    }
    const itemUsed = cart
      .filter((l) => l.itemId === item.id)
      .reduce((sum, l) => sum + l.quantity, 0);
    const lotUsed = cart
      .filter((l) => l.lotId === lot.id)
      .reduce((sum, l) => sum + l.quantity, 0);
    if (
      Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.0001 ||
      Math.round((quantity + itemUsed) * 1000) >
        Math.round(item.remaining * 1000) ||
      Math.round((quantity + lotUsed) * 1000) >
        Math.round((lot.quantity || 0) * 1000)
    ) {
      setError(
        "Confira a quantidade, o saldo da receita e o saldo do lote de ensaio.",
      );
      return;
    }
    setError("");
    setConfirmed(false);
    setQuote(null);
    setCart((old) =>
      old.some((l) => l.itemId === item.id && l.lotId === lot.id)
        ? old.map((l) =>
            l.itemId === item.id && l.lotId === lot.id
              ? {
                  ...l,
                  quantity: Math.round((l.quantity + quantity) * 1000) / 1000,
                }
              : l,
          )
        : [...old, { itemId: item.id, lotId: lot.id, quantity }],
    );
  }
  function print(id: number, paper = format) {
    const w = openInvoicePrint();
    void perform(async () => {
      if (!(await printIssuedInvoice(id, paper, w, "pharmacy")))
        setError(
          "Impressão não confirmada. Permita a janela de impressão e tente novamente.",
        );
    });
  }
  function checkout(e: FormEvent) {
    e.preventDefault();
    if (!prices || !confirmed || !state?.session || lock.current) return;
    const receivedValue = inputNumber(received);
    if (
      method === "Numerário" &&
      (!Number.isFinite(receivedValue) || receivedValue < prices.total)
    ) {
      setError("Indique o numerário de ensaio recebido.");
      return;
    }
    const w = autoPrint ? openInvoicePrint() : null;
    void perform(async () => {
      let issued: Sale;
      try {
        issued = await command<Sale>("/pharmacy-pos/sales", {
          ...order,
          expectedTotal: prices.total,
          paymentMethod: method,
          ...(method === "Numerário"
            ? { received: receivedValue }
            : { reference }),
          confirmItem: true,
          confirmTraining: true,
        });
      } catch (e) {
        w?.close();
        throw e;
      }
      setSale(issued);
      setMessage("Venda de formação registada.");
      setCart([]);
      setQuote(null);
      setConfirmed(false);
      setDiscount("");
      setReceived("");
      setReference("");
      if (
        autoPrint &&
        !(await printIssuedInvoice(issued.id, format, w, "pharmacy"))
      )
        setMessage("Venda registada. Use o botão Imprimir para abrir o talão.");
      await update();
    });
  }
  return (
    <section aria-label="POS — Farmácia" className="space-y-4">
      <header className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Receipt size={19} /> POS — Farmácia
        </h2>
        <p className="mt-1 text-sm text-amber-950">
          Balcão clínico ligado às receitas e aos lotes da instituição. Esta
          modalidade ainda é de formação, sem validade fiscal: a saída é
          registada apenas no saldo de ensaio do lote.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-900"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900"
        >
          {message}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {state?.session
            ? "Caixa aberta: " + state.session.terminal
            : "Caixa de ensaio fechada"}
        </span>
        <button
          type="button"
          className={subtle}
          disabled={busy}
          onClick={() => void perform(load)}
        >
          Actualizar balcão
        </button>
      </div>
      {!state ? (
        <p className="text-sm">
          A carregar receitas, lotes e vendas do balcão…
        </p>
      ) : (
        <>
          {(state.prescriptions.length === 0 || state.lots.length === 0) && (
            <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950" data-testid="pharmacy-pos-prerequisites">
              <strong>O catálogo do POS da Farmácia ainda não está pronto para uma venda.</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {state.prescriptions.length === 0 && (
                  <li>Não existem receitas activas recebidas dos médicos. Confirme o fluxo Médicos → Farmácia.</li>
                )}
                {state.lots.length === 0 && (
                  <li>Não há lotes farmacêuticos disponíveis nesta instituição. Registe os medicamentos e os lotes no separador «Produtos e lotes».</li>
                )}
              </ul>
              <p className="mt-2">Os produtos gerais da Facturação não substituem receitas e lotes da Farmácia. Não são criados medicamentos ou saldos fictícios automaticamente.</p>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={card}>
              <h3 className="flex items-center gap-2 font-semibold">
                <Wallet size={18} /> Caixa de ensaio
              </h3>
              {state.otherCashOpen ? (
                <p className="text-sm">
                  Tem uma caixa aberta na Facturação. Feche-a nesse balcão antes
                  de abrir a caixa da Farmácia.
                </p>
              ) : state.session ? (
                <>
                  <p className="text-sm">
                    Numerário esperado:{" "}
                    <strong>{fmt(state.session.valorEsperado)}</strong>
                  </p>
                  <button
                    className={subtle}
                    disabled={busy}
                    onClick={() => setCloseForm(!closeForm)}
                  >
                    {closeForm ? "Voltar" : "Fechar caixa"}
                  </button>
                  {closeForm && (
                    <form
                      className="space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void perform(async () => {
                          await command("/pharmacy-pos/cash/close", {
                            valorContado: inputNumber(closing),
                            ...(diff
                              ? {
                                  diferencaMotivo: differenceReason,
                                  supervisorUsername: manager,
                                  supervisorPassword: password,
                                }
                              : {}),
                          });
                          setCloseForm(false);
                          setClosing("");
                          setPassword("");
                          setMessage("Caixa de ensaio fechada.");
                          await update();
                        });
                      }}
                    >
                      <label className="block text-sm">
                        Numerário contado
                        <input
                          className={input}
                          required
                          inputMode="decimal"
                          value={closing}
                          onChange={(e) => setClosing(e.target.value)}
                        />
                      </label>
                      {diff && (
                        <div className="grid gap-2">
                          <label className="text-sm">
                            Motivo da diferença
                            <input
                              className={input}
                              required
                              minLength={3}
                              value={differenceReason}
                              onChange={(e) =>
                                setDifferenceReason(e.target.value)
                              }
                            />
                          </label>
                          <label className="text-sm">
                            Utilizador do gestor, se necessário
                            <input
                              className={input}
                              autoComplete="off"
                              value={manager}
                              onChange={(e) => setManager(e.target.value)}
                            />
                          </label>
                          <label className="text-sm">
                            Palavra-passe do gestor, se necessário
                            <input
                              className={input}
                              autoComplete="off"
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                            />
                          </label>
                        </div>
                      )}
                      <button className={button} disabled={busy}>
                        Confirmar fecho
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform(async () => {
                      await command("/pharmacy-pos/cash/open", {
                        terminal,
                        fundoInicial: inputNumber(opening),
                      });
                      setMessage("Caixa de ensaio aberta.");
                      await update();
                    });
                  }}
                >
                  <label className="text-sm">
                    Terminal
                    <input
                      className={input}
                      required
                      maxLength={36}
                      value={terminal}
                      onChange={(e) => setTerminal(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Fundo inicial (Kz)
                    <input
                      className={input}
                      required
                      inputMode="decimal"
                      value={opening}
                      onChange={(e) => setOpening(e.target.value)}
                    />
                  </label>
                  <button className={button} disabled={busy}>
                    Abrir caixa de ensaio
                  </button>
                </form>
              )}
            </section>
            <section className={card}>
              <h3 className="flex items-center gap-2 font-semibold">
                <Barcode size={18} /> Preparar lote de ensaio
              </h3>
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    await command("/pharmacy-pos/stock", {
                      lotId: seed,
                      quantity: inputNumber(seedQty),
                      confirmTraining: true,
                    });
                    setSeed("");
                    setSeedQty("");
                    setMessage("Saldo de ensaio criado para o lote.");
                    await update();
                  });
                }}
              >
                <label className="block text-sm">
                  Lote da Farmácia
                  <select
                    aria-label="Lote da Farmácia"
                    className={input}
                    required
                    value={seed}
                    onChange={(e) => {
                      setSeed(e.target.value);
                      setSeedQty("");
                    }}
                  >
                    <option value="">Escolher lote activo</option>
                    {readyLots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} · {l.code} · lote {l.lot} · até{" "}
                        {l.availableToInitialize}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">
                    Quantidade de ensaio
                    <input
                      className={input}
                      required
                      inputMode="decimal"
                      value={seedQty}
                      onChange={(e) => setSeedQty(e.target.value)}
                    />
                  </label>
                  <button className={button} disabled={busy || !seed}>
                    Criar saldo de ensaio
                  </button>
                </div>
              </form>
            </section>
          </div>
          <section className={card}>
            <h3 className="flex items-center gap-2 font-semibold">
              <ClipboardList size={18} /> Receita e medicamentos
            </h3>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-sm">
                Pesquisar paciente ou receita
                <input
                  className={input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Receita
                <select
                  aria-label="Receita"
                  className={input}
                  value={rxId}
                  onChange={(e) => {
                    setRxId(e.target.value);
                    setItemId("");
                    setLotId("");
                    setCart([]);
                    setConfirmed(false);
                    setQuote(null);
                  }}
                >
                  <option value="">Seleccione uma receita activa</option>
                  {state.prescriptions
                    .filter(
                      (r) =>
                        r.id === rxId ||
                        key(r.patient + " " + r.id).includes(key(search)),
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.patient} · {r.id}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {rx && (
              <form
                className="grid items-end gap-2 md:grid-cols-4"
                onSubmit={addLine}
              >
                <label className="text-sm">
                  Medicamento prescrito
                  <select
                    aria-label="Medicamento prescrito"
                    className={input}
                    required
                    value={itemId}
                    onChange={(e) => {
                      setItemId(e.target.value);
                      setLotId("");
                    }}
                  >
                    <option value="">Seleccione o medicamento</option>
                    {rx.items
                      .filter((i) => i.remaining > 0)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} · {i.dose} · saldo {i.remaining} {i.unit}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm">
                  Lote para vender
                  <select
                    aria-label="Lote para vender"
                    className={input}
                    required
                    value={lotId}
                    onChange={(e) => setLotId(e.target.value)}
                  >
                    <option value="">Seleccione o lote de ensaio</option>
                    {matching.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.lot} · {l.expiry} · saldo {l.quantity} ·{" "}
                        {fmt(l.price)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Quantidade
                  <input
                    className={input}
                    required
                    inputMode="decimal"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </label>
                <button className={button} disabled={busy || !lotId}>
                  Adicionar à venda
                </button>
                {item && !matching.length && (
                  <p className="text-sm text-slate-600 md:col-span-4">
                    Não há saldo de ensaio num lote com o mesmo nome do
                    medicamento prescrito. Confira a apresentação e prepare o
                    lote.
                  </p>
                )}
              </form>
            )}
            {cart.length > 0 && (
              <>
                <ul className="divide-y rounded-lg border">
                  {cart.map((l) => {
                    const item = rx?.items.find((x) => x.id === l.itemId);
                    const lot = state.lots.find((x) => x.id === l.lotId);
                    return (
                      <li
                        key={l.itemId + l.lotId}
                        className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm"
                      >
                        <span>
                          <strong>{item?.name || lot?.name}</strong> ·{" "}
                          {item?.dose} · lote {lot?.lot} · validade{" "}
                          {lot?.expiry} · {l.quantity} {item?.unit}
                        </span>
                        <button
                          type="button"
                          className={subtle}
                          disabled={busy}
                          onClick={() => {
                            setCart(cart.filter((x) => x !== l));
                            setQuote(null);
                            setConfirmed(false);
                          }}
                        >
                          Remover
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">
                    Desconto em Kz
                    <input
                      className={input}
                      inputMode="decimal"
                      value={discount}
                      onChange={(e) => {
                        setDiscount(e.target.value);
                        setQuote(null);
                        setConfirmed(false);
                      }}
                    />
                  </label>
                  <button
                    className={subtle}
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        if (!Number.isFinite(order.discountAmount))
                          throw Error("Desconto inválido.");
                        setConfirmed(false);
                        setQuote({
                          signature,
                          values: await billingRequest<Quote>(
                            "POST",
                            "/pharmacy-pos/quote",
                            order,
                          ),
                        });
                      })
                    }
                  >
                    Conferir total
                  </button>
                </div>
              </>
            )}
          </section>
          {prices && (
            <form className={card} onSubmit={checkout}>
              <h3 className="font-semibold">
                Receber e emitir factura-recibo de ensaio
              </h3>
              <p className="text-sm">
                Base {fmt(prices.subtotal)} · IVA de ensaio ({prices.ivaTaxa}%):{" "}
                {fmt(prices.iva)} · <strong>Total {fmt(prices.total)}</strong>
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="text-sm">
                  Forma de pagamento
                  <select
                    aria-label="Forma de pagamento"
                    className={input}
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option>Numerário</option>
                    <option>Multicaixa (TPA)</option>
                    <option>Transferência Bancária</option>
                  </select>
                </label>
                {method === "Numerário" ? (
                  <label className="text-sm">
                    Recebido em ensaio (Kz)
                    <input
                      className={input}
                      required
                      inputMode="decimal"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                    />
                  </label>
                ) : (
                  <label className="text-sm">
                    Referência de ensaio
                    <input
                      className={input}
                      required
                      minLength={3}
                      maxLength={100}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </label>
                )}
                <label className="text-sm">
                  Papel
                  <select
                    aria-label="Papel"
                    className={input}
                    value={format}
                    onChange={(e) => setFormat(e.target.value as typeof format)}
                  >
                    <option value="80mm">Talão 80 mm</option>
                    <option value="58mm">Talão 58 mm</option>
                    <option value="a4">A4</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                Conferi o medicamento, a concentração, a apresentação, o lote e
                a quantidade da receita.
              </label>
              <label className="block text-sm">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                />{" "}
                Abrir impressão ao concluir
              </label>
              <button
                className={button}
                disabled={busy || !state.session || !confirmed}
              >
                Concluir venda de formação
              </button>
            </form>
          )}
          {sale && (
            <section className={card}>
              <h3 className="font-semibold">
                {sale.numero} · {fmt(sale.total)}
              </h3>
              <p className="text-sm">Troco de ensaio: {fmt(sale.troco || 0)}</p>
              <button
                className={subtle}
                disabled={busy}
                onClick={() => print(sale.id)}
              >
                <Printer className="mr-1 inline" size={16} /> Imprimir
              </button>
            </section>
          )}
          {state.sales.length > 0 && (
            <section className={card}>
              <h3 className="font-semibold">Minhas vendas de formação</h3>
              <ul className="divide-y">
                {state.sales.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span>
                      {s.numero} · {s.patient} · {fmt(s.total)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        className={subtle}
                        disabled={busy}
                        onClick={() => print(s.id, "80mm")}
                      >
                        Talão
                      </button>
                      <button
                        className={subtle}
                        disabled={busy}
                        onClick={() => print(s.id, "a4")}
                      >
                        A4
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}
