"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { formatoFechaHora, infoEventoAuditoria } from "@/lib/formato";
import type { ReservaAuditoriaOut } from "@/lib/types";
import { Aviso, Boton, Cargando } from "./ui";
import { Badge } from "./badge";

const PUNTO_TONE_CLASSES: Record<string, string> = {
  neutral: "bg-text-600",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-series-1",
};

/** Línea legible de lo que cambió, cuando el evento trae un antes/después que vale la pena resumir. */
function resumenCambio(e: ReservaAuditoriaOut): string | null {
  const antes = e.datos_anteriores as Record<string, string> | null;
  const despues = e.datos_nuevos as Record<string, string> | null;

  if (e.evento === "reprogramada" && antes?.hora_inicio && despues?.hora_inicio) {
    return `${formatoFechaHora(antes.hora_inicio)} → ${formatoFechaHora(despues.hora_inicio)}`;
  }
  if (e.evento === "cambio_barbero" && antes && despues) {
    return `${antes.proveedor_nombre ?? "—"} → ${despues.proveedor_nombre ?? "—"}`;
  }
  if (e.evento === "creada" && despues?.hora_inicio) {
    return `${despues.servicio_nombre ?? ""} con ${despues.proveedor_nombre ?? ""}, ${formatoFechaHora(despues.hora_inicio)}`;
  }
  return null;
}

/**
 * Escenario 4 de la historia de bitácora: línea de tiempo completa y
 * EXCLUSIVA de una cita, de su creación al estado actual. Ascendente (al
 * revés que la bitácora general, que es más reciente primero) porque acá
 * lo natural es leerla como una historia de principio a fin.
 */
export function ReservaHistorialModal({
  open,
  onOpenChange,
  tenantId,
  reservaId,
  titulo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tenantId: string;
  reservaId: string | null;
  titulo?: string;
}) {
  const ruta =
    open && reservaId ? `/api/tenants/${tenantId}/calendario/reservas/${reservaId}/auditoria` : null;
  const historial = useApi<ReservaAuditoriaOut[]>(ruta);
  const eventos = historial.data ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-sm font-medium text-text-100">
              Historial de la cita{titulo ? ` — ${titulo}` : ""}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="cursor-pointer rounded p-1 text-text-400 hover:bg-bg-800 hover:text-text-100"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {historial.loading && !historial.data ? (
              <Cargando />
            ) : historial.error ? (
              <Aviso tipo="error">{historial.error}</Aviso>
            ) : eventos.length === 0 ? (
              <p className="px-2 py-6 text-center font-mono text-xs text-text-600">
                Todavía no hay eventos registrados.
              </p>
            ) : (
              <ol className="flex flex-col gap-4 border-l border-bg-700 pl-4">
                {eventos.map((e) => {
                  const info = infoEventoAuditoria(e.evento);
                  const resumen = resumenCambio(e);
                  return (
                    <li key={e.id} className="relative">
                      <span
                        className={`absolute top-1 -left-[1.16rem] h-2.5 w-2.5 rounded-full border-2 border-bg-900 ${PUNTO_TONE_CLASSES[info.tone]}`}
                        aria-hidden
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={info.tone}>{info.label}</Badge>
                        <span className="font-mono text-[11px] tabular-nums text-text-600">
                          {formatoFechaHora(e.creado_en)}
                        </span>
                      </div>
                      {resumen && <p className="mt-1 text-xs text-text-100">{resumen}</p>}
                      {e.motivo && (
                        <p className="mt-1 text-xs text-text-400">Motivo: {e.motivo}</p>
                      )}
                      <p className="mt-1 font-mono text-[11px] text-text-600">
                        {e.origen === "portal" ? "Portal" : "Chat"} · {e.actor}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <Boton variante="secundario">Cerrar</Boton>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
