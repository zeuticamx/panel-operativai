"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { UserRound, X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { HistorialOut, PipelineOut, VendedorOut } from "@/lib/types";
import { formatoFechaHora, formatoMonto, iniciales, tiempoRelativo } from "@/lib/formato";
import { EstadoLead } from "./estado-lead";
import { HistorialTimeline } from "./historial-timeline";
import { Aviso, Boton, Campo, selectClass } from "./ui";

const AUTO = "__auto__";

/**
 * Detalle de un lead: datos, vendedor, línea de tiempo y —solo para
 * gerencia— reasignación manual. El estado NO se cambia desde aquí: eso
 * lo hace el vendedor desde su app.
 */
export function LeadDrawer({
  lead,
  vendedores,
  puedeAsignar,
  onClose,
  onCambio,
}: {
  lead: PipelineOut;
  /** Vendedores activos, para el selector de reasignación. */
  vendedores: VendedorOut[];
  puedeAsignar: boolean;
  onClose: () => void;
  /** Se llama después de una reasignación exitosa para refrescar la lista. */
  onCambio: (mensaje: string) => void;
}) {
  const historial = useApi<HistorialOut[]>(`/api/pipeline/${lead.user_id}/historial`);

  const [destino, setDestino] = useState<string>(lead.vendedor_id ?? AUTO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nombre = lead.cliente_nombre ?? lead.cliente_handle ?? "Cliente sin nombre";
  const cambio = destino !== (lead.vendedor_id ?? AUTO);

  const asignar = async () => {
    if (!cambio || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await apiFetch<PipelineOut>(`/api/pipeline/${lead.user_id}/asignar`, {
        method: "POST",
        json: { vendedor_id: destino === AUTO ? null : destino },
      });
      onCambio(
        r.vendedor_nombre
          ? `${nombre} ahora es de ${r.vendedor_nombre}.`
          : `${nombre} quedó sin vendedor asignado.`,
      );
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo reasignar el cliente."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o && !guardando) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-bg-700 bg-bg-900 shadow-xl">
          <header className="flex items-start gap-3 border-b border-bg-700 px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-bg-700 bg-bg-800 font-mono text-xs text-text-400">
              {iniciales(lead.cliente_nombre, lead.cliente_handle)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="truncate text-sm font-medium text-text-100">
                {nombre}
              </Dialog.Title>
              <Dialog.Description className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-text-600">
                {lead.cliente_handle && <span>{lead.cliente_handle}</span>}
                <EstadoLead estado={lead.estado} />
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Boton
                variante="fantasma"
                disabled={guardando}
                aria-label="Cerrar"
                className="min-h-8 shrink-0 px-2"
              >
                <X size={14} aria-hidden />
              </Boton>
            </Dialog.Close>
          </header>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            {/* Datos */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <Dato label="Vendedor">
                {lead.vendedor_nombre ?? (
                  <span className="text-warning">sin asignar</span>
                )}
              </Dato>
              <Dato label="Monto estimado">{formatoMonto(lead.monto_estimado)}</Dato>
              <Dato label="Última actividad">
                <span title={formatoFechaHora(lead.actualizado_en)}>
                  {tiempoRelativo(lead.actualizado_en)}
                </span>
              </Dato>
              {lead.estado === "perdido" && (
                <Dato label="Motivo de pérdida">
                  {lead.motivo_perdida ?? <span className="text-text-600">no indicado</span>}
                </Dato>
              )}
            </dl>

            {/* Reasignación */}
            {puedeAsignar && (
              <section className="flex flex-col gap-3 rounded-md border border-bg-700 bg-bg-950 p-3">
                {error && <Aviso tipo="error">{error}</Aviso>}
                <Campo
                  id="lead-vendedor"
                  label="Reasignar a"
                  hint={
                    vendedores.length === 0
                      ? "no hay vendedores activos"
                      : "el vendedor recibe el lead con su historial completo"
                  }
                >
                  <select
                    id="lead-vendedor"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    disabled={guardando}
                    className={selectClass}
                  >
                    <option value={AUTO}>Automático (según la estrategia del negocio)</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nombre} · {v.clientes_activos} abiertos
                      </option>
                    ))}
                  </select>
                </Campo>
                <div className="flex justify-end">
                  <Boton
                    variante="primario"
                    onClick={asignar}
                    loading={guardando}
                    disabled={!cambio}
                  >
                    <UserRound size={13} aria-hidden />
                    Reasignar
                  </Boton>
                </div>
              </section>
            )}

            {/* Línea de tiempo */}
            <HistorialTimeline
              historial={historial.data ?? []}
              cargando={historial.loading}
              error={historial.error}
              vacio="sin movimientos todavía"
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[11px] text-text-600">{label}</dt>
      <dd className="text-text-100">{children}</dd>
    </div>
  );
}
