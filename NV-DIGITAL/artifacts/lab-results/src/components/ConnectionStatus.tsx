/**
 * ConnectionStatus — compact pill displayed in the app shell.
 *
 * States:
 *  • Online          — green dot, no pending ops
 *  • N pendentes     — amber dot, pending ops exist (will sync when online)
 *  • Offline         — red dot, no server connection
 *  • Sincronizando…  — pulsing amber, sync in progress
 */
import React, { useState } from "react";
import { useApp } from "../store/AppContext";

interface Props {
  /** Extra Tailwind classes for positioning / margin */
  className?: string;
}

export default function ConnectionStatus({ className = "" }: Props) {
  const { isOnline, pendingCount, syncNow } = useApp();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (syncing || !isOnline || pendingCount === 0) return;
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  }

  // ── Determine appearance ────────────────────────────────────────────────
  let dotClass = "bg-green-500";
  let label = "Online";
  let title = "Ligado ao servidor";
  let clickable = false;

  if (syncing) {
    dotClass = "bg-amber-400 animate-pulse";
    label = "Sincronizando…";
    title = "A sincronizar dados com o servidor";
  } else if (!isOnline) {
    dotClass = "bg-red-500";
    label = "Offline";
    title =
      "Sem ligação ao servidor. As alterações serão guardadas localmente.";
  } else if (pendingCount > 0) {
    dotClass = "bg-amber-400";
    label = `${pendingCount} pendente${pendingCount > 1 ? "s" : ""}`;
    title = `${pendingCount} operação(ões) por sincronizar. Clique para sincronizar agora.`;
    clickable = true;
  }

  return (
    <button
      type="button"
      title={title}
      disabled={!clickable}
      onClick={handleSync}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
        "text-xs font-medium select-none transition-colors",
        "bg-white/10 text-white/90 border border-white/20",
        clickable
          ? "cursor-pointer hover:bg-white/20 active:scale-95"
          : "cursor-default",
        className,
      ].join(" ")}
    >
      {/* Dot */}
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotClass}`} />
      {label}
    </button>
  );
}
