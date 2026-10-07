"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Check, RotateCcw, Trash2, X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { TIPO_INFO, aInputLocal, deInputLocal, fechaCorta } from "@/lib/agenda";
import { infoEstadoPipeline, infoEstadoTarea, tiempoRelativo } from "@/lib/formato";
import type { AgendaItemOut, ReprogramacionOut, VendedorOut } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Aviso, Boton, Campo, ConfirmDialog, inputClass, selectClass } from "./ui";

/**
 * Ficha de un pendiente de la agenda: verlo, reprogramarlo a mano (la
 * alternativa al arrastre, también para teclado), cerrarlo y ver cuántas
 * veces se movió.
 *
 * Tarea y seguimiento comparten la ficha pero no las acciones: una tarea
 * se completa y se borra; un seguimiento se "marca hecho", que en el
 * backend es quitarle la fecha (PUT /agenda/seguimientos con fecha null).
 */
export function AgendaDetalle({
  item,
  vendedores,
  puedeReasignar,
  onClose,
  onCambio,
}: {
  item: AgendaItemOut;
  vendedores: VendedorOut[];
  puedeReasignar: boolean;
  onClose: () => void;
  onCambio: (mensaje: string) => void;
}) {
  const esTarea = item.tipo === "tarea";
  const historial = useApi<ReprogramacionOut[]>(
    esTarea
      ? `/api/tareas/${item.id}/reprogramaciones`
      : `/api/agenda/seguimientos/${item.cliente_id}/reprogramaciones`,
  );

  const [fecha, setFecha] = useState(aInputLocal(item.fecha));
  // En una tarea es el título; en un seguimiento, la nota (que hace de título).
  const [titulo, setTitulo] = useState(item.titulo);
  const [descripcion, setDescripcion] = useState(item.descripcion ?? "");
  const [vendedor, setVendedor] = useState(item.vendedor_id ?? "");
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completada = item.estado === "completada";
  const estado = infoEstadoTarea(item.estado);
  const fechaIso = deInputLocal(fecha);

  const cambio =
    fechaIso !== new Date(item.fecha).toISOString() ||
    titulo.trim() !== item.titulo ||
    (esTarea && descripcion.trim() !== (item.descripcion ?? "")) ||
    (esTarea && vendedor !== (item.vendedor_id ?? ""));

  const ejecutar = async (accion: () => Promise<string>) => {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      onCambio(await accion());
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo guardar."));
      setGuardando(false);
    }
  };

  const guardar = () =>
    ejecutar(async () => {
      if (!fechaIso) throw new Error("Elige una fecha y hora válidas.");
      if (esTarea) {
        if (titulo.trim().length < 2) throw new Error("El título necesita al menos 2 caracteres.");
        await apiFetch(`/api/tareas/${item.id}`, {
          method: "PUT",
          json: {
            titulo: titulo.trim(),
            descripcion: descripcion.trim() || null,
            fecha_programada: fechaIso,
            ...(puedeReasignar && vendedor && vendedor !== item.vendedor_id ? { vendedor_id: vendedor } : {}),
          },
        });
      } else {
        await apiFetch(`/api/agenda/seguimientos/${item.cliente_id}`, {
          method: "PUT",
          json: { fecha: fechaIso, nota: titulo.trim() },
        });
      }
      return `«${titulo.trim()}» quedó para el ${fechaCorta(fechaIso)}.`;
    });

  const completar = () =>
    ejecutar(async () => {
      if (esTarea) {
        await apiFetch(`/api/tareas/${item.id}/completar`, { method: "POST" });
        return `«${item.titulo}» quedó completada.`;
      }
      await apiFetch(`/api/agenda/seguimientos/${item.cliente_id}`, {
        method: "PUT",
        json: { fecha: null },
      });
      return `Seguimiento a ${item.cliente_nombre ?? "el cliente"} marcado como hecho.`;
    });

  const reabrir = () =>
    ejecutar(async () => {
      await apiFetch(`/api/tareas/${item.id}/reabrir`, { method: "POST" });
      return `«${item.titulo}» volvió a pendiente.`;
    });

  const borrar = () =>
    ejecutar(async () => {
      await apiFetch(`/api/tareas/${item.id}`, { method: "DELETE" });
      return `«${item.titulo}» se eliminó.`;
    });

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
            <span
              aria-hidden
              className={cn(
                "mt-1 h-8 w-1 shrink-0 rounded-full",
                esTarea ? "bg-series-1" : "bg-series-2",
              )}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Dialog.Title
                className={cn(
                  "text-sm font-medium text-text-100",
                  completada && "text-text-400 line-through",
                )}
              >
                {item.titulo}
              </Dialog.Title>
              <Dialog.Description asChild>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-text-400">{TIPO_INFO[item.tipo].label}</span>
                  <Badge tone={estado.tone}>{estado.label.toLowerCase()}</Badge>
                  {item.etapa && (
                    <Badge tone={infoEstadoPipeline(item.etapa).tone}>
                      {infoEstadoPipeline(item.etapa).label.toLowerCase()}
                    </Badge>
                  )}
                </div>
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Boton variante="fantasma" disabled={guardando} aria-label="Cerrar" className="min-h-8 shrink-0 px-2">
                <X size={14} aria-hidden />
              </Boton>
            </Dialog.Close>
          </header>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div className="flex flex-col gap-0.5">
                <dt className="text-text-600">{esTarea ? "Cliente de campo" : "Lead"}</dt>
                <dd className="text-text-100">{item.cliente_nombre ?? "Sin nombre"}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-text-600">Vendedor</dt>
                <dd className={item.vendedor_nombre ? "text-text-100" : "text-warning"}>
                  {item.vendedor_nombre ?? "sin asignar"}
                </dd>
              </div>
              <div className="col-span-2 flex flex-col gap-0.5">
                <dt className="text-text-600">Cuándo</dt>
                <dd className={cn("text-text-100", item.estado === "vencida" && "text-danger")}>
                  {fechaCorta(item.fecha)}
                  <span className="ml-2 font-mono text-[11px] text-text-600">
                    {tiempoRelativo(item.fecha)}
                  </span>
                </dd>
              </div>
            </dl>

            {error && <Aviso tipo="error">{error}</Aviso>}

            {!completada && (
              <section className="flex flex-col gap-3 rounded-md border border-bg-700 bg-bg-950 p-3">
                <h3 className="text-xs font-medium text-text-100">Reprogramar o editar</h3>
                <Campo id="agenda-fecha" label="Fecha y hora">
                  <input
                    id="agenda-fecha"
                    type="datetime-local"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className={inputClass}
                  />
                </Campo>
                <Campo id="agenda-titulo" label={esTarea ? "Título" : "Qué hay que hacer"}>
                  <input
                    id="agenda-titulo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    maxLength={esTarea ? 255 : 500}
                    className={inputClass}
                  />
                </Campo>
                {esTarea && (
                  <Campo id="agenda-descripcion" label="Descripción">
                    <textarea
                      id="agenda-descripcion"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      rows={3}
                      maxLength={5000}
                      className={cn(inputClass, "resize-y")}
                    />
                  </Campo>
                )}
                {esTarea && puedeReasignar && (
                  <Campo id="agenda-vendedor" label="Vendedor">
                    <select
                      id="agenda-vendedor"
                      value={vendedor}
                      onChange={(e) => setVendedor(e.target.value)}
                      className={selectClass}
                    >
                      {vendedores
                        .filter((v) => v.activo || v.id === item.vendedor_id)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.nombre}
                          </option>
                        ))}
                    </select>
                  </Campo>
                )}
                <div className="flex justify-end">
                  <Boton variante="primario" onClick={guardar} loading={guardando} disabled={!cambio}>
                    Guardar cambios
                  </Boton>
                </div>
              </section>
            )}

            <div className="flex flex-wrap gap-2">
              {completada ? (
                <Boton variante="secundario" onClick={reabrir} disabled={guardando}>
                  <RotateCcw size={13} aria-hidden />
                  Reabrir tarea
                </Boton>
              ) : (
                <Boton variante="secundario" onClick={completar} disabled={guardando}>
                  <Check size={13} aria-hidden />
                  {esTarea ? "Completar tarea" : "Marcar como hecho"}
                </Boton>
              )}
              {esTarea && (
                <Boton
                  variante="fantasma"
                  onClick={() => setConfirmarBorrar(true)}
                  disabled={guardando}
                  className="text-danger hover:text-danger"
                >
                  <Trash2 size={13} aria-hidden />
                  Eliminar
                </Boton>
              )}
            </div>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-text-100">
                Reprogramaciones
                {historial.data && historial.data.length > 0 && (
                  <span className="ml-1.5 font-mono text-[11px] font-normal text-text-600">
                    {historial.data.length}
                  </span>
                )}
              </h3>
              {historial.error ? (
                <Aviso tipo="error">{historial.error}</Aviso>
              ) : !historial.data ? (
                <p className="font-mono text-xs text-text-600">cargando…</p>
              ) : historial.data.length === 0 ? (
                <p className="text-xs text-text-400">
                  Sigue en la fecha original. Cada vez que alguien la mueva, queda anotado aquí.
                </p>
              ) : (
                <ol className="flex flex-col divide-y divide-bg-700 overflow-hidden rounded-md border border-bg-700">
                  {historial.data.map((h) => (
                    <li key={h.id} className="flex flex-col gap-1 bg-bg-950 px-3 py-2">
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-text-100">
                        {h.fecha_anterior ? (
                          <span className="text-text-400">{fechaCorta(h.fecha_anterior)}</span>
                        ) : (
                          <span className="text-text-400">Se agendó</span>
                        )}
                        <ArrowRight size={11} className="text-text-600" aria-hidden />
                        {h.fecha_nueva ? fechaCorta(h.fecha_nueva) : "hecho"}
                      </span>
                      <span className="font-mono text-[11px] text-text-600">
                        {h.actor_etiqueta} · {tiempoRelativo(h.creado_en)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <ConfirmDialog
            open={confirmarBorrar}
            onOpenChange={setConfirmarBorrar}
            titulo="¿Eliminar esta tarea?"
            descripcion={`«${item.titulo}» desaparece de la agenda de ${item.vendedor_nombre ?? "su vendedor"} y de la app. No se puede deshacer.`}
            confirmar="Eliminar tarea"
            peligro
            loading={guardando}
            onConfirm={borrar}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
