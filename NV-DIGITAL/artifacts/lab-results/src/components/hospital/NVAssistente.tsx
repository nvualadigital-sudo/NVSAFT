import { useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff, Paperclip, Send, Sparkles, Square, Volume2, VolumeX, X } from "lucide-react";
import { reqDirect } from "../../store/api";
import CatalogImportDialog from "./CatalogImportDialog";

type Phase = "ready" | "wake" | "listening" | "thinking" | "speaking" | "confirmation" | "error";
type Line = { id: number; role: "user" | "assistant"; text: string; source?: string };
type Command = { kind: "navigate" | "proposal" | "help" | "unknown"; message: string; module?: string; text?: string; tool?: string };
type Pending = { actionId: string; summary: string; preview: string; expiresAt: string };

export default function NVAssistente({ companyName, modules, navigate }: { companyName?: string; modules: string[]; navigate: (module: string) => void }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [text, setText] = useState("");
  const [lines, setLines] = useState<Line[]>([{ id: 0, role: "assistant", text: "Olá! Sou o NV-ASSISTENTE. Posso abrir módulos e preparar mensagens à equipa. Diga «ajuda» para conhecer os comandos." }]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState(false);
  const [consent, setConsent] = useState(false);
  const [voice, setVoice] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const count = useRef(1), request = useRef(0), recognizer = useRef<any>(null);
  const active = useRef(false), armed = useRef(false), microphone = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const end = useRef<HTMLDivElement>(null);

  function append(role: Line["role"], text: string, source?: string) {
    setLines((entries) => [...entries.slice(-39), { id: count.current++, role, text, source }]);
  }
  function silence() { window.speechSynthesis?.cancel(); }
  function stopMic() {
    microphone.current = false; armed.current = false;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    const current = recognizer.current;
    recognizer.current = null;
    try { current?.abort(); } catch { /* browser may have already stopped */ }
  }
  function close() {
    active.current = false; request.current++;
    // O cartão desaparece ao fechar e o pedido pendente é também invalidado na API.
    if (pending) void reqDirect("POST", `/ai/actions/${pending.actionId}/cancel`, {}).catch(() => {});
    stopMic(); silence(); setPending(null); setConsent(false); setError(""); setBusy(false); setImportOpen(false); setOpen(false); setPhase("ready");
  }
  function say(words: string) {
    if (!voice || !active.current || !window.speechSynthesis) return;
    silence();
    const speech = new SpeechSynthesisUtterance(words);
    speech.lang = "pt-PT"; speech.rate = 1;
    speech.onend = () => setPhase((s) => s === "speaking" ? "ready" : s);
    speech.onerror = () => setPhase((s) => s === "speaking" ? "ready" : s);
    setPhase("speaking"); window.speechSynthesis.speak(speech);
  }
  async function submit(input: string) {
    const message = input.trim();
    if (!message || busy || pending || message.length > 4000) return;
    const turn = ++request.current;
    setBusy(true); setText(""); setError(""); setPhase("thinking"); append("user", message);
    try {
      const command = await reqDirect<Command>("POST", "/ai/commands", { message });
      if (!active.current || turn !== request.current) return;
      if (command.kind === "navigate" && command.module) {
        if (modules.includes(command.module)) { navigate(command.module); append("assistant", command.message); say(command.message); }
        else append("assistant", "Este módulo não está disponível para o seu perfil.");
      } else if (command.kind === "proposal" && command.tool === "chat.send_team" && command.text) {
        const prepared = await reqDirect<Pending>("POST", "/ai/actions/prepare", { tool: command.tool, text: command.text });
        if (!active.current || turn !== request.current) {
          void reqDirect("POST", `/ai/actions/${prepared.actionId}/cancel`, {}).catch(() => {});
          return;
        }
        setPending(prepared); setPhase("confirmation"); append("assistant", command.message);
        return;
      } else if (command.kind === "help") { append("assistant", command.message); say(command.message); }
      else if (model && consent) {
        const answer = await reqDirect<{ message: string; source: string }>("POST", "/ai/assistente", { message, externalProcessingApproved: true });
        if (!active.current || turn !== request.current) return;
        append("assistant", answer.message, answer.source); say(answer.message);
      } else append("assistant", "Posso abrir módulos e preparar mensagens à equipa. Para conversação livre, a IA externa deve estar configurada e o envio autorizado.");
      setPhase((s) => s === "speaking" ? s : "ready");
    } catch (ex: any) { if (active.current && turn === request.current) { setError(ex?.message || "O serviço não respondeu."); setPhase("error"); } }
    finally { if (turn === request.current) setBusy(false); }
  }
  function listen(wakeMode: boolean) {
    const API = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!API) { setError("O navegador não suporta reconhecimento de voz. Use o texto."); return; }
    if (!window.confirm("O navegador pode processar áudio através de terceiros. Não dite dados de pacientes. Autoriza o microfone somente nesta sessão?")) return;
    stopMic(); silence(); setError("");
    const instance = new API();
    instance.lang = "pt-PT"; instance.interimResults = false; instance.continuous = wakeMode;
    recognizer.current = instance; microphone.current = true; armed.current = wakeMode;
    setPhase(wakeMode ? "wake" : "listening");
    if (wakeMode) timeout.current = setTimeout(() => { stopMic(); setPhase("ready"); }, 15 * 60_000);
    instance.onresult = (e: any) => {
      for (let i = e.resultIndex ?? 0; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const heard = String(e.results[i][0].transcript || "").trim();
        if (!heard) continue;
        if (armed.current) {
          const match = /(?:olá|ola)\s+n\s*v\b/i.exec(heard);
          if (!match) continue;
          armed.current = false; setPhase("listening");
          const rest = heard.slice(match.index + match[0].length).trim();
          if (rest) { stopMic(); void submit(rest); }
          continue;
        }
        stopMic(); void submit(heard); return;
      }
    };
    instance.onerror = (e: any) => { if (!microphone.current) return; stopMic(); setPhase("error"); setError(e.error === "not-allowed" ? "Permissão do microfone recusada." : "A escuta terminou; continue por texto."); };
    instance.onend = () => { if (microphone.current) { stopMic(); setPhase("ready"); } };
    try { instance.start(); } catch { stopMic(); setPhase("error"); setError("Não foi possível iniciar a escuta."); }
  }
  async function decide(confirm: boolean) {
    if (!pending || busy) return;
    setBusy(true); setError("");
    try {
      await reqDirect("POST", `/ai/actions/${pending.actionId}/${confirm ? "confirm" : "cancel"}`, {});
      if (active.current) { setPending(null); setPhase("ready"); append("assistant", confirm ? "Mensagem enviada ao canal da equipa e registada." : "Acção cancelada; nada foi enviado."); }
    } catch (ex: any) { setError(ex?.message || "Não foi possível concluir a operação."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const openPanel = () => { active.current = true; setOpen(true); };
    window.addEventListener("nv:assistant-open", openPanel);
    return () => { window.removeEventListener("nv:assistant-open", openPanel); active.current = false; request.current++; stopMic(); silence(); };
  }, []);
  useEffect(() => { if (open) void reqDirect<{ model: boolean }>("GET", "/ai/capabilities").then((r) => setModel(r.model)).catch(() => setModel(false)); }, [open]);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: "end" }); }, [lines, open, pending]);

  if (!open) return null;
  return <section id="nv-assistant" role="dialog" aria-label="NV-ASSISTENTE" className="nv-assistant nv-agent-panel">
    <header className="nv-agent-heading"><span className="nv-agent-logo"><Sparkles size={20} /></span><div><strong>NV-ASSISTENTE</strong><small>{companyName || "Instituição activa"}</small></div><button type="button" onClick={close} aria-label="Fechar o assistente"><X size={19} /></button></header>
    <div className="nv-agent-hero"><div className={`nv-agent-orb nv-agent-orb-${phase}`} role="img" aria-label={`Estado: ${phase}`}><span /></div><strong>{phase === "wake" ? "Diga «Olá NV»" : phase === "listening" ? "Estou a ouvir" : phase === "thinking" ? "A preparar resposta…" : phase === "confirmation" ? "Confirmar a operação" : phase === "speaking" ? "A responder" : "Como posso ajudar?"}</strong><small>{microphone.current ? "Microfone activo nesta sessão" : "Voz e texto · Identidade institucional"}</small></div>
    <div className="nv-agent-transcript" role="log" aria-live="polite">{lines.map((line) => <div key={line.id} className={`nv-agent-line nv-agent-${line.role}`}><p>{line.text}</p>{line.source && <small>{line.source}</small>}</div>)}
      {pending && <div className="nv-agent-confirm"><strong>{pending.summary}</strong><p>{pending.preview}</p><small>Válido até {new Date(pending.expiresAt).toLocaleTimeString("pt-PT")}. Confirme depois de rever o texto.</small><div><button type="button" disabled={busy} onClick={() => void decide(false)}>Cancelar</button><button type="button" disabled={busy} onClick={() => void decide(true)}><Check size={15} /> Confirmar envio</button></div></div>}<div ref={end} />
    </div>
    {error && <p className="nv-agent-error" role="alert">{error}</p>}
    <form className="nv-agent-form" onSubmit={(e) => { e.preventDefault(); void submit(text); }}><label htmlFor="nv-agent-text">Escreva ou dite um comando</label><div className="nv-agent-compose"><textarea id="nv-agent-text" rows={2} maxLength={4000} value={text} placeholder="Ex.: abrir laboratório" onChange={(e) => setText(e.target.value)} /><button type="submit" disabled={busy || !!pending || !text.trim()} aria-label="Enviar"><Send size={18} /></button></div>
      <div className="nv-agent-controls"><button type="button" disabled={busy || !!pending || microphone.current} onClick={() => listen(false)}><Mic size={16} /> Falar</button><button type="button" disabled={busy || !!pending || microphone.current} onClick={() => listen(true)}><Sparkles size={16} /> «Olá NV»</button>{microphone.current && <button type="button" onClick={() => { stopMic(); setPhase("ready"); }}><MicOff size={16} /> Parar</button>}<button type="button" aria-pressed={voice} onClick={() => { setVoice((x) => !x); silence(); }}>{voice ? <Volume2 size={16} /> : <VolumeX size={16} />}{voice ? "Voz ligada" : "Sem áudio"}</button>{phase === "speaking" && <button type="button" onClick={() => { silence(); setPhase("ready"); }}><Square size={16} /> Interromper</button>}<button type="button" disabled={busy || !!pending} onClick={() => setImportOpen(true)}><Paperclip size={16} /> Importar exames/preços</button></div>
      <label className="nv-agent-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Autorizo o envio de perguntas sem dados de pacientes ao fornecedor de IA. {model ? "IA disponível." : "IA externa não configurada."}</label>
    </form>
    {importOpen && <CatalogImportDialog onClose={() => setImportOpen(false)} onSaved={(importados, ignorados) => {
      setImportOpen(false);
      append("assistant", `${importados} produto(s) importado(s) na empresa actual; ${ignorados} já existiam. Os preços de outras empresas não foram alterados.`);
      window.dispatchEvent(new Event("nv:catalog-updated"));
    }} />}
  </section>;
}
