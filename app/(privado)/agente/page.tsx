"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { RotateCcw } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { AgenteConfig, ModelosOut } from "@/lib/types";
import { fmtInt } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "@/app/components/badge";
import { Aviso, Boton, Campo, Cargando, PageHeader, inputClass, selectClass } from "@/app/components/ui";

// Límites espejo de AgenteConfigIn en el backend. La validación real la
// hace el servidor; aquí solo se usan para los atributos min/max del form.
const PROMPT_MAX = 20000;
const PROMPT_MIN = 10;
const NOMBRE_MAX = 100;
const HISTORIAL_MIN = 5;
const HISTORIAL_MAX = 200;

function iguales(a: AgenteConfig, b: AgenteConfig) {
  return (
    a.agent_name === b.agent_name &&
    a.system_prompt === b.system_prompt &&
    (a.model ?? null) === (b.model ?? null) &&
    a.temperature === b.temperature &&
    a.history_window === b.history_window &&
    a.is_active === b.is_active
  );
}

export default function AgentePage() {
  const remoto = useApi<AgenteConfig>("/api/agente");
  const modelos = useApi<ModelosOut>("/api/agente/modelos");

  // `original` = lo que hay en el servidor (lo cargado, o lo último guardado).
  // `local` = ediciones del usuario; null mientras no toque nada.
  // Así el formulario nunca pisa lo que el usuario está escribiendo.
  const [guardado, setGuardado] = useState<AgenteConfig | null>(null);
  const [local, setLocal] = useState<AgenteConfig | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const exitoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const original = guardado ?? remoto.data;
  const form = local ?? original;

  useEffect(() => {
    return () => {
      if (exitoTimeout.current) clearTimeout(exitoTimeout.current);
    };
  }, []);

  const set = <K extends keyof AgenteConfig>(k: K, v: AgenteConfig[K]) =>
    setLocal((f) => {
      const base = f ?? original;
      return base ? { ...base, [k]: v } : f;
    });

  const sucio = Boolean(local && original && !iguales(local, original));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || guardando) return;
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      const respuesta = await apiFetch<AgenteConfig>("/api/agente", {
        method: "PUT",
        json: {
          agent_name: form.agent_name.trim(),
          system_prompt: form.system_prompt,
          model: form.model || null,
          temperature: form.temperature,
          history_window: form.history_window,
          is_active: form.is_active,
        },
      });
      setGuardado(respuesta);
      setLocal(null);
      setExito("Configuración guardada. Los próximos mensajes ya usan estos ajustes.");
      if (exitoTimeout.current) clearTimeout(exitoTimeout.current);
      exitoTimeout.current = setTimeout(() => setExito(null), 5000);
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo guardar la configuración."));
    } finally {
      setGuardando(false);
    }
  };

  const descartar = () => {
    setLocal(null);
    setError(null);
  };

  if (remoto.error && !form) {
    return (
      <>
        <PageHeader titulo="Agente" />
        <div className="p-4">
          <Aviso tipo="error">{remoto.error}</Aviso>
        </div>
      </>
    );
  }

  if (!form) {
    return (
      <>
        <PageHeader titulo="Agente" />
        <Cargando texto="cargando configuración…" />
      </>
    );
  }

  const listaModelos = modelos.data?.modelos ?? [];
  // Si el modelo guardado no está en la lista (o es null), igual se muestra
  // para no perderlo silenciosamente al guardar.
  const modeloFueraDeLista = form.model && !listaModelos.includes(form.model) ? form.model : null;
  const promptLen = form.system_prompt.length;
  const promptExcedido = promptLen > PROMPT_MAX;

  return (
    <>
      <PageHeader
        titulo="Agente"
        sub={
          <span className="inline-flex items-center gap-2">
            {form.is_active ? <Badge tone="success">activo</Badge> : <Badge tone="warning">pausado</Badge>}
            {sucio && <Badge tone="info">cambios sin guardar</Badge>}
          </span>
        }
        acciones={
          <>
            <Boton variante="fantasma" onClick={descartar} disabled={!sucio || guardando}>
              <RotateCcw size={13} aria-hidden />
              Descartar
            </Boton>
            <Boton
              type="submit"
              form="form-agente"
              variante="primario"
              loading={guardando}
              disabled={!sucio || promptExcedido}
            >
              Guardar cambios
            </Boton>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <form
          id="form-agente"
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-4xl flex-col gap-4"
          noValidate
        >
          {error && <Aviso tipo="error">{error}</Aviso>}
          {exito && <Aviso tipo="exito">{exito}</Aviso>}

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Columna principal: prompt */}
            <section className="flex flex-col gap-4 rounded-md border border-bg-700 bg-bg-800 p-4 lg:col-span-2">
              <Campo id="agent_name" label="Nombre del agente" hint="Cómo se presenta ante tus clientes">
                <input
                  id="agent_name"
                  type="text"
                  value={form.agent_name}
                  onChange={(e) => set("agent_name", e.target.value)}
                  maxLength={NOMBRE_MAX}
                  disabled={guardando}
                  required
                  className={inputClass}
                />
              </Campo>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="system_prompt" className="text-xs text-text-400">
                    Instrucciones del agente (system prompt)
                  </label>
                  <span
                    className={cn(
                      "font-mono text-[11px] tabular-nums",
                      promptExcedido
                        ? "text-danger"
                        : promptLen > PROMPT_MAX * 0.9
                          ? "text-warning"
                          : "text-text-600",
                    )}
                    aria-live="polite"
                  >
                    {fmtInt.format(promptLen)} / {fmtInt.format(PROMPT_MAX)}
                  </span>
                </div>
                <textarea
                  id="system_prompt"
                  value={form.system_prompt}
                  onChange={(e) => set("system_prompt", e.target.value)}
                  minLength={PROMPT_MIN}
                  disabled={guardando}
                  rows={22}
                  spellCheck
                  required
                  aria-invalid={promptExcedido || undefined}
                  className={cn(
                    inputClass,
                    "min-h-64 resize-y font-mono text-[13px] leading-relaxed",
                    promptExcedido && "border-danger focus:border-danger",
                  )}
                />
                <span className="font-mono text-[11px] text-text-600">
                  Tono, reglas, qué puede y qué no puede decir. Mínimo {PROMPT_MIN} caracteres.
                </span>
              </div>
            </section>

            {/* Columna lateral: parámetros */}
            <section className="flex flex-col gap-5 rounded-md border border-bg-700 bg-bg-800 p-4">
              {/* Activo */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span id="lbl-activo" className="text-xs text-text-400">
                    Agente activo
                  </span>
                  <span className="font-mono text-[11px] text-text-600">
                    {form.is_active ? "responde mensajes" : "no responde; los mensajes se guardan"}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_active}
                  aria-labelledby="lbl-activo"
                  onClick={() => set("is_active", !form.is_active)}
                  disabled={guardando}
                  className={cn(
                    "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors disabled:opacity-50",
                    form.is_active ? "border-success bg-success" : "border-bg-600 bg-bg-700",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform",
                      form.is_active && "translate-x-5",
                    )}
                  />
                </button>
              </div>

              {/* Modelo */}
              <Campo
                id="model"
                label="Modelo"
                hint={modelos.error ? `No se pudo cargar la lista: ${modelos.error}` : "Lista permitida por el servidor"}
              >
                <select
                  id="model"
                  value={form.model ?? ""}
                  onChange={(e) => set("model", e.target.value || null)}
                  disabled={guardando || modelos.loading}
                  className={selectClass}
                >
                  <option value="">Predeterminado del sistema</option>
                  {modeloFueraDeLista && (
                    <option value={modeloFueraDeLista}>{modeloFueraDeLista} (no listado)</option>
                  )}
                  {listaModelos.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Campo>

              {/* Temperatura */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="temperature" className="text-xs text-text-400">
                    Temperatura
                  </label>
                  <span className="font-mono text-[11px] tabular-nums text-text-100">
                    {form.temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  id="temperature"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.temperature}
                  onChange={(e) => set("temperature", Number(e.target.value))}
                  disabled={guardando}
                  className="w-full cursor-pointer accent-[var(--success)]"
                />
                <div className="flex justify-between font-mono text-[11px] text-text-600">
                  <span>0 · preciso</span>
                  <span>1 · creativo</span>
                </div>
              </div>

              {/* Historial */}
              <Campo
                id="history_window"
                label="Mensajes de contexto"
                hint={`Cuántos mensajes previos recuerda (${HISTORIAL_MIN}–${HISTORIAL_MAX})`}
              >
                <input
                  id="history_window"
                  type="number"
                  inputMode="numeric"
                  min={HISTORIAL_MIN}
                  max={HISTORIAL_MAX}
                  step={1}
                  value={form.history_window}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    set("history_window", Number.isNaN(n) ? HISTORIAL_MIN : n);
                  }}
                  disabled={guardando}
                  className={cn(inputClass, "tabular-nums")}
                />
              </Campo>
            </section>
          </div>
        </form>
      </div>
    </>
  );
}
