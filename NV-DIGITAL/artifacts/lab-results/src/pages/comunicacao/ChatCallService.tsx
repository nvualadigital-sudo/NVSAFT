import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Bell,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { CallSounds } from "./callSounds";
import "./ChatCallService.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { hospitalApi } from "../../store/hospital";

export type CallInvite = {
  peer: string;
  name: string;
  kind: "voice" | "video";
};
export const inviteCall = (invite: CallInvite) =>
  window.dispatchEvent(new CustomEvent("nv:call:start", { detail: invite }));
type CallRow = {
  id: string;
  caller: string;
  callee: string;
  caller_name?: string;
  kind: "voice" | "video";
  status: string;
  created_at: string;
};
type Config = { iceServers: RTCIceServer[]; relayConfigured: boolean };
const request = <T,>(method: string, path: string, body?: unknown) =>
  hospitalApi<T>(method, "/chat-calls" + path, body);
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Falha na ligação da chamada.";

export default function ChatCallService({ username, companyName }: { username: string; companyName?: string }) {
  const [active, setActive] = useState<CallRow | null>(null),
    [incoming, setIncoming] = useState<CallRow | null>(null);
  const [label, setLabel] = useState(""),
    [phase, setPhase] = useState(""),
    [error, setError] = useState("");
  const [muted, setMuted] = useState(false),
    [cameraOff, setCameraOff] = useState(false),
    [seconds, setSeconds] = useState(0),
    [needsPlay, setNeedsPlay] = useState(false);
  const [relay, setRelay] = useState(true),
    [busy, setBusy] = useState(false);
  const [audioReady, setAudioReady] = useState(false),
    [ringMuted, setRingMuted] = useState(false),
    [volume, setVolume] = useState(40);
  const [settings, setSettings] = useState(false),
    [minimized, setMinimized] = useState(false),
    [notice, setNotice] = useState("");
  const [outcome, setOutcome] = useState("");
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const tones = useRef<CallSounds | null>(null);
  if (!tones.current) tones.current = new CallSounds();
  const notified = useRef(new Set<string>()),
    desktop = useRef<Notification | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null),
    local = useRef<MediaStream | null>(null),
    remote = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null),
    remoteVideo = useRef<HTMLVideoElement | null>(null);
  const current = useRef<CallRow | null>(null),
    incomingRef = useRef<CallRow | null>(null),
    mounted = useRef(true),
    starting = useRef(false);
  const cursor = useRef("0"),
    candidates = useRef<RTCIceCandidateInit[]>([]),
    connectedAt = useRef<number | null>(null),
    attempt = useRef(0);
  const sendChain = useRef<Promise<unknown>>(Promise.resolve());
  const restore = useCallback(() => {
    if (localVideo.current) localVideo.current.srcObject = local.current;
    if (remoteVideo.current && remote.current) {
      remoteVideo.current.srcObject = remote.current;
      void remoteVideo.current
        .play()
        .then(() => setNeedsPlay(false))
        .catch(() => setNeedsPlay(true));
    }
  }, []);
  const cleanup = useCallback(() => {
    attempt.current++;
    tones.current?.stop();
    desktop.current?.close();
    desktop.current = null;
    const old = pc.current;
    pc.current = null;
    if (old) {
      old.onicecandidate = null;
      old.onconnectionstatechange = null;
      old.ontrack = null;
      old.close();
    }
    local.current?.getTracks().forEach((t) => t.stop());
    remote.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    remote.current = null;
    current.current = null;
    cursor.current = "0";
    candidates.current = [];
    connectedAt.current = null;
    sendChain.current = Promise.resolve();
    starting.current = false;
    if (mounted.current) {
      setActive(null);
      setBusy(false);
      setSeconds(0);
      setMuted(false);
      setCameraOff(false);
      setMinimized(false);
    }
  }, []);
  const end = useCallback(async () => {
    const row = current.current;
    cleanup();
    if (row)
      try {
        await request("POST", "/" + row.id + "/action", { action: "end" });
      } catch (e) {
        if (mounted.current) setError(message(e));
      }
  }, [cleanup]);
  const signal = useCallback((row: CallRow, kind: string, payload: unknown) => {
    const requestId = crypto.randomUUID();
    const work = async () => {
      // Transport retries reuse their id; a duplicate cannot create extra candidates.
      for (let i = 0; i < 3; i++)
        try {
          return await request("POST", "/" + row.id + "/signals", {
            kind,
            payload,
            requestId,
          });
        } catch (e) {
          if (i === 2) throw e;
        }
      throw new Error("Não foi possível enviar a sinalização.");
    };
    const task = sendChain.current.then(work);
    sendChain.current = task.catch(() => {});
    return task;
  }, []);
  const prepare = useCallback(
    async (row: CallRow, config: Config) => {
      const ticket = attempt.current;
      if (
        !window.isSecureContext ||
        !navigator.mediaDevices?.getUserMedia ||
        !window.RTCPeerConnection
      )
        throw new Error(
          "Abra o software por HTTPS num navegador com suporte a chamadas.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: row.kind === "video",
      });
      if (!mounted.current || ticket !== attempt.current) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("Chamada cancelada.");
      }
      local.current = stream;
      remote.current = new MediaStream();
      const connection = new RTCPeerConnection({
        iceServers: config.iceServers,
      });
      pc.current = connection;
      for (const track of stream.getTracks())
        connection.addTrack(track, stream);
      connection.onicecandidate = (e) => {
        if (e.candidate)
          void signal(row, "ice", e.candidate.toJSON()).catch((e) => {
            if (current.current?.id === row.id) setError(message(e));
          });
      };
      connection.ontrack = (e) => {
        if (pc.current !== connection) return;
        remote.current?.addTrack(e.track);
        restore();
      };
      connection.onconnectionstatechange = () => {
        if (pc.current !== connection) return;
        if (connection.connectionState === "connected") {
          connectedAt.current ??= Date.now();
          setPhase("Em chamada");
          setError("");
        } else if (connection.connectionState === "failed") {
          setError(
            "Não foi possível ligar os dispositivos. Em redes diferentes, configure um servidor TURN.",
          );
          void end();
        } else if (connection.connectionState === "disconnected")
          setPhase("Ligação interrompida; a tentar recuperar…");
      };
      setRelay(config.relayConfigured);
      restore();
      return connection;
    },
    [signal, restore, end],
  );
  const start = useCallback(
    async (invite: CallInvite) => {
      if (starting.current || current.current || incomingRef.current) {
        setError("Já existe uma chamada em curso ou a chegar.");
        return;
      }
      starting.current = true;
      setBusy(true);
      setError("");
      setOutcome("");
      setMinimized(false);
      setLabel(invite.name);
      setPhase("A preparar chamada…");
      let row: CallRow | null = null;
      try {
        const config = await request<Config>("GET", "/config");
        row = await request<CallRow>("POST", "/", {
          peer: invite.peer,
          kind: invite.kind,
          requestId: crypto.randomUUID(),
        });
        if (!mounted.current) {
          void request("POST", "/" + row.id + "/action", { action: "end" });
          return;
        }
        current.current = row;
        setActive(row);
        const connection = await prepare(row, config);
        if (current.current?.id !== row.id) return;
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        await signal(row, "offer", connection.localDescription!.toJSON());
        setPhase("A chamar…");
      } catch (e) {
        if (mounted.current) setError(message(e));
        if (row)
          void request("POST", "/" + row.id + "/action", {
            action: "end",
          }).catch(() => {});
        cleanup();
      } finally {
        starting.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [prepare, signal, cleanup],
  );
  const accept = useCallback(async () => {
    const row = incomingRef.current;
    if (!row || starting.current || current.current) return;
    starting.current = true;
    tones.current?.stop();
    desktop.current?.close();
    setBusy(true);
    setMinimized(false);
    setOutcome("");
    setError("");
    setLabel(row.caller_name || row.caller);
    setPhase("A ligar…");
    try {
      const config = await request<Config>("GET", "/config");
      // Media is requested only after the user explicitly presses Atender.
      current.current = row;
      setActive(row);
      await prepare(row, config);
      await request("POST", "/" + row.id + "/action", { action: "accept" });
      incomingRef.current = null;
      setIncoming(null);
    } catch (e) {
      if (mounted.current) setError(message(e));
      void request("POST", "/" + row.id + "/action", { action: "end" }).catch(
        () => {},
      );
      incomingRef.current = null;
      setIncoming(null);
      cleanup();
    } finally {
      starting.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [prepare, cleanup]);
  const reject = useCallback(async () => {
    const row = incomingRef.current;
    if (!row || busy) return;
    tones.current?.stop();
    setBusy(true);
    try {
      await request("POST", "/" + row.id + "/action", { action: "reject" });
      incomingRef.current = null;
      setIncoming(null);
      desktop.current?.close();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }, [busy]);
  useEffect(() => {
    restore();
  }, [active, minimized, restore]);
  useEffect(() => {
    mounted.current = true;
    const startEvent = (event: Event) => {
      void start((event as CustomEvent<CallInvite>).detail);
    };
    window.addEventListener("nv:call:start", startEvent);
    return () => {
      window.removeEventListener("nv:call:start", startEvent);
    };
  }, [start]);
  useEffect(() => {
    let running = false;
    const tick = async () => {
      if (running || !mounted.current) return;
      running = true;
      try {
        const row = current.current;
        if (row) {
          const status = await request<{
            call: CallRow;
            signals: { id: string; kind: string; payload: any }[];
          }>("GET", "/" + row.id + "?after=" + cursor.current);
          if (current.current?.id !== row.id) return;
          if (!["ringing", "accepted"].includes(status.call.status)) {
            setOutcome(
              status.call.status === "rejected"
                ? "Chamada recusada"
                : status.call.status === "missed"
                  ? "Sem resposta"
                  : "Chamada terminada",
            );
            cleanup();
            return;
          }
          if (status.call.status === "accepted" && !connectedAt.current)
            setPhase("A ligar os dispositivos…");
          if (
            status.call.status === "accepted" &&
            !connectedAt.current &&
            Date.now() - new Date(row.created_at).getTime() > 90000
          ) {
            setError(
              "A ligação de áudio/vídeo não foi estabelecida. Verifique o servidor TURN e as permissões dos dispositivos.",
            );
            await end();
            return;
          }
          const connection = pc.current;
          if (connection && !starting.current) {
            for (const item of status.signals) {
              if (item.kind === "ice") {
                if (connection.remoteDescription)
                  await connection.addIceCandidate(item.payload);
                else candidates.current.push(item.payload);
              } else {
                if (
                  (item.kind === "offer" && row.callee !== username) ||
                  (item.kind === "answer" && row.caller !== username)
                )
                  throw new Error("Sinal inesperado.");
                await connection.setRemoteDescription(item.payload);
                for (const candidate of candidates.current)
                  await connection.addIceCandidate(candidate);
                candidates.current = [];
                if (item.kind === "offer") {
                  const answer = await connection.createAnswer();
                  await connection.setLocalDescription(answer);
                  await signal(
                    row,
                    "answer",
                    connection.localDescription!.toJSON(),
                  );
                }
              }
              cursor.current = item.id;
            }
          }
          if (connectedAt.current)
            setSeconds(Math.floor((Date.now() - connectedAt.current) / 1000));
          await request("POST", "/" + row.id + "/action", {
            action: "heartbeat",
          });
        } else if (!starting.current) {
          const rows = await request<CallRow[]>("GET", "/inbox");
          if (current.current || starting.current) return;
          incomingRef.current = rows[0] || null;
          setIncoming(rows[0] || null);
        }
      } catch (e) {
        if (mounted.current) setError(message(e));
      } finally {
        running = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 1500);
    return () => clearInterval(timer);
  }, [username, signal, cleanup, end]);
  useEffect(
    () => () => {
      mounted.current = false;
      const row = current.current;
      if (row)
        void request("POST", "/" + row.id + "/action", { action: "end" }).catch(
          () => {},
        );
      cleanup();
      tones.current?.dispose();
      desktop.current?.close();
    },
    [cleanup],
  );
  useEffect(() => {
    const show = () => setSettings(true);
    const notification = (e: Event) => {
      if (current.current || incomingRef.current) e.preventDefault();
    };
    window.addEventListener("nv:alerts-settings", show);
    window.addEventListener("nv:notification:new", notification);
    return () => {
      window.removeEventListener("nv:alerts-settings", show);
      window.removeEventListener("nv:notification:new", notification);
    };
  }, []);
  const enableAudio = useCallback(async () => {
    const ready = await tones.current!.unlock();
    if (mounted.current) setAudioReady(ready);
    return ready;
  }, []);
  useEffect(() => {
    const unlock = () => {
      void enableAudio();
    };
    document.addEventListener("pointerdown", unlock, { capture: true });
    document.addEventListener("keydown", unlock, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", unlock, { capture: true });
      document.removeEventListener("keydown", unlock, { capture: true });
    };
  }, [enableAudio]);
  const ringMode =
    !busy && !ringMuted
      ? incoming && !active
        ? "incoming"
        : active && phase === "A chamar…"
          ? "outgoing"
          : null
      : null;
  useEffect(() => {
    tones.current?.setVolume(volume / 100);
  }, [volume]);
  useEffect(() => {
    if (ringMode) tones.current?.start(ringMode);
    else tones.current?.stop();
    setAudioReady(!!tones.current?.ready);
    return () => tones.current?.stop();
  }, [ringMode, incoming?.id, active?.id]);
  useEffect(() => {
    if (!incoming || active) return;
    const id = incoming.id,
      name = incoming.caller_name || incoming.caller;
    const original = document.title;
    const update = () => {
      if (!document.hidden && document.hasFocus()) return;
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        !notified.current.has(id)
      ) {
        try {
          const n = new Notification(
            "Chamada de " +
              (incoming.kind === "video" ? "vídeo" : "voz") +
              " recebida · " + (companyName || "NV-DIGITAL"),
            {
              body: name + " está a chamar. Abra o software para atender.",
              tag: "nv-call:" + id,
              requireInteraction: true,
              silent: true,
            },
          );
          notified.current.add(id);
          desktop.current = n;
          n.onclick = () => {
            window.focus();
            setMinimized(false);
            n.close();
          };
        } catch {
          setNotice(
            "O navegador não apresentou a notificação. O aviso dentro do software continua activo.",
          );
        }
      }
    };
    let toggle = false;
    const timer = window.setInterval(() => {
      if (document.hidden || !document.hasFocus()) {
        toggle = !toggle;
        document.title = toggle ? "☎ " + name + " está a chamar" : original;
      }
    }, 1100);
    update();
    window.addEventListener("blur", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.title = original;
      desktop.current?.close();
      desktop.current = null;
      window.removeEventListener("blur", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [incoming?.id, active?.id, permission]);
  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(() => setOutcome(""), 6000);
    return () => clearTimeout(timer);
  }, [outcome]);
  async function enableAlerts() {
    const audio = enableAudio();
    let allowed: Promise<NotificationPermission | "unsupported"> =
      Promise.resolve("unsupported");
    if (typeof Notification !== "undefined")
      allowed =
        Notification.permission === "default"
          ? Notification.requestPermission()
          : Promise.resolve(Notification.permission);
    try {
      const [sound, p] = await Promise.all([audio, allowed]);
      setPermission(p);
      setNotice(
        sound
          ? "Som activado. Pode testar o toque abaixo."
          : "Clique em Activar som. Se estiver no Preview embutido, abra o software num novo separador.",
      );
    } catch {
      setNotice(
        "Abra o software num novo separador e permita notificações nas permissões do site.",
      );
    }
  }
  const call = incoming && !active ? incoming : active;
  const receiving = !!incoming && !active;
  const name = active
    ? label
    : incoming?.caller_name || incoming?.caller || "Chamada";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
  const connected = phase === "Em chamada" || seconds > 0;
  const visualRinging = receiving || phase === "A chamar…";
  const subtitle = receiving
    ? "Chamada recebida · " + (call?.kind === "video" ? "vídeo" : "voz")
    : phase;
  const control = (
    title: string,
    Icon: typeof Phone,
    onClick: () => void,
    variant = "",
    disabled = false,
  ) => (
    <button
      type="button"
      className={"nv-call-action " + variant}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      <span>
        <Icon aria-hidden="true" />
      </span>
      <span>{title}</span>
    </button>
  );
  return (
    <>
      {!call && (
        <button
          type="button"
          className="nv-call-alert-toggle"
          onClick={() => setSettings((v) => !v)}
          aria-expanded={settings}
          title="Configurar som e notificações de chamadas"
        >
          <Bell />
          <span>Alertas</span>
          {(!audioReady || permission !== "granted") && (
            <i aria-label="Configuração pendente" />
          )}
        </button>
      )}
      {settings && (
        <aside className="nv-call-settings" aria-label="Alertas de chamadas">
          <header>
            <strong>Som e notificações</strong>
            <button
              type="button"
              title="Fechar"
              onClick={() => setSettings(false)}
            >
              <X size={18} />
            </button>
          </header>
          <p>
            Som: <strong>{audioReady ? "activado" : "por activar"}</strong>
            <br />
            Notificações:{" "}
            <strong>
              {permission === "granted"
                ? "permitidas"
                : permission === "denied"
                  ? "bloqueadas"
                  : permission === "unsupported"
                    ? "não suportadas"
                    : "por permitir"}
            </strong>
          </p>
          <button
            type="button"
            className="nv-call-enable"
            onClick={() => void enableAlerts()}
          >
            Activar alertas
          </button>
          <button
            type="button"
            className="nv-call-enable nv-call-test"
            onClick={() => {
              void enableAudio().then((ready) => {
                if (ready) tones.current?.preview();
                else
                  setNotice(
                    "O som foi bloqueado pelo navegador. Abra num novo separador e tente novamente.",
                  );
              });
            }}
          >
            Testar toque (12 segundos)
          </button>
          <button
            type="button"
            className="nv-call-enable nv-call-test"
            onClick={() => tones.current?.stopPreview()}
          >
            Parar teste
          </button>
          {notice && <small role="status">{notice}</small>}
          {permission === "denied" && (
            <small>
              Nas permissões deste site, permita notificações para receber
              avisos do sistema.
            </small>
          )}
          <small>
            As chamadas chegam enquanto o software estiver aberto. O volume do
            dispositivo também deve estar ligado.
          </small>
        </aside>
      )}
      {(outcome || (error && !call)) && (
        <div className="nv-call-toast" role={error ? "alert" : "status"}>
          <PhoneOff />
          <span>{error || outcome}</span>
          <button
            type="button"
            title="Fechar aviso"
            onClick={() => {
              setError("");
              setOutcome("");
            }}
          >
            <X />
          </button>
        </div>
      )}
      {call && (
        <div
          role="dialog"
          aria-modal={!minimized}
          aria-label={
            receiving ? "Chamada recebida de " + name : "Chamada com " + name
          }
          className={
            "nv-call-backdrop " +
            (minimized ? "nv-call-mini" : "") +
            (visualRinging ? " nv-call-ringing" : "")
          }
        >
          <section className="nv-call-card">
            <header className="nv-call-top">
              <span className="nv-call-brand">
                <Phone size={15} /> {companyName || "NV-DIGITAL"} · CHAMADAS
              </span>
              <div className="nv-call-tools">
                <button
                  type="button"
                  className="nv-call-icon"
                  title="Som e notificações"
                  onClick={() => setSettings((v) => !v)}
                >
                  <SlidersHorizontal />
                </button>
                <button
                  type="button"
                  className="nv-call-icon"
                  title={minimized ? "Expandir chamada" : "Minimizar chamada"}
                  onClick={() => setMinimized((v) => !v)}
                >
                  {minimized ? <Maximize2 /> : <Minimize2 />}
                </button>
              </div>
            </header>
            <div className="nv-call-center">
              <span className="nv-call-eyebrow">
                {call.kind === "video" ? <Video /> : <Phone />}
                {call.kind === "video" ? "VIDEOCHAMADA" : "CHAMADA DE VOZ"}
              </span>
              <div className="nv-call-avatar" aria-hidden="true">
                {initials}
              </div>
              <h2 className="nv-call-name">{name}</h2>
              <p className="nv-call-subtitle" role="status" aria-live="polite">
                <span className="nv-call-dot" />
                {subtitle}
              </p>
              {active && connected && (
                <p className="nv-call-time">
                  {Math.floor(seconds / 60)
                    .toString()
                    .padStart(2, "0")}
                  :{(seconds % 60).toString().padStart(2, "0")}
                </p>
              )}
            </div>
            {active && (
              <div
                className={
                  active.kind === "video" ? "nv-call-stage" : "nv-call-audio"
                }
                style={
                  active.kind === "video" && !connected
                    ? { display: "none" }
                    : undefined
                }
              >
                <video
                  ref={remoteVideo}
                  aria-label="Imagem e som do colega"
                  className={
                    active.kind === "video" ? "nv-call-remote" : "nv-call-audio"
                  }
                  autoPlay
                  playsInline
                />
                {active.kind === "video" && (
                  <div className="nv-call-local">
                    <video
                      ref={localVideo}
                      aria-label="A sua câmara"
                      autoPlay
                      playsInline
                      muted
                      style={cameraOff ? { visibility: "hidden" } : undefined}
                    />
                    <span>{cameraOff ? "Câmara desligada" : "Você"}</span>
                  </div>
                )}
              </div>
            )}
            {visualRinging && (
              <div className="nv-call-volume">
                <button
                  type="button"
                  title={ringMuted ? "Activar toque" : "Silenciar toque"}
                  onClick={() => setRingMuted((v) => !v)}
                >
                  {ringMuted ? <VolumeX /> : <Volume2 />}
                </button>
                <label htmlFor="nv-call-volume">Volume do toque</label>
                <input
                  id="nv-call-volume"
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
                <output>{volume}%</output>
              </div>
            )}
            {(receiving || phase === "A chamar…") && !audioReady && (
              <div className="nv-call-warning">
                O navegador está a bloquear o toque.
                <button type="button" onClick={() => void enableAudio()}>
                  Activar som
                </button>
              </div>
            )}
            {(receiving || phase === "A chamar…") &&
              (ringMuted || volume === 0) && (
                <div className="nv-call-warning">
                  Toque silenciado.
                  <button
                    type="button"
                    onClick={() => {
                      setRingMuted(false);
                      setVolume(40);
                      void enableAudio();
                    }}
                  >
                    Activar toque
                  </button>
                </div>
              )}
            {error && (
              <div className="nv-call-warning nv-call-error" role="alert">
                {error}
              </div>
            )}
            {needsPlay && active && (
              <div className="nv-call-warning">
                O áudio do colega precisa de autorização.
                <button
                  type="button"
                  onClick={() => {
                    void remoteVideo.current
                      ?.play()
                      .then(() => setNeedsPlay(false))
                      .catch(() =>
                        setError(
                          "Não foi possível reproduzir o áudio. Verifique as permissões e o volume do dispositivo.",
                        ),
                      );
                  }}
                >
                  Ouvir chamada
                </button>
              </div>
            )}
            <div className="nv-call-actions">
              {receiving ? (
                <>
                  {control(
                    "Recusar",
                    PhoneOff,
                    () => void reject(),
                    "nv-call-red",
                    busy,
                  )}
                  {control(
                    busy ? "A atender…" : "Atender",
                    call.kind === "video" ? Video : Phone,
                    () => void accept(),
                    "nv-call-green",
                    busy,
                  )}
                </>
              ) : (
                <>
                  {control(
                    muted ? "Activar microfone" : "Silenciar",
                    muted ? MicOff : Mic,
                    () => {
                      local.current
                        ?.getAudioTracks()
                        .forEach((t) => (t.enabled = muted));
                      setMuted(!muted);
                    },
                    muted ? "nv-call-off" : "",
                    !local.current,
                  )}
                  {active?.kind === "video" &&
                    control(
                      cameraOff ? "Activar câmara" : "Câmara",
                      cameraOff ? VideoOff : Video,
                      () => {
                        local.current
                          ?.getVideoTracks()
                          .forEach((t) => (t.enabled = cameraOff));
                        setCameraOff(!cameraOff);
                      },
                      cameraOff ? "nv-call-off" : "",
                      !local.current,
                    )}
                  {control(
                    connected ? "Terminar" : "Cancelar",
                    PhoneOff,
                    () => {
                      setOutcome("Chamada terminada");
                      void end();
                    },
                    "nv-call-red",
                  )}
                </>
              )}
            </div>
            <footer className="nv-call-footer">
              <ShieldCheck />
              Comunicação interna da instituição ·{" "}
              {active && !relay
                ? "Ligação directa; TURN por configurar"
                : "Áudio e vídeo por WebRTC"}
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

export function CallHistory({ username }: { username?: string }) {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = () =>
      request<any[]>("GET", "/history")
        .then((r) => {
          if (live) {
            setRows(r);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(message(e));
        });
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [username]);
  return (
    <div style={{ padding: 12 }}>
      {error && <p role="alert">{error}</p>}
      {!rows.length && !error && <p>Ainda não existem chamadas.</p>}
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          className="chat-item"
          style={{ width: "100%", textAlign: "left" }}
          onClick={() =>
            inviteCall({
              peer: row.caller === username ? row.callee : row.caller,
              name: row.peer_name,
              kind: row.kind,
            })
          }
        >
          <div>
            <strong>
              {row.kind === "video" ? "📹" : "☎"} {row.peer_name}
            </strong>
            <p style={{ fontSize: 12 }}>
              {row.caller === username ? "Efectuada" : "Recebida"} ·{" "}
              {row.status === "missed"
                ? "Não atendida"
                : row.status === "rejected"
                  ? "Recusada"
                  : row.status === "accepted"
                    ? "Em ligação"
                    : row.status === "ringing"
                      ? "A chamar"
                      : "Terminada"}{" "}
              · {new Date(row.created_at).toLocaleString("pt-PT")}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
