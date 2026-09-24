"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { History } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { formatoFechaHora, formatoHora, infoEstadoReserva } from "@/lib/formato";
import type { MetodoPago, ProveedorOut, ReservaOut, ServicioOut } from "@/lib/types";
import { ReservaHistorialModal } from "./reserva-historial-modal";
import { Aviso, Boton, ConfirmDialog, inputClass } from "./ui";
import { Badge } from "./badge";

/**
 * Detalle de una reserva: ver datos, reprogramar (delega en ReservaForm vía
 * `onReprogramar`), reasignar barbero, cancelar (con confirmación, libera
 * el horario de inmediato), marcar el resultado de la cita ya pasada, o
 * abrir su historial completo (bitácora, Escenario 4).
 */
export function ReservaDetalle({
  open,
  onOpenChange,
  reserva,
  tenantId,
  proveedores,
  servicios,
  onReprogramar,
  onCambiado,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reserva: ReservaOut | null;
  tenantId: string;
  proveedores: ProveedorOut[];
  servicios: ServicioOut[];
  onReprogramar: (reserva: ReservaOut) => void;
  onCambiado: (mensaje: string) => void;
}) {
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const [procesando, setProcesando] = useState<"cancelar" | "completada" | "no_asistio" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [reasignarAbierto, setReasignarAbierto] = useState(false);
  const [nuevoProveedorId, setNuevoProveedorId] = useState("");
  const [reasignando, setReasignando] = useState(false);
  const [errorReasignar, setErrorReasignar] = useState<string | null>(null);
  const [completarAbierto, setCompletarAbierto] = useState(false);
  const [precioCobrado, setPrecioCobrado] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [errorCompletar, setErrorCompletar] = useState<string | null>(null);

  if (!reserva) return null;
  const info = infoEstadoReserva(reserva.estado);
  const activa = reserva.estado === "confirmada";
  const otrosProveedores = proveedores.filter((p) => p.id !== reserva.proveedor_id && p.activo);

  const abrirReasignar = () => {
    setErrorReasignar(null);
    setNuevoProveedorId(otrosProveedores[0]?.id ?? "");
    setReasignarAbierto(true);
  };

  const reasignar = async () => {
    if (!nuevoProveedorId) return;
    setReasignando(true);
    setErrorReasignar(null);
    try {
      await apiFetch(`/api/tenants/${tenantId}/calendario/reservas/${reserva.id}/reasignar`, {
        method: "PATCH",
        json: { proveedor_id: nuevoProveedorId },
      });
      setReasignarAbierto(false);
      onOpenChange(false);
      onCambiado("Se cambió el barbero de la cita.");
    } catch (e) {
      setErrorReasignar(mensajeDeError(e, "No se pudo cambiar el barbero."));
    } finally {
      setReasignando(false);
    }
  };

  const cancelar = async () => {
    setProcesando("cancelar");
    setError(null);
    try {
      await apiFetch(`/api/tenants/${tenantId}/calendario/reservas/${reserva.id}/cancelar`, {
        method: "POST",
        json: {},
      });
      setConfirmCancelar(false);
      onOpenChange(false);
      onCambiado("Reserva cancelada.");
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo cancelar la reserva."));
    } finally {
      setProcesando(null);
    }
  };

  const marcarNoAsistio = async () => {
    setProcesando("no_asistio");
    setError(null);
    try {
      await apiFetch(`/api/tenants/${tenantId}/calendario/reservas/${reserva.id}/estado`, {
        method: "PATCH",
        json: { estado: "no_asistio" },
      });
      onOpenChange(false);
      onCambiado("Reserva marcada como no asistió.");
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo actualizar la reserva."));
    } finally {
      setProcesando(null);
    }
  };

  const abrirCompletar = () => {
    setErrorCompletar(null);
    const servicio = servicios.find((s) => s.id === reserva.servicio_id);
    setPrecioCobrado(servicio?.precio ?? "");
    setMetodoPago("efectivo");
    setCompletarAbierto(true);
  };

  const completar = async () => {
    const precio = precioCobrado.trim();
    if (!precio || Number.isNaN(Number(precio)) || Number(precio) < 0) {
      setErrorCompletar("Indica el precio cobrado (un número mayor o igual a 0).");
      return;
    }
    setProcesando("completada");
    setErrorCompletar(null);
    try {
      await apiFetch(`/api/tenants/${tenantId}/calendario/reservas/${reserva.id}/estado`, {
        method: "PATCH",
        json: { estado: "completada", precio_cobrado: precio, metodo_pago: metodoPago },
      });
      setCompletarAbierto(false);
      onOpenChange(false);
      onCambiado("Reserva marcada como completada.");
    } catch (e) {
      setErrorCompletar(mensajeDeError(e, "No se pudo completar la reserva."));
    } finally {
      setProcesando(null);
    }
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <Dialog.Title className="truncate text-sm font-medium text-text-100">
                {reserva.cliente_nombre ?? "Cliente sin nombre"}
              </Dialog.Title>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={info.tone}>{info.label}</Badge>
                <button
                  type="button"
                  onClick={() => setHistorialAbierto(true)}
                  className="cursor-pointer rounded p-1 text-text-400 hover:bg-bg-800 hover:text-text-100"
                  aria-label="Ver historial de la cita"
                  title="Ver historial de la cita"
                >
                  <History size={14} />
                </button>
              </div>
            </div>

            <dl className="mt-3 flex flex-col gap-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-text-600">Servicio</dt>
                <dd className="text-text-100">{reserva.servicio_nombre}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-600">Proveedor</dt>
                <dd className="text-text-100">{reserva.proveedor_nombre}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-600">Horario</dt>
                <dd className="tabular-nums text-text-100">
                  {formatoFechaHora(reserva.hora_inicio)} – {formatoHora(reserva.hora_fin)}
                </dd>
              </div>
              {reserva.cliente_telefono && (
                <div className="flex justify-between gap-2">
                  <dt className="text-text-600">Teléfono</dt>
                  <dd className="text-text-100">{reserva.cliente_telefono}</dd>
                </div>
              )}
              {reserva.notas && (
                <div className="flex flex-col gap-1 border-t border-bg-700 pt-2">
                  <dt className="text-text-600">Notas</dt>
                  <dd className="leading-relaxed text-text-100">{reserva.notas}</dd>
                </div>
              )}
            </dl>

            {error && (
              <Aviso tipo="error" className="mt-3">
                {error}
              </Aviso>
            )}

            {activa ? (
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Boton variante="fantasma" onClick={() => onReprogramar(reserva)}>
                  Reprogramar
                </Boton>
                {otrosProveedores.length > 0 && (
                  <Boton variante="fantasma" onClick={abrirReasignar}>
                    Cambiar barbero
                  </Boton>
                )}
                <Boton
                  variante="secundario"
                  loading={procesando === "no_asistio"}
                  disabled={procesando !== null && procesando !== "no_asistio"}
                  onClick={marcarNoAsistio}
                >
                  No asistió
                </Boton>
                <Boton variante="primario" onClick={abrirCompletar}>
                  Completada
                </Boton>
                <Boton variante="peligro" onClick={() => setConfirmCancelar(true)}>
                  Cancelar cita
                </Boton>
              </div>
            ) : (
              <div className="mt-5 flex justify-end">
                <Dialog.Close asChild>
                  <Boton variante="secundario">Cerrar</Boton>
                </Dialog.Close>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={confirmCancelar}
        onOpenChange={setConfirmCancelar}
        titulo="¿Cancelar esta reserva?"
        descripcion="El horario queda libre de inmediato para que se pueda reservar de nuevo."
        confirmar="Cancelar cita"
        peligro
        loading={procesando === "cancelar"}
        onConfirm={cancelar}
      />

      <ConfirmDialog
        open={reasignarAbierto}
        onOpenChange={setReasignarAbierto}
        titulo="Cambiar barbero"
        confirmar="Cambiar"
        loading={reasignando}
        onConfirm={reasignar}
        descripcion={
          <div className="flex flex-col gap-2 text-left">
            <p>La cita conserva su horario; solo cambia quién la atiende.</p>
            <label className="flex flex-col gap-1 text-xs text-text-400">
              Nuevo barbero
              <select
                className={inputClass}
                value={nuevoProveedorId}
                onChange={(e) => setNuevoProveedorId(e.target.value)}
              >
                {otrosProveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            {errorReasignar && <Aviso tipo="error">{errorReasignar}</Aviso>}
          </div>
        }
      />

      <ConfirmDialog
        open={completarAbierto}
        onOpenChange={setCompletarAbierto}
        titulo="Completar cita"
        confirmar="Marcar como completada"
        loading={procesando === "completada"}
        onConfirm={completar}
        descripcion={
          <div className="flex flex-col gap-2 text-left">
            <label className="flex flex-col gap-1 text-xs text-text-400">
              Precio cobrado ($)
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={precioCobrado}
                onChange={(e) => setPrecioCobrado(e.target.value)}
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-400">
              Método de pago
              <select
                className={inputClass}
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </label>
            {errorCompletar && <Aviso tipo="error">{errorCompletar}</Aviso>}
          </div>
        }
      />

      <ReservaHistorialModal
        open={historialAbierto}
        onOpenChange={setHistorialAbierto}
        tenantId={tenantId}
        reservaId={reserva.id}
        titulo={reserva.cliente_nombre ?? undefined}
      />
    </>
  );
}
