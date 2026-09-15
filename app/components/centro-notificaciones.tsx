"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, X } from "lucide-react";
import { tiempoRelativo } from "@/lib/formato";
import type { AlertaOut, TipoAlerta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAlertas } from "./alertas-context";
import { useUsuario } from "./usuario-context";

// Un color por tipo, no `bg-*-50` con `border-l-*-500`: en el tema oscuro
// del portal un fondo pastel de light-mode se ve mal. El tinte a 10% de
// opacidad funciona igual sobre fondo oscuro o claro. "cierre" no estaba
// en el pedido original pero sí existe en schemas.TipoAlerta del backend.
const TIPO_CLASES: Record<TipoAlerta, string> = {
  nuevo_lead: "border-l-blue-500 bg-blue-500/10",
  cambio_etapa: "border-l-amber-500 bg-amber-500/10",
  sin_actividad: "border-l-orange-500 bg-orange-500/10",
  cuota_excedida: "border-l-red-500 bg-red-500/10",
  cierre: "border-l-emerald-500 bg-emerald-500/10",
};

/**
 * Centro de notificaciones: campana con contador de no leídas + modal con
 * el feed en vivo de backend/realtime.py. Sin props a propósito: el feed
 * sale de `AlertasProvider`, que es quien mantiene el socket abierto.
 */
export function CentroNotificaciones() {
  const { usuario } = useUsuario();
  const { alertas, noLeidosCount, marcarComoLeida } = useAlertas();
  const [open, setOpen] = useState(false);

  if (!usuario?.tenant_id) return null;

  const onClickAlerta = (alerta: AlertaOut) => {
    if (alerta.leido) return;
    // El hook ya revierte el estado optimista si el PATCH falla; acá no
    // hace falta un manejo de error aparte.
    marcarComoLeida(alerta.id).catch(() => {});
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={
            noLeidosCount > 0 ? `Notificaciones, ${noLeidosCount} sin leer` : "Notificaciones"
          }
          className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-400 hover:bg-bg-800 hover:text-text-100"
        >
          <Bell size={16} aria-hidden />
          {noLeidosCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] leading-none font-medium text-white">
              {noLeidosCount > 9 ? "9+" : noLeidosCount}
            </span>
          )}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(32rem,80vh)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-bg-700 bg-bg-900 shadow-xl">
          <header className="flex items-center justify-between gap-3 border-b border-bg-700 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <Dialog.Title className="text-sm font-medium text-text-100">
                Notificaciones
              </Dialog.Title>
              <Dialog.Description className="font-mono text-[11px] text-text-600">
                {noLeidosCount > 0 ? `${noLeidosCount} sin leer` : "Todo al día"}
              </Dialog.Description>
            </div>
            {/* Botón suelto y no `Boton` de ui.tsx a propósito: PageHeader
                (que vive en ui.tsx) dibuja esta campana, y volver a importar
                de ahí cerraría el ciclo entre los dos módulos. */}
            <Dialog.Close
              aria-label="Cerrar"
              className="inline-flex min-h-8 shrink-0 cursor-pointer items-center justify-center rounded-md px-2 text-text-400 transition-colors hover:bg-bg-800 hover:text-text-100"
            >
              <X size={14} aria-hidden />
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto">
            {alertas.length === 0 ? (
              <p className="flex h-32 items-center justify-center px-4 text-center text-xs text-text-600">
                Sin notificaciones
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 p-2">
                {alertas.map((alerta) => (
                  <li key={alerta.id}>
                    <button
                      type="button"
                      onClick={() => onClickAlerta(alerta)}
                      className={cn(
                        "w-full rounded-md border-l-4 px-3 py-2.5 text-left transition-opacity",
                        TIPO_CLASES[alerta.tipo] ?? "border-l-bg-600 bg-bg-800",
                        alerta.leido ? "cursor-default opacity-50" : "cursor-pointer",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-text-100">{alerta.titulo}</p>
                        {!alerta.leido && (
                          <span
                            className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-series-1"
                            aria-hidden
                          />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-text-400">{alerta.mensaje}</p>
                      <p className="mt-1 font-mono text-[10px] text-text-600">
                        {tiempoRelativo(alerta.creado_en)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
