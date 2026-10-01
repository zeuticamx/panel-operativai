"use client";

import { useState, type KeyboardEvent } from "react";
import { Bot, Hand, Send } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
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
  onCambio,
}: {
  status: string;
  enviarUrl: string;
  tomarUrl: string;
  volverIaUrl: string;
  onCambio: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [volviendo, setVolviendo] = useState(false);
  const [tomando, setTomando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transferida = status === "transferred";

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await apiFetch(enviarUrl, { method: "POST", json: { texto: limpio } });
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
      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={alTeclear}
          disabled={enviando}
          rows={2}
          placeholder="Responder como humano…"
          className={`${inputClass} resize-none`}
        />
        <Boton
          variante="primario"
          onClick={() => void enviar()}
          loading={enviando}
          disabled={!texto.trim()}
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
