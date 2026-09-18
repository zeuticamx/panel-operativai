import type { RankingVendedorOut } from "@/lib/types";
import { fmtInt } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Comparativa de vendedores por ventas ganadas: una sola serie (todas las
 * barras del mismo color), así que no lleva leyenda — el título ya dice
 * qué mide. Ordenado de mayor a menor, como el ranking de la página
 * principal del embudo.
 */
export function ChartComparativa({ ranking }: { ranking: RankingVendedorOut[] }) {
  const ordenado = [...ranking].sort((a, b) => b.ganados - a.ganados);
  const max = Math.max(1, ...ordenado.map((r) => r.ganados));

  return (
    <div className="flex flex-col gap-2.5" role="img" aria-label="Ventas ganadas por vendedor">
      {ordenado.map((r) => {
        const pct = Math.max(r.ganados > 0 ? 3 : 0, (r.ganados / max) * 100);
        return (
          <div key={r.vendedor_id} className="flex items-center gap-2.5 text-xs">
            <span
              className={cn(
                "w-24 shrink-0 truncate",
                r.activo ? "text-text-400" : "text-text-600",
              )}
              title={r.activo ? r.nombre : `${r.nombre} (inactivo)`}
            >
              {r.nombre}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded-sm bg-bg-800">
              <div
                className="h-full rounded-sm bg-series-1 transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-mono tabular-nums text-text-100">
              {fmtInt.format(r.ganados)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
