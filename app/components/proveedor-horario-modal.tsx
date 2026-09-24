"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { DIAS_SEMANA, formatoFechaHora } from "@/lib/formato";
import type {
  DescansoOut,
  HorarioSemanalIn,
  HorarioSemanalOut,
  ProveedorOut,
  ReemplazarHorariosOut,
  ReservaOut,
} from "@/lib/types";
import { Aviso, Boton, Cargando, inputClass } from "./ui";

interface DiaEditable {
  activo: boolean;
  horaInicio: string;
  horaFin: string;
}

const DIA_DEFAULT: DiaEditable = { activo: false, horaInicio: "09:00", horaFin: "18:00" };

/**
 * Editor del horario semanal recurrente de un proveedor: un bloque por día
 * (activo/inactivo + inicio/fin). El backend soporta turnos partidos
 * (varios bloques el mismo día) y excepciones puntuales, pero esta primera
 * versión del portal solo edita un bloque por día — cubre el caso común y
 * no bloquea agregar más adelante una vista más avanzada.
 */
export function ProveedorHorarioModal({
  open,
  onOpenChange,
  tenantId,
  proveedor,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tenantId: string;
  proveedor: ProveedorOut | null;
}) {
  const rutaHorarios = proveedor
    ? `/api/tenants/${tenantId}/calendario/proveedores/${proveedor.id}/horarios`
    : null;
  const rutaDescansos = proveedor
    ? `/api/tenants/${tenantId}/calendario/proveedores/${proveedor.id}/descansos`
    : null;
  const horarios = useApi<HorarioSemanalOut[]>(open ? rutaHorarios : null);
  const descansos = useApi<DescansoOut[]>(open ? rutaDescansos : null);

  const [dias, setDias] = useState<DiaEditable[]>(() => DIAS_SEMANA.map(() => ({ ...DIA_DEFAULT })));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictos, setConflictos] = useState<ReservaOut[] | null>(null);

  const [formDescanso, setFormDescanso] = useState<Record<number, { horaInicio: string; horaFin: string } | null>>({});
  const [guardandoDescanso, setGuardandoDescanso] = useState<number | null>(null);
  const [errorDescanso, setErrorDescanso] = useState<string | null>(null);

  useEffect(() => {
    if (!horarios.data) return;
    const nuevos = DIAS_SEMANA.map(() => ({ ...DIA_DEFAULT }));
    for (const h of horarios.data) {
      nuevos[h.dia_semana] = {
        activo: true,
        horaInicio: h.hora_inicio.slice(0, 5),
        horaFin: h.hora_fin.slice(0, 5),
      };
    }
    setDias(nuevos);
  }, [horarios.data]);

  // Cada vez que se abre el modal (no en cada render mientras sigue
  // abierto) se limpia el aviso de la vez anterior.
  useEffect(() => {
    if (open) {
      setConflictos(null);
      setFormDescanso({});
      setErrorDescanso(null);
    }
  }, [open]);

  if (!proveedor || !rutaHorarios || !rutaDescansos) return null;

  const descansosDelDia = (dia: number) => (descansos.data ?? []).filter((d) => d.dia_semana === dia);

  const abrirFormDescanso = (dia: number) => {
    setErrorDescanso(null);
    setFormDescanso((f) => ({ ...f, [dia]: { horaInicio: "13:00", horaFin: "14:00" } }));
  };

  const cambiarFormDescanso = (dia: number, cambios: Partial<{ horaInicio: string; horaFin: string }>) => {
    setFormDescanso((f) => ({ ...f, [dia]: { ...(f[dia] as { horaInicio: string; horaFin: string }), ...cambios } }));
  };

  const agregarDescanso = async (dia: number) => {
    const form = formDescanso[dia];
    if (!form) return;
    if (form.horaFin <= form.horaInicio) {
      setErrorDescanso("La hora de fin del descanso debe ser posterior a la de inicio.");
      return;
    }
    setErrorDescanso(null);
    setGuardandoDescanso(dia);
    try {
      await apiFetch(rutaDescansos, {
        method: "POST",
        json: { dia_semana: dia, hora_inicio: `${form.horaInicio}:00`, hora_fin: `${form.horaFin}:00` },
      });
      descansos.recargar(true);
      setFormDescanso((f) => ({ ...f, [dia]: null }));
    } catch (e) {
      setErrorDescanso(mensajeDeError(e, "No se pudo guardar el descanso."));
    } finally {
      setGuardandoDescanso(null);
    }
  };

  const borrarDescanso = async (id: string) => {
    setErrorDescanso(null);
    try {
      await apiFetch(`/api/tenants/${tenantId}/calendario/descansos/${id}`, { method: "DELETE" });
      descansos.recargar(true);
    } catch (e) {
      setErrorDescanso(mensajeDeError(e, "No se pudo eliminar el descanso."));
    }
  };

  const cambiarDia = (i: number, cambios: Partial<DiaEditable>) => {
    setDias((d) => d.map((x, idx) => (idx === i ? { ...x, ...cambios } : x)));
  };

  const guardar = async () => {
    setError(null);
    const activos = dias
      .map((d, i) => ({ ...d, dia_semana: i }))
      .filter((d) => d.activo);

    const invalido = activos.find((d) => d.horaFin <= d.horaInicio);
    if (invalido) {
      setError(`En ${DIAS_SEMANA[invalido.dia_semana]}, la hora de fin debe ser posterior a la de inicio.`);
      return;
    }

    setGuardando(true);
    try {
      const bloques: HorarioSemanalIn[] = activos.map((d) => ({
        dia_semana: d.dia_semana,
        hora_inicio: `${d.horaInicio}:00`,
        hora_fin: `${d.horaFin}:00`,
      }));
      const respuesta = await apiFetch<ReemplazarHorariosOut>(rutaHorarios, {
        method: "PUT",
        json: { bloques },
      });
      horarios.recargar(true);
      // Un horario más corto puede dejar citas ya confirmadas fuera de la
      // nueva jornada. El backend no las toca (no las cancela ni las
      // bloquea) — nada más avisa. Si hay alguna, el modal se queda abierto
      // mostrando cuáles son en vez de cerrarse solo.
      if (respuesta.reservas_en_conflicto.length > 0) {
        setConflictos(respuesta.reservas_en_conflicto);
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo guardar el horario."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-sm font-medium text-text-100">
              Horario de {proveedor.nombre}
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

          {horarios.loading ? (
            <Cargando />
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {DIAS_SEMANA.map((nombreDia, i) => (
                <div key={nombreDia} className="flex items-center gap-2">
                  <label className="flex w-28 shrink-0 items-center gap-2 text-xs text-text-100">
                    <input
                      type="checkbox"
                      checked={dias[i].activo}
                      onChange={(e) => cambiarDia(i, { activo: e.target.checked })}
                    />
                    {nombreDia}
                  </label>
                  <input
                    type="time"
                    className={inputClass}
                    disabled={!dias[i].activo}
                    value={dias[i].horaInicio}
                    onChange={(e) => cambiarDia(i, { horaInicio: e.target.value })}
                  />
                  <span className="text-text-600" aria-hidden>
                    –
                  </span>
                  <input
                    type="time"
                    className={inputClass}
                    disabled={!dias[i].activo}
                    value={dias[i].horaFin}
                    onChange={(e) => cambiarDia(i, { horaFin: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          {!horarios.loading && dias.some((d) => d.activo) && (
            <div className="mt-4 flex flex-col gap-2 border-t border-bg-700 pt-4">
              <p className="text-xs font-medium text-text-100">Descansos</p>
              {DIAS_SEMANA.map((nombreDia, i) => {
                if (!dias[i].activo) return null;
                const form = formDescanso[i];
                return (
                  <div
                    key={nombreDia}
                    className="flex flex-col gap-1.5 rounded-md border border-bg-700 bg-bg-800/50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-text-400">{nombreDia}</span>
                      {!form && (
                        <button
                          type="button"
                          onClick={() => abrirFormDescanso(i)}
                          className="cursor-pointer text-[11px] text-text-400 hover:text-text-100"
                        >
                          + agregar descanso
                        </button>
                      )}
                    </div>

                    {descansosDelDia(i).length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {descansosDelDia(i).map((d) => (
                          <li key={d.id} className="flex items-center justify-between text-[11px] text-text-100">
                            <span className="tabular-nums">
                              {d.hora_inicio.slice(0, 5)} – {d.hora_fin.slice(0, 5)}
                            </span>
                            <button
                              type="button"
                              onClick={() => borrarDescanso(d.id)}
                              className="cursor-pointer rounded p-0.5 text-text-600 hover:bg-bg-700 hover:text-text-100"
                              aria-label={`Eliminar descanso de ${nombreDia}`}
                            >
                              <X size={12} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {form && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          className={inputClass}
                          value={form.horaInicio}
                          onChange={(e) => cambiarFormDescanso(i, { horaInicio: e.target.value })}
                        />
                        <span className="text-text-600" aria-hidden>
                          –
                        </span>
                        <input
                          type="time"
                          className={inputClass}
                          value={form.horaFin}
                          onChange={(e) => cambiarFormDescanso(i, { horaFin: e.target.value })}
                        />
                        <Boton
                          variante="secundario"
                          onClick={() => setFormDescanso((f) => ({ ...f, [i]: null }))}
                        >
                          Cancelar
                        </Boton>
                        <Boton
                          variante="primario"
                          loading={guardandoDescanso === i}
                          onClick={() => agregarDescanso(i)}
                        >
                          Agregar
                        </Boton>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {errorDescanso && (
            <Aviso tipo="error" className="mt-3">
              {errorDescanso}
            </Aviso>
          )}

          {error && (
            <Aviso tipo="error" className="mt-3">
              {error}
            </Aviso>
          )}

          {conflictos && conflictos.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              <Aviso tipo="error">
                El horario se guardó, pero {conflictos.length === 1 ? "esta cita ya" : "estas citas ya"} no
                {conflictos.length === 1 ? " cabe" : " caben"} en la nueva jornada. No se cancelaron
                solas — avisa al cliente o reprográmalas desde la agenda.
              </Aviso>
              <ul className="flex flex-col gap-1 rounded-md border border-bg-700 bg-bg-800 px-3 py-2">
                {conflictos.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 text-xs">
                    <span className="text-text-100">{r.cliente_nombre ?? "Cliente sin nombre"}</span>
                    <span className="tabular-nums text-text-400">{formatoFechaHora(r.hora_inicio)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Boton variante="secundario" disabled={guardando}>
                Cerrar
              </Boton>
            </Dialog.Close>
            <Boton variante="primario" loading={guardando} onClick={guardar}>
              Guardar horario
            </Boton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
