"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, PauseCircle, Sparkles, X } from "lucide-react";
import { HERRAMIENTAS_INFO, textosBloqueo } from "@/lib/herramientas-plan";
import type { AccesoPlanOut, BloqueoPlanDetalle } from "@/lib/types";
import { esGerencia } from "./modulo-vendedores";
import { claseBoton, PageHeader } from "./ui";
import { useUsuario } from "./usuario-context";

/*
 * Las tres piezas de bloqueo por plan comparten tono: paleta neutra (nunca
 * `danger`), sin role="alert", y siempre con una salida — o el CTA a la
 * suscripción, o seguir navegando. No es un "acceso denegado": es "esto
 * está en otro plan, así se consigue".
 */

function Contenido({
  bloqueo,
  enModal,
  acciones,
}: {
  bloqueo: BloqueoPlanDetalle;
  /** En el modal, título y descripción son los de Radix (aria-labelledby/-describedby). */
  enModal: boolean;
  acciones: ReactNode;
}) {
  const textos = textosBloqueo(bloqueo);
  const Titulo = enModal ? Dialog.Title : "h2";
  const Descripcion = enModal ? Dialog.Description : "p";
  const suspendida = bloqueo.codigo === "cuenta_suspendida";
  const Icono = suspendida ? PauseCircle : Sparkles;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-md border border-bg-700 bg-bg-800 text-text-400">
        <Icono size={20} aria-hidden />
      </div>

      <div className="flex flex-col gap-1.5">
        <Titulo
          id={enModal ? undefined : "bloqueo-plan-titulo"}
          className="text-sm font-medium text-text-100"
        >
          {textos.titulo}
        </Titulo>
        <Descripcion className="text-xs leading-relaxed text-text-400">
          {textos.descripcion}
        </Descripcion>
      </div>

      {!suspendida && (
        <ul className="flex flex-col gap-1.5 text-left">
          {HERRAMIENTAS_INFO[bloqueo.herramienta].beneficios.map((b) => (
            <li key={b} className="flex items-start gap-2 text-xs text-text-400">
              <Check size={13} className="mt-px shrink-0 text-success" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {acciones}
    </div>
  );
}

/** El CTA, o por qué esta persona no lo tiene (solo el dueño contrata). */
function Cta({ bloqueo, onNavegar }: { bloqueo: BloqueoPlanDetalle; onNavegar?: () => void }) {
  const { usuario } = useUsuario();
  const { cta } = textosBloqueo(bloqueo);
  if (!cta) return null;

  if (!esGerencia(usuario)) {
    return (
      <p className="font-mono text-[11px] text-text-600">
        pídele al dueño del negocio que {bloqueo.codigo === "plan_insuficiente" ? "mejore" : "active"}{" "}
        el plan
      </p>
    );
  }

  return (
    <Link href={cta.href} onClick={onNavegar} className={claseBoton("primario")}>
      {cta.etiqueta}
    </Link>
  );
}

// ------------------------------------------------------------
// Vista de página completa: la pantalla entera está fuera del plan
// ------------------------------------------------------------
export function BloqueoPlanVista({ bloqueo }: { bloqueo: BloqueoPlanDetalle }) {
  return (
    <>
      <PageHeader titulo={HERRAMIENTAS_INFO[bloqueo.herramienta].nombre} />
      <div className="flex flex-1 overflow-y-auto p-6">
        <section
          aria-labelledby="bloqueo-plan-titulo"
          className="m-auto flex w-full max-w-lg flex-col rounded-md border border-dashed border-bg-700 px-6 py-12"
        >
          <Contenido
            bloqueo={bloqueo}
            enModal={false}
            acciones={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Cta bloqueo={bloqueo} />
                <Link href="/dashboard" className={claseBoton("fantasma")}>
                  Volver al inicio
                </Link>
              </div>
            }
          />
        </section>
      </div>
    </>
  );
}

// ------------------------------------------------------------
// Modal: una acción en mitad de la sesión chocó con el plan
// ------------------------------------------------------------
export function BloqueoPlanModal({
  bloqueo,
  onCerrar,
}: {
  bloqueo: BloqueoPlanDetalle | null;
  onCerrar: () => void;
}) {
  return (
    <Dialog.Root open={bloqueo !== null} onOpenChange={(o) => !o && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-700 bg-bg-900 p-6 shadow-xl">
          <Dialog.Close
            className="absolute top-3 right-3 cursor-pointer rounded p-1 text-text-600 hover:bg-bg-800 hover:text-text-100"
            aria-label="Cerrar"
          >
            <X size={14} />
          </Dialog.Close>
          {bloqueo && (
            <Contenido
              bloqueo={bloqueo}
              enModal
              acciones={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Cta bloqueo={bloqueo} onNavegar={onCerrar} />
                  <Dialog.Close className={claseBoton("fantasma")}>Ahora no</Dialog.Close>
                </div>
              }
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ------------------------------------------------------------
// Franja fina: el plan no está vigente (recordatorio, no bloqueo)
// ------------------------------------------------------------
const FRANJA_CERRADA_KEY = "operativai_franja_plan_cerrada";

export function FranjaPlanInactivo({ acceso }: { acceso: AccesoPlanOut }) {
  const { usuario } = useUsuario();
  const [cerrada, setCerrada] = useState(
    () => typeof window !== "undefined" && window.sessionStorage.getItem(FRANJA_CERRADA_KEY) === acceso.estado,
  );

  const texto: Partial<Record<AccesoPlanOut["estado"], string>> = {
    vencido: "Tu plan venció. Renuévalo para seguir usando todas tus herramientas.",
    cancelado: "Tu plan está cancelado. Reactívalo cuando quieras; tu información sigue guardada.",
    sin_plan: "Todavía no tienes un plan. Elige uno para activar tus herramientas.",
  };
  const mensaje = texto[acceso.estado];
  if (!mensaje || cerrada) return null;

  const plan = acceso.plan ?? acceso.planes[0]?.nombre ?? null;
  const cerrar = () => {
    window.sessionStorage.setItem(FRANJA_CERRADA_KEY, acceso.estado);
    setCerrada(true);
  };

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-bg-700 bg-bg-900 px-6 py-2 text-xs text-text-400"
    >
      <Sparkles size={13} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{mensaje}</span>
      {esGerencia(usuario) && (
        <Link
          href={`/suscripcion${plan ? `?plan=${encodeURIComponent(plan)}` : ""}`}
          className="shrink-0 font-medium text-text-100 underline-offset-2 hover:underline"
        >
          {acceso.estado === "sin_plan" ? "Ver planes" : "Renovar"}
        </Link>
      )}
      <button
        type="button"
        onClick={cerrar}
        className="shrink-0 cursor-pointer rounded p-0.5 text-text-600 hover:bg-bg-800 hover:text-text-100"
        aria-label="Ocultar aviso"
      >
        <X size={13} />
      </button>
    </div>
  );
}
