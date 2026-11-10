import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight, CalendarDays, CheckCheck, ClipboardList, FileText,
  Handshake, MessageCircle, Plus, RefreshCw, Send, ShieldCheck,
  Stethoscope, XCircle,
} from "lucide-react";
import { useApp } from "../../store/AppContext";
import type { Session } from "../../store/auth";
import { displayReference } from "../../utils/displayReference";
import { hospitalApi, input, Notice, useResource } from "./shared";

type RequestType = "partilha" | "exame" | "consulta";
type Status = "partilhado" | "pendente" | "aceite" | "recusado" | "em_execucao" | "concluido" | "cancelado";
type Share = {
  id: string;
  source_empresa_id: string;
  target_empresa_id: string;
  source_name: string;
  target_name: string;
  subject: string;
  request_type: RequestType;
  status: Status;
  created_at: string;
  revoked_at: string | null;
};
type Detail = Share & { body: string; basis: string };
type Message = {
  id: string;
  sender_empresa_id: string;
  sender: string;
  sender_name: string;
  body: string;
  created_at: string;
};

const kindLabel: Record<RequestType, string> = {
  partilha: "Partilha clínica",
  exame: "Pedido de exames",
  consulta: "Consulta ao parceiro",
};
const statusLabel: Record<Status, string> = {
  partilhado: "Disponível",
  pendente: "A aguardar resposta",
  aceite: "Aceite pelo parceiro",
  recusado: "Recusado",
  em_execucao: "Em execução",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
const statusColor: Record<Status, string> = {
  partilhado: "bg-teal-50 text-teal-800 border-teal-200",
  pendente: "bg-amber-50 text-amber-800 border-amber-200",
  aceite: "bg-sky-50 text-sky-800 border-sky-200",
  recusado: "bg-rose-50 text-rose-800 border-rose-200",
  em_execucao: "bg-indigo-50 text-indigo-800 border-indigo-200",
  concluido: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelado: "bg-slate-100 text-slate-700 border-slate-200",
};
const btn = "inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50";
const ghost = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-400 hover:bg-teal-50 disabled:opacity-50";
const dateTime = (value: string) => new Date(value).toLocaleString("pt-AO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const errorText = (value: unknown) => value instanceof Error ? value.message : "Não foi possível concluir a operação.";

export default function Medlik({ session }: { session?: Session }) {
  const { data } = useApp();
  const list = useResource<Share[]>("/medlink", []);
  const directory = useResource<{ id: string; nome: string }[]>("/medlink/directory", []);
  const [tab, setTab] = useState<"recebidos" | "enviados" | "novo">("recebidos");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ signature: string; id: string } | null>(null);
  const pendingMessage = useRef<{ signature: string; id: string } | null>(null);
  const [form, setForm] = useState({
    requestType: "exame" as RequestType,
    patientId: "",
    targetId: "",
    subject: "",
    body: "",
    basis: "",
    confirmed: false,
  });
  const allowed = ["admin", "gestor", "medico"].includes(session?.funcao || "");
  const rows = list.data.filter((s) => tab === "recebidos"
    ? s.target_empresa_id === session?.empresaId
    : s.source_empresa_id === session?.empresaId);
  const active = list.data.find((s) => s.id === activeId);
  const isTarget = active?.target_empresa_id === session?.empresaId;

  const loadConversation = useCallback(async (id: string) => {
    const [item, chat] = await Promise.all([
      hospitalApi<Detail>("GET", `/medlink/${id}`),
      hospitalApi<Message[]>("GET", `/medlink/${id}/messages`),
    ]);
    setDetail(item);
    setMessages(chat.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    const sync = async () => {
      try {
        const [item, chat] = await Promise.all([
          hospitalApi<Detail>("GET", `/medlink/${activeId}`),
          hospitalApi<Message[]>("GET", `/medlink/${activeId}/messages`),
        ]);
        if (live) {
          setDetail(item);
          setMessages(chat.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
        }
      } catch (e) { if (live) setError(errorText(e)); }
    };
    void sync();
    const timer = window.setInterval(() => { if (!document.hidden) void sync(); }, 10000);
    return () => { live = false; window.clearInterval(timer); };
  }, [activeId]);

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try { await task(); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!allowed || !form.confirmed || !form.patientId || !form.targetId) return;
    await run(async () => {
      const payload = { ...form, patientId: Number(form.patientId) };
      const signature = JSON.stringify(payload);
      if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
      await hospitalApi("POST", "/medlink", { ...payload, requestId: pending.current.id });
      pending.current = null;
      await list.load();
      setForm((old) => ({ ...old, subject: "", body: "", basis: "", confirmed: false }));
      setNotice("Pedido enviado ao parceiro e registado na auditoria.");
      setTab("enviados");
      setActiveId(null);
    });
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!activeId || !draft.trim() || !allowed) return;
    await run(async () => {
      const body = draft.trim(), signature = activeId + ":" + body;
      if (pendingMessage.current?.signature !== signature)
        pendingMessage.current = { signature, id: crypto.randomUUID() };
      await hospitalApi("POST", `/medlink/${activeId}/messages`, { body, requestId: pendingMessage.current.id });
      pendingMessage.current = null;
      setDraft("");
      await loadConversation(activeId);
    });
  }

  async function updateStatus(status: Status) {
    if (!activeId) return;
    await run(async () => {
      await hospitalApi("POST", `/medlink/${activeId}/status`, { status });
      await Promise.all([list.load(), loadConversation(activeId)]);
      setNotice(`Pedido actualizado: ${statusLabel[status]}.`);
    });
  }

  async function revoke() {
    if (!activeId || !window.confirm("Revogar o acesso futuro deste parceiro?")) return;
    await run(async () => {
      await hospitalApi("DELETE", `/medlink/${activeId}`);
      setActiveId(null);
      setDetail(null);
      setMessages([]);
      await list.load();
      setNotice("Acesso revogado. O registo permanece na auditoria.");
    });
  }

  const canAct = allowed && active && !active.revoked_at && active.request_type !== "partilha";
  const targetActions: Status[] = active?.status === "pendente" ? ["aceite", "recusado"]
    : active?.status === "aceite" ? ["em_execucao", "concluido"]
    : active?.status === "em_execucao" ? ["concluido"] : [];

  return (
    <section className="space-y-5 bg-slate-50 p-4 text-slate-800 md:p-6" aria-label="MedLink — colaboração interinstitucional">
      <header className="rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-teal-100"><Handshake size={16} /> Rede de parceiros</div>
            <h1 className="text-2xl font-bold tracking-tight">MedLink</h1>
            <p className="mt-1 max-w-2xl text-sm text-teal-50">Pedidos de exames, consultas a parceiros e comunicação segura entre instituições.</p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm">
            <div className="font-semibold">{session?.empresaNome || "Instituição activa"}</div>
            <div className="text-xs text-teal-100">Dados clínicos partilhados apenas com autorização</div>
          </div>
        </div>
      </header>

      <Notice error={error || list.error || directory.error} message={notice} />

      <nav className="flex flex-wrap items-center gap-2" aria-label="Caixas do MedLink">
        {(["recebidos", "enviados", "novo"] as const).map((item) => (
          <button key={item} type="button"
            className={tab === item ? btn : ghost}
            onClick={() => { setTab(item); setActiveId(null); setDetail(null); setMessages([]); setNotice(""); }}>
            {item === "recebidos" ? <ClipboardList size={16} /> : item === "enviados" ? <Send size={16} /> : <Plus size={16} />}
            {item === "recebidos" ? `Recebidos (${list.data.filter((s) => s.target_empresa_id === session?.empresaId).length})`
              : item === "enviados" ? `Enviados (${list.data.filter((s) => s.source_empresa_id === session?.empresaId).length})` : "Novo pedido"}
          </button>
        ))}
        <button type="button" className={`${ghost} ml-auto`} onClick={() => void Promise.all([list.load(), directory.load()])} title="Actualizar lista"><RefreshCw size={16} /> Actualizar</button>
      </nav>

      {tab === "novo" ? (
        <form onSubmit={(e) => void create(e)} className="mx-auto grid max-w-4xl gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 md:p-7">
          <div className="md:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Stethoscope size={20} className="text-teal-700"/> Solicitação institucional</h2>
            <p className="mt-1 text-sm text-slate-500">O pedido fica associado ao paciente da unidade de origem. O parceiro vê apenas o conteúdo autorizado.</p>
          </div>
          <label className="space-y-1 text-sm font-medium">Tipo de operação
            <select className={input} value={form.requestType} onChange={(e) => setForm({ ...form, requestType: e.target.value as RequestType })}>
              <option value="exame">Pedido de exames / laboratório</option>
              <option value="consulta">Pedido de consulta especializada</option>
              <option value="partilha">Partilha clínica autorizada</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">Instituição parceira
            <select required className={input} value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
              <option value="">Seleccione a instituição</option>
              {directory.data.filter((c) => c.id !== session?.empresaId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">Paciente da instituição
            <select required className={input} value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
              <option value="">Seleccione o paciente</option>
              {data.pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome} · {p.processo}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">Assunto / procedimento pretendido
            <input required maxLength={200} className={input} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Ex.: Hemograma completo ou consulta de cardiologia" />
          </label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">Informação estritamente necessária para o parceiro
            <textarea required maxLength={30000} rows={5} className={input} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Motivo, exames solicitados, prioridade, datas sugeridas e informações clínicas necessárias" />
          </label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">Fundamento e referência da autorização
            <textarea required maxLength={1000} rows={2} className={input} value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value })} placeholder="Registe o consentimento ou outra autorização institucional aplicável" />
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm md:col-span-2">
            <input type="checkbox" checked={form.confirmed} onChange={(e) => setForm({ ...form, confirmed: e.target.checked })} className="mt-1"/>
            <span><strong>Conferência obrigatória.</strong> Confirmei a identidade do paciente, o destinatário, a finalidade e a autorização para divulgar este conteúdo.</span>
          </label>
          <button className={`${btn} md:col-span-2`} disabled={busy || !allowed || !form.confirmed}><Send size={17}/> Enviar {kindLabel[form.requestType].toLowerCase()}</button>
          {!allowed && <p className="text-sm text-rose-700 md:col-span-2">O envio exige perfil médico ou gestor autorizado.</p>}
        </form>
      ) : (
        <div className="grid min-h-[500px] gap-4 lg:grid-cols-[minmax(260px,380px)_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold">{tab === "recebidos" ? "Pedidos recebidos" : "Pedidos enviados"}</h2><p className="text-xs text-slate-500">{rows.length} registos da instituição</p></div>
            <div className="max-h-[650px] space-y-1 overflow-y-auto p-2">
              {rows.length === 0 && !list.loading && !list.error && <p className="p-6 text-center text-sm text-slate-500">Ainda não há pedidos nesta caixa.</p>}
              {rows.map((s) => <button key={s.id} type="button" className={`block w-full rounded-xl border p-3 text-left transition ${activeId === s.id ? "border-teal-300 bg-teal-50" : "border-transparent hover:bg-slate-50"}`} onClick={() => { setActiveId(s.id); setDetail(null); setMessages([]); setError(""); }}>
                <div className="mb-1 flex items-center justify-between gap-2"><span className="flex items-center gap-1 text-xs font-medium text-slate-500">{s.request_type === "consulta" ? <CalendarDays size={13}/> : <FileText size={13}/>} {kindLabel[s.request_type] || "Partilha clínica"}</span><span className="text-[11px] text-slate-400">{dateTime(s.created_at)}</span></div>
                <div className="truncate font-semibold text-slate-900">{s.subject}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{tab === "recebidos" ? s.source_name : s.target_name}</div>
                <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusColor[s.status] || statusColor.partilhado}`}>{s.revoked_at ? "Revogado" : statusLabel[s.status] || "Disponível"}</span>
              </button>)}
            </div>
          </aside>
          <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {!activeId ? <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-slate-500"><div className="rounded-2xl bg-teal-50 p-5 text-teal-700"><Handshake size={36}/></div><h2 className="text-lg font-bold text-slate-800">Seleccione uma colaboração</h2><p className="max-w-sm text-sm">Veja o pedido, acompanhe a resposta do parceiro e troque mensagens com profissionais autorizados.</p></div> : !detail ? <p className="p-6 text-sm text-slate-500">A carregar conversa e autorização…</p> : <>
              <header className="border-b border-slate-100 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-semibold uppercase tracking-wide text-teal-700">{kindLabel[detail.request_type] || "Partilha clínica"}</span><h2 className="mt-1 text-xl font-bold">{detail.subject}</h2><p className="mt-1 flex items-center gap-2 text-sm text-slate-500">{detail.source_name} <ArrowRight size={14}/> {detail.target_name}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusColor[detail.status] || statusColor.partilhado}`}>{detail.revoked_at ? "Revogada" : statusLabel[detail.status]}</span></div>
                <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{detail.body}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span><ShieldCheck size={13} className="mr-1 inline"/> Fundamento: {detail.basis}</span><span title={detail.id}>Ref. {displayReference(detail.id)}</span></div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {canAct && isTarget && targetActions.map((status) => <button key={status} type="button" className={status === "recusado" ? ghost : btn} disabled={busy} onClick={() => void updateStatus(status)}>{status === "recusado" ? <XCircle size={15}/> : <CheckCheck size={15}/>} {statusLabel[status]}</button>)}
                  {canAct && !isTarget && ["pendente", "aceite", "em_execucao"].includes(detail.status) && <button type="button" className={ghost} disabled={busy} onClick={() => void updateStatus("cancelado")}>Cancelar pedido</button>}
                  {allowed && !isTarget && !detail.revoked_at && <button type="button" className={ghost} disabled={busy} onClick={() => void revoke()}>Revogar acesso</button>}
                </div>
              </header>
              <div className="flex flex-1 flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h3 className="flex items-center gap-2 font-semibold"><MessageCircle size={17} className="text-teal-700"/> Mensagens com o parceiro</h3><span className="text-xs text-slate-500">Ordem cronológica de envio</span></div>
                <div className="max-h-[350px] min-h-[170px] flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 md:p-5">
                  {!messages.length && <p className="p-4 text-center text-sm text-slate-500">Sem mensagens. Pode esclarecer o pedido directamente com a instituição parceira.</p>}
                  {messages.map((m) => <div key={m.id} className={`flex ${m.sender_empresa_id === session?.empresaId ? "justify-end" : "justify-start"}`}><div className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-sm md:max-w-[78%] ${m.sender_empresa_id === session?.empresaId ? "rounded-br-sm bg-teal-700 text-white" : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"}`}><p className={`text-xs font-semibold ${m.sender_empresa_id === session?.empresaId ? "text-teal-100" : "text-teal-700"}`}>{m.sender_name} · {m.sender_empresa_id === detail.source_empresa_id ? detail.source_name : detail.target_name}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.body}</p><time className={`mt-2 block text-right text-[11px] ${m.sender_empresa_id === session?.empresaId ? "text-teal-100" : "text-slate-400"}`}>{dateTime(m.created_at)}</time></div></div>)}
                </div>
                <form onSubmit={(e) => void sendMessage(e)} className="flex items-end gap-2 border-t border-slate-100 bg-white p-4"><label className="flex-1 text-xs text-slate-500">Mensagem institucional
                  <textarea className={`${input} mt-1 resize-y`} rows={2} maxLength={4000} disabled={!allowed || Boolean(detail.revoked_at)} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreva a resposta ao parceiro…" />
                </label><button type="submit" className={btn} disabled={busy || !allowed || !draft.trim() || Boolean(detail.revoked_at)} aria-label="Enviar mensagem"><Send size={18}/></button></form>
              </div>
            </>}
          </article>
        </div>
      )}
      <footer className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500"><ShieldCheck size={16} className="shrink-0 text-teal-700"/> Cada pedido tem destinatário, autorização, estados auditáveis e conversa limitada às duas instituições. Revogar impede novas leituras; não elimina cópias já consultadas. Chamadas de voz/vídeo interinstitucionais exigem uma autorização e sinalização próprias e não são activadas neste circuito.</footer>
    </section>
  );
}
