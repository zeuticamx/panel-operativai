"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import type { ProveedorOut, ReservaCrearIn, ReservaOut, ServicioOut } from "@/lib/types";
import { Aviso, Boton, Campo, inputClass, selectClass } from "./ui";

export type ModoReservaForm =
  | { tipo: "crear"; proveedorId: string; horaInicioLocal: string } // "YYYY-MM-DDTHH:mm"
  | { tipo: "reprogramar"; reserva: ReservaOut };

/** "2026-01-05T15:00:00Z" -> "2026-01-05T09:00" en hora local, para el input datetime-local. */
function aInputLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Modal para crear una reserva manual (walk-in/telefónica) o reprogramar
 * una existente. En modo "reprogramar" el backend solo acepta mover la
 * hora (PATCH .../reprogramar no cambia proveedor ni servicio), así que
 * acá tampoco se ofrecen esos campos en ese modo.
 */
export function ReservaForm({
  open,
  onOpenChange,
  tenantId,
  proveedores,
  servicios,
  modo,
  onGuardado,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tenantId: string;
  proveedores: ProveedorOut[];
  servicios: ServicioOut[];
  modo: ModoReservaForm;
  onGuardado: (mensaje: string) => void;
}) {
  const esCrear = modo.tipo === "crear";
  const [proveedorId, setProveedorId] = useState(
    esCrear ? modo.proveedorId : modo.reserva.proveedor_id,
  );
  const [servicioId, setServicioId] = useState(
    esCrear ? (servicios[0]?.id ?? "") : modo.reserva.servicio_id,
  );
  const [horaInicio, setHoraInicio] = useState(
    esCrear ? modo.horaInicioLocal : aInputLocal(modo.reserva.hora_inicio),
  );
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setError(null);
    if (esCrear && !clienteNombre.trim()) {
      setError("Escribe el nombre del cliente.");
      return;
    }
    if (esCrear && !servicioId) {
      setError("Elige un servicio.");
      return;
    }
    if (!horaInicio) {
      setError("Elige fecha y hora.");
      return;
    }

    setGuardando(true);
    try {
      const isoUtc = new Date(horaInicio).toISOString();

      if (esCrear) {
        await apiFetch<ReservaOut>(`/api/tenants/${tenantId}/calendario/reservas`, {
          method: "POST",
          json: {
            proveedor_id: proveedorId,
            servicio_id: servicioId,
            hora_inicio: isoUtc,
            cliente_nombre: clienteNombre.trim(),
            cliente_telefono: clienteTelefono.trim() || undefined,
            notas: notas.trim() || undefined,
          } satisfies ReservaCrearIn,
        });
        onGuardado("Reserva creada.");
      } else {
        await apiFetch<ReservaOut>(
          `/api/tenants/${tenantId}/calendario/reservas/${modo.reserva.id}/reprogramar`,
          { method: "PATCH", json: { hora_inicio: isoUtc } },
        );
        onGuardado("Reserva reprogramada.");
      }
      onOpenChange(false);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo guardar la reserva."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
          <Dialog.Title className="text-sm font-medium text-text-100">
            {esCrear ? "Nueva reserva" : "Reprogramar reserva"}
          </Dialog.Title>
          {!esCrear && (
            <Dialog.Description className="mt-1 text-xs text-text-400">
              {modo.reserva.cliente_nombre ?? "Cliente"} · {modo.reserva.servicio_nombre} con{" "}
              {modo.reserva.proveedor_nombre}
            </Dialog.Description>
          )}

          <div className="mt-4 flex flex-col gap-3">
            {esCrear && (
              <>
                <Campo id="rf-proveedor" label="Proveedor">
                  <select
                    id="rf-proveedor"
                    className={selectClass}
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                  >
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo id="rf-servicio" label="Servicio">
                  <select
                    id="rf-servicio"
                    className={selectClass}
                    value={servicioId}
                    onChange={(e) => setServicioId(e.target.value)}
                  >
                    {servicios.length === 0 && <option value="">sin servicios activos</option>}
                    {servicios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} · {s.duracion_minutos} min
                      </option>
                    ))}
                  </select>
                </Campo>
              </>
            )}

            <Campo id="rf-hora" label="Fecha y hora">
              <input
                id="rf-hora"
                type="datetime-local"
                className={inputClass}
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </Campo>

            {esCrear && (
              <>
                <Campo id="rf-cliente" label="Cliente">
                  <input
                    id="rf-cliente"
                    className={inputClass}
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    placeholder="Nombre del cliente"
                  />
                </Campo>
                <Campo id="rf-telefono" label="Teléfono" hint="opcional">
                  <input
                    id="rf-telefono"
                    className={inputClass}
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                  />
                </Campo>
                <Campo id="rf-notas" label="Notas" hint="opcional">
                  <textarea
                    id="rf-notas"
                    rows={2}
                    className={inputClass}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                </Campo>
              </>
            )}

            {error && <Aviso tipo="error">{error}</Aviso>}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Boton variante="secundario" disabled={guardando}>
                Cancelar
              </Boton>
            </Dialog.Close>
            <Boton variante="primario" loading={guardando} onClick={guardar}>
              {esCrear ? "Crear reserva" : "Guardar"}
            </Boton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
