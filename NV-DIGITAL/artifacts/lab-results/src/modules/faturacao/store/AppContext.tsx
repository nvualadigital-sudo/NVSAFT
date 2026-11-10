import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { reqDirect } from "../../../store/api";
import type {
  Fatura,
  Produto,
  PacienteCliente,
  ConfigSistema,
  UsuarioSistema,
  KitProduto,
  MovimentoStock,
  Notificacao,
  ConsumoMensalData,
} from "../types";
export const billingRequest = <T,>(method: string, path: string, body?: any) =>
  reqDirect<T>(method, "/billing-v2" + path, body);
export async function command<T = any>(
  path: string,
  body: any = {},
  method = "POST",
): Promise<T> {
  // Conserva a mesma chave numa repetição imediata após falha de rede.
  const { supervisorPassword: _secret, ...safeBody } = body;
  const key = JSON.stringify([method, path, safeBody]);
  let id = pending.get(key);
  if (!id) {
    id = crypto.randomUUID();
    pending.set(key, id);
  }
  try {
    const r = await billingRequest<T>(method, path, { ...body, requestId: id });
    pending.delete(key);
    return r;
  } catch (e) {
    throw e;
  }
}
const pending = new Map<string, string>();
type State = {
  faturas: Fatura[];
  produtos: Produto[];
  pacientes: PacienteCliente[];
  config: ConfigSistema;
  kits: KitProduto[];
  categorias: string[];
  currentUser: UsuarioSistema;
  movimentos: MovimentoStock[];
  notificacoes: Notificacao[];
};
type Ctx = State & {
  refresh: () => Promise<void>;
  addFatura: (d: Omit<Fatura, "id" | "numero">) => Promise<Fatura>;
  updateFatura: (id: number, d: Partial<Fatura>) => Promise<Fatura>;
  removeFatura: (id: number) => Promise<void>;
  addPaciente: (d: Omit<PacienteCliente, "id">) => Promise<PacienteCliente>;
  updatePaciente: (id: number, d: Partial<PacienteCliente>) => Promise<void>;
  addProduto: (d: Omit<Produto, "id">) => Promise<Produto>;
  updateProduto: (id: number, d: Partial<Produto>) => Promise<void>;
  updateConfig: (d: Partial<ConfigSistema>) => Promise<void>;
  findProdutoByBarcodeOrCode: (s: string) => Produto | undefined;
  addKit: (d: Omit<KitProduto, "id"> | KitProduto) => Promise<KitProduto>;
  updateKit: (id: string, d: Partial<KitProduto>) => Promise<KitProduto>;
  deleteKit: (id: string) => Promise<void>;
  saveCategory: (nome: string, anterior?: string) => Promise<void>;
  deleteCategory: (nome: string) => Promise<void>;
  consumoMensalData: ConsumoMensalData[];
};
const Context = createContext<Ctx | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(0);
  const mounted = useRef(true),
    revision = useRef(0),
    fetching = useRef(0),
    count = useRef(0),
    blockingCount = useRef(0),
    lastRefreshedAt = useRef(0),
    refreshTimer = useRef<number | null>(null);
  const refresh = useCallback(async () => {
    const seq = ++fetching.current,
      r = revision.current;
    const data = await billingRequest<State>("GET", "/state");
    if (mounted.current && seq === fetching.current && r === revision.current) {
      setState(data);
      lastRefreshedAt.current = Date.now();
      (window as any).__nvBillingAudit = (data as any).audit || {};
      setError("");
    }
  }, []);
  const scheduleRefresh = useCallback((wait = 1200) => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      if (count.current > 0) {
        scheduleRefresh(1800);
        return;
      }
      void refresh().catch(() =>
        setError("Operação guardada. A actualização dos saldos será repetida quando a ligação regressar."),
      );
    }, wait);
  }, [refresh]);
  useEffect(() => {
    mounted.current = true;
    void refresh().catch((e) => setError(e.message));
    const tick = window.setInterval(() => {
      if (count.current === 0 && document.visibilityState === "visible")
        void refresh().catch((e) => setError(e.message));
    }, 60000);
    // Regressar frequentemente à aba não deve descarregar o estado completo
    // repetidamente enquanto os dados ainda são recentes.
    const onFocus = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshedAt.current > 30000)
        scheduleRefresh(1000);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      mounted.current = false;
      (window as any).__nvBillingAudit = {};
      window.clearInterval(tick);
      window.removeEventListener("focus", onFocus);
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    };
  }, [refresh, scheduleRefresh]);
  async function mutate<T>(
    path: string,
    b: any,
    method = "POST",
    update: "full" | "invoice" | "draft" | "delete-invoice" = "full",
  ): Promise<T> {
    // O auto-guardar de rascunhos não pode bloquear os campos enquanto o
    // utilizador continua a introduzir linhas; confirmações fiscais mantêm bloqueio.
    const blocksInterface = update !== "draft";
    count.current++;
    revision.current++;
    if (blocksInterface) {
      blockingCount.current++;
      setBusy(blockingCount.current);
    }
    try {
      const r = await command<T>(path, b, method);
      if ((update === "invoice" || update === "draft") && (r as any)?.fatura) {
        const invoice = (r as any).fatura as Fatura;
        setState((previous) => previous && ({
          ...previous,
          faturas: [invoice, ...previous.faturas.filter((f) => f.id !== invoice.id)],
        }));
        // Rascunhos são guardados frequentemente e não necessitam de descarregar
        // todos os pacientes, produtos, caixas e documentos após cada gravação.
        if (update === "invoice") scheduleRefresh();
      } else if (update === "delete-invoice") {
        const id = Number(path.split("/").pop());
        setState((previous) => previous && ({
          ...previous,
          faturas: previous.faturas.filter((f) => f.id !== id),
        }));
        scheduleRefresh();
      } else {
        // Operações de configuração/caixa conservam a sincronização completa.
        await refresh().catch(() =>
          setError("Operação registada. A lista será actualizada quando a ligação regressar."),
        );
      }
      return r;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      count.current--;
      if (blocksInterface) {
        blockingCount.current--;
        if (mounted.current) setBusy(blockingCount.current);
      }
    }
  }
  if (!state)
    return (
      <div className="p-6">
        <p>{error || "A carregar a facturação da instituição…"}</p>
        <button
          onClick={() => void refresh().catch((e) => setError(e.message))}
        >
          Tentar novamente
        </button>
      </div>
    );
  async function updateConfig(d: Partial<ConfigSistema>) {
    if (
      Object.prototype.hasOwnProperty.call(d, "caixaSessaoAtual") ||
      d.historicoCaixa
    )
      throw new Error(
        "O caixa é controlado pelas operações de abertura, movimento e fecho no servidor.",
      );
    await mutate("/config", { patch: d });
  }
  const value: Ctx = {
    ...state,
    refresh,
    consumoMensalData: [],
    addFatura: async (d) => {
      const input: any = { ...d };
      if (input.tipoDocumento === "nota-credito") {
        input.linhas = input.linhas.map((l: any) => ({
          ...l,
          quantidade: -Math.abs(l.quantidade),
        }));
        const origin = state.faturas.find(
          (f) => f.numero === input.documentoOrigem,
        );
        if (origin) input.desconto = origin.desconto || 0;
      }
      if (input.tipoDocumento === "nota-credito" && !input.provaConhecimento) {
        const proof = window.prompt(
          "Referência da prova de conhecimento do adquirente (email, carta ou assinatura arquivada):",
        );
        if (!proof)
          throw new Error(
            "A nota de crédito exige prova de conhecimento do adquirente.",
          );
        input.provaConhecimento = proof;
      }
      const r = await mutate<{ fatura: Fatura }>("/documents", {
        document: input,
      }, "POST", input.estado === "rascunho" ? "draft" : "invoice");
      return r.fatura;
    },
    updateFatura: async (id, d) => {
      const input: any = { ...d };
      if (d.estado === "paga") {
        const f = state.faturas.find((x) => x.id === id);
        if (f?.estado !== "rascunho") {
          if (
            f?.insured ||
            (typeof f?.receivableBalance === "number" &&
              f.receivableBalance < f.total)
          )
            throw new Error(
              "Registe os recebimentos por pagador ou pelo saldo em Seguradoras → Cobrança / Extractos.",
            );
          const forma = window.prompt(
            "Forma de pagamento: Numerário, Multicaixa (TPA) ou Transferência Bancária",
            "Numerário",
          );
          if (!forma) throw new Error("Recebimento cancelado.");
          const reference =
            forma === "Numerário"
              ? ""
              : window.prompt(
                  "Referência do pagamento confirmado no banco/TPA:",
                );
          input.formaPagamento = forma;
          input.formasPagamentoDetalhe = [
            {
              id: crypto.randomUUID(),
              forma,
              valor: f?.total,
              referencia: reference,
            },
          ];
        }
      }
      const r = await mutate<{ fatura: Fatura }>(`/documents/${id}`, {
        document: input,
      }, "POST", input.estado === "rascunho" ? "draft" : "invoice");
      return r.fatura;
    },
    removeFatura: async (id) => {
      await mutate(`/documents/${id}`, {}, "DELETE", "delete-invoice");
    },
    addPaciente: (d) => mutate<PacienteCliente>("/clients", { client: d }),
    updatePaciente: async (id, d) => {
      await mutate("/clients", {
        client: { ...state.pacientes.find((x) => x.id === id), ...d, id },
      });
    },
    addProduto: (d) => mutate<Produto>("/products", { product: d }),
    updateProduto: async (id, d) => {
      await mutate("/products", {
        product: { ...state.produtos.find((x) => x.id === id), ...d, id },
      });
    },
    updateConfig,
    findProdutoByBarcodeOrCode: (s) =>
      state.produtos.find(
        (p) => p.ativo && (p.codigo === s || p.codigoBarras === s),
      ),
    addKit: (d) => mutate<KitProduto>("/kits", { kit: d }),
    updateKit: (id, d) =>
      mutate<KitProduto>("/kits", {
        kit: { ...state.kits.find((k) => k.id === id), ...d, id },
      }),
    deleteKit: async (id) => {
      const kit = state.kits.find((k) => k.id === id);
      await mutate(
        "/kits/" + encodeURIComponent(id),
        { revision: kit?.revision || 0 },
        "DELETE",
      );
    },
    saveCategory: async (nome, anterior) => {
      await mutate("/categories", { nome, anterior });
    },
    deleteCategory: async (nome) => {
      await mutate("/categories", { nome }, "DELETE");
    },
  };
  return (
    <Context.Provider value={value}>
      {error && (
        <div
          role="alert"
          className="m-3 rounded border border-red-300 bg-red-50 p-3 text-red-800"
        >
          {error}
          <button
            className="ml-3 underline"
            onClick={() => void refresh().catch((e) => setError(e.message))}
          >
            Actualizar dados
          </button>
        </div>
      )}
      <div
        aria-busy={busy > 0}
        style={busy ? { pointerEvents: "none", opacity: 0.65 } : undefined}
      >
        {children}
      </div>
      {busy > 0 && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-[200] rounded bg-slate-900 p-3 text-white"
        >
          A confirmar no servidor…
        </div>
      )}
    </Context.Provider>
  );
}
export function useApp() {
  const c = useContext(Context);
  if (!c) throw new Error("Módulo de facturação não inicializado.");
  return c;
}
