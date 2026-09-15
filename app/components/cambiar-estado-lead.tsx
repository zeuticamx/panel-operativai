"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import type { PipelineOut } from "@/lib/types";
import { infoEstadoPipeline } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { EstadoLead } from "./estado-lead";
import { Aviso, Boton, Campo, inputClass, selectClass } from "./ui";

/**
 * Dialog para mover un lead a otra etapa del embudo. Solo ofrece los
 * destinos que la máquina de estados permite desde la etapa actual
 * (`lead.transiciones_posibles`): el backend vuelve a validar la
 * transición igual, pero así no se le muestran al usuario opciones que
 * de todos modos van a rebotar con 409.
 */
export function CambiarEstadoLead({
  lead,
  open,
  onOpenChange,
  onGuardado,
}: {
  lead: PipelineOut;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama después de un cambio de etapa exitoso, con el lead actualizado. */
  onGuardado: (lead: PipelineOut, mensaje: string) => void;
}) {
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [montoEstimado, setMontoEstimado] = useState("");
  const [motivoPerdida, setMotivoPerdida] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre (o cambia el lead detrás), se vuelve a partir del
  // estado real en el servidor: si quedó abierto un cambio a medias no
  // debe sobrevivir a cerrar y reabrir el dialog.
  useEffect(() => {
    if (!open) return;
    setNuevoEstado("");
    setMontoEstimado(lead.monto_estimado ?? "");
    setMotivoPerdida("");
    setNota("");
    setError(null);
  }, [open, lead]);

  const nombre = lead.cliente_nombre ?? lead.cliente_handle ?? "Cliente sin nombre";
  const cambio = nuevoEstado !== "";
  const requierePerdida = nuevoEstado === "perdido";
  const montoValido =
    montoEstimado.trim() === "" ||
    (!Number.isNaN(Number(montoEstimado)) && Number(montoEstimado) >= 0);
  const motivoValido = !requierePerdida || motivoPerdida.trim().length > 0;
  const puedeGuardar = cambio && montoValido && motivoValido && !guardando;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { estado: nuevoEstado };
      if (nota.trim()) body.nota = nota.trim();
      if (montoEstimado.trim()) body.monto_estimado = Number(montoEstimado);
      if (requierePerdida) body.motivo_perdida = motivoPerdida.trim();

      const r = await apiFetch<PipelineOut>(`/api/pipeline/${lead.user_id}/estado`, {
        method: "PATCH",
        json: body,
      });
      onGuardado(r, `${nombre} pasó a ${infoEstadoPipeline(nuevoEstado).label}.`);
      onOpenChange(false);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo cambiar el estado."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!guardando) onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-700 bg-bg-900 shadow-xl">
          <header className="flex items-start gap-3 border-b border-bg-700 px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="text-sm font-medium text-text-100">
                Cambiar estado
              </Dialog.Title>
              <Dialog.Description className="truncate font-mono text-[11px] text-text-600">
                {nombre}
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

          <div className="flex flex-col gap-4 px-5 py-4">
            {error && <Aviso tipo="error">{error}</Aviso>}

            <Campo id="lead-estado-actual" label="Estado actual">
              <div className={cn(inputClass, "flex items-center bg-bg-950")}>
                <EstadoLead estado={lead.estado} />
              </div>
            </Campo>

            <Campo
              id="lead-nuevo-estado"
              label="Nuevo estado"
              hint={
                lead.transiciones_posibles.length === 0
                  ? "esta etapa no tiene salidas posibles"
                  : undefined
              }
            >
              <select
                id="lead-nuevo-estado"
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value)}
                disabled={guardando || lead.transiciones_posibles.length === 0}
                className={selectClass}
              >
                <option value="">Selecciona un estado…</option>
                {lead.transiciones_posibles.map((estado) => (
                  <option key={estado} value={estado}>
                    {infoEstadoPipeline(estado).label}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              id="lead-monto"
              label="Monto estimado"
              hint="Opcional"
              error={montoEstimado.trim() && !montoValido ? "Debe ser un número válido" : undefined}
            >
              <input
                id="lead-monto"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={montoEstimado}
                onChange={(e) => setMontoEstimado(e.target.value)}
                disabled={guardando}
                placeholder="0.00"
                className={inputClass}
              />
            </Campo>

            {requierePerdida && (
              <Campo
                id="lead-motivo-perdida"
                label="Motivo de pérdida"
                hint="Obligatorio para marcar como perdido"
                error={
                  !motivoPerdida.trim() ? "Indica por qué se perdió el cliente" : undefined
                }
              >
                <textarea
                  id="lead-motivo-perdida"
                  value={motivoPerdida}
                  onChange={(e) => setMotivoPerdida(e.target.value)}
                  disabled={guardando}
                  rows={2}
                  maxLength={1000}
                  placeholder="Precio, competencia, sin respuesta…"
                  className={cn(inputClass, "resize-y")}
                />
              </Campo>
            )}

            <Campo id="lead-nota" label="Nota" hint="Opcional, queda en la bitácora">
              <textarea
                id="lead-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                disabled={guardando}
                rows={2}
                maxLength={1000}
                placeholder="Contexto del cambio…"
                className={cn(inputClass, "resize-y")}
              />
            </Campo>
          </div>

          <footer className="flex justify-end gap-2 border-t border-bg-700 px-5 py-3">
            <Dialog.Close asChild>
              <Boton variante="secundario" disabled={guardando}>
                Cancelar
              </Boton>
            </Dialog.Close>
            <Boton variante="primario" onClick={guardar} loading={guardando} disabled={!puedeGuardar}>
              Guardar
            </Boton>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
