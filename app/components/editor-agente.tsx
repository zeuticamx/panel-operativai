"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { FlaskConical, RotateCcw, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { mensajeErrorNumero } from "@/lib/numeros";
import { useApi } from "@/lib/use-api";
import type { AgenteConfig, LimitesAgente, ModelosOut, NumeroConfig, NumeroConfigIn } from "@/lib/types";
import { fmtInt } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { PanelProbarAgente } from "./panel-probar-agente";
import { Aviso, Boton, Campo, Cargando, PageHeader, claseBoton, inputClass, selectClass } from "./ui";

// Límites espejo de AgenteConfigIn en el backend. La validación real la
// hace el servidor; aquí solo se usan para los atributos min/max del form.
const PROMPT_MAX = 20000;
const PROMPT_MIN = 10;
const NOMBRE_MAX = 100;
const HISTORIAL_MIN = 5;
const HISTORIAL_MAX = 200;

/** A qué configuración apunta el editor: un número de WhatsApp, o Instagram, Facebook y el widget web. */
export type DestinoAgente = { tipo: "numero"; id: string } | { tipo: "social" };

/** La forma común de las dos configuraciones (el campo de encendido se llama distinto en cada una). */
interface Formulario {
  agent_name: string;
  system_prompt: string;
  model: string | null;
  temperature: number;
  history_window: number;
  activo: boolean;
}

interface Remoto {
  form: Formulario;
  limites: LimitesAgente | null;
  /** Datos propios de un número; null en Instagram, Facebook y widget. */
  numero: Pick<NumeroConfig, "estado" | "es_principal" | "es_linea_avisos" | "phone_number_id"> | null;
  incompleta: boolean;
}

function esNumero(d: AgenteConfig | NumeroConfig): d is NumeroConfig {
  return "agente_activo" in d;
}

function aRemoto(d: AgenteConfig | NumeroConfig): Remoto {
  if (esNumero(d)) {
    return {
      form: {
        agent_name: d.agent_name,
        system_prompt: d.system_prompt,
        model: d.model,
        temperature: d.temperature,
        history_window: d.history_window,
        activo: d.agente_activo,
      },
      limites: d.limites_plan,
      numero: {
        estado: d.estado,
        es_principal: d.es_principal,
        es_linea_avisos: d.es_linea_avisos,
        phone_number_id: d.phone_number_id,
      },
      incompleta: d.configuracion_incompleta,
    };
  }
  return {
    form: {
      agent_name: d.agent_name,
      system_prompt: d.system_prompt,
      model: d.model,
      temperature: d.temperature,
      history_window: d.history_window,
      activo: d.is_active,
    },
    limites: d.limites_plan ?? null,
    numero: null,
    incompleta: !d.agent_name.trim() || !d.system_prompt.trim(),
  };
}

function iguales(a: Formulario, b: Formulario) {
  return (
    a.agent_name === b.agent_name &&
    a.system_prompt === b.system_prompt &&
    (a.model ?? null) === (b.model ?? null) &&
    a.temperature === b.temperature &&
    a.history_window === b.history_window &&
    a.activo === b.activo
  );
}

/**
 * Editor de la configuración del agente de UN número de WhatsApp, o de la de
 * Instagram, Facebook y widget (spec 005a, RF-5, RF-17). `soloLectura` es el
 * member (RF-18): ve todo y no tiene ni botones de guardar ni campos activos.
 * `selector` es el control que elige a cuál se apunta; lo dibuja la página.
 */
export function EditorAgente({
  destino,
  soloLectura = false,
  selector,
}: {
  destino: DestinoAgente;
  soloLectura?: boolean;
  selector?: ReactNode;
}) {
  const ruta = destino.tipo === "numero" ? `/api/agente/numeros/${destino.id}` : "/api/agente";
  const remoto = useApi<AgenteConfig | NumeroConfig>(ruta);
  const modelos = useApi<ModelosOut>("/api/agente/modelos");

  // `original` = lo que hay en el servidor (lo cargado, o lo último guardado).
  // `local` = ediciones del usuario; null mientras no toque nada.
  // Así el formulario nunca pisa lo que el usuario está escribiendo.
  const [guardado, setGuardado] = useState<Remoto | null>(null);
  const [local, setLocal] = useState<Formulario | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);
  const exitoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const original: Remoto | null = guardado ?? (remoto.data ? aRemoto(remoto.data) : null);
  const form = local ?? original?.form ?? null;

  useEffect(() => {
    return () => {
      if (exitoTimeout.current) clearTimeout(exitoTimeout.current);
    };
  }, []);

  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) =>
    setLocal((f) => {
      const base = f ?? original?.form ?? null;
      return base ? { ...base, [k]: v } : f;
    });

  const sucio = Boolean(local && original && !iguales(local, original.form));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || guardando || soloLectura) return;
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      let respuesta: AgenteConfig | NumeroConfig;
      if (destino.tipo === "numero") {
        const cuerpo: NumeroConfigIn = {
          agent_name: form.agent_name.trim(),
          system_prompt: form.system_prompt,
          model: form.model || null,
          temperature: form.temperature,
          history_window: form.history_window,
          agente_activo: form.activo,
        };
        respuesta = await apiFetch<NumeroConfig>(ruta, { method: "PUT", json: cuerpo });
      } else {
        respuesta = await apiFetch<AgenteConfig>(ruta, {
          method: "PUT",
          json: {
            agent_name: form.agent_name.trim(),
            system_prompt: form.system_prompt,
            model: form.model || null,
            temperature: form.temperature,
            history_window: form.history_window,
            is_active: form.activo,
          },
        });
      }
      setGuardado(aRemoto(respuesta));
      setLocal(null);
      setExito("Configuración guardada. Los próximos mensajes ya usan estos ajustes.");
      if (exitoTimeout.current) clearTimeout(exitoTimeout.current);
      exitoTimeout.current = setTimeout(() => setExito(null), 5000);
    } catch (err) {
      setError(mensajeErrorNumero(err, "No se pudo guardar la configuración."));
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
        <div className="flex flex-col gap-3 p-4">
          {selector}
          <Aviso tipo="error">{remoto.error}</Aviso>
        </div>
      </>
    );
  }

  if (!form || !original) {
    return (
      <>
        <PageHeader titulo="Agente" />
        <div className="p-4">{selector}</div>
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

  // Lo que el plan deja elegir (viene del servidor, que es quien lo hace cumplir).
  const limites = original.limites;
  const modelosDelPlan = limites?.modelos_permitidos ?? listaModelos;
  // Con modelos limitados no hay "predeterminado del sistema": el servidor guarda el del plan.
  const planLimitaModelos = limites?.modelo_por_defecto != null;
  const historialTope = limites?.historial_maximo ?? HISTORIAL_MAX;
  const historialExcedido = form.history_window > historialTope;
  const modeloFueraDelPlan = Boolean(form.model) && !modelosDelPlan.includes(form.model as string);
  const nombrePlan = limites?.plan ? limites.plan.charAt(0).toUpperCase() + limites.plan.slice(1) : null;
  const bloqueado = guardando || soloLectura;
  const numero = original.numero;

  return (
    <>
      <PageHeader
        titulo="Agente"
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            {form.activo ? <Badge tone="success">activo</Badge> : <Badge tone="warning">apagado</Badge>}
            {numero?.estado === "pausado" && <Badge tone="warning">número pausado</Badge>}
            {numero?.es_principal && <Badge tone="info">principal</Badge>}
            {numero?.es_linea_avisos && <Badge tone="info">línea de avisos de plataforma</Badge>}
            {original.incompleta && <Badge tone="warning">configuración incompleta</Badge>}
            {sucio && <Badge tone="info">cambios sin guardar</Badge>}
            {soloLectura && <Badge>solo lectura</Badge>}
          </span>
        }
        acciones={
          soloLectura ? undefined : (
            <>
              {/* Cuestionario de bienvenida: también para negocios anteriores a él. */}
              <Link href="/bienvenida" className={claseBoton("fantasma")}>
                <Sparkles size={13} aria-hidden />
                Configuración guiada
              </Link>
              <Boton variante="secundario" onClick={() => setProbando(true)} aria-haspopup="dialog">
                <FlaskConical size={13} aria-hidden />
                Probar agente
              </Boton>
              <Boton variante="fantasma" onClick={descartar} disabled={!sucio || guardando}>
                <RotateCcw size={13} aria-hidden />
                Descartar
              </Boton>
              <Boton
                type="submit"
                form="form-agente"
                variante="primario"
                loading={guardando}
                disabled={!sucio || promptExcedido || historialExcedido || modeloFueraDelPlan}
              >
                Guardar cambios
              </Boton>
            </>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <form
          id="form-agente"
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-4xl flex-col gap-4"
          noValidate
        >
          {selector}
          {error && <Aviso tipo="error">{error}</Aviso>}
          {exito && <Aviso tipo="exito">{exito}</Aviso>}
          {original.incompleta && (
            <Aviso tipo="error">
              Configuración incompleta: falta el nombre del agente o sus instrucciones. Este agente no responde
              (ni tampoco las respuestas humanas desde el portal) hasta que lo completes.
            </Aviso>
          )}
          {numero?.estado === "pausado" && (
            <Aviso tipo="info">
              Este número está pausado: no responde ni envía nada. Puedes editar su configuración; se conserva al
              reactivarlo desde Canales.
            </Aviso>
          )}
          {numero?.es_linea_avisos && (
            <Aviso tipo="info">
              Línea de avisos de la plataforma: no cuenta para el cupo ni puede ser el número principal. Por lo demás
              es un agente como cualquier otro: lo puedes configurar, probar, pausar o cambiar.
            </Aviso>
          )}
          {soloLectura && <Aviso tipo="info">Puedes ver esta configuración, pero solo la gerencia puede editarla.</Aviso>}

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Columna principal: prompt */}
            <section
              data-tour="agente.identidad"
              className="flex flex-col gap-4 rounded-md border border-bg-700 bg-bg-800 p-4 lg:col-span-2"
            >
              <Campo id="agent_name" label="Nombre del agente" hint="Cómo se presenta ante tus clientes">
                <input
                  id="agent_name"
                  type="text"
                  value={form.agent_name}
                  onChange={(e) => set("agent_name", e.target.value)}
                  maxLength={NOMBRE_MAX}
                  disabled={bloqueado}
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
                  disabled={bloqueado}
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
                <span className="font-mono text-[11px] text-text-600">
                  Puedes pedirle a tu IA favorita que te ayude a redactar las instrucciones y las pegas aqui.
                </span>
              </div>
            </section>

            {/* Columna lateral: parámetros */}
            <section
              data-tour="agente.modelo"
              className="flex flex-col gap-5 rounded-md border border-bg-700 bg-bg-800 p-4"
            >
              {/* Activo */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span id="lbl-activo" className="text-xs text-text-400">
                    Agente activo
                  </span>
                  <span className="font-mono text-[11px] text-text-600">
                    {form.activo ? "responde mensajes" : "no responde; los mensajes se guardan"}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.activo}
                  aria-labelledby="lbl-activo"
                  onClick={() => set("activo", !form.activo)}
                  disabled={bloqueado}
                  className={cn(
                    "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors disabled:opacity-50",
                    form.activo ? "border-success bg-success" : "border-bg-600 bg-bg-700",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform",
                      form.activo && "translate-x-5",
                    )}
                  />
                </button>
              </div>

              {/* Modelo */}
              <Campo
                id="model"
                label="Modelo"
                hint={
                  modelos.error
                    ? `No se pudo cargar la lista: ${modelos.error}`
                    : planLimitaModelos && nombrePlan
                      ? `Tu plan ${nombrePlan} incluye ${modelosDelPlan.length} de ${listaModelos.length} modelos`
                      : "Lista permitida por el servidor"
                }
                error={modeloFueraDelPlan ? "Este modelo no está en tu plan. Elige uno incluido." : null}
              >
                <select
                  id="model"
                  value={form.model ?? ""}
                  onChange={(e) => set("model", e.target.value || null)}
                  disabled={bloqueado || modelos.loading}
                  className={selectClass}
                >
                  {!planLimitaModelos && <option value="">Predeterminado del sistema</option>}
                  {/* Un modelo guardado que no está en la lista (o null con plan limitado) se muestra para no perderlo en silencio. */}
                  {modeloFueraDeLista && <option value={modeloFueraDeLista}>{modeloFueraDeLista} (no listado)</option>}
                  {listaModelos.map((m) => {
                    const incluido = modelosDelPlan.includes(m);
                    return (
                      <option key={m} value={m} disabled={!incluido && m !== form.model}>
                        {incluido ? m : `${m} (requiere otro plan)`}
                      </option>
                    );
                  })}
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
                  disabled={bloqueado}
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
                hint={`Cuántos mensajes previos recuerda (${HISTORIAL_MIN}–${historialTope}${
                  historialTope < HISTORIAL_MAX && nombrePlan ? `, tope de tu plan ${nombrePlan}` : ""
                })`}
                error={
                  historialExcedido
                    ? `Tu plan permite hasta ${historialTope} mensajes. Mejora tu plan para dar más contexto.`
                    : null
                }
              >
                <input
                  id="history_window"
                  type="number"
                  inputMode="numeric"
                  min={HISTORIAL_MIN}
                  max={historialTope}
                  aria-invalid={historialExcedido || undefined}
                  step={1}
                  value={form.history_window}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    set("history_window", Number.isNaN(n) ? HISTORIAL_MIN : n);
                  }}
                  disabled={bloqueado}
                  className={cn(inputClass, "tabular-nums")}
                />
              </Campo>
            </section>
          </div>
        </form>
      </div>

      {!soloLectura && (
        <PanelProbarAgente
          abierto={probando}
          onCerrar={() => setProbando(false)}
          borrador={{
            agent_name: form.agent_name,
            system_prompt: form.system_prompt,
            model: form.model || null,
            temperature: form.temperature,
            history_window: form.history_window,
          }}
          numeroId={destino.tipo === "numero" ? destino.id : null}
          sucio={sucio}
          incompleto={!form.agent_name.trim() || !form.system_prompt.trim()}
        />
      )}
    </>
  );
}
