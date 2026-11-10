import { inputNumber, invoicePreview } from "../utils/billingNumbers";
import { creditedDocumentNumbers, paginateInvoices } from "../utils/invoiceList";
import InvoiceItemEditor from "../components/InvoiceItemEditor";
import { FATURACAO_REFERENCE_CSS } from "../styles/reference";
import InsuranceBilling from "../../../components/hospital/InsuranceBilling";
import type { InsuranceSelection } from "@workspace/api-zod";
import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useApp } from "../store/AppContext";
import {
  Fatura,
  LinhaFatura,
  DocumentType,
  DocumentState,
  PacienteCliente,
  KitProduto,
} from "../types";
import {
  formatCurrency,
  generateFaturaHTML,
  downloadFatura,
  validarNifEmitente,
} from "../utils/faturaGenerator";
import { KitsProcedimentosModal } from "../components/KitsProcedimentosModal";
import {
  ReceiptText,
  Plus,
  Search,
  Printer,
  BadgeCheck,
  CircleAlert,
  QrCode,
  Trash2,
  X,
  UserRoundPlus,
  CreditCard,
  ArrowLeft,
  FileMinus2,
  Check,
  BookOpen,
  Package,
  ChevronRight,
  Boxes,
  FileDown,
  Mail,
  CalendarDays,
  Hash,
  Clock,
  Percent,
  ArrowRightLeft,
  GraduationCap,
  ChevronLeft,
  Truck,
  Store,
  Menu,
  List,
  ChevronDown,
  Banknote,
  ShieldCheck,
  Pencil,
  Save,
  HelpCircle,
  TrendingUp,
  Minus,
  MessageCircle,
  LockKeyhole,
  History,
  WalletCards,
  Send,
  UserRound,
  Receipt,
} from "lucide-react";

/* ---- Tipos de documento — identidade própria NV Digital ---- */
type FaturacaoAction = {
  id: string;
  at: string;
  action: string;
  label: string;
  detail?: string;
};

function readFaturacaoActions(numero?: string): FaturacaoAction[] {
  return ((window as any).__nvBillingAudit?.[numero || ""] ||
    []) as FaturacaoAction[];
}
function appendFaturacaoAction(
  _numero: string,
  _action: string,
  _label: string,
  _detail?: string,
) {}

const TIPO_DOC_OPTS: {
  value: DocumentType;
  label: string;
  code: string;
  defaultState: DocumentState;
  color: string;
  group: string;
  note?: string;
}[] = [
  {
    value: "factura",
    label: "Factura",
    code: "FT",
    defaultState: "emitida",
    color: "#1577EB",
    group: "Facturação",
  },
  {
    value: "factura-global",
    label: "Factura Global",
    code: "FG",
    defaultState: "emitida",
    color: "#17A2B8",
    group: "Facturação",
  },
  {
    value: "factura-recibo",
    label: "Factura Recibo",
    code: "FR",
    defaultState: "paga",
    color: "#28A745",
    group: "Facturação",
  },
  {
    value: "nota-credito",
    label: "Nota de Crédito",
    code: "NC",
    defaultState: "emitida",
    color: "#DC3545",
    group: "Retificação",
    note: "(com documento de origem e prova de conhecimento)",
  },
  {
    value: "pro-forma",
    label: "Factura Pró-Forma",
    code: "PF",
    defaultState: "rascunho",
    color: "#6C757D",
    group: "Informativo",
  },
  {
    value: "recibo",
    label: "Recibo de Pagamento",
    code: "RC",
    defaultState: "paga",
    color: "#20C997",
    group: "Informativo",
  },
];

function getDocumentMeta(tipoDocumento: DocumentType) {
  return (
    TIPO_DOC_OPTS.find((tipo) => tipo.value === tipoDocumento) ||
    TIPO_DOC_OPTS[0]
  );
}

/* ---- Pagamentos ---- */
const PAYMENT_METHODS = [
  { label: "Dinheiro", code: "NU" },
  { label: "Multibanco", code: "CD" },
  { label: "Cartão de Crédito", code: "CC" },
  { label: "Transferência Bancária", code: "TB" },
];

const VENCIMENTO_OPTIONS = [
  { value: "now", label: "A Pronto" },
  { value: "1", label: "Hoje" },
  { value: "7", label: "A Prazo de 7 Dias" },
  { value: "15", label: "A Prazo de 15 Dias" },
  { value: "30", label: "A Prazo de 30 Dias" },
  { value: "45", label: "A Prazo de 45 Dias" },
  { value: "60", label: "A Prazo de 60 Dias" },
  { value: "90", label: "A Prazo de 90 Dias" },
  { value: "date", label: "Data específica" },
];

function todayStr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function addDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

interface FaturacaoViewProps {
  onOpenScanner?: (onSelect: (p: any) => void) => void;
  preselectedClient?: PacienteCliente | null;
  onClearPreselectedClient?: () => void;
  initialView?: "form" | "lista";
  initialTypeFilter?: string;
  initialStateFilter?: string;
  initialSearchFilter?: string;
  onViewChange?: (view: string) => void;
  onTrainingHelp?: () => void;
}

export const FaturacaoView: React.FC<FaturacaoViewProps> = ({
  onOpenScanner,
  preselectedClient,
  onClearPreselectedClient,
  initialView = "form",
  initialTypeFilter = "todos",
  initialStateFilter = "todos",
  initialSearchFilter = "",
  onViewChange,
  onTrainingHelp,
}) => {
  const {
    faturas,
    produtos,
    pacientes,
    config,
    kits,
    categorias = [],
    refresh,
    currentUser,
    addFatura,
    updateFatura,
    addPaciente,
    updatePaciente,
    removeFatura,
    findProdutoByBarcodeOrCode,
  } = useApp();

  const [viewMode, setViewMode] = useState<"lista" | "form" | "detalhe">(
    initialView,
  );
  useEffect(() => {
    onViewChange?.(viewMode);
  }, [viewMode, onViewChange]);
  const [editId, setEditId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState(initialSearchFilter);
  const [filterState, setFilterState] = useState<string>(initialStateFilter);
  const [filterType, setFilterType] = useState<string>(initialTypeFilter);
  const [invoicePage, setInvoicePage] = useState(1);
  useEffect(() => {
    setInvoicePage(1);
  }, [searchTerm, filterState, filterType]);

  const [tipoDocumento, setTipoDocumento] = useState<DocumentType>("factura");
  const [estado, setEstado] = useState<DocumentState>("emitida");
  const modoFormacao = config.ambiente === "homologacao";
  const issueBlockedForMissingIssuerNif =
    !modoFormacao &&
    tipoDocumento !== "pro-forma" &&
    estado !== "rascunho" &&
    !validarNifEmitente(config.nif);

  const [dataEmissao, setDataEmissao] = useState(todayStr());
  const [dataDisponibilizacao, setDataDisponibilizacao] = useState("");
  const [dataVencimento, setDataVencimento] = useState(todayStr());
  const [vencimentoPreset, setVencimentoPreset] = useState("now");

  const [clienteNome, setClienteNome] = useState("Consumidor Final");
  const [clienteNif, setClienteNif] = useState("");
  const [clienteEndereco, setClienteEndereco] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [pacienteId, setPacienteId] = useState<number | undefined>(undefined);
  const [insurance, setInsurance] = useState<InsuranceSelection | null>(null);
  const [insuranceReady, setInsuranceReady] = useState(false);
  const insurancePatient = useRef(pacienteId);
  useEffect(() => {
    if (insurancePatient.current !== pacienteId) {
      setInsurance(null);
      setInsuranceReady(false);
      insurancePatient.current = pacienteId;
    }
  }, [pacienteId]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);

  const [linhas, setLinhas] = useState<LinhaFatura[]>([]);
  const [descontoPercent, setDescontoPercent] = useState<string>("");
  const [descontoValorStr, setDescontoValorStr] = useState<string>("");

  useEffect(() => {
    if (!preselectedClient) return;
    setClienteNome(preselectedClient.nome);
    setClienteNif(preselectedClient.nif || "");
    setClienteEndereco(preselectedClient.endereco || "");
    setClienteTelefone(preselectedClient.telefone || "");
    setClienteEmail(preselectedClient.email || "");
    setPacienteId(preselectedClient.id);
    setViewMode("form");
    onClearPreselectedClient?.();
  }, [preselectedClient, onClearPreselectedClient]);

  const [ivaTaxa, setIvaTaxa] = useState(config.ivaTaxa ?? 14);
  const [paymentsSelected, setPaymentsSelected] = useState<
    Record<string, boolean>
  >({});
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>(
    {},
  );
  // Protege a emissão contra duplo clique/reenvio e evita criar dois números em sequência.
  const fiscalOperationLockRef = useRef(false);
  const [actionHistoryTick, setActionHistoryTick] = useState(0);
  const logFaturacaoAction = useCallback(
    (
      doc: Fatura | null | undefined,
      action: string,
      label: string,
      detail?: string,
    ) => {
      if (!doc?.numero) return;
      appendFaturacaoAction(doc.numero, action, label, detail);
      setActionHistoryTick((v) => v + 1);
    },
    [],
  );
  const [observacoes, setObservacoes] = useState("");
  const [referenciaExterna, setReferenciaExterna] = useState("");
  const [facturaPremiada, setFacturaPremiada] = useState(true);
  const [docOrigem, setDocOrigem] = useState("");
  const [movimentarStock, setMovimentarStock] = useState(true);
  const [transporte, setTransporte] = useState(false);
  const [localCarga, setLocalCarga] = useState("");
  const [moradaCarga, setMoradaCarga] = useState("");
  const [dataHoraCarga, setDataHoraCarga] = useState("");
  const [localDescarga, setLocalDescarga] = useState("");
  const [moradaDescarga, setMoradaDescarga] = useState("");
  const [dataHoraDescarga, setDataHoraDescarga] = useState("");
  const [matriculaVeiculo, setMatriculaVeiculo] = useState("");
  const [incluirPrecosTransporte, setIncluirPrecosTransporte] = useState(true);
  const [retencaoIPU, setRetencaoIPU] = useState("");
  const [docToGenerate, setDocToGenerate] = useState<"FT" | "FR">("FT");

  const [itemSearch, setItemSearch] = useState("");
  const [itemQtd, setItemQtd] = useState("1");
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const [showKitsModal, setShowKitsModal] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("todas");

  const [showNovoClienteModal, setShowNovoClienteModal] = useState(false);
  const [novoCliNome, setNovoCliNome] = useState("");
  const [novoCliNif, setNovoCliNif] = useState("");
  const [novoCliTel, setNovoCliTel] = useState("");
  const [novoCliEnd, setNovoCliEnd] = useState("");

  const [ncModal, setNcModal] = useState<Fatura | null>(null);
  const [ncMotivo, setNcMotivo] = useState("");
  const [ncQuantidades, setNcQuantidades] = useState<Record<number, number>>(
    {},
  );
  const [confirmingIssue, setConfirmingIssue] = useState(false);
  const [issuedDocument, setIssuedDocument] = useState<Fatura | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showListTypes, setShowListTypes] = useState(false);
  const [showTaxes, setShowTaxes] = useState(false);
  const [openBoxes, setOpenBoxes] = useState<Record<string, boolean>>({});
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftError, setDraftError] = useState("");
  const draftState = useRef<{
    signature: string;
    id: number | null;
    running: boolean;
  }>({ signature: "", id: null, running: false });

  const toggleBox = (k: string) => setOpenBoxes((p) => ({ ...p, [k]: !p[k] }));

  const searchInputRef = useRef<HTMLInputElement>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);

  const matchingKitsDropdown = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return [];
    return (kits || [])
      .filter(
        (k) =>
          k.ativo &&
          (k.codigo.toLowerCase().includes(q) ||
            k.nome.toLowerCase().includes(q) ||
            (k.categoria && k.categoria.toLowerCase().includes(q)) ||
            k.itens.some(
              (i) =>
                i.produtoNome.toLowerCase().includes(q) ||
                i.produtoCodigo.toLowerCase().includes(q),
            )),
      )
      .slice(0, 4);
  }, [itemSearch, kits]);

  const filteredProductsDropdown = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return [];
    return produtos
      .filter(
        (p) =>
          p.ativo &&
          (p.nome.toLowerCase().includes(q) ||
            p.codigo.toLowerCase().includes(q) ||
            (p.categoria && p.categoria.toLowerCase().includes(q)) ||
            (p.codigoBarras && p.codigoBarras.toLowerCase().includes(q))),
      )
      .slice(0, 15);
  }, [itemSearch, produtos]);

  const clientSuggestions = useMemo(() => {
    const q = clienteNome.trim().toLowerCase();
    return pacientes
      .filter(
        (c) =>
          !q ||
          q === "consumidor final" ||
          c.nome.toLowerCase().includes(q) ||
          (c.nif && c.nif.includes(q)) ||
          (c.telefone && c.telefone.includes(q)),
      )
      .slice(0, 30);
  }, [clienteNome, pacientes]);

  const catalogFilteredProducts = useMemo(() => {
    return produtos.filter((p) => {
      const q = catalogSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.nome.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.categoria && p.categoria.toLowerCase().includes(q)) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(q));
      const matchesCat =
        catalogCategory === "todas" || p.categoria === catalogCategory;
      return matchesSearch && matchesCat;
    });
  }, [produtos, catalogSearch, catalogCategory]);

  /* Barcode wedge */
  useEffect(() => {
    let buf = "";
    let last = Date.now();
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        (e.key === "Enter" && e.defaultPrevented) ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        e.isComposing ||
        (target?.closest("input,textarea,[contenteditable=true]") &&
          target !== searchInputRef.current)
      ) {
        buf = "";
        return;
      }
      const now = Date.now();
      if (now - last > 100) buf = "";
      last = now;
      if (e.key === "Enter") {
        if (buf.length >= 3) {
          const found = findProdutoByBarcodeOrCode(buf);
          if (found) {
            e.preventDefault();
            addItemToLinhas(found, 1);
            buf = "";
            return;
          }
        }
        buf = "";
      } else if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [produtos, linhas]);

  const resetForm = useCallback(() => {
    draftState.current.signature = "";
    draftState.current.id = null;
    setDraftError("");
    setInsurance(null);
    setInsuranceReady(false);
    setEditId(null);
    setTipoDocumento("factura");
    setEstado("emitida");
    setDataEmissao(todayStr());
    setDataDisponibilizacao("");
    setDataVencimento(todayStr());
    setVencimentoPreset("now");
    setClienteNome("Consumidor Final");
    setClienteNif("");
    setClienteEndereco("");
    setClienteTelefone("");
    setClienteEmail("");
    setPacienteId(undefined);
    setLinhas([]);
    setDescontoPercent("");
    setDescontoValorStr("");
    setIvaTaxa(config.ivaTaxa ?? 14);
    setPaymentsSelected({});
    setPaymentAmounts({});
    setObservacoes("");
    setReferenciaExterna("");
    setFacturaPremiada(true);
    setDocOrigem("");
    setMovimentarStock(true);
    setTransporte(false);
    setRetencaoIPU("");
    setDocToGenerate("FT");
    setItemSearch("");
    setItemQtd("1");
    setShowListTypes(false);
    setShowTaxes(false);
    setDraftSavedAt(null);
  }, [config.ivaTaxa]);

  const handleNovoDocumento = useCallback(
    (tipo: DocumentType = "factura") => {
      resetForm();
      setTipoDocumento(tipo);
      const opt = TIPO_DOC_OPTS.find((t) => t.value === tipo);
      if (opt) setEstado(opt.defaultState);
      setViewMode("form");
    },
    [resetForm],
  );

  const addItemToLinhas = useCallback((produto: any, qtd: number = 1) => {
    setLinhas((prev) => {
      const idx = prev.findIndex((l) => l.produtoId === produto.id);
      if (idx >= 0) {
        const up = [...prev];
        up[idx] = { ...up[idx], quantidade: up[idx].quantidade + qtd };
        return up;
      }
      return [
        ...prev,
        {
          id: `line-${Date.now()}-${Math.random()}`,
          produtoId: produto.id,
          codigo: produto.codigo,
          descricao: produto.nome,
          quantidade: qtd,
          precoUnitario: produto.preco,
          ivaIsento: produto.ivaIsento,
          unidade: produto.unidadeMedida,
          lote: produto.loteAtual,
          dataValidade: produto.dataValidade,
        },
      ];
    });
    setItemSearch("");
    setItemQtd("1");
    setShowItemDropdown(false);
  }, []);

  const handleInsertKit = useCallback(
    (kit: KitProduto, mode: "detalhado" | "linha_unica" = "detalhado") => {
      if (mode === "detalhado") {
        setLinhas((prev) => {
          const up = [...prev];
          kit.itens.forEach((kItem) => {
            const idx = up.findIndex(
              (l) =>
                (kItem.produtoId && l.produtoId === kItem.produtoId) ||
                l.codigo === kItem.produtoCodigo,
            );
            if (idx >= 0) {
              up[idx] = {
                ...up[idx],
                quantidade: up[idx].quantidade + (kItem.quantidade || 1),
              };
            } else {
              up.push({
                id: `line-kit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                produtoId: kItem.produtoId,
                codigo: kItem.produtoCodigo,
                descricao: kItem.produtoNome,
                quantidade: kItem.quantidade || 1,
                precoUnitario: kItem.precoUnitario,
                ivaIsento: kItem.ivaIsento || false,
                unidade: kItem.unidade || "un",
              });
            }
          });
          return up;
        });
        setObservacoes((prev) => {
          const note = `Procedimento executado: ${kit.nome} (${kit.codigo})`;
          return prev
            ? prev.includes(kit.codigo)
              ? prev
              : `${prev}\n${note}`
            : note;
        });
      } else {
        setLinhas((prev) => [
          ...prev,
          {
            id: `line-kit-single-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            codigo: kit.codigo,
            descricao: `${kit.nome} (Kit/Procedimento Completo)`,
            quantidade: 1,
            precoUnitario: kit.precoVendaKit,
            ivaIsento: kit.itens.every((i) => i.ivaIsento),
            unidade: "kit",
          },
        ]);
        const note = `[KIT ${kit.codigo}: ${kit.nome} - Inclui: ${kit.itens.map((i) => `${i.quantidade}x ${i.produtoCodigo} ${i.produtoNome}`).join(", ")}]`;
        setObservacoes((prev) =>
          prev ? (prev.includes(kit.codigo) ? prev : `${prev}\n${note}`) : note,
        );
      }
      setItemSearch("");
      setShowItemDropdown(false);
      setShowKitsModal(false);
    },
    [],
  );

  const handleRemoveLine = useCallback(
    (idx: number) => setLinhas((p) => p.filter((_, i) => i !== idx)),
    [],
  );
  const handleUpdateLine = useCallback(
    (idx: number, field: keyof LinhaFatura, value: any) => {
      setLinhas((p) => {
        const u = [...p];
        u[idx] = { ...u[idx], [field]: value };
        return u;
      });
    },
    [],
  );

  const totals = useMemo(
    () =>
      invoicePreview(
        linhas,
        ivaTaxa,
        descontoPercent,
        descontoValorStr,
        config.calculoFiscalAGT ? "agt2" : "legacy",
      ),
    [
      linhas,
      ivaTaxa,
      descontoPercent,
      descontoValorStr,
      config.calculoFiscalAGT,
    ],
  );

  const formaPagamentoFinal = useMemo(() => {
    const sel = PAYMENT_METHODS.filter((m) => paymentsSelected[m.label]);
    if (sel.length === 0) return "A combinar";
    return sel.map((s) => s.label).join(" + ");
  }, [paymentsSelected]);

  const trocoCalculado = useMemo(() => {
    if (!paymentsSelected["Dinheiro"]) return 0;
    const v = parseFloat(paymentAmounts["Dinheiro"] || "") || 0;
    return Math.max(0, v - totals.total);
  }, [paymentsSelected, paymentAmounts, totals.total]);

  const pagamentoTotal = useMemo(
    () =>
      PAYMENT_METHODS.reduce(
        (sum, m) =>
          sum +
          (paymentsSelected[m.label]
            ? parseFloat(
                String(paymentAmounts[m.label] || "").replace(",", "."),
              ) || 0
            : 0),
        0,
      ),
    [paymentsSelected, paymentAmounts],
  );
  const pagamentoEmFalta = useMemo(
    () => Math.max(0, totals.total - pagamentoTotal),
    [totals.total, pagamentoTotal],
  );
  const pagamentoExcesso = useMemo(
    () => Math.max(0, pagamentoTotal - totals.total),
    [totals.total, pagamentoTotal],
  );

  // Automatização inspirada no comportamento do HTML: ao selecionar uma forma
  // de pagamento, o sistema preenche automaticamente o valor com o total.
  // Com várias formas, a nova forma recebe apenas o saldo ainda em falta.
  const handleTogglePayment = useCallback(
    (label: string, checked: boolean) => {
      setPaymentsSelected((prev) => {
        const next = { ...prev, [label]: checked };
        if (!checked) {
          setPaymentAmounts((amounts) => ({ ...amounts, [label]: "" }));
          return next;
        }
        const selectedOthers = PAYMENT_METHODS.filter(
          (m) => m.label !== label && next[m.label],
        );
        const alreadyAllocated = selectedOthers.reduce(
          (sum, m) =>
            sum +
            (parseFloat(
              String(paymentAmounts[m.label] || "").replace(",", "."),
            ) || 0),
          0,
        );
        const remaining = Math.max(0, totals.total - alreadyAllocated);
        setPaymentAmounts((amounts) => ({
          ...amounts,
          [label]: remaining > 0 ? remaining.toFixed(2) : "0",
        }));
        return next;
      });
    },
    [paymentAmounts, totals.total],
  );

  useEffect(() => {
    const selected = PAYMENT_METHODS.filter((m) => paymentsSelected[m.label]);
    if (selected.length === 1) {
      const m = selected[0];
      const current =
        parseFloat(String(paymentAmounts[m.label] || "").replace(",", ".")) ||
        0;
      if (!current && totals.total > 0) {
        setPaymentAmounts((prev) => ({
          ...prev,
          [m.label]: totals.total.toFixed(2),
        }));
      }
    }
  }, [totals.total]);

  const handleEditDraft = useCallback((draft: Fatura) => {
    if (draft.estado !== "rascunho" || draft.proformaFinalizada) {
      alert(
        "Este documento já foi emitido e está bloqueado. Para corrigir uma emissão, utilize uma Nota de Crédito.",
      );
      return;
    }
    setInsurance(draft.insurance || null);
    setInsuranceReady(false);
    insurancePatient.current = draft.pacienteId;
    draftState.current.id = draft.id;
    draftState.current.signature = "";
    setDraftError("");
    setDraftSavedAt(new Date((draft as any).createdAt || Date.now()));
    setEditId(draft.id);
    setTipoDocumento(draft.tipoDocumento);
    setEstado(draft.tipoDocumento === "pro-forma" ? draft.estado : "emitida");
    setDataEmissao(draft.data);
    setDataVencimento(draft.dataVencimento);
    setDataDisponibilizacao(draft.dataDisponibilizacao || "");
    const options = draft.opcoesDocumento;
    setReferenciaExterna(options?.referenciaExterna || "");
    setTransporte(options?.transporte || false);
    setLocalCarga(options?.localCarga || "");
    setMoradaCarga(options?.moradaCarga || "");
    setDataHoraCarga(options?.dataHoraCarga || "");
    setLocalDescarga(options?.localDescarga || "");
    setMoradaDescarga(options?.moradaDescarga || "");
    setDataHoraDescarga(options?.dataHoraDescarga || "");
    setMatriculaVeiculo(options?.matriculaVeiculo || "");
    setIncluirPrecosTransporte(options?.incluirPrecosTransporte ?? true);
    setClienteNome(draft.clienteNome);
    setClienteNif(draft.clienteNif || "");
    setClienteEndereco(draft.clienteEndereco || "");
    setClienteTelefone(draft.clienteTelefone || "");
    setClienteEmail(draft.clienteEmail || "");
    setPacienteId(draft.pacienteId);
    setLinhas(draft.linhas.map((l) => ({ ...l })));
    setDescontoPercent(draft.desconto ? String(draft.desconto) : "");
    setDescontoValorStr(draft.descontoValor ? String(draft.descontoValor) : "");
    setIvaTaxa(draft.ivaTaxa);
    setObservacoes(
      draft.opcoesDocumento?.observacoesLivres ?? draft.observacoes ?? "",
    );
    setFacturaPremiada(draft.facturaPremiada ?? true);
    setDocOrigem(draft.documentoOrigem || "");
    setConfirmingIssue(false);
    setViewMode("form");
  }, []);

  const handleSaveDocumento = useCallback(
    async (estadoOverride?: DocumentState, confirmed = false) => {
      if (fiscalOperationLockRef.current) return;
      if (linhas.length === 0) {
        alert(
          "Por favor adicione pelo menos um produto ou serviço ao documento.",
        );
        return;
      }

      const effectiveState = estadoOverride || estado;
      const isOfficialEmission =
        tipoDocumento !== "pro-forma" && effectiveState !== "rascunho";
      if (
        isOfficialEmission &&
        insurance &&
        (!insuranceReady ||
          tipoDocumento !== "factura" ||
          effectiveState !== "emitida" ||
          pagamentoTotal > 0)
      ) {
        alert(
          "Valide a cobertura e emita como Factura / Emitida sem pagamentos. Registe depois cada parcela em Seguradoras → Cobrança.",
        );
        return;
      }

      // Documento emitido é imutável: esta view só permite alterar rascunhos.
      if (editId) {
        const original = faturas.find((f) => f.id === editId);
        if (!original || original.estado !== "rascunho") {
          alert(
            "Documento fiscal emitido não pode ser editado. Emita uma Nota de Crédito para corrigir uma emissão.",
          );
          return;
        }
      }

      // Validações de emissão antes de gerar o número definitivo.
      if (
        linhas.some(
          (l) =>
            !String(l.descricao || "").trim() ||
            !Number.isFinite(Number(l.quantidade)) ||
            Number(l.quantidade) <= 0 ||
            !Number.isFinite(Number(l.precoUnitario)) ||
            Number(l.precoUnitario) < 0,
        )
      ) {
        alert(
          "Existem linhas inválidas. Verifique descrição, quantidade e preço unitário.",
        );
        return;
      }
      const descontoPct = inputNumber(descontoPercent),
        descontoValor = descontoPct > 0 ? 0 : inputNumber(descontoValorStr);
      if (totals.error) {
        alert(totals.error);
        return;
      }
      if (isOfficialEmission && totals.total <= 0) {
        alert(
          "Para emitir este documento de teste, o total deve ser superior a zero. Verifique os itens e o desconto.",
        );
        return;
      }
      if (
        isOfficialEmission &&
        !modoFormacao &&
        !validarNifEmitente(config.nif)
      ) {
        alert(
          "Configure um NIF do emitente válido nas Definições antes de emitir um documento oficial.",
        );
        return;
      }

      const selectedPayments = PAYMENT_METHODS.filter(
        (m) => paymentsSelected[m.label],
      );
      const hasCashOnlyOverpayment =
        selectedPayments.length === 1 &&
        selectedPayments[0].label === "Dinheiro" &&
        pagamentoExcesso > 0;
      if (
        (tipoDocumento === "factura-recibo" || effectiveState === "paga") &&
        totals.total > 0 &&
        pagamentoTotal < totals.total
      ) {
        alert(
          `O documento está marcado como pago, mas faltam ${formatCurrency(pagamentoEmFalta, config.moeda)} em pagamentos.`,
        );
        setOpenBoxes((prev) => ({ ...prev, pay: true }));
        return;
      }
      if (pagamentoExcesso > 0 && !hasCashOnlyOverpayment) {
        alert(
          "O total dos pagamentos não pode ultrapassar o valor da factura. Apenas o pagamento em Dinheiro pode exceder o total, sendo o excedente tratado como troco.",
        );
        setOpenBoxes((prev) => ({ ...prev, pay: true }));
        return;
      }

      // Se o utilizador informou pagamentos que liquidam o total, o documento fica automaticamente pago.
      const autoPaid =
        totals.total > 0 &&
        pagamentoTotal >= totals.total &&
        selectedPayments.length > 0;
      const finalState: DocumentState =
        effectiveState === "rascunho"
          ? "rascunho"
          : tipoDocumento === "factura-recibo" || autoPaid
            ? "paga"
            : effectiveState;

      if (!estadoOverride && !confirmed) {
        setConfirmingIssue(true);
        return;
      }

      fiscalOperationLockRef.current = true;
      try {
        const invoiceData: Omit<Fatura, "id" | "numero"> = {
          serie: config.serie,
          data: dataEmissao,
          dataVencimento,
          clienteNome: clienteNome.trim() || "Consumidor Final",
          clienteNif: clienteNif.trim() || undefined,
          clienteEndereco: clienteEndereco.trim() || undefined,
          clienteTelefone: clienteTelefone.trim() || undefined,
          clienteEmail: clienteEmail.trim() || undefined,
          pacienteId,
          linhas,
          insurance,
          subtotalSemIva: totals.subtotalSemIva,
          totalIva: totals.totalIva,
          ivaTaxa,
          desconto: descontoPct,
          descontoValor,
          total: totals.total,
          estado: finalState,
          observacoes: [
            observacoes.trim(),
            referenciaExterna.trim()
              ? `Ref. Externa: ${referenciaExterna.trim()}`
              : "",
            transporte
              ? `Transporte: ${localCarga || "Local de carga não indicado"} → ${localDescarga || "Local de descarga não indicado"}${moradaCarga ? ` | Carga: ${moradaCarga}` : ""}${moradaDescarga ? ` | Descarga: ${moradaDescarga}` : ""}${dataHoraCarga ? ` | Início: ${dataHoraCarga}` : ""}${dataHoraDescarga ? ` | Fim: ${dataHoraDescarga}` : ""}${matriculaVeiculo ? ` | Matrícula: ${matriculaVeiculo}` : ""}${incluirPrecosTransporte ? " | Inclui preços" : " | Sem preços"}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          tipoDocumento,
          finalizarProforma: tipoDocumento === "pro-forma",
          formaPagamento: formaPagamentoFinal,
          formasPagamentoDetalhe: selectedPayments
            .filter(() => finalState === "paga")
            .map((m) => {
              const valor =
                parseFloat(
                  String(paymentAmounts[m.label] || "").replace(",", "."),
                ) || 0;
              const forma =
                (
                  {
                    Dinheiro: "Numerário",
                    Multibanco: "Multicaixa (TPA)",
                    "Cartão de Crédito": "Cartão",
                  } as Record<string, string>
                )[m.label] || m.label;
              const referencia =
                forma === "Numerário"
                  ? ""
                  : window.prompt(
                      "Referência do pagamento confirmado: " + forma,
                    ) || "";
              return {
                id: crypto.randomUUID(),
                forma,
                valor:
                  Math.round(
                    (m.label === "Dinheiro"
                      ? Math.min(valor, totals.total)
                      : valor) * 100,
                  ) / 100,
                referencia,
              };
            }),
          facturaPremiada,
          documentoOrigem: docOrigem || undefined,
          dataDisponibilizacao,
          opcoesDocumento: {
            observacoesLivres: observacoes,
            referenciaExterna,
            transporte,
            localCarga,
            moradaCarga,
            dataHoraCarga,
            localDescarga,
            moradaDescarga,
            dataHoraDescarga,
            matriculaVeiculo,
            incluirPrecosTransporte,
          },
          emitidoPor: "Operador de Facturação",
        };
        const saved = editId
          ? await updateFatura(editId, invoiceData)
          : await addFatura(invoiceData);
        if (!saved)
          throw new Error("O documento não foi confirmado pelo sistema.");
        if (saved.estado !== "rascunho") {
          logFaturacaoAction(
            saved,
            "emitida",
            "Documento emitido",
            `Série ${saved.serie || config.serie}`,
          );
          if (saved.estado === "paga")
            logFaturacaoAction(
              saved,
              "paga",
              "Pagamento liquidado",
              `Total ${formatCurrency(saved.total, config.moeda)}`,
            );
        }
        resetForm();
        if (
          saved &&
          saved.estado !== "rascunho" &&
          saved.tipoDocumento !== "pro-forma"
        ) {
          setIssuedDocument(saved);
          setViewMode("detalhe");
        } else setViewMode("lista");
        setConfirmingIssue(false);
        fiscalOperationLockRef.current = false;
      } catch (err) {
        console.error(err);
        fiscalOperationLockRef.current = false;
        setConfirmingIssue(false);
        alert(err instanceof Error ? err.message : "Erro ao gravar documento.");
      }
    },
    [
      insurance,
      insuranceReady,
      modoFormacao,
      faturas,
      linhas,
      estado,
      tipoDocumento,
      config,
      dataEmissao,
      dataVencimento,
      clienteNome,
      clienteNif,
      clienteEndereco,
      clienteTelefone,
      clienteEmail,
      pacienteId,
      totals,
      ivaTaxa,
      descontoPercent,
      descontoValorStr,
      observacoes,
      referenciaExterna,
      formaPagamentoFinal,
      facturaPremiada,
      docOrigem,
      editId,
      resetForm,
      updateFatura,
      addFatura,
      pagamentoTotal,
      pagamentoEmFalta,
      pagamentoExcesso,
      paymentsSelected,
      paymentAmounts,
      transporte,
      localCarga,
      localDescarga,
      moradaCarga,
      moradaDescarga,
      dataHoraCarga,
      dataHoraDescarga,
      matriculaVeiculo,
      incluirPrecosTransporte,
      logFaturacaoAction,
      dataDisponibilizacao,
    ],
  );

  const draftSignature = JSON.stringify({
    linhas,
    clienteNome,
    clienteNif,
    clienteEndereco,
    clienteTelefone,
    clienteEmail,
    pacienteId,
    descontoPercent,
    descontoValorStr,
    ivaTaxa,
    observacoes,
    referenciaExterna,
    tipoDocumento,
    dataVencimento,
    dataDisponibilizacao,
    transporte,
    localCarga,
    moradaCarga,
    dataHoraCarga,
    localDescarga,
    moradaDescarga,
    dataHoraDescarga,
    matriculaVeiculo,
    incluirPrecosTransporte,
    insurance,
  });
  useEffect(() => {
    if (
      viewMode !== "form" ||
      !linhas.length ||
      totals.error ||
      linhas.some(
        (l) =>
          !l.descricao.trim() ||
          !Number.isFinite(l.quantidade) ||
          l.quantidade <= 0 ||
          !Number.isFinite(l.precoUnitario) ||
          l.precoUnitario < 0,
      ) ||
      tipoDocumento === "recibo" ||
      tipoDocumento === "nota-credito" ||
      draftSignature === draftState.current.signature
    )
      return;
    const timer = window.setTimeout(async () => {
      if (fiscalOperationLockRef.current || draftState.current.running) return;
      draftState.current.running = true;
      fiscalOperationLockRef.current = true;
      try {
        const draft: Omit<Fatura, "id" | "numero"> = {
          serie: config.serie,
          data: dataEmissao,
          dataVencimento,
          clienteNome: clienteNome.trim() || "Consumidor Final",
          clienteNif: clienteNif || undefined,
          clienteEndereco,
          clienteTelefone,
          clienteEmail,
          pacienteId,
          linhas,
          subtotalSemIva: totals.subtotalSemIva,
          totalIva: totals.totalIva,
          ivaTaxa,
          total: totals.total,
          desconto: inputNumber(descontoPercent),
          descontoValor:
            inputNumber(descontoPercent) > 0
              ? 0
              : inputNumber(descontoValorStr),
          estado: "rascunho",
          tipoDocumento,
          observacoes: [
            observacoes.trim(),
            referenciaExterna.trim()
              ? `Ref. Externa: ${referenciaExterna.trim()}`
              : "",
            transporte
              ? `Transporte: ${localCarga || "Local de carga não indicado"} → ${localDescarga || "Local de descarga não indicado"}${moradaCarga ? ` | Carga: ${moradaCarga}` : ""}${moradaDescarga ? ` | Descarga: ${moradaDescarga}` : ""}${dataHoraCarga ? ` | Início: ${dataHoraCarga}` : ""}${dataHoraDescarga ? ` | Fim: ${dataHoraDescarga}` : ""}${matriculaVeiculo ? ` | Matrícula: ${matriculaVeiculo}` : ""}${incluirPrecosTransporte ? " | Inclui preços" : " | Sem preços"}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          insurance,
          dataDisponibilizacao,
          opcoesDocumento: {
            observacoesLivres: observacoes,
            referenciaExterna,
            transporte,
            localCarga,
            moradaCarga,
            dataHoraCarga,
            localDescarga,
            moradaDescarga,
            dataHoraDescarga,
            matriculaVeiculo,
            incluirPrecosTransporte,
          },
        };
        const id = draftState.current.id || editId;
        const saved = id
          ? await updateFatura(id, draft)
          : await addFatura(draft);
        draftState.current.id = saved.id;
        draftState.current.signature = draftSignature;
        setEditId(saved.id);
        setDraftSavedAt(new Date());
        setDraftError("");
      } catch (e) {
        setDraftError("Rascunho não guardado: " + (e as Error).message);
      } finally {
        draftState.current.running = false;
        fiscalOperationLockRef.current = false;
      }
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [draftSignature, viewMode, editId, addFatura, updateFatura, draftSavedAt]);

  const handleConverterProForma = useCallback(
    (pf: Fatura) => {
      resetForm();
      setTipoDocumento("factura");
      setEstado("emitida");
      setClienteNome(pf.clienteNome);
      setClienteNif(pf.clienteNif || "");
      setClienteEndereco(pf.clienteEndereco || "");
      setLinhas(pf.linhas.map((l) => ({ ...l })));
      setIvaTaxa(pf.ivaTaxa);
      setDescontoPercent(pf.desconto ? String(pf.desconto) : "");
      setObservacoes(`Convertida a partir da Pró-Forma ${pf.numero}`);
      setDocOrigem(pf.numero);
      setViewMode("form");
    },
    [resetForm],
  );

  const handleConfirmNotaCredito = useCallback(async () => {
    if (!ncModal) return;
    if (fiscalOperationLockRef.current) return;
    if (
      ncModal.tipoDocumento === "pro-forma" ||
      ncModal.estado === "rascunho" ||
      ncModal.tipoDocumento === "nota-credito"
    ) {
      alert(
        "Só é possível emitir uma Nota de Crédito para um documento oficial já emitido.",
      );
      return;
    }
    if (!ncMotivo.trim()) {
      alert("É obrigatório informar o motivo da Nota de Crédito.");
      return;
    }
    try {
      const linhasCredito = ncModal.linhas
        .map((linha, index) => {
          const pedido = Number(ncQuantidades[index] ?? 0);
          const limite = Math.abs(Number(linha.quantidade) || 0);
          return {
            ...linha,
            originActIndex: index,
            quantidade: Math.min(Math.max(0, pedido), limite),
          };
        })
        .filter((l) => l.quantidade > 0);
      if (linhasCredito.length === 0) {
        alert("Seleccione pelo menos uma quantidade para creditar.");
        return;
      }

      const sub = linhasCredito.reduce(
        (s, l) => s + l.quantidade * l.precoUnitario,
        0,
      );
      const iva = linhasCredito.reduce(
        (s, l) =>
          s +
          (l.ivaIsento
            ? 0
            : l.quantidade * l.precoUnitario * (ncModal.ivaTaxa / 100)),
        0,
      );
      const novoTotal = sub + iva;
      const jaCreditado = faturas
        .filter(
          (f) =>
            f.tipoDocumento === "nota-credito" &&
            f.documentoOrigem === ncModal.numero &&
            f.estado !== "anulada",
        )
        .reduce((sum, f) => sum + Math.max(0, Number(f.total) || 0), 0);
      const limiteCredito = Math.max(0, Number(ncModal.total) || 0);

      if (novoTotal <= 0) {
        alert("A Nota de Crédito deve ter um valor superior a zero.");
        return;
      }
      if (jaCreditado + novoTotal > limiteCredito + 0.01) {
        alert(
          `O crédito acumulado não pode ultrapassar o valor do documento original. Já creditado: ${formatCurrency(jaCreditado, config.moeda)}.`,
        );
        return;
      }

      fiscalOperationLockRef.current = true;
      const saved = await addFatura({
        serie: config.serie,
        data: todayStr(),
        dataVencimento: todayStr(),
        clienteNome: ncModal.clienteNome,
        clienteNif: ncModal.clienteNif,
        clienteEndereco: ncModal.clienteEndereco,
        clienteTelefone: ncModal.clienteTelefone,
        clienteEmail: ncModal.clienteEmail,
        pacienteId: ncModal.pacienteId,
        linhas: linhasCredito,
        subtotalSemIva: sub,
        totalIva: iva,
        ivaTaxa: ncModal.ivaTaxa,
        total: novoTotal,
        desconto: 0,
        estado: "emitida",
        observacoes: `Nota de Crédito ref. ${ncModal.numero}. Motivo: ${ncMotivo.trim()}`,
        tipoDocumento: "nota-credito",
        documentoOrigem: ncModal.numero,
        motivoAnulacaoOuCredito: ncMotivo.trim(),
        emitidoPor: "Operador de Facturação",
      });
      if (!saved)
        throw new Error("A Nota de Crédito não foi confirmada pelo sistema.");
      logFaturacaoAction(
        saved,
        "nota-credito",
        "Nota de Crédito emitida",
        `Referência: ${ncModal.numero}`,
      );
      logFaturacaoAction(
        ncModal,
        "nota-credito",
        "Documento retificado",
        `Nota de Crédito: ${saved.numero}`,
      );
      setNcModal(null);
      setNcMotivo("");
      setNcQuantidades({});
      alert(`Nota de Crédito ${saved.numero} emitida com sucesso.`);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Não foi possível emitir a Nota de Crédito.",
      );
    } finally {
      fiscalOperationLockRef.current = false;
    }
  }, [
    ncModal,
    ncMotivo,
    ncQuantidades,
    faturas,
    config,
    addFatura,
    logFaturacaoAction,
  ]);

  const handleCreateCustomer = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!novoCliNome.trim()) return;
      const details = {
        nome: novoCliNome.trim(),
        nif: novoCliNif.trim() || undefined,
        telefone: novoCliTel.trim() || undefined,
        endereco: novoCliEnd.trim() || undefined,
      };
      const novo =
        editingClient && pacienteId
          ? (await updatePaciente(pacienteId, details),
            { ...details, id: pacienteId })
          : await addPaciente(details);
      setEditingClient(false);
      setClienteNome(novo.nome);
      setClienteNif(novo.nif || "");
      setClienteEndereco(novo.endereco || "");
      setClienteTelefone(novo.telefone || "");
      setPacienteId(novo.id);
      setShowNovoClienteModal(false);
      setNovoCliNome("");
      setNovoCliNif("");
      setNovoCliTel("");
      setNovoCliEnd("");
    },
    [
      novoCliNome,
      novoCliNif,
      novoCliTel,
      novoCliEnd,
      addPaciente,
      updatePaciente,
      editingClient,
      pacienteId,
    ],
  );

  const filteredInvoices = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return faturas.filter((f) => {
      const matchesSearch =
        f.numero.toLowerCase().includes(q) ||
        f.clienteNome.toLowerCase().includes(q) ||
        (f.clienteNif && f.clienteNif.includes(searchTerm)) ||
        (f.observacoes || "").toLowerCase().includes(q);
      const matchesState = filterState === "todos" || f.estado === filterState;
      const matchesType =
        filterType === "todos" || f.tipoDocumento === filterType;
      return matchesSearch && matchesState && matchesType;
    });
  }, [faturas, searchTerm, filterState, filterType]);
  const invoiceListing = useMemo(
    () => paginateInvoices(filteredInvoices, invoicePage),
    [filteredInvoices, invoicePage],
  );
  const creditedInvoices = useMemo(() => creditedDocumentNumbers(faturas), [faturas]);

  const stats = useMemo(() => {
    const summary = { totalDocs: faturas.length, totalEmitidas: 0, totalPagas: 0, valorPendente: 0 };
    for (const f of faturas) {
      if (f.estado === "emitida" && !f.agtReplacementNo) {
        summary.totalEmitidas++;
        summary.valorPendente += f.total;
      }
      if (f.estado === "paga") summary.totalPagas++;
    }
    return summary;
  }, [faturas]);

  const currentDocMeta = getDocumentMeta(tipoDocumento);
  const groupedDocTypes = useMemo(() => {
    const g: Record<string, typeof TIPO_DOC_OPTS> = {};
    TIPO_DOC_OPTS.forEach((t) => {
      (g[t.group] = g[t.group] || []).push(t);
    });
    return g;
  }, []);

  const handleWhatsAppDocumento = useCallback(
    (doc: Fatura) => {
      const raw = String(doc.clienteTelefone || "").trim();
      const digits = raw.replace(/\D/g, "");
      let phone = digits;
      if (/^9\d{8}$/.test(digits)) phone = `244${digits}`;
      else if (/^2449\d{8}$/.test(digits)) phone = digits;
      else if (digits.length < 10 || digits.length > 15) {
        alert(
          "O cliente não tem um número de WhatsApp válido. Use, por exemplo, 923123456 ou +244 923 123 456.",
        );
        return;
      }

      const meta = getDocumentMeta(doc.tipoDocumento);
      const total = formatCurrency(doc.total, config.moeda);
      const mensagem =
        doc.tipoDocumento === "pro-forma"
          ? `Olá ${doc.clienteNome || "cliente"}, segue a sua Factura Pró-Forma ${doc.numero}, no valor de ${total}.`
          : `Olá ${doc.clienteNome || "cliente"}, segue a sua ${meta.label} ${doc.numero}, no valor de ${total}.`;

      // O navegador não consegue anexar automaticamente o PDF ao WhatsApp Web.
      // Abrimos a conversa com a mensagem pronta; o botão PDF continua disponível para o anexo.
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
      appendFaturacaoAction(
        doc.numero,
        "whatsapp",
        "WhatsApp preparado",
        "Conversa aberta com mensagem pré-preenchida",
      );
      setActionHistoryTick((v) => v + 1);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) window.location.href = url;
    },
    [config.moeda],
  );

  const documentDialogs = (
    <>
      {confirmingIssue && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-[480px] bg-white rounded shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                Confirmar Emissão
              </h2>
              <button
                type="button"
                onClick={() => setConfirmingIssue(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 text-center">
              <div
                className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: currentDocMeta.color }}
              >
                {currentDocMeta.code}
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Emitir <b>{currentDocMeta.label}</b> no valor de
              </p>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {formatCurrency(totals.total, config.moeda)}
              </div>
              <div className="text-xs text-gray-500 mb-4">
                {linhas.length} {linhas.length === 1 ? "item" : "itens"} ·{" "}
                {clienteNome}
              </div>
              {modoFormacao && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3 text-left">
                  <GraduationCap className="w-4 h-4 inline mr-1 align-[-2px]" />
                  Atenção: Modo de Formação encontra-se ativo. Documento sem
                  validade fiscal.
                </div>
              )}
              {tipoDocumento === "pro-forma" && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3 text-left">
                  A Pró-Forma é um documento informativo, não tem validade
                  fiscal e não entra no SAF-T oficial.
                </div>
              )}
              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => handleSaveDocumento(undefined, true)}
                  className="flex-1 py-2.5 rounded text-white text-sm font-bold"
                  style={{ background: currentDocMeta.color }}
                >
                  <Check className="w-4 h-4 inline mr-1 align-[-2px]" /> Emitir
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingIssue(false)}
                  className="flex-1 py-2.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {issuedDocument && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-[480px] bg-white rounded shadow-2xl">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <BadgeCheck className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Documento Emitido!
              </h2>
              <p className="text-sm text-gray-600 mb-3">
                {getDocumentMeta(issuedDocument.tipoDocumento).label}{" "}
                <span className="font-mono font-bold">
                  {issuedDocument.numero}
                </span>
              </p>
              <div className="text-2xl font-bold text-gray-900 mb-5">
                {formatCurrency(issuedDocument.total, config.moeda)}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    downloadFatura(
                      generateFaturaHTML(issuedDocument, config, {
                        termica: true,
                      }),
                      `${issuedDocument.numero}_termica`,
                    )
                  }
                  className="flex flex-col items-center gap-1 p-3 rounded hover:bg-gray-50"
                >
                  <Printer className="w-5 h-5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700">
                    Imprimir
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadFatura(
                      generateFaturaHTML(issuedDocument, config, {
                        termica: false,
                      }),
                      issuedDocument.numero,
                    )
                  }
                  className="flex flex-col items-center gap-1 p-3 rounded hover:bg-gray-50"
                >
                  <FileDown className="w-5 h-5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700">
                    PDF
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const s = encodeURIComponent(
                      `${issuedDocument.numero} - ${getDocumentMeta(issuedDocument.tipoDocumento).label}`,
                    );
                    window.location.href = `mailto:${issuedDocument.clienteEmail || ""}?subject=${s}`;
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded hover:bg-gray-50"
                >
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700">
                    E-mail
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleWhatsAppDocumento(issuedDocument)}
                  className="flex flex-col items-center gap-1 p-3 rounded hover:bg-green-50"
                >
                  <MessageCircle className="w-5 h-5 text-slate-600" />
                  <span className="text-xs font-semibold text-gray-700">
                    WhatsApp
                  </span>
                </button>
              </div>
              <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800">
                    Histórico de acções
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {readFaturacaoActions(issuedDocument.numero).length}{" "}
                    registos
                  </span>
                </div>
                {readFaturacaoActions(issuedDocument.numero).length === 0 ? (
                  <div className="text-[11px] text-gray-500">
                    Ainda não existem acções registadas neste dispositivo.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {readFaturacaoActions(issuedDocument.numero)
                      .slice()
                      .reverse()
                      .map((item) => (
                        <div key={item.id} className="flex gap-2 items-start">
                          <BadgeCheck className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-gray-800">
                              {item.label}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {new Date(item.at).toLocaleString("pt-PT")}{" "}
                              {item.detail ? `· ${item.detail}` : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIssuedDocument(null);
                  handleNovoDocumento("factura");
                }}
                className="mt-4 text-sm font-bold text-[#1577EB] hover:underline"
              >
                Criar Novo Documento →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  /* =================================================================
     FORM VIEW — IDENTIDADE PRÓPRIA NV DIGITAL
     ================================================================= */
  if (viewMode === "form") {
    const qtdNum = Math.max(1, parseInt(itemQtd) || 1);
    const hasClientDetail =
      (clienteNif || clienteEndereco) && clienteNome !== "Consumidor Final";

    return (
      <div className="nvf-root">
        <style>{FATURACAO_REFERENCE_CSS}</style>

        {/* ===== nvf-breadcrumb-nav : breadcrumbs ===== */}
        <div className="nvf-breadcrumb-nav">
          <div className="nvf-container-fluid">
            <div className="nvf-row">
              <div
                className="nvf-col-8"
                style={{ flex: "0 0 50%", maxWidth: "50%" }}
              >
                <nav id="breadcrumbs">
                  <ol className="nvf-breadcrumb">
                    <li>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          resetForm();
                          setViewMode("lista");
                        }}
                        title="Documentos"
                      >
                        Documentos
                      </a>
                    </li>
                    <li className="active">Novo Documento</li>
                  </ol>
                </nav>
              </div>
            </div>
          </div>
        </div>

        {/* ===== header-mobile-title ===== */}
        <div className="nvf-mobile-title">
          <h1>Novo Documento</h1>
        </div>

        <div className="nvf-container-fluid" style={{ paddingBottom: 40 }}>
          <div className="nvf-row">
            {/* ================= COL 8 : FORM ================= */}
            <div className="nvf-col-8">
              <form id="document-form" onSubmit={(e) => e.preventDefault()}>
                {issueBlockedForMissingIssuerNif && (
                  <div
                    style={{
                      background: "#fff8e6",
                      border: "1px solid #ffe1a1",
                      borderRadius: 4,
                      padding: "12px 16px",
                      marginBottom: 16,
                      fontSize: 12,
                      color: "#8a5a00",
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Configure um NIF do emitente válido nas Definições para
                      emitir documentos oficiais. Pode guardar rascunhos e
                      Pró-Forma sem NIF.
                    </span>
                  </div>
                )}

                {/* ===== box-flex-header : tipo de documento ===== */}
                <div id="box-flex-header" className="nvf-box-flex">
                  <div className="nvf-header">
                    <div className="nvf-header-flex-title">
                      <div
                        id="doc-header-type"
                        className="nvf-doc-header"
                        onClick={() => setShowListTypes((v) => !v)}
                      >
                        <div
                          className="nvf-doc-type-circle"
                          style={{ background: currentDocMeta.color }}
                        >
                          {currentDocMeta.code}
                        </div>
                        <div id="doc-type-title" className="nvf-title-bold">
                          {currentDocMeta.label}
                        </div>
                      </div>
                    </div>
                    <div className="nvf-doc-header-right">
                      <button
                        type="button"
                        id="office-change-doctype"
                        className="nvf-link-blue"
                        onClick={() => setShowListTypes((v) => !v)}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Alterar
                      </button>
                    </div>
                  </div>

                  {/* ===== list-types ===== */}
                  {showListTypes && (
                    <div id="list-types" className="nvf-list-types">
                      {Object.entries(groupedDocTypes).map(([group, types]) => (
                        <React.Fragment key={group}>
                          <div className="nvf-doc-header-group-item">
                            {group}
                          </div>
                          <ul className="nvf-doc-header-list">
                            {types.map((t) => (
                              <li
                                key={t.value}
                                className="nvf-doc-type-list"
                                style={{
                                  borderLeftColor: t.color,
                                  background:
                                    tipoDocumento === t.value
                                      ? "#f0f7ff"
                                      : undefined,
                                }}
                              >
                                <input
                                  type="radio"
                                  id={`type_${t.code}`}
                                  name="register"
                                  checked={tipoDocumento === t.value}
                                  onChange={() => {
                                    setTipoDocumento(t.value);
                                    setEstado(t.defaultState);
                                    setShowListTypes(false);
                                  }}
                                />
                                <label
                                  htmlFor={`type_${t.code}`}
                                  style={{
                                    cursor: "pointer",
                                    margin: 0,
                                    fontWeight:
                                      tipoDocumento === t.value ? 700 : 400,
                                  }}
                                >
                                  {t.label}
                                </label>
                                {t.note && (
                                  <small style={{ fontWeight: 400 }}>
                                    {t.note}
                                  </small>
                                )}
                              </li>
                            ))}
                          </ul>
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* ===== document-client-container ===== */}
                  <div
                    className="nvf-content"
                    id="document-client-container"
                    style={{ padding: 20 }}
                  >
                    <div id="document-client">
                      <div
                        className="nvf-form-group"
                        style={{ marginBottom: hasClientDetail ? 0 : 0 }}
                      >
                        <label htmlFor="client-target">
                          Selecione o Cliente{" "}
                          <span
                            className="nvf-help-icon"
                            title="Selecione o Cliente"
                          >
                            ?
                          </span>
                        </label>
                        <div className="nvf-autocomplete-wrap">
                          <input
                            id="client-target"
                            ref={clientInputRef}
                            type="text"
                            className="nvf-form-control"
                            placeholder="Consumidor Final"
                            name="client_name"
                            value={clienteNome}
                            onChange={(e) => {
                              setPacienteId(undefined);
                              setClienteNif("");
                              setClienteEndereco("");
                              setClienteTelefone("");
                              setClienteEmail("");
                              setInsurance(null);
                              setClienteNome(e.target.value);
                              setClientSearchOpen(true);
                            }}
                            onFocus={(e) => {
                              e.target.select();
                              setClientSearchOpen(true);
                              void refresh().catch(() => {});
                            }}
                            onBlur={() =>
                              setTimeout(() => setClientSearchOpen(false), 180)
                            }
                            autoComplete="off"
                          />
                          {clientSearchOpen && (
                            <div
                              className="nvf-suggestions"
                              role="listbox"
                              aria-label="Clientes desta empresa"
                            >
                              <button
                                type="button"
                                className="nvf-suggestion"
                                style={{ width: "100%", textAlign: "left" }}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setPacienteId(undefined);
                                  setClienteNome("Consumidor Final");
                                  setClienteNif("");
                                  setClienteEndereco("");
                                  setClienteTelefone("");
                                  setClienteEmail("");
                                  setInsurance(null);
                                  setClientSearchOpen(false);
                                }}
                              >
                                Consumidor Final
                              </button>
                              {clientSuggestions.map((c) => (
                                <div
                                  key={c.id}
                                  role="option"
                                  aria-selected={pacienteId === c.id}
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      setPacienteId(c.id);
                                      setClienteNome(c.nome);
                                      setClienteNif(c.nif || "");
                                      setClienteEndereco(c.endereco || "");
                                      setClienteTelefone(c.telefone || "");
                                      setClienteEmail(c.email || "");
                                      setClientSearchOpen(false);
                                    }
                                  }}
                                  className="nvf-suggestion"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setPacienteId(c.id);
                                    setClienteNome(c.nome);
                                    setClienteNif(c.nif || "");
                                    setClienteEndereco(c.endereco || "");
                                    setClienteTelefone(c.telefone || "");
                                    setClienteEmail(c.email || "");
                                    setClientSearchOpen(false);
                                  }}
                                >
                                  <div>
                                    <div className="nm">{c.nome}</div>
                                    {c.telefone && (
                                      <div className="sub">{c.telefone}</div>
                                    )}
                                  </div>
                                  {c.nif && (
                                    <div
                                      className="sub"
                                      style={{
                                        margin: 0,
                                        fontFamily: "monospace",
                                      }}
                                    >
                                      {c.nif}
                                    </div>
                                  )}
                                </div>
                              ))}
                              <div
                                className="nvf-suggestion"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setClientSearchOpen(false);
                                  setEditingClient(false);
                                  setNovoCliNome("");
                                  setNovoCliNif("");
                                  setNovoCliTel("");
                                  setNovoCliEnd("");
                                  setShowNovoClienteModal(true);
                                }}
                                style={{
                                  background: "#fafbfc",
                                  color: "#1577EB",
                                  fontWeight: 700,
                                }}
                              >
                                <span
                                  className="nm"
                                  style={{ color: "#1577EB" }}
                                >
                                  <UserRoundPlus className="w-3.5 h-3.5 inline mr-1 align-[-2px]" />{" "}
                                  Criar novo cliente
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ===== doc-client-detail ===== */}
                      {hasClientDetail && (
                        <div id="doc-client-detail">
                          {clienteNif && (
                            <>
                              <label>NIF</label>
                              <br />
                              <span style={{ fontFamily: "monospace" }}>
                                {clienteNif}
                              </span>
                              <br />
                              <br />
                            </>
                          )}
                          {clienteEndereco && (
                            <>
                              <label>Morada</label>
                              <br />
                              {clienteEndereco}
                              <br />
                              <br />
                            </>
                          )}
                          <div className="nvf-client-actions">
                            <button
                              type="button"
                              id="btn-office-edit-client"
                              className="nvf-link-blue"
                              onClick={() => {
                                setEditingClient(!!pacienteId);
                                setNovoCliNome(
                                  clienteNome === "Consumidor Final"
                                    ? ""
                                    : clienteNome,
                                );
                                setNovoCliNif(clienteNif);
                                setNovoCliTel(clienteTelefone);
                                setNovoCliEnd(clienteEndereco);
                                setShowNovoClienteModal(true);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" /> Alterar Dados
                            </button>
                            <button
                              type="button"
                              id="btn-office-remove-client"
                              className="nvf-link-blue"
                              onClick={() => {
                                setPacienteId(undefined);
                                setClienteNome("Consumidor Final");
                                setClienteNif("");
                                setClienteEndereco("");
                                setClienteTelefone("");
                                setClienteEmail("");
                              }}
                            >
                              <UserRoundPlus className="w-3.5 h-3.5" />{" "}
                              Consumidor Final
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <InsuranceBilling
                  patientId={String(pacienteId || "")}
                  lines={linhas}
                  selection={insurance}
                  onChange={(next) => {
                    if (next && !insurance) {
                      setTipoDocumento("factura");
                      setEstado("emitida");
                      setPaymentsSelected({});
                      setPaymentAmounts({});
                    }
                    setInsurance(next);
                    setInsuranceReady(false);
                  }}
                  onPrices={setLinhas}
                  onReady={setInsuranceReady}
                  rate={ivaTaxa}
                  discount={inputNumber(descontoPercent)}
                  fixedDiscount={
                    inputNumber(descontoPercent) > 0
                      ? 0
                      : inputNumber(descontoValorStr)
                  }
                  date={dataEmissao}
                  professional={currentUser.nome || currentUser.username}
                />

                <br />

                {/* ===== box-flex-products : Itens ===== */}
                <div id="box-flex-products" className="nvf-box-flex">
                  <div className="nvf-header" style={{ padding: "14px 20px" }}>
                    <div className="nvf-header-flex-title">
                      <div className="nvf-title-bold">
                        Itens{" "}
                        <span className="nvf-slogan">Produtos e Serviços</span>
                      </div>
                    </div>
                    <div
                      className="nvf-doc-header-right"
                      style={{ display: "flex", gap: 14 }}
                    >
                      <button
                        type="button"
                        className="nvf-link-blue"
                        onClick={() => {
                          setShowCatalogModal(false);
                          setShowKitsModal(true);
                        }}
                      >
                        <Boxes className="w-4 h-4" /> Kits
                      </button>
                      <button
                        type="button"
                        id="office-add-products"
                        className="nvf-link-blue"
                        onClick={() => setShowCatalogModal(true)}
                      >
                        <Menu className="w-4 h-4" /> Itens
                      </button>
                      {onOpenScanner && (
                        <button
                          type="button"
                          className="nvf-link-blue"
                          onClick={() =>
                            onOpenScanner((p) => addItemToLinhas(p, 1))
                          }
                        >
                          <QrCode className="w-4 h-4" /> Scanner
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="nvf-content no-padding pb-5">
                    {/* has-no-products */}
                    {linhas.length === 0 ? (
                      <div id="has-no-products" className="nvf-no-products">
                        <List className="nvf-big-icon w-12 h-12" />
                        Não existem itens associados ao documento.
                        <br />
                        <button
                          type="button"
                          id="btn-office-add-product"
                          className="nvf-btn mt-3"
                          onClick={() => setShowCatalogModal(true)}
                        >
                          <Plus className="w-4 h-4" /> Adicionar Novo Item
                        </button>
                      </div>
                    ) : (
                      <table
                        className="nvf-table-flex nvf-products-entry-table"
                        id="document-products"
                      >
                        <thead>
                          <tr>
                            <th style={{ width: "40" }}></th>
                            <th style={{ width: "40" }}></th>
                            <th className="text-left" style={{ width: "50%" }}>
                              Produto
                            </th>
                            <th className="text-right" style={{ width: "10%" }}>
                              Desc.
                            </th>
                            <th className="text-right" style={{ width: "10%" }}>
                              IVA
                            </th>
                            <th className="text-right" style={{ width: "10%" }}>
                              P.Unit.
                            </th>
                            <th className="text-right" style={{ width: "10%" }}>
                              Qtd.
                            </th>
                            <th className="text-right" style={{ width: "10%" }}>
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhas.map((linha, idx) => {
                            const lineTotal =
                              linha.quantidade * linha.precoUnitario;
                            return (
                              <tr
                                key={linha.id || idx}
                                id={`document-product-${idx}`}
                                className="doc-product-line"
                              >
                                <td
                                  className="text-center nvf-doc-product-remove"
                                  onClick={() => handleRemoveLine(idx)}
                                  title="Remover"
                                >
                                  <button
                                    type="button"
                                    aria-label={`Remover item ${idx + 1}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveLine(idx);
                                    }}
                                    className="nvf-icon-button"
                                  >
                                    <X className="w-4 h-4 inline" />
                                  </button>
                                </td>
                                <td
                                  className="text-center nvf-doc-product-edit"
                                  title="Editar"
                                >
                                  <button
                                    type="button"
                                    aria-label={`Editar item ${idx + 1}`}
                                    onClick={(e) =>
                                      e.currentTarget
                                        .closest("tr")
                                        ?.querySelector<HTMLInputElement>(
                                          ".nvf-cell-input",
                                        )
                                        ?.focus()
                                    }
                                    className="nvf-icon-button"
                                  >
                                    <Pencil className="w-3.5 h-3.5 inline" />
                                  </button>
                                </td>
                                <td className="nvf-cell-desc">
                                  <input
                                    className="nvf-cell-input"
                                    value={linha.descricao}
                                    onChange={(e) =>
                                      handleUpdateLine(
                                        idx,
                                        "descricao",
                                        e.target.value,
                                      )
                                    }
                                  />
                                  {linha.codigo && (
                                    <>
                                      <br />
                                      <span className="nvf-doc-product-line-reference">
                                        {linha.codigo}
                                      </span>
                                    </>
                                  )}
                                  {linha.lote && (
                                    <>
                                      <br />
                                      <span className="nvf-doc-product-line-reference">
                                        Lote: {linha.lote}
                                        {linha.dataValidade
                                          ? ` · Val: ${linha.dataValidade}`
                                          : ""}
                                      </span>
                                    </>
                                  )}
                                </td>
                                <td
                                  className="text-right"
                                  style={{ color: "#9aa1ac", fontSize: 12 }}
                                >
                                  —
                                </td>
                                <td className="text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateLine(
                                        idx,
                                        "ivaIsento",
                                        !linha.ivaIsento,
                                      )
                                    }
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      fontSize: 12,
                                      color: linha.ivaIsento
                                        ? "#8a919c"
                                        : "#333",
                                      fontFamily: "inherit",
                                    }}
                                    title="Alternar isenção de IVA"
                                  >
                                    {linha.ivaIsento ? "Isento" : `${ivaTaxa}%`}
                                  </button>
                                </td>
                                <td className="text-right">
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    className="nvf-cell-input"
                                    value={linha.precoUnitario}
                                    onChange={(e) =>
                                      handleUpdateLine(
                                        idx,
                                        "precoUnitario",
                                        parseFloat(e.target.value) || 0,
                                      )
                                    }
                                  />
                                </td>
                                <td className="text-right">
                                  <input
                                    type="number"
                                    min={0.000001}
                                    step={0.000001}
                                    aria-label={`Quantidade do item ${idx + 1}`}
                                    className="nvf-cell-input"
                                    value={linha.quantidade}
                                    onChange={(e) =>
                                      handleUpdateLine(
                                        idx,
                                        "quantidade",
                                        Math.max(
                                          0,
                                          parseFloat(e.target.value) || 0,
                                        ),
                                      )
                                    }
                                  />
                                </td>
                                <td
                                  className="text-right"
                                  style={{
                                    fontWeight: 700,
                                    color: "#2f3640",
                                    paddingRight: 16,
                                  }}
                                >
                                  {formatCurrency(lineTotal, config.moeda)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          {totals.descontoValor > 0 && (
                            <tr>
                              <td colSpan={4} style={{ border: "none" }}></td>
                              <td colSpan={2}>Desc.</td>
                              <td colSpan={2} className="text-right">
                                {formatCurrency(
                                  totals.descontoValor,
                                  config.moeda,
                                )}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td colSpan={4} style={{ border: "none" }}></td>
                            <th colSpan={2} className="total">
                              Total
                            </th>
                            <th colSpan={2} className="text-right total">
                              {formatCurrency(
                                totals.subtotalSemIva,
                                config.moeda,
                              )}
                            </th>
                          </tr>
                          {retencaoIPU && (
                            <tr>
                              <td colSpan={4} style={{ border: "none" }}></td>
                              <th colSpan={2}>Retenção 15%</th>
                              <th colSpan={2} className="text-right">
                                -{formatCurrency(totals.retencao, config.moeda)}
                              </th>
                            </tr>
                          )}
                          <tr id="document-total-pay">
                            <td colSpan={4} style={{ border: "none" }}></td>
                            <th colSpan={2} className="total">
                              Total c/IVA
                            </th>
                            <th colSpan={2} className="text-right total">
                              {formatCurrency(totals.total, config.moeda)}
                            </th>
                          </tr>
                        </tfoot>
                      </table>
                    )}

                    {/* Ver Impostos */}
                    {linhas.length > 0 && (
                      <div
                        className="nvf-row"
                        style={{
                          padding: "10px 20px 0",
                          justifyContent: "flex-end",
                        }}
                      >
                        <div className="text-right">
                          <button
                            type="button"
                            id="document-taxes-link"
                            className="nvf-see-more"
                            onClick={() => setShowTaxes((v) => !v)}
                          >
                            Ver Impostos{" "}
                            <ChevronDown
                              className="w-3 h-3"
                              style={{
                                transform: showTaxes
                                  ? "rotate(180deg)"
                                  : undefined,
                                transition: "transform .15s",
                              }}
                            />
                          </button>
                          {showTaxes && (
                            <div id="doc-taxes-table">
                              <table
                                id="document-taxes"
                                className="nvf-taxes-table"
                              >
                                <thead>
                                  <tr>
                                    <td className="text-left">Taxa</td>
                                    <td className="text-right">Base</td>
                                    <td className="text-right">IVA</td>
                                    <td className="text-right">Total</td>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="text-left">{ivaTaxa}%</td>
                                    <td className="text-right">
                                      {formatCurrency(
                                        totals.subtotalSemIva,
                                        config.moeda,
                                      )}
                                    </td>
                                    <td className="text-right">
                                      {formatCurrency(
                                        totals.totalIva,
                                        config.moeda,
                                      )}
                                    </td>
                                    <td className="text-right">
                                      {formatCurrency(
                                        totals.total,
                                        config.moeda,
                                      )}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ===== product-autocomplete-add ===== */}
                  <div id="product-autocomplete-add">
                    <div id="product-autocomplete-add-content">
                      <button
                        type="button"
                        className="nvf-qty-icon"
                        title="Diminuir"
                        onClick={() =>
                          setItemQtd(String(Math.max(1, qtdNum - 1)))
                        }
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          style={{ width: "26" }}
                          height="26"
                          viewBox="0 0 24 24"
                          fill="#28a745"
                        >
                          <rect
                            style={{ width: "24" }}
                            height="24"
                            opacity="0"
                          ></rect>
                          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path>
                          <path d="M15 11H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2z"></path>
                        </svg>
                      </button>
                      <input
                        id="product-autocomplete-add-qty"
                        className="nvf-form-control text-center"
                        value={itemQtd}
                        onChange={(e) =>
                          setItemQtd(
                            e.target.value.replace(/[^0-9]/g, "") || "1",
                          )
                        }
                      />
                      <button
                        type="button"
                        className="nvf-qty-icon"
                        title="Aumentar"
                        onClick={() => setItemQtd(String(qtdNum + 1))}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          style={{ width: "26" }}
                          height="26"
                          viewBox="0 0 24 24"
                          fill="#28a745"
                        >
                          <rect
                            style={{ width: "24" }}
                            height="24"
                            opacity="0"
                          ></rect>
                          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path>
                          <path d="M15 11h-2V9a1 1 0 0 0-2 0v2H9a1 1 0 0 0 0 2h2v2a1 1 0 0 0 2 0v-2h2a1 1 0 0 0 0-2z"></path>
                        </svg>
                      </button>
                      <input
                        id="product-autocomplete-add-search"
                        ref={searchInputRef}
                        type="text"
                        value={itemSearch}
                        placeholder="Pesquisar e adicionar ao documento"
                        autoComplete="off"
                        onChange={(e) => {
                          setItemSearch(e.target.value);
                          setShowItemDropdown(true);
                        }}
                        onFocus={() => setShowItemDropdown(true)}
                        onBlur={() =>
                          setTimeout(() => setShowItemDropdown(false), 180)
                        }
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            filteredProductsDropdown.length > 0
                          ) {
                            e.preventDefault();
                            addItemToLinhas(
                              filteredProductsDropdown[0],
                              qtdNum,
                            );
                          }
                        }}
                      />

                      {/* autocomplete-suggestions */}
                      {showItemDropdown &&
                        (matchingKitsDropdown.length > 0 ||
                          filteredProductsDropdown.length > 0) && (
                          <div className="nvf-product-dropdown">
                            {matchingKitsDropdown.length > 0 && (
                              <div
                                style={{
                                  borderBottom: "1px solid #eef0f3",
                                  background: "#faf5ff",
                                }}
                              >
                                <div
                                  style={{
                                    padding: "8px 14px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: "#7c3aed",
                                    textTransform: "uppercase",
                                    borderBottom: "1px solid #ede9fe",
                                  }}
                                >
                                  Kits / Procedimentos
                                </div>
                                {matchingKitsDropdown.map((kit) => (
                                  <div
                                    key={kit.id}
                                    className="nvf-suggestion"
                                    style={{ display: "block" }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 8,
                                      }}
                                    >
                                      <div style={{ minWidth: 0 }}>
                                        <div className="nm">
                                          {kit.codigo} · {kit.nome}
                                        </div>
                                        <div className="sub">
                                          {kit.itens.length} itens ·{" "}
                                          {formatCurrency(
                                            kit.precoVendaKit,
                                            config.moeda,
                                          )}
                                        </div>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 6,
                                          flexShrink: 0,
                                        }}
                                      >
                                        <button
                                          type="button"
                                          className="nvf-btn"
                                          style={{
                                            padding: "5px 10px",
                                            fontSize: 11,
                                          }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleInsertKit(kit, "detalhado");
                                          }}
                                        >
                                          Detalhado
                                        </button>
                                        <button
                                          type="button"
                                          className="nvf-btn"
                                          style={{
                                            padding: "5px 10px",
                                            fontSize: 11,
                                            background: "#7c3aed",
                                            color: "#fff",
                                            borderColor: "#7c3aed",
                                          }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleInsertKit(kit, "linha_unica");
                                          }}
                                        >
                                          Linha Única
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {filteredProductsDropdown.map((p) => (
                              <div
                                key={p.id}
                                className="nvf-suggestion"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  addItemToLinhas(p, qtdNum);
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div className="nm">{p.nome}</div>
                                  <div className="sub">
                                    {p.codigo} · Stock: {p.stock}{" "}
                                    {p.unidadeMedida} · EAN:{" "}
                                    {p.codigoBarras || "—"}
                                  </div>
                                </div>
                                <div
                                  style={{ textAlign: "right", flexShrink: 0 }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      color: "#1577EB",
                                      fontSize: 13,
                                    }}
                                  >
                                    {formatCurrency(p.preco, config.moeda)}
                                  </div>
                                  <div className="sub">
                                    {p.ivaIsento ? "Isento" : `${ivaTaxa}% IVA`}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>

                    <div className="nvf-fast-add-wrap">
                      <button
                        type="button"
                        id="product-autocomplete-fast-add"
                        className="nvf-link-blue"
                        onClick={() => setShowNewItem(true)}
                      >
                        <Plus className="w-4 h-4" /> Criar Novo Item
                      </button>
                    </div>
                  </div>
                </div>

                <br />

                {/* ===== movement-of-goods (Transporte) ===== */}
                {transporte && (
                  <div className="movement-of-goods">
                    <div
                      id="box-flex-movement-of-goods"
                      className="nvf-box-flex"
                    >
                      <div
                        className="nvf-header no-padding-bottom"
                        style={{ display: "block", padding: "14px 20px 0" }}
                      >
                        <div
                          className="nvf-title-bold"
                          style={{ marginBottom: 10 }}
                        >
                          Transporte
                        </div>
                        <ul
                          style={{
                            listStyle: "none",
                            display: "flex",
                            gap: 20,
                            margin: 0,
                            padding: 0,
                            borderBottom: "1px solid #eef0f3",
                          }}
                        >
                          <li>
                            <a
                              href="#"
                              className="nvf-link-blue"
                              style={{
                                padding: "8px 0",
                                display: "inline-block",
                                borderBottom: "2px solid #1577EB",
                                borderRadius: 0,
                              }}
                              onClick={(e) => e.preventDefault()}
                            >
                              Local de Origem
                            </a>
                          </li>
                          <li>
                            <a
                              href="#"
                              className="nvf-link-blue"
                              style={{
                                padding: "8px 0",
                                display: "inline-block",
                                color: "#8a919c",
                              }}
                              onClick={(e) => e.preventDefault()}
                            >
                              Local de Destino
                            </a>
                          </li>
                        </ul>
                      </div>
                      <div className="nvf-content" style={{ padding: 20 }}>
                        <div id="show-loadpoint">
                          <div className="nvf-form-group">
                            <label>
                              Local de Carga{" "}
                              <span
                                className="nvf-help-icon"
                                title="Indique um endereço ou selecione a sede fiscal ou uma loja"
                              >
                                ?
                              </span>
                            </label>
                            <select
                              className="nvf-form-control"
                              value={localCarga}
                              onChange={(e) => setLocalCarga(e.target.value)}
                            >
                              <option value="">Selecionar Endereço</option>
                              <option value="0">Sede Fiscal</option>
                              <optgroup label="Lojas">
                                <option value="store">
                                  {config.configuracaoFiscal?.terminalCaixa ||
                                    "Loja principal"}
                                </option>
                              </optgroup>
                            </select>
                          </div>
                          <div className="nvf-form-group">
                            <label>
                              Morada{" "}
                              <span
                                className="nvf-help-icon"
                                title="Morada do Local de Carga"
                              >
                                ?
                              </span>
                            </label>
                            <input
                              className="nvf-form-control"
                              type="text"
                              placeholder="Morada do Local de Carga. Ficará disponível no documento emitido."
                              value={moradaCarga}
                              onChange={(e) => setMoradaCarga(e.target.value)}
                            />
                          </div>
                          <div className="nvf-form-group">
                            <label>
                              Data e Hora{" "}
                              <span
                                className="nvf-help-icon"
                                title="Data e Hora do Início do Transporte"
                              >
                                ?
                              </span>
                            </label>
                            <div className="nvf-row-inner">
                              <div style={{ flex: "0 0 240px" }}>
                                <input
                                  className="nvf-form-control"
                                  type="datetime-local"
                                  value={dataHoraCarga}
                                  onChange={(e) =>
                                    setDataHoraCarga(e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                          <div className="nvf-form-group">
                            <label>
                              Matrícula{" "}
                              <span
                                className="nvf-help-icon"
                                title="Matrícula do Veículo"
                              >
                                ?
                              </span>
                            </label>
                            <div className="nvf-row-inner">
                              <div style={{ flex: "0 0 180px" }}>
                                <input
                                  className="nvf-form-control"
                                  type="text"
                                  placeholder="00-AA-00 (Opcional)"
                                  value={matriculaVeiculo}
                                  onChange={(e) =>
                                    setMatriculaVeiculo(
                                      e.target.value.toUpperCase(),
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>
                          <hr
                            style={{
                              border: "none",
                              borderTop: "1px solid #eef0f3",
                              margin: "14px 0",
                            }}
                          />
                          <div className="nvf-row-inner">
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 13,
                                fontWeight: 400,
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={incluirPrecosTransporte}
                                onChange={(e) =>
                                  setIncluirPrecosTransporte(e.target.checked)
                                }
                                style={{ accentColor: "#1577EB" }}
                              />{" "}
                              Incluir preços
                            </label>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 13,
                                fontWeight: 400,
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={movimentarStock}
                                onChange={(e) =>
                                  setMovimentarStock(e.target.checked)
                                }
                                style={{ accentColor: "#1577EB" }}
                              />{" "}
                              Saída de stock
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    <br />
                  </div>
                )}

                {/* ===== Observações ===== */}
                <div className="nvf-box-flex">
                  <div className="nvf-header">
                    <div className="nvf-header-flex-title">
                      <div className="nvf-title-bold">
                        Observações{" "}
                        <span className="nvf-slogan">Referência Externa</span>
                      </div>
                    </div>
                  </div>
                  <div className="nvf-content" style={{ padding: 20 }}>
                    <div className="nvf-form-group">
                      <label htmlFor="doc-obs">
                        <span id="doc-obs-label">Observações</span>{" "}
                        <span
                          className="nvf-help-icon"
                          title="Observações a incluir no Documento"
                        >
                          ?
                        </span>
                      </label>
                      <textarea
                        id="doc-obs"
                        name="obs"
                        maxLength={1250}
                        className="nvf-form-control"
                        placeholder="Observações, notas ou comentários a adicionar ao documento"
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                      />
                    </div>
                    <div className="nvf-form-group" style={{ marginBottom: 0 }}>
                      <div className="nvf-row-inner">
                        <div style={{ flex: "0 0 33.333%" }}>
                          <label htmlFor="external-reference">
                            <span id="external-reference-label">
                              Referência Externa
                            </span>{" "}
                            <span
                              className="nvf-help-icon"
                              id="external-reference-help"
                              title="Referência a um documento externo, código de rastreio ou nota de encomenda"
                            >
                              ?
                            </span>
                          </label>
                          <input
                            name="external_reference"
                            type="text"
                            id="external-reference"
                            className="nvf-form-control"
                            maxLength={20}
                            placeholder="Referência Externa"
                            value={referenciaExterna}
                            onChange={(e) =>
                              setReferenciaExterna(e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* ================= COL 4 : SIDEBAR ================= */}
            <div
              id="document-form-options"
              className={`menu-filter ${sidebarOpen ? "open" : ""}`}
            >
              <button
                type="button"
                className="btn-menu-filter-close mb-3"
                onClick={() => setSidebarOpen(false)}
              >
                <ChevronLeft className="w-4 h-4" /> Fechar
              </button>

              <div
                className="nvf-col-4"
                style={{ flex: "0 0 100%", maxWidth: "100%", padding: 0 }}
              >
                <div
                  id="documents-options"
                  className="nvf-box-flex turn"
                  style={{ marginBottom: 12 }}
                >
                  <div className="nvf-content" style={{ padding: 0 }}>
                    <div className="nvf-section-title">
                      Definições do Documento
                    </div>

                    {totals.error && (
                      <p
                        role="alert"
                        className="mb-3 p-2 border border-red-200 text-red-700 bg-red-50"
                      >
                        {totals.error}
                      </p>
                    )}
                    {/* ---- Loja / Caixa ---- */}
                    <div className="nvf-box box-collapse">
                      <button
                        type="button"
                        className="nvf-box-header"
                        aria-expanded={!!openBoxes.store}
                        onClick={() => toggleBox("store")}
                      >
                        <span className="nvf-box-icon">
                          <Store className="w-4 h-4" />
                        </span>
                        <span className="text-selected-option store">
                          {config.configuracaoFiscal?.terminalCaixa ||
                            "Caixa principal"}{" "}
                          ({config.nomeClinica || "Loja principal"})
                        </span>
                        <span className="form-option-txt-change">Alterar</span>
                      </button>
                      {openBoxes.store && (
                        <div className="nvf-box-content">
                          <ul id="office-form-stores-list">
                            <li className="line">
                              <input
                                type="radio"
                                id="store_main"
                                name="store"
                                defaultChecked
                              />
                              <label htmlFor="store_main">
                                {config.configuracaoFiscal?.terminalCaixa ||
                                  "Caixa principal"}{" "}
                                ({config.nomeClinica || "Loja principal"})
                              </label>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* ---- Data de Emissão ---- */}
                    <div className="nvf-box box-collapse">
                      <button
                        type="button"
                        className="nvf-box-header"
                        aria-expanded={!!openBoxes.date}
                        onClick={() => toggleBox("date")}
                      >
                        <span className="nvf-box-icon">
                          <CalendarDays className="w-4 h-4" />
                        </span>
                        Data de Emissão
                        <span className="text-selected-option">
                          {dataEmissao !== todayStr() ? dataEmissao : ""}
                        </span>
                        <span className="form-option-txt-change">Alterar</span>
                      </button>
                      {openBoxes.date && (
                        <div className="nvf-box-content">
                          <div className="nvf-input-group">
                            <div className="nvf-input-group-addon">
                              <CalendarDays className="w-3.5 h-3.5" />
                            </div>
                            <input
                              type="text"
                              id="document-date"
                              className="nvf-form-control"
                              placeholder="Hoje"
                              value={dataEmissao}
                              onChange={(e) => setDataEmissao(e.target.value)}
                              autoComplete="off"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ---- Data de Disponibilização ---- */}
                    <div className="nvf-box box-collapse">
                      <button
                        type="button"
                        className="nvf-box-header"
                        aria-expanded={!!openBoxes.supply}
                        onClick={() => toggleBox("supply")}
                      >
                        <span className="nvf-box-icon">
                          <CalendarDays className="w-4 h-4" />
                        </span>
                        Data de Disponibilização
                        <span className="text-selected-option">
                          {dataDisponibilizacao || ""}
                        </span>
                        <span className="form-option-txt-change">Alterar</span>
                      </button>
                      {openBoxes.supply && (
                        <div className="nvf-box-content">
                          <div className="nvf-input-group">
                            <div className="nvf-input-group-addon">
                              <CalendarDays className="w-3.5 h-3.5" />
                            </div>
                            <input
                              type="text"
                              id="document-date-supply"
                              className="nvf-form-control"
                              placeholder="Data de emissão"
                              value={dataDisponibilizacao}
                              onChange={(e) =>
                                setDataDisponibilizacao(e.target.value)
                              }
                              autoComplete="off"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ---- Vencimento ---- */}
                    <div id="datedue-list" className="nvf-box box-collapse">
                      <button
                        type="button"
                        className="nvf-box-header"
                        aria-expanded={!!openBoxes.datedue}
                        onClick={() => toggleBox("datedue")}
                      >
                        <span className="nvf-box-icon">
                          <Clock className="w-4 h-4" />
                        </span>
                        Vencimento
                        <span className="text-selected-option">
                          {
                            VENCIMENTO_OPTIONS.find(
                              (o) => o.value === vencimentoPreset,
                            )?.label
                          }
                        </span>
                        <span className="form-option-txt-change">Alterar</span>
                      </button>
                      {openBoxes.datedue && (
                        <div className="nvf-box-content">
                          <ul data-type="datedue">
                            {VENCIMENTO_OPTIONS.map((opt) => (
                              <li className="line" key={opt.value}>
                                <input
                                  type="radio"
                                  id={`datedue_${opt.value}`}
                                  name="datedue"
                                  checked={vencimentoPreset === opt.value}
                                  onChange={() => {
                                    setVencimentoPreset(opt.value);
                                    if (
                                      opt.value === "now" ||
                                      opt.value === "1"
                                    )
                                      setDataVencimento(todayStr());
                                    else if (opt.value !== "date")
                                      setDataVencimento(
                                        addDaysStr(parseInt(opt.value)),
                                      );
                                  }}
                                />
                                <label htmlFor={`datedue_${opt.value}`}>
                                  {opt.label}
                                </label>
                                {opt.value === "date" &&
                                  vencimentoPreset === "date" && (
                                    <input
                                      id="datedue_date_input"
                                      type="text"
                                      className="nvf-form-control nvf-input-line"
                                      name="datedue_date"
                                      placeholder="Data de Vencimento: Ano/Mês/Dia"
                                      value={dataVencimento}
                                      onChange={(e) =>
                                        setDataVencimento(e.target.value)
                                      }
                                      autoComplete="off"
                                    />
                                  )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* ---- Pagamentos ---- */}
                    <div id="payments-list" className="nvf-box box-collapse">
                      <button
                        type="button"
                        id="payment-methods"
                        className="nvf-box-header"
                        aria-expanded={!!openBoxes.pay}
                        onClick={() => toggleBox("pay")}
                      >
                        <span className="nvf-box-icon">
                          <Banknote className="w-4 h-4" />
                        </span>
                        <span className="text-selected-option">
                          {PAYMENT_METHODS.filter(
                            (m) => paymentsSelected[m.label],
                          )
                            .map((m) => m.label)
                            .join(", ") || "Pagamentos"}
                        </span>
                        <span className="form-option-txt-change">Alterar</span>
                      </button>
                      {openBoxes.pay && (
                        <div className="nvf-box-content">
                          <ul data-type="payment">
                            {PAYMENT_METHODS.map((m) => (
                              <li
                                className="line"
                                key={m.code}
                                style={{ display: "block" }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    id={`payments_${m.code}`}
                                    checked={!!paymentsSelected[m.label]}
                                    onChange={(e) =>
                                      handleTogglePayment(
                                        m.label,
                                        e.target.checked,
                                      )
                                    }
                                  />
                                  <label htmlFor={`payments_${m.code}`}>
                                    {m.label}
                                  </label>
                                </div>
                                {paymentsSelected[m.label] && (
                                  <div
                                    className="nvf-input-group"
                                    style={{ marginTop: 6 }}
                                  >
                                    <input
                                      type="text"
                                      id={`payments_amount_${m.code}`}
                                      className="nvf-form-control text-right"
                                      placeholder={`Montante em ${m.label}`}
                                      value={paymentAmounts[m.label] || ""}
                                      onChange={(e) =>
                                        setPaymentAmounts((p) => ({
                                          ...p,
                                          [m.label]: e.target.value,
                                        }))
                                      }
                                    />
                                    <div
                                      className="nvf-input-group-addon"
                                      style={{
                                        borderRight: "none",
                                        borderLeft: "1px solid #d7dce3",
                                      }}
                                    >
                                      {config.moeda}
                                    </div>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                          {paymentsSelected["Dinheiro"] && (
                            <div
                              className="nvf-inner-note"
                              style={{ marginTop: 8 }}
                            >
                              <input
                                type="text"
                                className="nvf-form-control text-right"
                                placeholder="Valor entregue pelo cliente"
                                value={paymentAmounts["Dinheiro"] || ""}
                                onChange={(e) =>
                                  setPaymentAmounts((p) => ({
                                    ...p,
                                    Dinheiro: e.target.value.replace(
                                      /[^0-9.,]/g,
                                      "",
                                    ),
                                  }))
                                }
                              />
                              {trocoCalculado > 0 && (
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontWeight: 700,
                                    color: "#28a745",
                                  }}
                                >
                                  Troco:{" "}
                                  {formatCurrency(trocoCalculado, config.moeda)}
                                </div>
                              )}
                            </div>
                          )}
                          {Object.values(paymentsSelected).some(Boolean) && (
                            <div
                              style={{
                                marginTop: 12,
                                padding: 10,
                                borderTop: "1px solid #eef0f3",
                                fontSize: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  marginBottom: 4,
                                }}
                              >
                                <span>Total do documento</span>
                                <strong>
                                  {formatCurrency(totals.total, config.moeda)}
                                </strong>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  marginBottom: 4,
                                }}
                              >
                                <span>Total atribuído a pagamentos</span>
                                <strong>
                                  {formatCurrency(pagamentoTotal, config.moeda)}
                                </strong>
                              </div>
                              {pagamentoEmFalta > 0 && (
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#b45309",
                                    fontWeight: 700,
                                  }}
                                >
                                  <span>Em falta</span>
                                  <span>
                                    {formatCurrency(
                                      pagamentoEmFalta,
                                      config.moeda,
                                    )}
                                  </span>
                                </div>
                              )}
                              {pagamentoExcesso > 0 && (
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#15803d",
                                    fontWeight: 700,
                                  }}
                                >
                                  <span>Excesso / Troco</span>
                                  <span>
                                    {formatCurrency(
                                      pagamentoExcesso,
                                      config.moeda,
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ---- Desconto ---- */}
                    <div className="nvf-row" style={{ margin: 0 }}>
                      <div style={{ flex: "0 0 100%", padding: 0 }}>
                        <div
                          id="discount-list"
                          className="nvf-box box-collapse"
                        >
                          <button
                            type="button"
                            className="nvf-box-header"
                            onClick={() => toggleBox("disc")}
                          >
                            <span className="nvf-box-icon">
                              <Percent className="w-4 h-4" />
                            </span>
                            <span className="text-selected-option">
                              Desconto
                            </span>
                            <span className="form-option-txt-change">
                              Alterar
                            </span>
                          </button>
                          {openBoxes.disc && (
                            <div
                              className="nvf-box-content"
                              id="global-discount-content"
                            >
                              <div className="nvf-row-inner">
                                <div>
                                  <div className="nvf-input-group">
                                    <div className="nvf-input-group-addon">
                                      %
                                    </div>
                                    <input
                                      className="nvf-form-control text-right"
                                      type="text"
                                      placeholder="Desc. Percentual"
                                      id="discount-percentage"
                                      value={descontoPercent}
                                      onChange={(e) => {
                                        setDescontoPercent(
                                          e.target.value.replace(
                                            /[^0-9.,]/g,
                                            "",
                                          ),
                                        );
                                        if (e.target.value)
                                          setDescontoValorStr("");
                                      }}
                                      onFocus={(e) => e.target.select()}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <div className="nvf-input-group">
                                    <div className="nvf-input-group-addon">
                                      {config.moeda}
                                    </div>
                                    <input
                                      className="nvf-form-control text-right"
                                      type="text"
                                      placeholder="Desc. Monetário"
                                      id="discount-amount"
                                      value={descontoValorStr}
                                      onChange={(e) => {
                                        setDescontoValorStr(
                                          e.target.value.replace(
                                            /[^0-9.,]/g,
                                            "",
                                          ),
                                        );
                                        if (e.target.value)
                                          setDescontoPercent("");
                                      }}
                                      onFocus={(e) => e.target.select()}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ---- Transporte ---- */}
                    <div className="nvf-box box-collapse transport-menu">
                      <button
                        type="button"
                        className="nvf-box-header"
                        aria-expanded={!!openBoxes.transp}
                        onClick={() => toggleBox("transp")}
                      >
                        <span className="nvf-box-icon">
                          <Truck className="w-4 h-4" />
                        </span>
                        Transporte
                        <span className="text-selected-option">
                          {transporte ? "Sim" : "Não"}
                        </span>
                        <span className="form-option-txt-change">Alterar</span>
                      </button>
                      {openBoxes.transp && (
                        <div className="nvf-box-content">
                          <ul data-type="transport">
                            <li className="line">
                              <input
                                type="radio"
                                id="transport_off"
                                name="transport"
                                checked={!transporte}
                                onChange={() => setTransporte(false)}
                              />
                              <label htmlFor="transport_off">Não</label>
                            </li>
                            <li className="line">
                              <input
                                type="radio"
                                id="transport_on"
                                name="transport"
                                checked={transporte}
                                onChange={() => setTransporte(true)}
                              />
                              <label htmlFor="transport_on">Sim</label>
                            </li>
                          </ul>
                          {transporte && (
                            <div style={{ marginTop: 12 }}>
                              <div className="nvf-form-group">
                                <label>Local de Carga</label>
                                <select
                                  className="nvf-form-control"
                                  value={localCarga}
                                  onChange={(e) =>
                                    setLocalCarga(e.target.value)
                                  }
                                >
                                  <option value="">Selecionar Endereço</option>
                                  <option value="Sede Fiscal">
                                    Sede Fiscal
                                  </option>
                                  <option
                                    value={
                                      config.configuracaoFiscal
                                        ?.terminalCaixa || "Loja principal"
                                    }
                                  >
                                    {config.configuracaoFiscal?.terminalCaixa ||
                                      "Loja principal"}
                                  </option>
                                </select>
                              </div>
                              <div className="nvf-form-group">
                                <label>Morada de Carga</label>
                                <input
                                  className="nvf-form-control"
                                  value={moradaCarga}
                                  onChange={(e) =>
                                    setMoradaCarga(e.target.value)
                                  }
                                  placeholder="Morada do Local de Carga"
                                />
                              </div>
                              <div className="nvf-form-group">
                                <label>Data e Hora de Carga</label>
                                <input
                                  className="nvf-form-control"
                                  type="datetime-local"
                                  value={dataHoraCarga}
                                  onChange={(e) =>
                                    setDataHoraCarga(e.target.value)
                                  }
                                />
                              </div>
                              <div className="nvf-form-group">
                                <label>Local de Descarga</label>
                                <select
                                  className="nvf-form-control"
                                  value={localDescarga}
                                  onChange={(e) =>
                                    setLocalDescarga(e.target.value)
                                  }
                                >
                                  <option value="">Selecionar Endereço</option>
                                  <option value="Sede Fiscal">
                                    Sede Fiscal
                                  </option>
                                  <option value="Cliente">
                                    Morada do Cliente
                                  </option>
                                </select>
                              </div>
                              <div className="nvf-form-group">
                                <label>Morada de Descarga</label>
                                <input
                                  className="nvf-form-control"
                                  value={moradaDescarga}
                                  onChange={(e) =>
                                    setMoradaDescarga(e.target.value)
                                  }
                                  placeholder="Morada do Local de Descarga"
                                />
                              </div>
                              <div className="nvf-form-group">
                                <label>Data e Hora de Descarga</label>
                                <input
                                  className="nvf-form-control"
                                  type="datetime-local"
                                  value={dataHoraDescarga}
                                  onChange={(e) =>
                                    setDataHoraDescarga(e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ---- Retenção IPU ---- */}
                    <div id="irc-list" className="nvf-box box-collapse">
                      <button
                        type="button"
                        className="nvf-box-header"
                        aria-expanded={!!openBoxes.irc}
                        onClick={() => toggleBox("irc")}
                      >
                        <span className="nvf-box-icon">
                          <ShieldCheck className="w-4 h-4" />
                        </span>
                        Retenção IPU
                        <span className="text-selected-option">
                          {retencaoIPU ? "15% - Prédios Arrendados" : ""}
                        </span>
                        <span className="form-option-txt-change">Alterar</span>
                      </button>
                      {openBoxes.irc && (
                        <div className="nvf-box-content">
                          <ul data-type="irc" id="office-irc-retention">
                            <li className="line">
                              <input
                                type="radio"
                                id="irc_none"
                                name="irc"
                                checked={retencaoIPU === ""}
                                onChange={() => setRetencaoIPU("")}
                              />
                              <label htmlFor="irc_none">Não</label>
                            </li>
                            <li className="line">
                              <input
                                type="radio"
                                id="irc_IPU"
                                name="irc"
                                checked={false}
                                disabled
                                title="Retenções específicas exigem validação fiscal antes de activar."
                              />
                              <label htmlFor="irc_IPU">
                                15% - Prédios Arrendados
                              </label>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* ---- Tipo de Documento a Gerar ---- */}
                    <div
                      id="office-doc-to-generate"
                      className="nvf-box box-collapse"
                    >
                      <button
                        type="button"
                        className="nvf-box-header"
                        aria-expanded={!!openBoxes.gen}
                        onClick={() => toggleBox("gen")}
                      >
                        <span className="nvf-box-icon">
                          <CreditCard className="w-4 h-4" />
                        </span>
                        Tipo de Documento a Gerar
                        <span className="text-selected-option">
                          {docToGenerate === "FT"
                            ? "Factura"
                            : "Factura Recibo"}
                        </span>
                        <span className="form-option-txt-change">Alterar</span>
                      </button>
                      {openBoxes.gen && (
                        <div className="nvf-box-content">
                          <div
                            id="office-doc-to-generate-note"
                            className="nvf-inner-note"
                          >
                            Quando o documento é pago, qual o tipo de documento
                            a gerar?
                          </div>
                          <ul data-type="doctogenerate">
                            <li className="line">
                              <input
                                type="radio"
                                id="generate_ft"
                                name="doctogenerate"
                                checked={docToGenerate === "FT"}
                                onChange={() => setDocToGenerate("FT")}
                              />
                              <label htmlFor="generate_ft">Factura</label>
                            </li>
                            <li className="line">
                              <input
                                type="radio"
                                id="generate_ref_yes"
                                name="doctogenerate"
                                checked={docToGenerate === "FR"}
                                onChange={() => setDocToGenerate("FR")}
                              />
                              <label htmlFor="generate_ref_yes">
                                Factura Recibo
                              </label>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* ---- Modo Formação ---- */}
                    <div
                      id="office-training-mode"
                      className={`nvf-box box-collapse ${modoFormacao ? "active" : ""}`}
                    >
                      <button
                        type="button"
                        className="nvf-box-header"
                        aria-expanded={!!openBoxes.mode}
                        onClick={() => toggleBox("mode")}
                      >
                        <span className="nvf-box-icon">
                          <GraduationCap className="w-4 h-4" />
                        </span>
                        Modo Formação
                        <span className="text-selected-option">
                          {modoFormacao ? "Sim" : ""}
                        </span>
                        <span className="form-option-txt-change">Alterar</span>
                      </button>
                      {openBoxes.mode && (
                        <div className="nvf-box-content">
                          <div
                            id="office-training-mode-note"
                            className="nvf-inner-note"
                          >
                            Utilize o Modo Formação para experimentar a emissão
                            de Documentos. Estes não têm validade fiscal.
                          </div>
                          <ul data-type="mode">
                            <li className="line">
                              <input
                                type="radio"
                                id="mode_normal"
                                name="mode"
                                checked={!modoFormacao}
                                disabled
                                readOnly
                              />
                              <label htmlFor="mode_normal">
                                Produção fiscal — bloqueada
                              </label>
                            </li>
                            <li className="line">
                              <input
                                type="radio"
                                id="mode_tests"
                                name="mode"
                                checked={modoFormacao}
                                readOnly
                              />
                              <label htmlFor="mode_tests">
                                Formação activa para testes
                              </label>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* ---- Movimentar Stock ---- */}
                    <div
                      id="office-stock-mode"
                      className="nvf-box box-collapse"
                    >
                      <button
                        type="button"
                        className="nvf-box-header"
                        aria-expanded={!!openBoxes.stock}
                        onClick={() => toggleBox("stock")}
                      >
                        <span className="nvf-box-icon">
                          <ArrowRightLeft className="w-4 h-4" />
                        </span>
                        Movimentar Stock
                        <span className="text-selected-option">
                          {modoFormacao
                            ? "Não — formação"
                            : movimentarStock
                              ? "Sim"
                              : "Não"}
                        </span>
                        <span className="form-option-txt-change">Alterar</span>
                      </button>
                      {openBoxes.stock && (
                        <div className="nvf-box-content">
                          <div className="nvf-inner-note">
                            Pretende que o stock seja atualizado após a emissão
                            do documento?
                          </div>
                          <ul data-type="stock">
                            <li className="line">
                              <input
                                type="radio"
                                id="stock_yes"
                                name="stock_control"
                                checked={!modoFormacao && movimentarStock}
                                disabled={modoFormacao}
                                onChange={() => setMovimentarStock(true)}
                              />
                              <label htmlFor="stock_yes">Sim</label>
                            </li>
                            <li className="line">
                              <input
                                type="radio"
                                id="stock_no"
                                name="stock_control"
                                checked={modoFormacao || !movimentarStock}
                                onChange={() => setMovimentarStock(false)}
                              />
                              <label htmlFor="stock_no">Não</label>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* ---- Botão Criar ---- */}
                    <button
                      type="button"
                      id="document-create-btn"
                      className={`nvf-btn-apply ${currentDocMeta.code} ${modoFormacao ? "training" : ""}`}
                      style={{
                        background: modoFormacao
                          ? "#FED500"
                          : currentDocMeta.color,
                      }}
                      disabled={issueBlockedForMissingIssuerNif}
                      onClick={() => handleSaveDocumento()}
                      title={
                        issueBlockedForMissingIssuerNif
                          ? "Configure um NIF válido nas Definições para emitir."
                          : undefined
                      }
                    >
                      {modoFormacao && <GraduationCap className="w-4 h-4" />}
                      {!modoFormacao && <Check className="w-4 h-4" />}
                      Criar <span className="text">{currentDocMeta.label}</span>
                    </button>

                    {modoFormacao && (
                      <div id="office-training-btn-note">
                        Modo Formação Ativo: Experimente a emissão de documentos
                        <br />
                        <button type="button" onClick={onTrainingHelp}>
                          Saber Mais
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ---- office-draft ---- */}
                {draftError && (
                  <p role="alert" className="text-red-700 text-xs">
                    {draftError}
                  </p>
                )}
                {(draftSavedAt || editId) && (
                  <div id="office-draft">
                    <Receipt className="nvf-draft-icon w-5 h-5 inline" />
                    <span id="office-draft-document">
                      {currentDocMeta.label}
                    </span>{" "}
                    em rascunho. Guardado{" "}
                    <span id="office-draft-time">
                      {draftSavedAt
                        ? `${String(draftSavedAt.getHours()).padStart(2, "0")}:${String(draftSavedAt.getMinutes()).padStart(2, "0")}`
                        : "agora"}
                    </span>
                    .
                    <br />
                    <a
                      className="office-draft-remove"
                      onClick={async (e) => {
                        e.preventDefault();
                        try {
                          if (editId) await removeFatura(editId);
                          resetForm();
                        } catch (error) {
                          setDraftError((error as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" /> Remover Rascunho
                    </a>
                  </div>
                )}

                {/* ---- resumo totais (extra útil) ---- */}
                <div id="office-draft" style={{ marginTop: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "#5b6470",
                      marginBottom: 4,
                    }}
                  >
                    <span>Total s/IVA</span>
                    <span>
                      {formatCurrency(totals.subtotalSemIva, config.moeda)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "#5b6470",
                      marginBottom: 4,
                    }}
                  >
                    <span>IVA ({ivaTaxa}%)</span>
                    <span>{formatCurrency(totals.totalIva, config.moeda)}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#2f3640",
                      borderTop: "1px solid #eef0f3",
                      paddingTop: 8,
                      marginTop: 6,
                    }}
                  >
                    <span>Total c/IVA</span>
                    <span>{formatCurrency(totals.total, config.moeda)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== help footer ===== */}
        <div className="nvf-help-footer">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onTrainingHelp?.();
            }}
          >
            <HelpCircle className="w-4 h-4" /> Precisa de Ajuda?
          </a>
        </div>

        {/* ===== overlay + sticky Finalizar (mobile) ===== */}
        <div
          className={`nvf-overlay ${sidebarOpen ? "show" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
        <button
          type="button"
          className="nvf-btn-menu-filter-sticky"
          onClick={() =>
            linhas.length > 0 ? handleSaveDocumento() : setSidebarOpen(true)
          }
        >
          <Check className="w-4 h-4" /> Finalizar
        </button>

        {/* ===== Modais ===== */}
        {showNewItem && (
          <InvoiceItemEditor
            onClose={() => setShowNewItem(false)}
            onSaved={(p) => {
              addItemToLinhas(p, 1);
              setShowNewItem(false);
            }}
          />
        )}
        {showNovoClienteModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded shadow-2xl w-full max-w-lg">
              <div className="px-6 py-4 bg-[#1577EB] text-white flex items-center justify-between rounded-t">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <UserRoundPlus className="w-5 h-5" /> Cadastrar Novo Cliente
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNovoClienteModal(false)}
                  className="text-white/80 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={novoCliNome}
                    onChange={(e) => setNovoCliNome(e.target.value)}
                    placeholder="Nome do cliente ou empresa..."
                    className="nvf-form-control"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">
                    NIF / BI
                  </label>
                  <input
                    type="text"
                    value={novoCliNif}
                    onChange={(e) => setNovoCliNif(e.target.value)}
                    placeholder="Ex: 5417082910"
                    className="nvf-form-control"
                    style={{ fontFamily: "monospace" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={novoCliTel}
                    onChange={(e) => setNovoCliTel(e.target.value)}
                    placeholder="+244 9XX XXX XXX"
                    className="nvf-form-control"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">
                    Morada
                  </label>
                  <input
                    type="text"
                    value={novoCliEnd}
                    onChange={(e) => setNovoCliEnd(e.target.value)}
                    placeholder="Ex: Luanda, Maianga"
                    className="nvf-form-control"
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNovoClienteModal(false)}
                    className="flex-1 py-2 rounded bg-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded bg-[#1577EB] hover:bg-[#0d5fc0] text-white text-sm font-bold"
                  >
                    Salvar e Selecionar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showCatalogModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-4">
            <div className="bg-white rounded shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 bg-[#1577EB] text-white flex items-center justify-between rounded-t">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-6 h-6" />
                  <div>
                    <button
                      type="button"
                      className="underline text-xs"
                      onClick={() => {
                        setShowCatalogModal(false);
                        setShowKitsModal(true);
                      }}
                    >
                      Kits e procedimentos
                    </button>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      Catálogo de Produtos
                      <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-mono">
                        {produtos.length} Itens
                      </span>
                    </h3>
                    <p className="text-xs text-blue-100 mt-0.5">
                      Selecione produtos para adicionar à factura
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="text-white/80 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative md:col-span-2">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Pesquisar por descrição, código ou código de barras..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-[#1577EB]"
                      autoFocus
                    />
                  </div>
                  <select
                    value={catalogCategory}
                    onChange={(e) => setCatalogCategory(e.target.value)}
                    className="w-full border border-gray-300 bg-white rounded px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#1577EB]"
                  >
                    <option value="todas">Todas as Categorias</option>
                    {categorias.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["todas", ...categorias].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCatalogCategory(cat)}
                      className={`px-2.5 py-1 rounded text-xs border ${catalogCategory === cat ? "bg-blue-600 text-white" : "bg-white text-slate-700"}`}
                    >
                      {cat === "todas" ? "Todas" : cat}
                    </button>
                  ))}
                  <span className="text-xs text-gray-500 ml-auto">
                    {catalogFilteredProducts.length} itens encontrados
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 max-h-[55vh]">
                {catalogFilteredProducts.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold text-gray-600">
                      Nenhum item corresponde à pesquisa
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {catalogFilteredProducts.slice(0, 80).map((p) => {
                      const inCart = linhas.some((l) => l.produtoId === p.id);
                      return (
                        <div
                          key={p.id}
                          className="p-3 rounded border border-gray-200 hover:border-[#1577EB] hover:bg-blue-50/40 flex items-center justify-between gap-3 bg-white"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px] font-bold">
                                {p.codigo}
                              </span>
                              <span className="text-[10px] text-gray-500 truncate">
                                {p.categoria}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-gray-900 truncate">
                              {p.nome}
                            </div>
                            <div className="text-xs font-black text-[#1577EB] mt-1">
                              {formatCurrency(p.preco, config.moeda)}
                              <span className="text-[10px] text-gray-400 font-normal ml-1">
                                / {p.unidadeMedida} (Stock: {p.stock})
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => addItemToLinhas(p, 1)}
                            className={`px-3 py-1.5 rounded text-xs font-bold shrink-0 flex items-center gap-1 ${inCart ? "bg-green-600 hover:bg-green-700 text-white" : "bg-[#1577EB] hover:bg-[#0d5fc0] text-white"}`}
                          >
                            <Plus className="w-3.5 h-3.5" />{" "}
                            {inCart ? "+1 Adicionar" : "Adicionar"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {catalogFilteredProducts.length > 80 && (
                  <div className="text-center py-2 text-xs text-gray-400">
                    Mostrando os primeiros 80 itens. Use a pesquisa para
                    refinar.
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between rounded-b">
                <div className="text-xs text-gray-500">
                  Itens na Fatura atual: <b>{linhas.length}</b> linha(s)
                </div>
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="px-5 py-2 bg-[#2f3640] hover:bg-[#1f242b] text-white rounded text-xs font-bold"
                >
                  Concluir Seleção
                </button>
              </div>
            </div>
          </div>
        )}

        {ncModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 bg-orange-600 text-white flex items-center justify-between rounded-t">
                <h3 className="font-bold text-sm">
                  Emitir Nota de Crédito para {ncModal.numero}
                </h3>
                <button
                  type="button"
                  onClick={() => setNcModal(null)}
                  className="text-orange-200 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-orange-50 p-3 rounded border border-orange-200 text-xs text-orange-900">
                  <div className="font-bold">
                    Cliente: {ncModal.clienteNome}
                  </div>
                  <div>
                    Valor original:{" "}
                    {formatCurrency(ncModal.total, config.moeda)}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-700">
                    Artigos e quantidades a creditar
                  </p>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded border border-gray-200 p-2">
                    {ncModal.linhas.map((linha, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 rounded bg-gray-50 p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-gray-800">
                            {linha.descricao}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {formatCurrency(linha.precoUnitario, config.moeda)}{" "}
                            · disponível {Math.abs(linha.quantidade)}{" "}
                            {linha.unidade || "un"}
                          </p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={Math.abs(linha.quantidade)}
                          step="0.01"
                          value={ncQuantidades[index] ?? 0}
                          onChange={(ev) =>
                            setNcQuantidades((prev) => ({
                              ...prev,
                              [index]: Number(ev.target.value) || 0,
                            }))
                          }
                          className="h-9 w-20 rounded border border-gray-300 bg-white px-2 text-right text-xs font-bold outline-none focus:border-orange-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">
                    Motivo da Nota de Crédito (Exigido pela AGT) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={ncMotivo}
                    onChange={(e) => setNcMotivo(e.target.value)}
                    placeholder="Ex: Anulação por erro na quantidade, devolução de mercadoria..."
                    className="nvf-form-control"
                  />
                </div>
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNcModal(null)}
                    className="flex-1 py-2 rounded bg-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmNotaCredito}
                    className="flex-1 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                  >
                    Emitir Nota de Crédito
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <KitsProcedimentosModal
          isOpen={showKitsModal}
          onClose={() => setShowKitsModal(false)}
          onInsertKit={handleInsertKit}
          currency={config.moeda}
        />
        {documentDialogs}
      </div>
    );
  }

  /* =================================================================
     DETAIL VIEW
     ================================================================= */
  if (viewMode === "detalhe" && issuedDocument) {
    void actionHistoryTick;
    const detalheMeta = getDocumentMeta(issuedDocument.tipoDocumento);
    const imprimirDocumento = (termica: boolean) => {
      downloadFatura(
        generateFaturaHTML(issuedDocument, config, { termica }),
        termica ? `${issuedDocument.numero}_termica` : issuedDocument.numero,
      );
    };
    return (
      <div className="nvf-root" style={{ padding: "20px 0" }}>
        <style>{FATURACAO_REFERENCE_CSS}</style>
        <div className="nvf-container-fluid" style={{ maxWidth: 1000 }}>
          <nav id="breadcrumbs" style={{ marginBottom: 16 }}>
            <ol className="nvf-breadcrumb">
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setIssuedDocument(null);
                    setViewMode("lista");
                  }}
                >
                  Documentos
                </a>
              </li>
              <li className="active">{issuedDocument.numero}</li>
            </ol>
          </nav>

          <div className="nvf-box-flex">
            <div className="nvf-header">
              <div className="nvf-header-flex-title">
                <div
                  className="nvf-doc-type-circle"
                  style={{ background: detalheMeta.color }}
                >
                  {detalheMeta.code}
                </div>
                <div>
                  <div className="nvf-title-bold">{issuedDocument.numero}</div>
                  <div style={{ fontSize: 12, color: "#8a919c" }}>
                    {issuedDocument.data} · {detalheMeta.label}
                  </div>
                </div>
              </div>
              <span
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  background:
                    issuedDocument.tipoDocumento === "pro-forma"
                      ? "#fff3cd"
                      : issuedDocument.estado === "paga"
                        ? "#d4edda"
                        : "#d1ecf1",
                  color:
                    issuedDocument.tipoDocumento === "pro-forma"
                      ? "#856404"
                      : issuedDocument.estado === "paga"
                        ? "#155724"
                        : "#0c5460",
                }}
              >
                {issuedDocument.tipoDocumento === "pro-forma"
                  ? "Informativo"
                  : issuedDocument.estado}
              </span>
            </div>
            <div
              className="nvf-content"
              style={{
                padding: 20,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9aa1ac",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Cliente
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {issuedDocument.clienteNome}
                </div>
                {issuedDocument.clienteNif && (
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "#8a919c",
                    }}
                  >
                    NIF: {issuedDocument.clienteNif}
                  </div>
                )}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9aa1ac",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Emitente
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {config.nomeClinica}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: "#8a919c",
                  }}
                >
                  NIF: {config.nif}
                </div>
              </div>
            </div>
          </div>

          <div className="nvf-box-flex">
            <div className="nvf-header">
              <div className="nvf-title-bold">
                Itens <span className="nvf-slogan">Produtos e Serviços</span>
              </div>
            </div>
            <table className="nvf-table-flex">
              <thead>
                <tr>
                  <th className="text-left" style={{ paddingLeft: 20 }}>
                    Produto
                  </th>
                  <th className="text-right">IVA</th>
                  <th className="text-right">P.Unit.</th>
                  <th className="text-right">Qtd.</th>
                  <th className="text-right" style={{ paddingRight: 20 }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {issuedDocument.linhas.map((linha, i) => (
                  <tr key={i}>
                    <td className="nvf-cell-desc" style={{ paddingLeft: 20 }}>
                      <span className="nvf-doc-product-line-title">
                        {linha.descricao}
                      </span>
                      {linha.codigo && (
                        <>
                          <br />
                          <span className="nvf-doc-product-line-reference">
                            {linha.codigo}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="text-right">
                      {linha.ivaIsento
                        ? "Isento"
                        : `${issuedDocument.ivaTaxa}%`}
                    </td>
                    <td className="text-right">
                      {formatCurrency(linha.precoUnitario, config.moeda)}
                    </td>
                    <td className="text-right">{linha.quantidade}</td>
                    <td
                      className="text-right"
                      style={{ fontWeight: 700, paddingRight: 20 }}
                    >
                      {formatCurrency(
                        linha.quantidade * linha.precoUnitario,
                        config.moeda,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}></td>
                  <th className="total">Total</th>
                  <th className="text-right total" style={{ paddingRight: 20 }}>
                    {formatCurrency(
                      issuedDocument.subtotalSemIva,
                      config.moeda,
                    )}
                  </th>
                </tr>
                <tr id="document-total-pay">
                  <td colSpan={3}></td>
                  <th className="total">Total c/IVA</th>
                  <th
                    className="text-right total"
                    style={{ paddingRight: 20, color: "#1577EB" }}
                  >
                    {formatCurrency(issuedDocument.total, config.moeda)}
                  </th>
                </tr>
              </tfoot>
            </table>
            {issuedDocument.observacoes && (
              <div
                className="nvf-content"
                style={{ padding: 20, borderTop: "1px solid #eef0f3" }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9aa1ac",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Observações
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#5b6470",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.6,
                  }}
                >
                  {issuedDocument.observacoes}
                </div>
              </div>
            )}
          </div>

          <div className="nvf-box-flex">
            <div className="nvf-header">
              <div className="nvf-title-bold">Ações</div>
            </div>
            <div
              className="nvf-content"
              style={{ padding: 12, display: "flex", gap: 8, flexWrap: "wrap" }}
            >
              <button
                type="button"
                className="nvf-btn"
                onClick={() => imprimirDocumento(false)}
              >
                <Printer className="w-4 h-4" /> Imprimir A4
              </button>
              <button
                type="button"
                className="nvf-btn"
                onClick={() => imprimirDocumento(true)}
              >
                <Printer className="w-4 h-4" /> Térmico 80mm
              </button>
              <button
                type="button"
                className="nvf-btn"
                onClick={() =>
                  downloadFatura(
                    generateFaturaHTML(issuedDocument, config, {
                      termica: false,
                    }),
                    issuedDocument.numero,
                  )
                }
              >
                <FileDown className="w-4 h-4" /> PDF
              </button>
              <button
                type="button"
                className="nvf-btn"
                onClick={() => {
                  const s = encodeURIComponent(
                    `${issuedDocument.numero} - ${detalheMeta.label}`,
                  );
                  window.location.href = `mailto:${issuedDocument.clienteEmail || ""}?subject=${s}`;
                }}
              >
                <Mail className="w-4 h-4" /> Enviar E-mail
              </button>
              <button
                type="button"
                className="nvf-btn"
                onClick={() =>
                  handleNovoDocumento(issuedDocument.tipoDocumento)
                }
              >
                <ReceiptText className="w-4 h-4" /> Copiar p/ Novo
              </button>
              <button
                type="button"
                className="nvf-btn"
                onClick={() => {
                  setIssuedDocument(null);
                  setViewMode("lista");
                }}
              >
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
            </div>
          </div>
        </div>
        {documentDialogs}
      </div>
    );
  }

  /* =================================================================
     LIST VIEW
     ================================================================= */
  return (
    <div className="nvf-root" style={{ padding: "20px 0" }}>
      <style>{FATURACAO_REFERENCE_CSS}</style>
      <div className="nvf-container-fluid">
        <div className="nvf-box-flex">
          <div className="nvf-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="nvf-header-flex-title">
              <div className="nvf-title-bold" style={{ fontSize: 17 }}>
                Documentos e Facturação
              </div>
              <span className="nvf-slogan">
                Emissão de facturas, notas de crédito, recibos e pró-formas
              </span>
            </div>
            <div
              className="nvf-doc-header-right"
              style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
            >
              {onOpenScanner && (
                <button
                  type="button"
                  className="nvf-btn"
                  style={{
                    background: "#2f3640",
                    color: "#7ec8ff",
                    borderColor: "#2f3640",
                  }}
                  onClick={() =>
                    onOpenScanner((p) => {
                      handleNovoDocumento("factura");
                      setTimeout(() => addItemToLinhas(p, 1), 120);
                    })
                  }
                >
                  <QrCode className="w-4 h-4" /> Scanner
                </button>
              )}
              <button
                type="button"
                className="nvf-btn"
                style={{
                  background: "#fff8e6",
                  color: "#8a5a00",
                  borderColor: "#ffe1a1",
                }}
                onClick={() => handleNovoDocumento("pro-forma")}
              >
                + Pró-Forma
              </button>
              <button
                type="button"
                className="nvf-btn"
                style={{
                  background: "#e8f7ee",
                  color: "#155724",
                  borderColor: "#b7e4c7",
                }}
                onClick={() => handleNovoDocumento("factura-recibo")}
              >
                + Factura Recibo
              </button>
              <button
                type="button"
                className="nvf-btn"
                style={{
                  background: "#1577EB",
                  color: "#fff",
                  borderColor: "#1577EB",
                }}
                onClick={() => handleNovoDocumento("factura")}
              >
                <Plus className="w-4 h-4" /> Nova Factura (FT)
              </button>
            </div>
          </div>
          <div
            className="nvf-content"
            style={{
              padding: 16,
              background: "#fafbfc",
              borderBottom: "1px solid #eef0f3",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
              gap: 12,
            }}
          >
            {[
              {
                label: "Total Documentos",
                value: String(stats.totalDocs),
                icon: <Hash className="w-4 h-4" />,
                color: "#2f3640",
              },
              {
                label: "Pendentes",
                value: String(stats.totalEmitidas),
                icon: <CircleAlert className="w-4 h-4" />,
                color: "#b8860b",
              },
              {
                label: "Pagas",
                value: String(stats.totalPagas),
                icon: <BadgeCheck className="w-4 h-4" />,
                color: "#155724",
              },
              {
                label: "Valor Pendente",
                value: formatCurrency(stats.valorPendente, config.moeda),
                icon: <TrendingUp className="w-4 h-4" />,
                color: "#1577EB",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#fff",
                  border: "1px solid #e3e6ea",
                  borderRadius: 4,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                    color: "#8a919c",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {s.label}
                  </span>
                  {s.icon}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
          <div className="nvf-content" style={{ padding: 16 }}>
            <div
              className="nvf-list-filters"
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr",
                gap: 10,
              }}
            >
              <div style={{ position: "relative" }}>
                <Search
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#aab1bc" }}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar por n.º de factura, cliente ou NIF..."
                  className="nvf-form-control"
                  style={{ paddingLeft: 34 }}
                />
              </div>
              <select
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
                className="nvf-form-control"
              >
                <option value="todos">Todos os Estados</option>
                <option value="emitida">Emitida (Pendente)</option>
                <option value="paga">Paga</option>
                <option value="rascunho">Rascunho</option>
                <option value="anulada">Anulada</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="nvf-form-control"
              >
                <option value="todos">Todos os Tipos</option>
                {TIPO_DOC_OPTS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="nvf-box-flex">
          {filteredInvoices.length === 0 ? (
            <div className="nvf-no-products">
              <ReceiptText className="nvf-big-icon w-12 h-12" />
              Nenhum documento encontrado.
              <br />
              <button
                type="button"
                className="nvf-btn mt-3"
                onClick={() => handleNovoDocumento("factura")}
              >
                <Plus className="w-4 h-4" /> Criar a primeira factura
              </button>
            </div>
          ) : (
            <div className="nvf-documents-list-wrap">
              <table className="nvf-table-flex nvf-documents-list-table">
                <thead>
                  <tr>
                    <th className="text-left" style={{ paddingLeft: 20 }}>
                      Documento
                    </th>
                    <th className="text-left">Cliente / NIF</th>
                    <th className="text-left">Data / Venc.</th>
                    <th className="text-center">Estado</th>
                    <th className="text-right">Total</th>
                    <th className="text-right" style={{ paddingRight: 20 }}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceListing.items.map((f) => {
                    const meta = getDocumentMeta(f.tipoDocumento);
                    const isPaid = f.estado === "paga";
                    const blockedSettlement =
                      !!f.agtReplacementNo ||
                      (!!f.agtCorrection && f.agtStatus !== "validado");
                    const isAnulada = f.estado === "anulada";
                    const isProForma = f.tipoDocumento === "pro-forma";
                    const noFiscal = isProForma || f.estado === "rascunho";
                    const hasNC = creditedInvoices.has(f.numero);
                    return (
                      <tr key={f.id}>
                        <td
                          className="nvf-cell-desc"
                          style={{ paddingLeft: 20 }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                background: meta.color,
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {meta.code}
                            </span>
                            <span className="nvf-doc-product-line-title">
                              {f.numero}
                            </span>
                          </div>
                          <span
                            className="nvf-doc-product-line-reference"
                            style={{ fontFamily: "monospace" }}
                          >
                            {noFiscal
                              ? "SEM VALOR FISCAL"
                              : f.codigoHash?.substring(0, 18) ||
                                "Hash não registado"}
                          </span>
                        </td>
                        <td className="nvf-cell-desc">
                          <div
                            style={{
                              fontWeight: 600,
                              color: "#2f3640",
                              fontSize: 13,
                            }}
                          >
                            {f.clienteNome}
                          </div>
                          <span className="nvf-doc-product-line-reference">
                            {f.clienteNif
                              ? `NIF: ${f.clienteNif}`
                              : "Consumidor Final"}
                          </span>
                        </td>
                        <td className="nvf-cell-desc">
                          <div style={{ fontSize: 13 }}>{f.data}</div>
                          <span className="nvf-doc-product-line-reference">
                            Venc: {f.dataVencimento}
                          </span>
                        </td>
                        <td className="text-center">
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 10px",
                              borderRadius: 20,
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              background: isPaid
                                ? "#d4edda"
                                : isAnulada
                                  ? "#f8d7da"
                                  : f.estado === "rascunho"
                                    ? "#fff3cd"
                                    : "#d1ecf1",
                              color: isPaid
                                ? "#155724"
                                : isAnulada
                                  ? "#721c24"
                                  : f.estado === "rascunho"
                                    ? "#856404"
                                    : "#0c5460",
                            }}
                          >
                            {f.agtReplacementNo ? "Substituída" : f.estado}
                          </span>
                        </td>
                        <td
                          className="text-right"
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: "#2f3640",
                          }}
                        >
                          {formatCurrency(f.total, config.moeda)}
                        </td>
                        <td className="text-right" style={{ paddingRight: 20 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              gap: 4,
                            }}
                          >
                            <button
                              type="button"
                              title="Imprimir A4"
                              onClick={() => {
                                downloadFatura(
                                  generateFaturaHTML(f, config, {
                                    termica: false,
                                  }),
                                  f.numero,
                                );
                                logFaturacaoAction(
                                  f,
                                  "impressao",
                                  "Documento impresso",
                                  "Formato A4",
                                );
                              }}
                              className="nvf-qty-icon"
                              style={{ color: "#5b6470", padding: 6 }}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Térmico 80mm"
                              onClick={() =>
                                downloadFatura(
                                  generateFaturaHTML(f, config, {
                                    termica: true,
                                  }),
                                  `${f.numero}_termica`,
                                )
                              }
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#5b6470",
                                padding: 6,
                                fontFamily: "monospace",
                              }}
                            >
                              80mm
                            </button>
                            {f.clienteTelefone && (
                              <button
                                type="button"
                                title="Abrir WhatsApp"
                                onClick={() => handleWhatsAppDocumento(f)}
                                className="nvf-qty-icon"
                                style={{ color: "#334155", padding: 6 }}
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                            )}
                            {isProForma && (
                              <button
                                type="button"
                                title="Converter em Factura"
                                onClick={() => handleConverterProForma(f)}
                                style={{
                                  background: "#F39C12",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 4,
                                  padding: "4px 8px",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Converter FT
                              </button>
                            )}
                            {f.estado === "rascunho" &&
                              !f.proformaFinalizada && (
                                <button
                                  type="button"
                                  title="Editar rascunho"
                                  onClick={() => handleEditDraft(f)}
                                  className="nvf-qty-icon"
                                  style={{ color: "#1577EB", padding: 6 }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                            {!blockedSettlement &&
                              !isPaid &&
                              !isAnulada &&
                              !isProForma &&
                              f.estado !== "rascunho" && (
                                <button
                                  type="button"
                                  title="Marcar como Paga"
                                  onClick={async () => {
                                    if (
                                      !window.confirm(
                                        `Confirmar que ${f.numero} foi totalmente pago?`,
                                      )
                                    )
                                      return;
                                    const pago = await updateFatura(f.id, {
                                      estado: "paga",
                                    });
                                    if (pago)
                                      logFaturacaoAction(
                                        pago,
                                        "paga",
                                        "Pagamento registado",
                                        `Total ${formatCurrency(pago.total, config.moeda)}`,
                                      );
                                  }}
                                  className="nvf-qty-icon"
                                  style={{ color: "#28a745", padding: 6 }}
                                >
                                  <BadgeCheck className="w-4 h-4" />
                                </button>
                              )}
                            {!blockedSettlement &&
                              !isAnulada &&
                              !isProForma &&
                              f.estado !== "rascunho" &&
                              f.tipoDocumento !== "nota-credito" &&
                              !hasNC && (
                                <button
                                  type="button"
                                  title="Emitir Nota de Crédito"
                                  onClick={() => {
                                    setNcModal(f);
                                    setNcMotivo("");
                                    setNcQuantidades(
                                      Object.fromEntries(
                                        f.linhas.map((l, i) => [
                                          i,
                                          Math.abs(l.quantidade),
                                        ]),
                                      ),
                                    );
                                  }}
                                  className="nvf-qty-icon"
                                  style={{ color: "#fd7e14", padding: 6 }}
                                >
                                  <FileMinus2 className="w-4 h-4" />
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <nav aria-label="Páginas do histórico de facturação" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                <span>
                  A mostrar <strong>{invoiceListing.start}–{invoiceListing.end}</strong> de <strong>{invoiceListing.total}</strong> documentos
                </span>
                <div className="flex items-center gap-3">
                  <button type="button" className="nvf-btn" disabled={invoiceListing.page === 1} onClick={() => setInvoicePage(invoiceListing.page - 1)}>
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </button>
                  <span className="whitespace-nowrap">Página {invoiceListing.page} de {invoiceListing.pages}</span>
                  <button type="button" className="nvf-btn" disabled={invoiceListing.page >= invoiceListing.pages} onClick={() => setInvoicePage(invoiceListing.page + 1)}>
                    Seguinte <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </nav>
            </div>
          )}
        </div>

        <div className="nvf-help-footer">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onTrainingHelp?.();
            }}
          >
            <HelpCircle className="w-4 h-4" /> Precisa de Ajuda?
          </a>
        </div>
      </div>

      {/* Modais partilhados com list view (Catálogo / NC / Kits) */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#1577EB] text-white flex items-center justify-between rounded-t">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6" />
                <h3 className="font-bold text-lg">
                  Catálogo de Produtos{" "}
                  <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full font-mono">
                    {produtos.length} Itens
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Pesquisar..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-[#1577EB]"
                    autoFocus
                  />
                </div>
                <select
                  value={catalogCategory}
                  onChange={(e) => setCatalogCategory(e.target.value)}
                  className="w-full border border-gray-300 bg-white rounded px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#1577EB]"
                >
                  <option value="todas">Todas as Categorias</option>
                  {categorias.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {["todas", ...categorias].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategory(cat)}
                    className={`px-2.5 py-1 rounded text-xs border ${catalogCategory === cat ? "bg-blue-600 text-white" : "bg-white text-slate-700"}`}
                  >
                    {cat === "todas" ? "Todas" : cat}
                  </button>
                ))}
                <span className="text-xs text-gray-500 ml-auto">
                  {catalogFilteredProducts.length} itens encontrados
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 max-h-[55vh]">
              {catalogFilteredProducts.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold text-gray-600">
                    Nenhum item corresponde à pesquisa
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {catalogFilteredProducts.slice(0, 80).map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded border border-gray-200 hover:border-[#1577EB] hover:bg-blue-50/40 flex items-center justify-between gap-3 bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px] font-bold">
                            {p.codigo}
                          </span>
                          <span className="text-[10px] text-gray-500 truncate">
                            {p.categoria}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-gray-900 truncate">
                          {p.nome}
                        </div>
                        <div className="text-xs font-black text-[#1577EB] mt-1">
                          {formatCurrency(p.preco, config.moeda)}
                          <span className="text-[10px] text-gray-400 font-normal ml-1">
                            / {p.unidadeMedida} (Stock: {p.stock})
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleNovoDocumento("factura");
                          addItemToLinhas(p, 1);
                        }}
                        className="px-3 py-1.5 rounded text-xs font-bold shrink-0 flex items-center gap-1 bg-[#1577EB] hover:bg-[#0d5fc0] text-white"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end rounded-b">
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="px-5 py-2 bg-[#2f3640] hover:bg-[#1f242b] text-white rounded text-xs font-bold"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {ncModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 bg-orange-600 text-white flex items-center justify-between rounded-t">
              <h3 className="font-bold text-sm">
                Emitir Nota de Crédito para {ncModal.numero}
              </h3>
              <button
                type="button"
                onClick={() => setNcModal(null)}
                className="text-orange-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-orange-50 p-3 rounded border border-orange-200 text-xs text-orange-900">
                <div className="font-bold">Cliente: {ncModal.clienteNome}</div>
                <div>
                  Valor original: {formatCurrency(ncModal.total, config.moeda)}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-700">
                  Artigos e quantidades a creditar
                </p>
                <div className="max-h-44 space-y-2 overflow-y-auto rounded border border-gray-200 p-2">
                  {ncModal.linhas.map((linha, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded bg-gray-50 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-gray-800">
                          {linha.descricao}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {formatCurrency(linha.precoUnitario, config.moeda)} ·
                          disponível {Math.abs(linha.quantidade)}{" "}
                          {linha.unidade || "un"}
                        </p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={Math.abs(linha.quantidade)}
                        step="0.01"
                        value={ncQuantidades[index] ?? 0}
                        onChange={(ev) =>
                          setNcQuantidades((prev) => ({
                            ...prev,
                            [index]: Number(ev.target.value) || 0,
                          }))
                        }
                        className="h-9 w-20 rounded border border-gray-300 bg-white px-2 text-right text-xs font-bold outline-none focus:border-orange-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">
                  Motivo da Nota de Crédito (Exigido pela AGT) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={ncMotivo}
                  onChange={(e) => setNcMotivo(e.target.value)}
                  placeholder="Ex: Anulação por erro na quantidade, devolução de mercadoria..."
                  className="nvf-form-control"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setNcModal(null)}
                  className="flex-1 py-2 rounded bg-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmNotaCredito}
                  className="flex-1 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                >
                  Emitir Nota de Crédito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <KitsProcedimentosModal
        isOpen={showKitsModal}
        onClose={() => setShowKitsModal(false)}
        onInsertKit={handleInsertKit}
        currency={config.moeda}
      />
      {documentDialogs}
    </div>
  );
};
