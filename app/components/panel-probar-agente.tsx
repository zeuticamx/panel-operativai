"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { RotateCcw, Send, Wrench, X } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/auth";
import type { ProbarAgenteIn, ProbarAgenteOut, TurnoPrueba } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Aviso, Boton } from "./ui";

/** Lo que el panel prueba: el borrador del formulario, aunque no esté guardado. */
export type BorradorAgente = Pick<
  ProbarAgenteIn,
  "agent_name" | "system_prompt" | "model" | "temperature" | "history_window"
>;

interface TurnoVisible extends TurnoPrueba {
  herramientas?: ProbarAgenteOut["herramientas"];
  transferida?: boolean;
}

const MENSAJE_MAX = 4000;
// Espejo del tope del backend (services/agente_tester.MAX_TURNOS).
const TURNOS_MAX = 40;

/**
 * Chat de prueba del agente: el dueño escribe como si fuera un cliente y ve la
 * respuesta con la configuración del formulario, sin guardarla y sin mandar
 * nada a nadie. La conversación vive solo aquí (se pierde al recargar o al
 * cambiar de agente); el servidor no guarda nada y limita los mensajes por día.
 *
 * Se queda montado aunque esté cerrado, para que el dueño pueda editar el
 * prompt y volver a la misma conversación.
 */
export function PanelProbarAgente({
  abierto,
  onCerrar,
  borrador,
  numeroId,
  sucio,
  incompleto,
}: {
  abierto: boolean;
  onCerrar: () => void;
  borrador: BorradorAgente;
  /** Id del número de WhatsApp que se prueba; null = Instagram, Facebook y chat web. */
  numeroId: string | null;
  sucio: boolean;
  /** Falta el nombre o las instrucciones: el servidor no deja probar así. */
  incompleto: boolean;
}) {
  const [turnos, setTurnos] = useState<TurnoVisible[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restantes, setRestantes] = useState<number | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView?.({ block: "end" });
  }, [turnos, enviando]);

  useEffect(() => {
    if (abierto) entradaRef.current?.focus();
  }, [abierto]);

  // Escape cierra el panel (en móvil ocupa toda la pantalla).
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto, onCerrar]);

  const sinCupo = restantes === 0;
  const lleno = turnos.length >= TURNOS_MAX;
  const puedeEnviar = Boolean(texto.trim()) && !enviando && !incompleto && !sinCupo && !lleno;

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!puedeEnviar) return;
    const nuevo: TurnoVisible = { role: "user", content: texto.trim() };
    const conversacion = [...turnos, nuevo];
    setTurnos(conversacion);
    setTexto("");
    setError(null);
    setEnviando(true);
    try {
      const cuerpo: ProbarAgenteIn = {
        ...borrador,
        agent_name: borrador.agent_name.trim(),
        mensajes: conversacion.map(({ role, content }) => ({ role, content })),
      };
      const ruta = numeroId ? `/api/agente/probar?numero_id=${encodeURIComponent(numeroId)}` : "/api/agente/probar";
      const r = await apiFetch<ProbarAgenteOut>(ruta, { method: "POST", json: cuerpo });
      setTurnos([
        ...conversacion,
        { role: "assistant", content: r.texto, herramientas: r.herramientas, transferida: r.transferida },
      ]);
      setRestantes(r.restantes_hoy);
    } catch (err) {
      // El mensaje no llegó a contestarse: se devuelve al cuadro para reintentar.
      setTurnos(turnos);
      setTexto(nuevo.content);
      if (err instanceof ApiError && err.status === 429) setRestantes(0);
      setError(err instanceof ApiError ? err.detail : "No se pudo probar el agente. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => {
    setTurnos([]);
    setError(null);
    setTexto("");
  };

  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void enviar();
    }
  };

  return (
    <aside
      role="dialog"
      aria-label="Probar agente"
      aria-hidden={!abierto}
      className={cn(
        "fixed inset-0 z-40 flex flex-col bg-bg-900 lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[26rem] lg:border-l lg:border-bg-700 lg:shadow-xl",
        !abierto && "hidden",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-bg-700 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-sm font-medium text-text-100">Probar agente</h2>
          <span className="truncate font-mono text-[11px] text-text-600">
            {sucio ? "con tus cambios sin guardar" : "con la configuración guardada"}
            {restantes !== null && ` · ${restantes} de hoy`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Boton variante="fantasma" onClick={reiniciar} disabled={enviando || turnos.length === 0} className="min-h-8 px-2">
            <RotateCcw size={13} aria-hidden />
            Reiniciar
          </Boton>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex size-8 cursor-pointer items-center justify-center rounded-md text-text-400 hover:bg-bg-800 hover:text-text-100"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        <Aviso className="mb-3">
          Modo prueba: no se envía nada a clientes reales. Lo que cambia datos (reservas, avisos, transferencias) se
          simula; las consultas de solo lectura sí corren de verdad.
        </Aviso>

        {incompleto && (
          <Aviso tipo="error" className="mb-3">
            Completa el nombre y las instrucciones del agente para poder probarlo.
          </Aviso>
        )}

        {turnos.length === 0 && !incompleto && (
          <p className="py-8 text-center text-xs text-text-600">
            Escribe como lo haría un cliente, por ejemplo «hola, ¿qué servicios ofrecen?».
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {turnos.map((t, i) => (
            <li key={i} className={cn("flex flex-col gap-1", t.role === "user" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                  t.role === "user" ? "bg-bg-700 text-text-100" : "border border-bg-700 bg-bg-800 text-text-100",
                )}
              >
                {t.content}
              </div>
              {t.herramientas && t.herramientas.length > 0 && (
                <details className="max-w-[85%] text-[11px] text-text-400">
                  <summary className="flex cursor-pointer items-center gap-1">
                    <Wrench size={11} aria-hidden />
                    Usó {t.herramientas.length === 1 ? "1 herramienta" : `${t.herramientas.length} herramientas`}
                  </summary>
                  <ul className="mt-1 flex flex-col gap-1 font-mono text-[11px]">
                    {t.herramientas.map((h, j) => (
                      <li key={j} className="break-all rounded bg-bg-950 px-2 py-1">
                        {h.tool_key}
                        {Object.keys(h.parametros).length > 0 && ` ${JSON.stringify(h.parametros)}`}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {t.transferida && (
                <span className="text-[11px] text-warning">
                  El agente habría pasado esta conversación a una persona (no se transfirió nada).
                </span>
              )}
            </li>
          ))}
          {enviando && (
            <li className="flex items-start">
              <div className="rounded-lg border border-bg-700 bg-bg-800 px-3 py-2 font-mono text-xs text-text-600">
                escribiendo…
              </div>
            </li>
          )}
        </ul>
        <div ref={finRef} />
      </div>

      <form onSubmit={enviar} className="flex flex-col gap-2 border-t border-bg-700 px-4 py-3">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {sinCupo && !error && (
          <Aviso tipo="info">Llegaste al límite de mensajes de prueba de hoy. Mañana se renueva.</Aviso>
        )}
        {lleno && <Aviso tipo="info">La conversación de prueba es muy larga: reiníciala para seguir.</Aviso>}
        <div className="flex items-end gap-2">
          <label htmlFor="mensaje-prueba" className="sr-only">
            Mensaje de prueba
          </label>
          <textarea
            id="mensaje-prueba"
            ref={entradaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={alTeclear}
            maxLength={MENSAJE_MAX}
            rows={2}
            placeholder="Escribe un mensaje de prueba…"
            disabled={enviando || incompleto || sinCupo || lleno}
            className="min-h-10 flex-1 resize-none rounded-md border border-bg-700 bg-bg-950 px-3 py-2 text-sm text-text-100 placeholder:text-text-600 focus:border-bg-600 focus:outline-none disabled:opacity-50"
          />
          <Boton type="submit" variante="primario" loading={enviando} disabled={!puedeEnviar} aria-label="Enviar">
            <Send size={14} aria-hidden />
          </Boton>
        </div>
        <span className="font-mono text-[11px] text-text-600">Enter envía · Mayús+Enter salto de línea</span>
      </form>
    </aside>
  );
}
