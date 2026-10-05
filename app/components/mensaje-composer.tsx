"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Bot, Hand, Paperclip, Send, X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { ACCEPT_ADJUNTO, formatoBytes, validarAdjunto } from "@/lib/adjuntos";
import { Aviso, Boton, inputClass } from "@/app/components/ui";

/**
 * Compositor de respuesta manual + botones "Tomar conversación" y "Volver a
 * IA" (handoff humano en ambos sentidos).
 *
 * Reusado tanto en la conversación tenant-scoped (/conversaciones/{id})
 * como en la de gerencia de plataforma (/gerencia/conversaciones/{id}) —
 * ambas exponen los mismos tres endpoints, solo cambia la base de la ruta.
 */
export function MensajeComposer({
  status,
  enviarUrl,
  tomarUrl,
  volverIaUrl,
  adjuntosUrl,
  onCambio,
}: {
  status: string;
  enviarUrl: string;
  tomarUrl: string;
  volverIaUrl: string;
  /** Si viene, se ofrece adjuntar imágenes/documentos (solo WhatsApp). */
  adjuntosUrl?: string;
  onCambio: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [volviendo, setVolviendo] = useState(false);
  const [tomando, setTomando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transferida = status === "transferred";

  const elegirArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const elegido = e.target.files?.[0] ?? null;
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!elegido) return;
    const problema = validarAdjunto(elegido);
    setError(problema);
    setArchivo(problema ? null : elegido);
  };

  const enviar = async () => {
    const limpio = texto.trim();
    if ((!limpio && !archivo) || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      if (archivo && adjuntosUrl) {
        // El texto escrito viaja como leyenda del archivo.
        const form = new FormData();
        form.append("archivo", archivo);
        if (limpio) form.append("leyenda", limpio);
        await apiFetch(adjuntosUrl, { method: "POST", body: form });
        setArchivo(null);
      } else {
        await apiFetch(enviarUrl, { method: "POST", json: { texto: limpio } });
      }
      setTexto("");
      onCambio();
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo enviar el mensaje."));
    } finally {
      setEnviando(false);
    }
  };

  const tomar = async () => {
    if (tomando) return;
    setTomando(true);
    setError(null);
    try {
      await apiFetch(tomarUrl, { method: "POST" });
      onCambio();
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo tomar la conversación."));
    } finally {
      setTomando(false);
    }
  };

  const volverAIa = async () => {
    if (volviendo) return;
    setVolviendo(true);
    setError(null);
    try {
      await apiFetch(volverIaUrl, { method: "POST" });
      onCambio();
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo devolver el control a la IA."));
    } finally {
      setVolviendo(false);
    }
  };

  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  };

  if (!transferida) {
    return (
      <div className="flex flex-col gap-2 border-t border-bg-700 px-4 py-3">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Aviso tipo="info">
          El asistente de IA tiene el control de esta conversación. Para responder
          manualmente, toma la conversación: la IA dejará de contestar hasta que
          se la devuelvas.
        </Aviso>
        <div>
          <Boton
            variante="secundario"
            onClick={() => void tomar()}
            loading={tomando}
            className="min-h-8"
          >
            <Hand size={13} aria-hidden />
            Tomar conversación
          </Boton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-bg-700 px-4 py-3">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {archivo && (
        <div className="flex items-center gap-2 self-start rounded border border-bg-700 bg-bg-900 px-2.5 py-1.5 text-xs text-text-100">
          <Paperclip size={12} aria-hidden className="text-text-400" />
          <span className="max-w-[16rem] truncate">{archivo.name}</span>
          <span className="font-mono text-[11px] text-text-600">{formatoBytes(archivo.size)}</span>
          <button
            type="button"
            onClick={() => setArchivo(null)}
            disabled={enviando}
            aria-label="Quitar archivo"
            className="text-text-400 hover:text-text-100"
          >
            <X size={12} aria-hidden />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        {adjuntosUrl && (
          <>
            <input
              ref={inputArchivo}
              type="file"
              accept={ACCEPT_ADJUNTO}
              onChange={elegirArchivo}
              className="hidden"
              data-testid="input-adjunto"
            />
            <Boton
              variante="fantasma"
              onClick={() => inputArchivo.current?.click()}
              disabled={enviando}
              aria-label="Adjuntar archivo"
              title="Adjuntar imagen (JPG, PNG) o documento (PDF, DOCX)"
              className="shrink-0 px-2"
            >
              <Paperclip size={14} aria-hidden />
            </Boton>
          </>
        )}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={alTeclear}
          disabled={enviando}
          rows={2}
          placeholder={archivo ? "Leyenda (opcional)…" : "Responder como humano…"}
          className={`${inputClass} resize-none`}
        />
        <Boton
          variante="primario"
          onClick={() => void enviar()}
          loading={enviando}
          disabled={!texto.trim() && !archivo}
          className="shrink-0"
        >
          <Send size={13} aria-hidden />
          Enviar
        </Boton>
      </div>
      <div>
        <Boton
          variante="secundario"
          onClick={() => void volverAIa()}
          loading={volviendo}
          className="min-h-8"
        >
          <Bot size={13} aria-hidden />
          Volver a IA
        </Boton>
      </div>
    </div>
  );
}
