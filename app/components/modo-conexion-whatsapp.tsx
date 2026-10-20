"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ModoConexionWhatsApp } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Boton } from "./ui";

interface OpcionModo {
  modo: ModoConexionWhatsApp;
  titulo: string;
  descripcion: string;
}

const OPCIONES: OpcionModo[] = [
  {
    modo: "standard",
    titulo: "Modo exclusivo API",
    descripcion:
      "El número opera 100% por la integración y el agente de IA. Es el modo estándar y el recomendado si nadie va a usar la app del móvil con esa línea.",
  },
  {
    modo: "coexistence",
    titulo: "Modo coexistencia",
    descripcion:
      "El número funciona a la vez en la app de WhatsApp Business del móvil y en la API. Tu equipo puede responder desde el móvil; esas respuestas aparecen aquí en solo lectura.",
  },
];

export interface ModoConexionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El plan vigente incluye la coexistencia; si no, la tarjeta se muestra bloqueada. */
  coexistenciaPermitida: boolean;
  loading?: boolean;
  onConfirm: (modo: ModoConexionWhatsApp) => void;
}

/**
 * Elegir cómo se vincula el número antes de abrir el Embedded Signup de Meta:
 * solo API (estándar) o coexistencia con la app de WhatsApp Business.
 */
export function ModoConexionDialog({
  open,
  onOpenChange,
  coexistenciaPermitida,
  loading = false,
  onConfirm,
}: ModoConexionDialogProps) {
  const [modo, setModo] = useState<ModoConexionWhatsApp>("standard");

  // Cada vez que se abre vuelve al modo estándar: la coexistencia nunca queda preseleccionada.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetear la elección al abrir es el patrón del resto del portal.
    if (open) setModo("standard");
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
          <Dialog.Title className="text-sm font-medium text-text-100">Conectar WhatsApp</Dialog.Title>
          <Dialog.Description className="mt-1.5 text-xs text-text-400">
            Elige cómo quieres conectar tu número. Después te llevamos a Meta para autorizarlo.
          </Dialog.Description>

          <div role="radiogroup" aria-label="Modo de conexión" className="mt-4 flex flex-col gap-2">
            {OPCIONES.map((o) => {
              const bloqueada = o.modo === "coexistence" && !coexistenciaPermitida;
              const elegida = modo === o.modo;
              const inputId = `modo-conexion-${o.modo}`;
              return (
                <label
                  key={o.modo}
                  htmlFor={inputId}
                  className={cn(
                    "flex gap-3 rounded-md border p-3 transition-colors",
                    elegida ? "border-success/60 bg-bg-800" : "border-bg-700 bg-bg-900",
                    bloqueada ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-bg-800",
                  )}
                >
                  <input
                    id={inputId}
                    type="radio"
                    name="modo-conexion"
                    value={o.modo}
                    checked={elegida}
                    disabled={bloqueada || loading}
                    onChange={() => setModo(o.modo)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--success)]"
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-medium text-text-100">{o.titulo}</span>
                    <span className="text-xs text-text-400">{o.descripcion}</span>
                    {bloqueada && (
                      <span className="text-xs text-warning">
                        Tu plan no incluye el modo coexistencia. Mejora tu plan para usarlo.
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Boton variante="secundario" disabled={loading}>
                Cancelar
              </Boton>
            </Dialog.Close>
            <Boton variante="primario" loading={loading} onClick={() => onConfirm(modo)}>
              Continuar con Meta
            </Boton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
