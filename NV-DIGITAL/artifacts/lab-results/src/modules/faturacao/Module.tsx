import AgtHomologacao from "./components/AgtHomologacao";
import InvoiceItemEditor from "./components/InvoiceItemEditor";
import { CategoryManager } from "./components/CatalogueCategories";
import type { Produto } from "./types";
import React, { Suspense, lazy, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  Monitor,
  Package,
  Layers,
  Settings as SettingsIcon,
  Folder,
  UserRound,
  ChartNoAxesCombined,
  BookOpen,
  ChevronDown,
  PanelLeftClose,
  Plus,
  HelpCircle,
  GraduationCap,
  CheckCircle2,
  ArrowLeft,
  Search,
} from "lucide-react";
import { FATURACAO_REFERENCE_CSS } from "./styles/reference";
import { AppProvider, useApp, billingRequest } from "./store/AppContext";
const FaturacaoView = lazy(() =>
  import("./views/FaturacaoView").then(({ FaturacaoView }) => ({ default: FaturacaoView })),
);
const POSView = lazy(() =>
  import("./views/POSView").then(({ POSView }) => ({ default: POSView })),
);
import type { ConfigSistema, PacienteCliente } from "./types";
function Settings() {
  const { config, updateConfig, currentUser } = useApp();
  const [form, setForm] = useState<any>({ ...config }),
    [msg, setMsg] = useState("");
  if (currentUser.role !== "admin")
    return (
      <p className="p-6">Configuração reservada à gestão da instituição.</p>
    );
  const fields = [
    ["nomeClinica", "Nome / razão social"],
    ["nif", "NIF do emitente"],
    ["endereco", "Endereço"],
    ["telefone", "Telefone"],
    ["email", "Email"],
    ["serie", "Série interna de ensaio"],
    ["ivaTaxa", "IVA (%)"],
    ["regimeIva", "Regime tributário"],
    ["bancoNome", "Banco"],
    ["bancoIban", "IBAN"],
    ["mensagemRodape", "Rodapé de impressão"],
  ];
  return (
    <form
      className="p-5 grid gap-3 max-w-3xl"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const d = Object.fromEntries(fields.map(([k]) => [k, form[k] ?? ""]));
          const taxa = String(form.ivaTaxa ?? "").trim();
          if (!["0", "5", "7", "14"].includes(taxa))
            throw new Error("Seleccione expressamente a taxa de IVA aplicável (0%, 5%, 7% ou 14%).");
          d.ivaTaxa = Number(taxa);
          d.configuracaoFiscal = form.configuracaoFiscal;
          d.formatoImpressaoPadrao = form.formatoImpressaoPadrao;
          d.perfisImpressoras = form.perfisImpressoras;
          await updateConfig(d as Partial<ConfigSistema>);
          setMsg("Configuração confirmada no servidor.");
        } catch (e: any) {
          setMsg(e.message);
        }
      }}
    >
      <h2 className="text-xl font-bold">Emitente e impressão</h2>
      {fields.map(([k, label]) => (
        <label key={k} className="grid gap-1">
          {label}
          {k === "ivaTaxa" ? (
            <select
              className="rounded border p-2 bg-white text-slate-900"
              value={String(form[k] ?? "")}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              required
              aria-label="Taxa de IVA aplicável"
            >
              <option value="" disabled>Seleccione a taxa (não determina isenção por si só)</option>
              {[0, 5, 7, 14].map((rate) => (
                <option key={rate} value={rate}>{rate}%</option>
              ))}
            </select>
          ) : (
            <input
              className="rounded border p-2 bg-white text-slate-900"
              value={form[k] ?? ""}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          )}
        </label>
      ))}
      <label>
        Motivo de isenção / não liquidação e norma legal aplicável
        <textarea
          className="block w-full rounded border p-2"
          value={form.configuracaoFiscal?.motivoIsencaoPadrao || ""}
          onChange={(e) =>
            setForm({
              ...form,
              configuracaoFiscal: {
                ...form.configuracaoFiscal,
                motivoIsencaoPadrao: e.target.value,
              },
            })
          }
        />
      </label>
      <label>
        Formato padrão
        <select
          className="ml-3 border p-2"
          value={form.formatoImpressaoPadrao}
          onChange={(e) =>
            setForm({ ...form, formatoImpressaoPadrao: e.target.value })
          }
        >
          <option value="a4">A4</option>
          <option value="termica">Térmica</option>
        </select>
      </label>
      <label>
        Papel térmico
        <select
          className="ml-3 border p-2"
          value={form.perfisImpressoras?.[0]?.larguraPapel || "80mm"}
          onChange={(e) =>
            setForm({
              ...form,
              perfisImpressoras: [
                {
                  id: "browser-print",
                  nome: "Impressora do sistema",
                  modelo: "Driver do sistema",
                  tipoConexao: "browser_spool",
                  larguraPapel: e.target.value,
                  colunas: e.target.value === "58mm" ? 32 : 48,
                  protocolo: "generic_raw",
                  padrao: true,
                  ativo: true,
                  cortarPapel: false,
                  abrirGaveta: false,
                  imprimirLogotipo: false,
                  imprimirQrCodeFiscal: false,
                  imprimirCodigoBarras: false,
                  viasImpressao: 3,
                  densidadeImpressao: "normal",
                },
              ],
            })
          }
        >
          <option>80mm</option>
          <option>58mm</option>
        </select>
      </label>
      <p>
        A primeira reserva de impressão inclui original e duas cópias.
        Repetições são identificadas como 2.ª via. A reserva é registada antes
        de abrir o diálogo; o navegador não confirma se o papel foi impresso.
      </p>
      <button className="rounded bg-blue-700 text-white p-3">
        Guardar no servidor
      </button>
      <p role="status">{msg}</p>
    </form>
  );
}
function Catalogue() {
  const { produtos, categorias = [], currentUser, config } = useApp();
  const [editing, setEditing] = useState<Produto | null | undefined>(undefined),
    [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [msg, setMsg] = useState("");
  return (
    <section className="p-5">
      <h2 className="text-xl font-semibold">Produtos e serviços</h2>
      <p className="text-sm my-2">
        Catálogo da instituição activa, partilhado com a facturação.
      </p>
      <CategoryManager />
      <div className="flex flex-wrap gap-3 my-4">
        <input
          aria-label="Pesquisar produtos"
          className="border rounded p-2 flex-1"
          placeholder="Nome, código ou código de barras"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Categoria do catálogo"
          className="border rounded p-2"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {currentUser.role === "admin" && (
          <button
            className="bg-blue-700 text-white p-2 rounded"
            onClick={() => setEditing(null)}
          >
            Novo produto / serviço
          </button>
        )}
      </div>
      <p role="status">{msg}</p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th>Código</th>
            <th>Produto / Serviço</th>
            <th>Categoria</th>
            <th>Preço</th>
            <th>Stock</th>
            <th>Código de barras</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {produtos
            .filter(
              (p) =>
                (!category || p.categoria === category) &&
                `${p.nome} ${p.codigo} ${p.codigoBarras || ""}`
                  .toLowerCase()
                  .includes(q.toLowerCase()),
            )
            .map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-3">{p.codigo}</td>
                <td>
                  {p.nome}
                  {!p.ativo && " (inactivo)"}
                </td>
                <td>{p.categoria || "Sem categoria"}</td>
                <td>
                  {new Intl.NumberFormat("pt-AO", {
                    style: "currency",
                    currency: config.moeda || "AOA",
                  }).format(p.preco)}
                </td>
                <td>
                  {p.stock} {p.unidadeMedida}
                </td>
                <td>{p.codigoBarras || "—"}</td>
                <td>
                  {currentUser.role === "admin" && (
                    <button
                      className="text-blue-700"
                      onClick={() => setEditing(p)}
                    >
                      Editar produto
                    </button>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {editing !== undefined && (
        <InvoiceItemEditor
          initial={editing || undefined}
          addToInvoice={false}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            setMsg("Produto guardado no catálogo.");
          }}
        />
      )}
    </section>
  );
}
function Clients({ onInvoice }: { onInvoice: (p: PacienteCliente) => void }) {
  const { pacientes, addPaciente } = useApp();
  const [form, setForm] = useState({
      nome: "",
      nif: "",
      telefone: "",
      email: "",
      endereco: "",
    }),
    [msg, setMsg] = useState(""),
    [created, setCreated] = useState<PacienteCliente | null>(null),
    [busy, setBusy] = useState(false);
  const fields = [
    ["nome", "Nome do paciente"],
    ["nif", "NIF (opcional)"],
    ["telefone", "Telefone"],
    ["email", "Email"],
    ["endereco", "Morada"],
  ];
  return (
    <div className="p-5 space-y-4">
      <h2 className="text-xl font-bold">Pacientes / Clientes da instituição</h2>
      <p className="text-sm">
        Este cadastro usa os mesmos pacientes da clínica. Para ensaios,
        identifique o nome como TESTE e use a empresa de formação, se
        disponível.
      </p>
      <form
        className="flex flex-wrap gap-3 my-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setMsg("");
          try {
            const patient = await addPaciente(form);
            setCreated(patient);
            setForm({
              nome: "",
              nif: "",
              telefone: "",
              email: "",
              endereco: "",
            });
            setMsg("Paciente registado. Pode criar a factura de formação.");
          } catch (e: any) {
            setMsg(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {fields.map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              className="block border rounded p-2"
              type={k === "email" ? "email" : "text"}
              required={k === "nome"}
              value={(form as any)[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </label>
        ))}
        <button
          disabled={busy}
          className="bg-blue-700 text-white p-2 rounded disabled:opacity-50"
        >
          {busy ? "A guardar…" : "Registar paciente"}
        </button>
      </form>
      <p role="status">{msg}</p>
      {created && (
        <button
          className="bg-emerald-700 text-white rounded p-3"
          onClick={() => onInvoice(created)}
        >
          Criar factura para {created.nome}
        </button>
      )}
      <div className="divide-y">
        {pacientes.map((p) => (
          <div className="p-2 flex justify-between gap-3" key={p.id}>
            <span>
              {p.nome} · NIF {p.nif || "não indicado"} · {p.telefone}
            </span>
            <button
              className="text-blue-800 underline"
              onClick={() => onInvoice(p)}
            >
              Criar factura
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
function AGT() {
  return <AgtHomologacao />;
}
function Content({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { produtos, config, currentUser } = useApp();
  const [tab, setTab] = useState("novo"),
    [openKey, setOpenKey] = useState(0),
    [client, setClient] = useState<PacienteCliente | null>(null),
    [collapsed, setCollapsed] = useState(false),
    [mobileMenuOpen, setMobileMenuOpen] = useState(false),
    [notice, setNotice] = useState(config.ambiente === "homologacao"),
    [help, setHelp] = useState(false),
    [apps, setApps] = useState(false),
    [title, setTitle] = useState("Novo Documento");
  React.useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  const open = (next: string) => {
    setMobileMenuOpen(false);
    setTab(next);
    if (next === "novo") setOpenKey((k) => k + 1);
    setTitle(
      next === "novo"
        ? "Novo Documento"
        : next === "pos"
          ? "POS / Caixa"
          : next === "artigos"
            ? "Produtos"
            : next === "clientes"
              ? "Clientes"
              : next === "config"
                ? "Configuração / Impressão"
                : next === "agt"
                  ? "Preparação AGT"
                  : "Documentos",
    );
  };
  const changedView = useCallback(
    (view: string) =>
      setTitle(
        view === "form"
          ? "Novo Documento"
          : view === "lista"
            ? "Documentos"
            : "Documento emitido",
      ),
    [],
  );
  const invoiceFor = (p: PacienteCliente) => {
    setClient(p);
    setTab("novo");
    setOpenKey((k) => k + 1);
  };
  const scan = (select: (p: any) => void) => {
    const code = window.prompt("Código de barras ou código interno:");
    if (!code) return;
    const p = produtos.find(
      (p) =>
        p.ativo && (p.codigo === code.trim() || p.codigoBarras === code.trim()),
    );
    if (p) select(p);
    else window.alert("Código não encontrado no catálogo desta instituição.");
  };
  const nav = (key: string, label: string, child = false, Icon?: any) => (
    <button
      key={key}
      className={child ? "vf-nav-child" : ""}
      aria-current={tab === key ? "page" : undefined}
      onClick={() => open(key)}
    >
      {Icon && <Icon />}
      {label}
    </button>
  );
  const documentTabs = [
    "novo",
    "facturas",
    "transporte",
    "informativo",
    "todos",
    "formacao",
    "pendentes",
    "relatorios",
  ];
  return (
    <section
      className={
        "vf-shell" +
        (collapsed ? " is-collapsed" : "") +
        (mobileMenuOpen ? " is-mobile-open" : "")
      }
      aria-label="Facturação clínica"
    >
      <style>{FATURACAO_REFERENCE_CSS}</style>
      <aside className="vf-rail" aria-label="Áreas da facturação">
        <button
          className="vf-logo"
          title="Voltar à clínica"
          onClick={() => onNavigate?.("dashboard")}
        >
          <span>NV</span>
        </button>
        <button className="active" onClick={() => open("novo")}>
          <LayoutDashboard />
          GESTÃO
        </button>
        <button onClick={() => open("pos")}>
          <Monitor />
          POS
        </button>
        <button onClick={() => onNavigate?.("chat")} title="Chat da clínica">
          <Package />
          CHAT
        </button>
        <button onClick={() => setApps((v) => !v)}>
          <Layers />
          APPS
        </button>
        <button
          className="vf-back"
          onClick={() => onNavigate?.("dashboard")}
          title="Voltar à clínica"
        >
          <ArrowLeft />
        </button>
      </aside>
      <aside className="vf-sidebar">
        <div className="vf-company">
          <strong title={config.nomeClinica}>
            {config.nomeClinica || "Clínica"}{" "}
            <ChevronDown style={{ display: "inline", width: 12, height: 12 }} />
          </strong>
          <small>NIF: {config.nif || "não configurado"}</small>
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label="Recolher menu"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <nav className="vf-nav" aria-label="Menu de facturação">
          {nav("artigos", "Produtos", false, Package)}
          <div className="vf-nav-group">
            {nav("todos", "Documentos", false, Folder)}
            {[
              ["novo", "Criar Documento"],
              ["facturas", "Facturação"],
              ["transporte", "Transporte"],
              ["informativo", "Informativo"],
              ["todos", "Todos"],
              ["formacao", "Formação"],
              ["pendentes", "Facturas por Liquidar"],
              ["config", "Impressão"],
            ].map(([k, l]) => nav(k, l, true))}
          </div>
          {nav("clientes", "Clientes", false, UserRound)}
          {nav("relatorios", "Relatórios", false, ChartNoAxesCombined)}
          <button onClick={() => onNavigate?.("resumofinanceiro")}>
            <BookOpen />
            Contabilidade
          </button>
          {nav("agt", "Preparação AGT", false, CheckCircle2)}
        </nav>
        <button className="vf-settings-nav" onClick={() => open("config")}>
          <SettingsIcon size={17} />
          Configuração
        </button>
      </aside>
      {mobileMenuOpen && (
        <button
          className="vf-mobile-shade"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <header className="vf-topbar">
        <button
          className="vf-mobile-menu"
          aria-label="Menu de facturação"
          onClick={() => {
            setCollapsed(false);
            setMobileMenuOpen((v) => !v);
          }}
        >
          <PanelLeftClose size={20} />
        </button>
        <h1>{title}</h1>
        <div className="vf-training-badge">
          Formação<span>{config.calculoFiscalAGT ? "HML" : "TEST"}</span>
        </div>
        <button
          className="vf-agt"
          onClick={() => open("agt")}
          style={{
            background: "#fff",
            borderTop: 0,
            borderBottom: 0,
            textAlign: "left",
          }}
        >
          AGT
          <small>
            {config.calculoFiscalAGT ? "Homologação FE" : "Formação local"}
          </small>
        </button>
        <div className="vf-top-actions">
          <button
            className="vf-round"
            aria-label="Novo documento"
            onClick={() => open("novo")}
          >
            <Plus size={20} />
          </button>
          <button
            className="vf-round"
            aria-label="Ajuda"
            onClick={() => setHelp(true)}
          >
            <HelpCircle size={20} />
          </button>
        </div>
        <div className="vf-account">
          <span className="vf-avatar">
            {String(currentUser.nome || currentUser.username)
              .split(" ")
              .slice(0, 2)
              .map((s) => s[0])
              .join("")
              .toUpperCase()}
          </span>
          <span className="vf-account-name">
            {currentUser.nome || currentUser.username}
            <small>{currentUser.cargo || "Utilizador da clínica"}</small>
          </span>
          <ChevronDown size={12} />
        </div>
      </header>
      <main className="vf-body">
        <Suspense fallback={<div className="p-6 text-slate-600">A preparar o módulo de facturação…</div>}>
        {documentTabs.includes(tab) ? (
          <FaturacaoView
            key={tab + "-" + openKey}
            initialView={tab === "novo" ? "form" : "lista"}
            initialTypeFilter={
              tab === "informativo"
                ? "pro-forma"
                : tab === "facturas"
                  ? "factura"
                  : "todos"
            }
            initialStateFilter={tab === "pendentes" ? "emitida" : "todos"}
            initialSearchFilter={
              tab === "formacao"
                ? "TEST"
                : tab === "transporte"
                  ? "Transporte:"
                  : ""
            }
            onViewChange={changedView}
            onTrainingHelp={() => setNotice(true)}
            preselectedClient={client}
            onClearPreselectedClient={() => setClient(null)}
          />
        ) : tab === "pos" ? (
          <POSView onOpenScanner={scan} />
        ) : tab === "artigos" ? (
          <Catalogue />
        ) : tab === "clientes" ? (
          <Clients onInvoice={invoiceFor} />
        ) : tab === "config" ? (
          <Settings />
        ) : (
          <AGT />
        )}
        </Suspense>
      </main>
      <div className="vf-float">
        <button
          aria-label="Aplicações da clínica"
          onClick={() => setApps((v) => !v)}
        >
          <LayoutDashboard />
        </button>
        <button aria-label="Ajuda da facturação" onClick={() => setHelp(true)}>
          <HelpCircle />
          AJUDA
        </button>
      </div>
      {apps && (
        <div className="vf-floating-menu">
          {[
            ["dashboard", "Início da clínica"],
            ["pacientes", "Pacientes"],
            ["seguradoras", "Seguradoras / contas"],
            ["farmacia", "Farmácia"],
            ["chat", "Chat"],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => {
                setApps(false);
                onNavigate?.(k);
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {notice && (
        <div
          className="vf-modal-cover"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vf-training-title"
        >
          <div className="vf-training-modal">
            <button
              className="vf-close"
              onClick={() => setNotice(false)}
              aria-label="Fechar aviso de formação"
            >
              ×
            </button>
            <div className="vf-training-head">
              <GraduationCap />
              <h2 id="vf-training-title">Modo Formação Ativo</h2>
              <p>
                Atenção: Documentos emitidos não têm validade fiscal.
                <br />
                Utilize este modo para formação e testes.
              </p>
            </div>
            <div className="vf-training-content">
              Os documentos ficam associados a{" "}
              {config.nomeClinica || "esta clínica"}, na empresa da sua sessão.
              <small>
                Envio para homologação apenas por confirmação no painel AGT. A
                produção fiscal mantém-se bloqueada nesta instalação.
              </small>
            </div>
            <div className="vf-training-actions">
              <button onClick={() => setNotice(false)} autoFocus>
                <CheckCircle2 />
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {help && (
        <div
          className="vf-modal-cover"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vf-help-title"
        >
          <div className="vf-help-dialog">
            <h2 id="vf-help-title">Precisa de Ajuda?</h2>
            <p>
              Seleccione o paciente no campo Cliente. Adicione os produtos ou
              serviços pela pesquisa ou pelo botão Itens.
            </p>
            <p>
              Use Alterar para abrir cada definição do documento: data,
              vencimento, pagamentos, desconto e transporte. Confirme os valores
              antes de Criar Factura.
            </p>
            <p>
              Para receber pagamentos, abra primeiro uma sessão em POS / Caixa.
              Para seguro, valide vínculo, autorização e repartição por pagador.
              A impressão usa o emitente e os valores guardados no documento.
            </p>
            <p>
              O modo formação conserva os documentos na série TEST e não
              movimenta a tesouraria nem o stock reais.
            </p>
            <button onClick={() => setHelp(false)}>Fechar ajuda</button>
          </div>
        </div>
      )}
    </section>
  );
}
export default function BillingModule({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void;
}) {
  const content = (
    <AppProvider>
      <Content onNavigate={onNavigate} />
    </AppProvider>
  );
  return typeof document === "undefined"
    ? content
    : createPortal(content, document.body);
}
