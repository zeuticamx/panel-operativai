"use client";

import { useMemo, useState } from "react";
import { ArrowRight, GitCommitVertical, Table2 } from "lucide-react";
import { formatoFechaHora, iniciales, infoEstadoPipeline, tiempoRelativo } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { EstadoLead } from "./estado-lead";
import { Aviso } from "./ui";

type Vista = "timeline" | "tabla";

/**
 * Una fila de bitácora. Superconjunto de `HistorialOut` (línea de tiempo de
 * UN cliente) y `HistorialVendedorOut` (bitácora de TODOS los clientes de
 * un vendedor) — este componente sirve para ambas, y muestra el nombre del
 * cliente solo cuando `mostrarCliente` está activo y el dato viene.
 */
export interface HistorialTimelineItem {
  estado_anterior: string | null;
  estado_nuevo: string;
  nota: string | null;
  creado_en: string;
  vendedor_nombre?: string | null;
  cliente_nombre?: string | null;
  cliente_handle?: string | null;
}

/** Color del punto por tono de la etapa (mismo mapeo que `Badge`/`EstadoLead`). */
const TONO_PUNTO: Record<string, string> = {
  neutral: "bg-bg-600",
  info: "bg-series-1",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-danger",
};

interface Movimiento {
  esAlta: boolean;
  soloAsignacion: boolean;
  tono: string;
}

function leerMovimiento(h: HistorialTimelineItem): Movimiento {
  const esAlta = h.estado_anterior === null;
  const soloAsignacion = !esAlta && h.estado_anterior === h.estado_nuevo;
  const tono = soloAsignacion ? "neutral" : infoEstadoPipeline(h.estado_nuevo).tone;
  return { esAlta, soloAsignacion, tono };
}

/**
 * Línea de tiempo de un embudo: cada cambio de etapa o reasignación que le
 * pasó a un cliente, en orden. Pensado para reusarse en el drawer de
 * cliente, la página de un vendedor y reportes — solo necesita el arreglo
 * que ya devuelve `/pipeline/{user_id}/historial`.
 *
 * Trae su propia vista de tabla (toggle arriba a la derecha): con pocos
 * movimientos la línea de tiempo se lee mejor, pero con una bitácora larga
 * (por ejemplo la de un vendedor completo) una tabla densa escala mejor.
 */
export function HistorialTimeline({
  historial,
  titulo = "Línea de tiempo",
  cargando = false,
  error = null,
  vacio = "Sin movimientos todavía",
  vistaInicial = "timeline",
  mostrarCliente = false,
  className,
}: {
  historial: HistorialTimelineItem[];
  titulo?: string;
  cargando?: boolean;
  error?: string | null;
  vacio?: string;
  vistaInicial?: Vista;
  /** Antepone el cliente de cada fila — para una bitácora que abarca varios (ej. la de un vendedor). */
  mostrarCliente?: boolean;
  className?: string;
}) {
  const [vista, setVista] = useState<Vista>(vistaInicial);

  // Más nuevo arriba: lo último que pasó es lo primero que se ve.
  const ordenado = useMemo(() => [...historial].reverse(), [historial]);

  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-[11px] text-text-600">{titulo}</h3>
        {ordenado.length > 0 && (
          <div className="flex shrink-0 overflow-hidden rounded-md border border-bg-700">
            <button
              type="button"
              onClick={() => setVista("timeline")}
              aria-pressed={vista === "timeline"}
              title="Vista de línea de tiempo"
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-[11px]",
                vista === "timeline"
                  ? "bg-bg-800 text-text-100"
                  : "text-text-600 hover:text-text-400",
              )}
            >
              <GitCommitVertical size={12} aria-hidden />
              Línea
            </button>
            <button
              type="button"
              onClick={() => setVista("tabla")}
              aria-pressed={vista === "tabla"}
              title="Vista de tabla"
              className={cn(
                "flex items-center gap-1 border-l border-bg-700 px-2 py-1 text-[11px]",
                vista === "tabla"
                  ? "bg-bg-800 text-text-100"
                  : "text-text-600 hover:text-text-400",
              )}
            >
              <Table2 size={12} aria-hidden />
              Tabla
            </button>
          </div>
        )}
      </header>

      {error ? (
        <Aviso tipo="error">{error}</Aviso>
      ) : cargando && historial.length === 0 ? (
        <p className="font-mono text-xs text-text-600">cargando…</p>
      ) : ordenado.length === 0 ? (
        <p className="font-mono text-xs text-text-600">{vacio}</p>
      ) : vista === "timeline" ? (
        <TimelineLista historial={ordenado} mostrarCliente={mostrarCliente} />
      ) : (
        <TimelineTabla historial={ordenado} mostrarCliente={mostrarCliente} />
      )}
    </section>
  );
}

// ------------------------------------------------------------
// Vista de línea de tiempo
// ------------------------------------------------------------
function TimelineLista({
  historial,
  mostrarCliente,
}: {
  historial: HistorialTimelineItem[];
  mostrarCliente: boolean;
}) {
  return (
    <ol className="flex flex-col">
      {historial.map((h, i) => (
        <Punto
          key={`${h.creado_en}-${i}`}
          h={h}
          ultimo={i === historial.length - 1}
          mostrarCliente={mostrarCliente}
        />
      ))}
    </ol>
  );
}

function Punto({
  h,
  ultimo,
  mostrarCliente,
}: {
  h: HistorialTimelineItem;
  ultimo: boolean;
  mostrarCliente: boolean;
}) {
  const { esAlta, soloAsignacion, tono } = leerMovimiento(h);
  const cliente = h.cliente_nombre ?? h.cliente_handle ?? "Cliente sin nombre";

  return (
    <li className="group relative -mx-2 flex gap-3 rounded-md px-2 pt-2 pb-4 hover:bg-bg-800/60 focus-within:bg-bg-800/60">
      {!ultimo && (
        <span
          aria-hidden
          className="absolute top-7 left-[15px] h-[calc(100%-10px)] w-px bg-bg-700"
        />
      )}

      {/* Punto: >=8px pintado, aro de 2px en el color de la superficie para
          que se distinga cruzando la línea vertical (misma técnica que un
          marker en un gráfico de líneas). */}
      <span
        aria-hidden
        className="relative mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center"
      >
        <span className={cn("h-2.5 w-2.5 rounded-full border-2 border-bg-900", TONO_PUNTO[tono])} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {mostrarCliente && (
          <span className="truncate text-xs font-medium text-text-100">{cliente}</span>
        )}
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 text-xs",
            mostrarCliente ? "text-text-400" : "text-text-100",
          )}
        >
          {esAlta ? (
            <>
              Entró al embudo
              <EstadoLead estado={h.estado_nuevo} />
            </>
          ) : soloAsignacion ? (
            <>
              Asignado a{" "}
              <span className="font-medium">
                {h.vendedor_nombre ?? <span className="text-warning">nadie</span>}
              </span>
            </>
          ) : (
            <>
              <EstadoLead estado={h.estado_anterior!} />
              <ArrowRight size={11} className="text-text-600" aria-hidden />
              <EstadoLead estado={h.estado_nuevo} />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-text-600">
          <span title={formatoFechaHora(h.creado_en)}>{tiempoRelativo(h.creado_en)}</span>
          {!soloAsignacion && h.vendedor_nombre && (
            <span className="inline-flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-bg-700 bg-bg-800 text-[9px] font-medium text-text-400">
                {iniciales(h.vendedor_nombre, null)}
              </span>
              {h.vendedor_nombre}
            </span>
          )}
          {h.nota && <span className="max-w-[200px] truncate text-text-400">· {h.nota}</span>}
        </div>
      </div>

      {/* Tooltip: la nota completa y la fecha exacta, para cuando el
          resumen de arriba viene truncado. Aparece con hover o foco en
          toda la fila (el punto solo no es un objetivo confiable). */}
      {h.nota && (
        <div
          role="tooltip"
          className={cn(
            "invisible absolute top-full left-9 z-20 mt-0.5 max-w-sm rounded-md border border-bg-700 bg-bg-800 p-2.5 opacity-0 shadow-lg",
            "transition-opacity duration-100 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
          )}
        >
          <p className="mb-1 font-mono text-[11px] text-text-600">{formatoFechaHora(h.creado_en)}</p>
          <p className="text-xs leading-relaxed text-text-100">{h.nota}</p>
        </div>
      )}
    </li>
  );
}

// ------------------------------------------------------------
// Vista de tabla (alternativa densa, para bitácoras largas)
// ------------------------------------------------------------
function TimelineTabla({
  historial,
  mostrarCliente,
}: {
  historial: HistorialTimelineItem[];
  mostrarCliente: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-bg-700">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
            {mostrarCliente && <th className="px-3 py-2 text-left font-normal">Cliente</th>}
            <th className="px-3 py-2 text-left font-normal">Fecha</th>
            <th className="px-3 py-2 text-left font-normal">Cambio</th>
            <th className="px-3 py-2 text-left font-normal">Vendedor</th>
            <th className="px-3 py-2 text-left font-normal">Nota</th>
          </tr>
        </thead>
        <tbody>
          {historial.map((h, i) => {
            const { esAlta, soloAsignacion } = leerMovimiento(h);
            return (
              <tr key={`${h.creado_en}-${i}`} className="border-b border-bg-700 last:border-b-0">
                {mostrarCliente && (
                  <td className="max-w-[160px] truncate px-3 py-2 font-medium text-text-100">
                    {h.cliente_nombre ?? h.cliente_handle ?? "—"}
                  </td>
                )}
                <td
                  className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-text-600"
                  title={formatoFechaHora(h.creado_en)}
                >
                  {tiempoRelativo(h.creado_en)}
                </td>
                <td className="px-3 py-2">
                  {esAlta ? (
                    <span className="inline-flex items-center gap-1.5">
                      <EstadoLead estado={h.estado_nuevo} />
                    </span>
                  ) : soloAsignacion ? (
                    <span className="text-text-400">reasignación</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <EstadoLead estado={h.estado_anterior!} />
                      <ArrowRight size={10} className="text-text-600" aria-hidden />
                      <EstadoLead estado={h.estado_nuevo} />
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-text-400">{h.vendedor_nombre ?? "—"}</td>
                <td
                  className="max-w-[240px] truncate px-3 py-2 text-text-400"
                  title={h.nota ?? undefined}
                >
                  {h.nota ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
