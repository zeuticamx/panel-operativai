import type { ConversionEtapaOut } from "@/lib/types";
import { fmtInt, infoEstadoPipeline } from "@/lib/formato";
import { claseFondoEtapa } from "@/lib/colores-etapa";
import { cn } from "@/lib/utils";

/**
 * Waterfall de conversión: cuántos leads llegaron a pisar cada etapa
 * alguna vez, no cuántos están ahí ahora mismo (esa foto ya la da
 * ChartEmbudo). El ancho cae en cascada porque el backend ya entrega
 * `porcentaje` sobre el total del rango — "nuevo" siempre es 100.
 */
export function ChartConversion({ etapas }: { etapas: ConversionEtapaOut[] }) {
  return (
    <div className="flex flex-col gap-2" role="img" aria-label="Conversión entre etapas del embudo">
      {etapas.map((e, i) => {
        const anterior = i > 0 ? etapas[i - 1] : null;
        const caida = anterior ? anterior.porcentaje - e.porcentaje : 0;

        return (
          <div key={e.estado} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-100">{infoEstadoPipeline(e.estado).label}</span>
              <span className="font-mono tabular-nums text-text-400">
                {fmtInt.format(e.alcanzados)} · {Math.round(e.porcentaje)}%
              </span>
            </div>
            <div className="h-4 overflow-hidden rounded-sm bg-bg-800">
              <div
                className={cn(
                  "flex h-full items-center rounded-sm pl-2 transition-[width]",
                  claseFondoEtapa(e.estado),
                )}
                style={{ width: `${Math.max(2, e.porcentaje)}%` }}
              />
            </div>
            {anterior && caida > 0 && (
              <p className="font-mono text-[11px] text-text-600">
                −{Math.round(caida)}% no llegó aquí desde {infoEstadoPipeline(anterior.estado).label.toLowerCase()}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
