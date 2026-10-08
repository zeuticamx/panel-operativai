"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatoFechaHora, formatoMonto } from "@/lib/formato";
import { HERRAMIENTAS_INFO, capitalizar } from "@/lib/herramientas-plan";
import {
  CANALES_ONBOARDING,
  DESCRIPCION_MAX,
  EQUIPO_MAX,
  GIROS,
  HORARIO_MAX,
  TONOS,
  conGiro,
  respuestasIniciales,
} from "@/lib/onboarding";
import type { OnboardingAplicado, OnboardingOut, OnboardingRespuestas } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Aviso, Boton, Campo, Cargando, Interruptor, PageHeader, claseBoton, inputClass } from "@/app/components/ui";
import { usePlan } from "@/app/components/plan-context";
import { useUsuario } from "@/app/components/usuario-context";

const PASOS = ["Tu negocio", "Cómo atiendes", "Tu agente", "Resumen"] as const;

export default function BienvenidaPage() {
  const remoto = useApi<OnboardingOut>("/api/onboarding");
  const { usuario, recargar: recargarUsuario } = useUsuario();
  const { recargar: recargarPlan } = usePlan();
  const router = useRouter();
  const [omitiendo, setOmitiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const omitir = async () => {
    setOmitiendo(true);
    setError(null);
    try {
      await apiFetch("/api/onboarding/omitir", { method: "POST" });
      recargarUsuario?.();
      router.replace("/dashboard");
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo omitir el cuestionario."));
      setOmitiendo(false);
    }
  };

  const yaAplicado = remoto.data?.estado === "completado";

  return (
    <>
      <PageHeader
        titulo="Configura tu negocio"
        sub={usuario?.nombre_negocio ?? undefined}
        acciones={
          !yaAplicado && remoto.data ? (
            <Boton variante="fantasma" onClick={omitir} loading={omitiendo}>
              Omitir por ahora
            </Boton>
          ) : undefined
        }
      />
      {/* pb-20 en móvil: los botones del paso no quedan bajo el botón flotante del chat. */}
      <div className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {remoto.error && <Aviso tipo="error">{remoto.error}</Aviso>}
          {!remoto.data && remoto.loading && <Cargando texto="cargando cuestionario…" />}
          {remoto.data && (
            <Cuestionario
              inicial={remoto.data}
              alAplicar={() => {
                recargarUsuario?.();
                void recargarPlan();
                // Ya completado: el encabezado deja de ofrecer "Omitir".
                void remoto.recargar(true);
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Se monta cuando ya llegó GET /api/onboarding: así el estado del form nace
 * de las respuestas guardadas sin un efecto que lo sincronice.
 */
function Cuestionario({ inicial, alAplicar }: { inicial: OnboardingOut; alAplicar: () => void }) {
  const [r, setR] = useState<OnboardingRespuestas>(inicial.respuestas ?? respuestasIniciales());
  const [paso, setPaso] = useState(0);
  const [vista, setVista] = useState<OnboardingOut | null>(null);
  const [resultado, setResultado] = useState<OnboardingAplicado | null>(null);
  const [sobrescribir, setSobrescribir] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiar = <K extends keyof OnboardingRespuestas>(campo: K, valor: OnboardingRespuestas[K]) =>
    setR((prev) => ({ ...prev, [campo]: valor }));

  // Entrar al resumen guarda las respuestas: la vista previa la arma el
  // backend con el catálogo de planes vigente.
  const irA = async (siguiente: number) => {
    setError(null);
    if (siguiente !== PASOS.length - 1) {
      setPaso(siguiente);
      return;
    }
    setOcupado(true);
    try {
      setVista(await apiFetch<OnboardingOut>("/api/onboarding", { method: "PUT", json: r }));
      setPaso(siguiente);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudieron guardar tus respuestas."));
    } finally {
      setOcupado(false);
    }
  };

  const aplicar = async () => {
    setOcupado(true);
    setError(null);
    try {
      const out = await apiFetch<OnboardingAplicado>("/api/onboarding/aplicar", {
        method: "POST",
        json: { sobrescribir_prompt: sobrescribir },
      });
      setResultado(out);
      alAplicar();
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo aplicar la configuración."));
    } finally {
      setOcupado(false);
    }
  };

  if (resultado) return <Resultado resultado={resultado} />;

  const ultimo = paso === PASOS.length - 1;

  return (
    <>
      {inicial.estado === "completado" && paso === 0 && (
        <Aviso tipo="info">
          Ya aplicaste este cuestionario. Puedes cambiar tus respuestas y volver a aplicarlo; si editaste el
          prompt del agente a mano, te preguntaremos antes de reemplazarlo.
        </Aviso>
      )}

      <ol className="flex gap-1.5" aria-label="Pasos del cuestionario">
        {PASOS.map((nombre, i) => (
          <li key={nombre} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={cn("h-1 rounded-full", i <= paso ? "bg-success" : "bg-bg-700")} />
            <span
              className={cn(
                "truncate font-mono text-[11px]",
                i === paso ? "text-text-100" : "text-text-600",
              )}
              aria-current={i === paso ? "step" : undefined}
            >
              {nombre}
            </span>
          </li>
        ))}
      </ol>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {paso === 0 && <PasoNegocio r={r} setR={setR} cambiar={cambiar} />}
      {paso === 1 && <PasoAtencion r={r} cambiar={cambiar} />}
      {paso === 2 && <PasoAgente r={r} cambiar={cambiar} />}
      {paso === 3 && vista && (
        <PasoResumen vista={vista} sobrescribir={sobrescribir} setSobrescribir={setSobrescribir} />
      )}

      <div className="flex items-center justify-between gap-2 border-t border-bg-700 pt-4">
        <Boton variante="secundario" onClick={() => irA(paso - 1)} disabled={paso === 0 || ocupado}>
          <ArrowLeft size={13} aria-hidden />
          Atrás
        </Boton>
        {ultimo ? (
          <Boton variante="primario" onClick={aplicar} loading={ocupado}>
            <Check size={13} aria-hidden />
            Aplicar configuración
          </Boton>
        ) : (
          <Boton variante="primario" onClick={() => irA(paso + 1)} loading={ocupado}>
            {paso === PASOS.length - 2 ? "Ver recomendación" : "Siguiente"}
            <ArrowRight size={13} aria-hidden />
          </Boton>
        )}
      </div>
    </>
  );
}

type Cambiar = <K extends keyof OnboardingRespuestas>(campo: K, valor: OnboardingRespuestas[K]) => void;

function Seccion({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-bg-700 bg-bg-900 p-4">
      <header>
        <h2 className="text-sm font-medium text-text-100">{titulo}</h2>
        {sub && <p className="mt-0.5 text-xs text-text-400">{sub}</p>}
      </header>
      {children}
    </section>
  );
}

function PasoNegocio({
  r,
  setR,
  cambiar,
}: {
  r: OnboardingRespuestas;
  setR: (f: (prev: OnboardingRespuestas) => OnboardingRespuestas) => void;
  cambiar: Cambiar;
}) {
  return (
    <Seccion titulo="¿Qué tipo de negocio tienes?" sub="Con esto preparamos las instrucciones de tu agente.">
      <div role="radiogroup" aria-label="Tipo de negocio" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {GIROS.map((g) => {
          const activo = r.giro === g.valor;
          return (
            <button
              key={g.valor}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => setR((prev) => conGiro(prev, g.valor))}
              className={cn(
                "flex min-h-14 cursor-pointer flex-col items-start rounded-md border px-3 py-2 text-left transition-colors",
                activo ? "border-success/60 bg-success-bg" : "border-bg-700 hover:bg-hover",
              )}
            >
              <span className="text-sm text-text-100">{g.etiqueta}</span>
              <span className="font-mono text-[11px] text-text-600">{g.ejemplo}</span>
            </button>
          );
        })}
      </div>
      <Campo
        id="onb-descripcion"
        label="¿Qué vendes u ofreces? (opcional)"
        hint={`${r.descripcion.length}/${DESCRIPCION_MAX} · tu agente lo usará para presentarse`}
      >
        <textarea
          id="onb-descripcion"
          rows={3}
          maxLength={DESCRIPCION_MAX}
          value={r.descripcion}
          onChange={(e) => cambiar("descripcion", e.target.value)}
          placeholder="Ej.: cortes de cabello y barba para caballero, con productos de marca propia"
          className={inputClass}
        />
      </Campo>
    </Seccion>
  );
}

function Pregunta({
  titulo,
  detalle,
  valor,
  onChange,
}: {
  titulo: string;
  detalle: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-bg-700 pt-3 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm text-text-100">{titulo}</span>
        <span className="text-xs text-text-400">{detalle}</span>
      </div>
      <Interruptor label={titulo} checked={valor} onChange={onChange} />
    </div>
  );
}

function NumeroEquipo({
  id,
  label,
  hint,
  valor,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  valor: number;
  onChange: (n: number) => void;
}) {
  return (
    <Campo id={id} label={label} hint={hint}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={EQUIPO_MAX}
        value={valor}
        onChange={(e) => {
          const n = Math.trunc(Number(e.target.value));
          onChange(Number.isFinite(n) ? Math.min(Math.max(n, 0), EQUIPO_MAX) : 0);
        }}
        className={cn(inputClass, "max-w-32")}
      />
    </Campo>
  );
}

function PasoAtencion({ r, cambiar }: { r: OnboardingRespuestas; cambiar: Cambiar }) {
  const conVendedores = r.vende_por_chat || r.visitas_campo;
  return (
    <Seccion titulo="¿Cómo atiendes a tus clientes?" sub="Marca lo que aplica; lo puedes cambiar después.">
      <div className="flex flex-col gap-3">
        <Pregunta
          titulo="Mis clientes reservan citas"
          detalle="El agente consulta tu agenda y reserva desde el chat."
          valor={r.agenda_citas}
          onChange={(v) => cambiar("agenda_citas", v)}
        />
        <Pregunta
          titulo="Vendo por chat y quiero dar seguimiento"
          detalle="Los interesados pasan a un embudo y se reparten entre tu equipo."
          valor={r.vende_por_chat}
          onChange={(v) => cambiar("vende_por_chat", v)}
        />
        <Pregunta
          titulo="Mi equipo visita clientes en persona"
          detalle="Cartera con ubicación, visitas y reportes de campo."
          valor={r.visitas_campo}
          onChange={(v) => cambiar("visitas_campo", v)}
        />
        <Pregunta
          titulo="El agente debe consultar mis datos"
          detalle="Inventario, precios o políticas en Google Sheets o Docs."
          valor={r.consulta_sistemas}
          onChange={(v) => cambiar("consulta_sistemas", v)}
        />
      </div>

      {(conVendedores || r.agenda_citas) && (
        <div className="grid grid-cols-1 gap-3 border-t border-bg-700 pt-3 sm:grid-cols-2">
          {conVendedores && (
            <NumeroEquipo
              id="onb-vendedores"
              label="¿Cuántos vendedores tienes?"
              hint="nos ayuda a elegir el plan"
              valor={r.num_vendedores}
              onChange={(n) => cambiar("num_vendedores", n)}
            />
          )}
          {r.agenda_citas && (
            <NumeroEquipo
              id="onb-proveedores"
              label="¿Cuántas personas atienden citas?"
              hint="barberos, médicos, asesores…"
              valor={r.num_proveedores}
              onChange={(n) => cambiar("num_proveedores", n)}
            />
          )}
        </div>
      )}
    </Seccion>
  );
}

function PasoAgente({ r, cambiar }: { r: OnboardingRespuestas; cambiar: Cambiar }) {
  const alternarCanal = (canal: OnboardingRespuestas["canales"][number]) =>
    cambiar("canales", r.canales.includes(canal) ? r.canales.filter((c) => c !== canal) : [...r.canales, canal]);

  return (
    <Seccion titulo="¿Cómo debe hablar tu agente?">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-xs text-text-400">¿Por dónde te escriben tus clientes?</legend>
        <div className="flex flex-wrap gap-2">
          {CANALES_ONBOARDING.map((c) => {
            const activo = r.canales.includes(c.valor);
            return (
              <button
                key={c.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => alternarCanal(c.valor)}
                className={cn(
                  "min-h-9 cursor-pointer rounded-md border px-3 text-xs font-medium",
                  activo ? "border-success/60 bg-success-bg text-text-100" : "border-bg-700 text-text-400 hover:bg-hover",
                )}
              >
                {c.etiqueta}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-xs text-text-400">Tono</legend>
        <div role="radiogroup" aria-label="Tono del agente" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TONOS.map((t) => {
            const activo = r.tono === t.valor;
            return (
              <button
                key={t.valor}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => cambiar("tono", t.valor)}
                className={cn(
                  "flex cursor-pointer flex-col items-start rounded-md border px-3 py-2 text-left",
                  activo ? "border-success/60 bg-success-bg" : "border-bg-700 hover:bg-hover",
                )}
              >
                <span className="text-sm text-text-100">{t.etiqueta}</span>
                <span className="text-xs text-text-400">{t.ejemplo}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Campo id="onb-horario" label="Horario de atención (opcional)" hint="el agente lo comparte cuando se lo pregunten">
        <input
          id="onb-horario"
          maxLength={HORARIO_MAX}
          value={r.horario}
          onChange={(e) => cambiar("horario", e.target.value)}
          placeholder="Ej.: lunes a sábado de 10 a 20 h"
          className={inputClass}
        />
      </Campo>
    </Seccion>
  );
}

function PasoResumen({
  vista,
  sobrescribir,
  setSobrescribir,
}: {
  vista: OnboardingOut;
  sobrescribir: boolean;
  setSobrescribir: (v: boolean) => void;
}) {
  const reco = vista.recomendacion;
  if (!reco) return <Aviso tipo="error">No se pudo armar la recomendación.</Aviso>;
  const plan = reco.plan;

  return (
    <>
      {plan && (
        <section className="flex flex-col gap-3 rounded-md border border-success/40 bg-bg-900 p-4">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] text-text-600">PLAN RECOMENDADO</p>
              <h2 className="mt-0.5 flex items-center gap-2 text-lg font-medium text-text-100">
                <Sparkles size={16} className="text-success" aria-hidden />
                {capitalizar(plan.nombre)}
              </h2>
            </div>
            <p className="text-sm text-text-100">
              {formatoMonto(plan.precio_monthly)}
              <span className="text-xs text-text-400"> / mes</span>
            </p>
          </header>

          <ul className="flex flex-col gap-1 text-xs text-text-400">
            {plan.herramientas.map((h) => (
              <li key={h} className="flex items-center gap-2">
                <Check size={12} className="shrink-0 text-success" aria-hidden />
                {HERRAMIENTAS_INFO[h].nombre}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Check size={12} className="shrink-0 text-success" aria-hidden />
              {plan.max_vendedores === null ? "Vendedores sin límite" : `Hasta ${plan.max_vendedores} vendedores`}
            </li>
          </ul>

          {!plan.cubre_todo && (
            <Aviso tipo="info">
              Ningún plan cubre todo lo que necesitas ({plan.faltantes.join(", ")}). Este es el más cercano;
              escríbenos y lo armamos contigo.
            </Aviso>
          )}
          {vista.prueba_disponible ? (
            <Aviso tipo="exito">
              Al aplicar, te activamos el plan {capitalizar(plan.nombre)} gratis por {vista.dias_prueba} días. Sin
              tarjeta: al terminar eliges si lo contratas.
            </Aviso>
          ) : (
            <p className="text-xs text-text-400">
              Puedes contratarlo o cambiar de plan desde{" "}
              <Link href={`/suscripcion?plan=${encodeURIComponent(plan.nombre)}`} className="text-text-100 underline">
                Suscripción
              </Link>
              .
            </p>
          )}
        </section>
      )}

      <Seccion titulo="Lo que vamos a configurar">
        <ul className="flex flex-col gap-1.5 text-xs text-text-400">
          {reco.modulos.map((m) => (
            <li key={m} className="flex items-start gap-2">
              <Check size={12} className="mt-0.5 shrink-0 text-success" aria-hidden />
              <span>
                <span className="text-text-100">{HERRAMIENTAS_INFO[m].nombre}</span> —{" "}
                {HERRAMIENTAS_INFO[m].beneficios[0]}
              </span>
            </li>
          ))}
          <li className="flex items-start gap-2">
            <Check size={12} className="mt-0.5 shrink-0 text-success" aria-hidden />
            <span>
              <span className="text-text-100">Instrucciones del agente</span> — escritas para tu tipo de negocio
            </span>
          </li>
        </ul>

        <details className="rounded-md border border-bg-700">
          <summary className="cursor-pointer px-3 py-2 text-xs text-text-400 hover:text-text-100">
            Ver las instrucciones (system prompt)
          </summary>
          <pre className="max-h-72 overflow-auto border-t border-bg-700 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-text-400">
            {reco.system_prompt}
          </pre>
        </details>

        {vista.prompt_editado && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-bg-950 p-3">
            <p className="text-xs text-text-400">
              Ya escribiste tus propias instrucciones para el agente. ¿Reemplazarlas por estas? Si no, se conservan
              las tuyas.
            </p>
            <Interruptor label="Reemplazar mis instrucciones" checked={sobrescribir} onChange={setSobrescribir} />
          </div>
        )}
      </Seccion>
    </>
  );
}

function Resultado({ resultado }: { resultado: OnboardingAplicado }) {
  const plan = resultado.plan_recomendado;
  return (
    <section className="flex flex-col gap-4 rounded-md border border-bg-700 bg-bg-900 p-5">
      <h2 className="flex items-center gap-2 text-base font-medium text-text-100">
        <Check size={16} className="text-success" aria-hidden />
        ¡Listo! Tu agente está configurado
      </h2>

      {resultado.prueba && (
        <Aviso tipo="exito">
          Tienes el plan {capitalizar(resultado.prueba.plan)} de prueba hasta el{" "}
          {formatoFechaHora(resultado.prueba.vence)}.
        </Aviso>
      )}

      <ul className="flex flex-col gap-1.5 text-xs text-text-400">
        {resultado.prompt_actualizado ? (
          <li>· Instrucciones del agente actualizadas para tu negocio.</li>
        ) : (
          <li>· Conservamos las instrucciones que ya habías escrito.</li>
        )}
        {resultado.modulos_encendidos.map((m) => (
          <li key={m}>· {HERRAMIENTAS_INFO[m].nombre}: activo.</li>
        ))}
      </ul>

      {resultado.modulos_pendientes.length > 0 && (
        <Aviso tipo="info">
          {resultado.modulos_pendientes.map((m) => HERRAMIENTAS_INFO[m].nombre).join(", ")}{" "}
          {resultado.modulos_pendientes.length === 1 ? "se activa" : "se activan"} al contratar
          {plan ? ` el plan ${capitalizar(plan)}` : " un plan"}.
        </Aviso>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/canales" className={claseBoton("primario")}>
          Conectar un canal
          <ArrowRight size={13} aria-hidden />
        </Link>
        <Link href="/agente" className={claseBoton("secundario")}>
          Revisar el agente
        </Link>
        {resultado.modulos_pendientes.length > 0 && plan && (
          <Link href={`/suscripcion?plan=${encodeURIComponent(plan)}`} className={claseBoton("secundario")}>
            Ver plan {capitalizar(plan)}
          </Link>
        )}
        <Link href="/dashboard" className={claseBoton("fantasma")}>
          Ir al dashboard
        </Link>
      </div>
    </section>
  );
}
