"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/lib/auth";
import { useUsuario } from "./usuario-context";

/**
 * ⚠️ EDITAR AQUÍ cuando tengas la URL real del chat/agente embebido.
 * Puede venir de una env var (NEXT_PUBLIC_CHAT_IFRAME_URL) o quedar fija.
 */
const CHAT_IFRAME_SRC = process.env.NEXT_PUBLIC_CHAT_IFRAME_URL ?? "";

/** Origen permitido para el postMessage. Debe matchear el dominio del iframe. */
const CHAT_IFRAME_ORIGIN = "*"; // ⚠️ EDITAR: restringir al origen real en prod.

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [montado, setMontado] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { usuario } = useUsuario();

  // Monta el iframe recién al primer open y nunca lo desmonta:
  // así no pierde su estado/URL interna al cerrar y reabrir.
  useEffect(() => {
    if (open) setMontado(true);
  }, [open]);

  const handleLoad = () => {
    if (!iframeRef.current?.contentWindow) return;

    // ⚠️ EDITAR AQUÍ: forma del payload que espera el iframe del chat.
    const payload = {
      type: "auth-sync",
      token: getAccessToken(),
      usuario: usuario
        ? {
            id: usuario.id,
            email: usuario.email,
            tenant_id: process.env.NEXT_PUBLIC_TENANT_ID ?? "",
            nombre_negocio: usuario.nombre_negocio,
          }
        : null,
    };

    iframeRef.current.contentWindow.postMessage(payload, CHAT_IFRAME_ORIGIN);
  };

  if (!CHAT_IFRAME_SRC) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      <div
        className={cn(
          "h-[560px] w-80 overflow-hidden rounded-lg border border-bg-700 bg-bg-900 shadow-xl transition-opacity duration-150 sm:w-96",
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
