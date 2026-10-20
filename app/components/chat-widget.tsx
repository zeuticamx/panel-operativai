"use client";

import { useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUsuario } from "./usuario-context";

/**
 * ⚠️ EDITAR AQUÍ cuando tengas la URL real del chat/agente embebido.
 * Puede venir de una env var (NEXT_PUBLIC_CHAT_IFRAME_URL) o quedar fija.
 */
const CHAT_IFRAME_SRC = process.env.NEXT_PUBLIC_CHAT_IFRAME_URL ?? "";

/**
 * Origen exacto del iframe: el postMessage solo se entrega a ese origen.
 * Si la URL no es válida, queda en null y no se envía nada.
 */
function origenDe(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
const CHAT_IFRAME_ORIGIN = origenDe(CHAT_IFRAME_SRC);

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [montado, setMontado] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { usuario } = useUsuario();

  // Monta el iframe recién al primer open y nunca lo desmonta:
  // así no pierde su estado/URL interna al cerrar y reabrir.
  if (open && !montado) setMontado(true);

  const handleLoad = () => {
    if (!iframeRef.current?.contentWindow || !CHAT_IFRAME_ORIGIN) return;

    // Sin token ni tenant_id: el chat solo necesita el correo del usuario
    // (chat-service/app/embed/page.tsx lee data.usuario.email). El token de
    // sesión no sale de la página.
    const payload = {
      type: "auth-sync",
      usuario: usuario
        ? {
            id: usuario.id,
            email: usuario.email,
            nombre_negocio: usuario.nombre_negocio,
          }
        : null,
    };

    iframeRef.current.contentWindow.postMessage(payload, CHAT_IFRAME_ORIGIN);
  };

  if (!CHAT_IFRAME_SRC) return null;

  return (
    <div className="fixed right-4 bottom-20 z-50 md:bottom-4 flex flex-col items-end gap-3">
      <div
        className={cn(
          "h-[min(70vh,560px)] w-[min(90vw,20rem)] overflow-hidden rounded-lg border border-bg-700 bg-bg-900 shadow-xl transition-opacity duration-150 sm:w-80 md:w-96",
          open ? "opacity-100" : "pointer-events-none absolute opacity-0",
        )}
        aria-hidden={!open}
      >
        {montado && (
          <iframe
            ref={iframeRef}
            src={CHAT_IFRAME_SRC}
            title="Chat"
            className="h-full w-full border-0"
            onLoad={handleLoad}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-bg-800 text-text-100 shadow-lg hover:bg-bg-700"
        aria-label={open ? "Cerrar chat" : "Abrir chat"}
        aria-expanded={open}
      >
        {open ? <X size={20} aria-hidden /> : <MessageCircle size={20} aria-hidden />}
      </button>
    </div>
  );
}
