"use client";

import type { ProveedorOut, ReservaOut } from "@/lib/types";

// Rango fijo de la grilla. No sale de los horarios reales de cada
// proveedor (eso lo resuelve /calendario/disponibilidad para el agente de
// n8n): acá es solo la vista, así que un rango generoso cubre la jornada
// típica de cualquier negocio sin tener que cargar el horario de cada
// proveedor nada más para dibujar la tabla.
const HORA_INICIO = 7;
const HORA_FIN = 21;
const PASO_MINUTOS = 30;

function generarFilas(): { horas: number; minutos: number }[] {
  const filas: { horas: number; minutos: number }[] = [];
  for (let m = HORA_INICIO * 60; m < HORA_FIN * 60; m += PASO_MINUTOS) {
    filas.push({ horas: Math.floor(m / 60), minutos: m % 60 });
  }
  return filas;
}

function etiquetaFila(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutos desde medianoche, en hora LOCAL del navegador (misma zona que se usó para pintar `fecha`). */
function minutosDelDia(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Grilla de agenda: columnas = proveedores activos, filas = horarios en
 * bloques de 30 min. Hecha a mano con Tailwind (tabla nativa, sin librería
 * de calendario) para no pelear contra el tema oscuro del portal. Sin
 * drag-and-drop: reprogramar una cita se hace desde su modal de detalle.
 */
export function CalendarioGrid({
  proveedores,
  reservas,
  ventanasPorProveedor,
  onSlotClick,
  onReservaClick,
}: {
  proveedores: ProveedorOut[];
  reservas: ReservaOut[];
  /**
   * Ventanas de atención (minutos locales desde medianoche) de cada
   * proveedor para el día que se está mostrando. Un proveedor ausente del
   * mapa significa "todavía no se cargó su horario" (se muestra habilitado
   * para no parpadear todo bloqueado mientras llega) — un proveedor
   * presente con un arreglo vacío significa "no atiende ese día".
   */
  ventanasPorProveedor: Record<string, Array<[number, number]>>;
  onSlotClick: (proveedorId: string, horas: number, minutos: number) => void;
  onReservaClick: (reserva: ReservaOut) => void;
}) {
  const filas = generarFilas();

  const porProveedor = new Map<string, ReservaOut[]>();
  for (const r of reservas) {
    if (r.estado === "cancelada") continue;
    const lista = porProveedor.get(r.proveedor_id);
    if (lista) lista.push(r);
    else porProveedor.set(r.proveedor_id, [r]);
  }

  if (proveedores.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-bg-700 px-6 py-12 text-center font-mono text-xs text-text-600">
        No hay proveedores activos. Agrégalos en la pestaña &quot;Proveedores&quot;.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-bg-700">
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-bg-700 bg-bg-800">
            <th
              scope="col"
              className="w-16 border-r border-bg-700 px-2 py-2 text-left font-mono text-[11px] font-normal text-text-600"
            >
              hora
            </th>
            {proveedores.map((p) => (
              <th
                key={p.id}
                scope="col"
                className="border-r border-bg-700 px-2 py-2 text-left text-xs font-medium text-text-100 last:border-r-0"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                    aria-hidden
                  />
                  <span className="truncate">{p.nombre}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ horas, minutos }) => {
            const minutoFila = horas * 60 + minutos;
            return (
              <tr key={`${horas}-${minutos}`} className="border-b border-bg-700 last:border-b-0">
                <td className="border-r border-bg-700 px-2 py-1 font-mono text-[11px] tabular-nums text-text-600">
                  {etiquetaFila(horas, minutos)}
                </td>
                {proveedores.map((p) => {
                  const deEsteProveedor = porProveedor.get(p.id) ?? [];

                  const queEmpiezaAqui = deEsteProveedor.find(
                    (r) =>
                      Math.floor(minutosDelDia(r.hora_inicio) / PASO_MINUTOS) * PASO_MINUTOS ===
                      minutoFila,
                  );

                  if (queEmpiezaAqui) {
                    const duracionMin = Math.round(
                      (new Date(queEmpiezaAqui.hora_fin).getTime() -
                        new Date(queEmpiezaAqui.hora_inicio).getTime()) /
                        60000,
                    );
                    const rowSpan = Math.max(1, Math.round(duracionMin / PASO_MINUTOS));
                    return (
                      <td
                        key={p.id}
                        rowSpan={rowSpan}
                        className="border-r border-bg-700 p-0.5 align-top last:border-r-0"
                      >
                        <button
                          type="button"
                          onClick={() => onReservaClick(queEmpiezaAqui)}
                          className="flex h-full w-full cursor-pointer flex-col gap-0.5 rounded px-2 py-1 text-left text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/60"
                          style={{ backgroundColor: p.color }}
                        >
                          <span className="truncate text-[11px] font-medium">
                            {queEmpiezaAqui.cliente_nombre ?? "Cliente"}
                          </span>
                          <span className="truncate text-[10px] opacity-90">
                            {queEmpiezaAqui.servicio_nombre}
                          </span>
                        </button>
                      </td>
                    );
                  }

                  const cubierta = deEsteProveedor.some((r) => {
                    const inicio = minutosDelDia(r.hora_inicio);
                    const fin = minutosDelDia(r.hora_fin);
                    return inicio < minutoFila && minutoFila < fin;
                  });
                  // El rowSpan de la celda de arriba ya pinta esta fila para
                  // este proveedor: no se dibuja una celda encima.
                  if (cubierta) return null;

                  const ventanas = ventanasPorProveedor[p.id];
                  // Sin datos todavía (ventanas === undefined): se deja
                  // habilitado para no mostrar todo bloqueado mientras
                  // carga. Con datos, el slot completo (no solo su inicio)
                  // tiene que caber en alguna ventana — igual criterio que
                  // dentro_de_horario del backend.
                  const habilitado =
                    ventanas === undefined ||
                    ventanas.some(([ini, fin]) => minutoFila >= ini && minutoFila + PASO_MINUTOS <= fin);

                  if (!habilitado) {
                    return (
                      <td key={p.id} className="border-r border-bg-700 bg-bg-950/60 p-0.5 last:border-r-0">
                        <span
                          className="block h-8 w-full rounded"
                          aria-hidden
                          title={`${p.nombre} no atiende a las ${etiquetaFila(horas, minutos)}`}
                        />
                      </td>
                    );
                  }

                  return (
                    <td key={p.id} className="border-r border-bg-700 p-0.5 last:border-r-0">
                      <button
                        type="button"
                        onClick={() => onSlotClick(p.id, horas, minutos)}
                        className="h-8 w-full cursor-pointer rounded hover:bg-bg-800 focus:outline-none focus:ring-2 focus:ring-bg-600"
                        aria-label={`Reservar con ${p.nombre} a las ${etiquetaFila(horas, minutos)}`}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
