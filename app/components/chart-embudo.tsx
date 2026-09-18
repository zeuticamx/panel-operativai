import type { MetricaEtapaOut } from "@/lib/types";
import { ESTADOS_PIPELINE, fmtInt, formatoPorcentaje, infoEstadoPipeline } from "@/lib/formato";
import { claseFondoEtapa } from "@/lib/colores-etapa";
import { cn } from "@/lib/utils";

/**
 * Embudo por etapa como barras horizontales: una fila por etapa del
 * proceso (siempre en `ESTADOS_PIPELINE`, no en el orden que devuelva la
 * API), ancho proporcional a la etapa con más leads. Es la vista "columnas"
 * que pidió el reporte — el Kanban con las tarjetas ya vive en la página
 * principal del embudo.
 */
export function ChartEmbudo({ etapas }: { etapas: MetricaEtapaOut[] }) {
  const porEstado = new Map(etapas.map((e) => [e.estado, e]));
  const max = Math.max(1, ...etapas.map((e) => e.total));

  return (
    <div className="flex flex-col gap-2.5" role="img" aria-label="Leads por etapa del embudo">
      {ESTADOS_PIPELINE.map((estado) => {
        const info = infoEstadoPipeline(estado);
        const dato = porEstado.get(estado);
        const total = dato?.total ?? 0;
        const pct = Math.max(total > 0 ? 3 : 0, (total / max) * 100);

        return (
          <div key={estado} className="flex items-center gap-2.5 text-xs">
            <span className="w-24 shrink-0 truncate text-text-400">{info.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-sm bg-bg-800">
              <div
                className={cn("h-full rounded-sm transition-[width]", claseFondoEtapa(estado))}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-mono tabular-nums text-text-100">
              {fmtInt.format(total)}
            </span>
            <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-600">
              {formatoPorcentaje(dato?.porcentaje ?? 0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
