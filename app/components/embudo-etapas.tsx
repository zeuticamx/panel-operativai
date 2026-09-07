import type { MetricaEtapaOut } from "@/lib/types";
import {
  ESTADOS_PIPELINE,
  fmtInt,
  formatoHoras,
  formatoPorcentaje,
  infoEstadoPipeline,
} from "@/lib/formato";
import { cn } from "@/lib/utils";

const COLOR_BARRA: Record<string, string> = {
  ganado: "bg-success",
  perdido: "bg-danger",
};

/**
 * Cuántos leads hay en cada etapa y cuánto tardan en salir de ella. Las
 * barras van a escala de la etapa más llena (no del total) para que las
 * diferencias entre etapas se vean aunque el total sea grande.
 */
export function EmbudoEtapas({
  etapas,
  loading = false,
}: {
  etapas: MetricaEtapaOut[];
  loading?: boolean;
}) {
  const porEstado = new Map(etapas.map((e) => [e.estado, e]));
  // Orden del embudo, no el que devolvió el backend; las etapas vacías
  // se muestran en 0 en vez de desaparecer.
  const filas = ESTADOS_PIPELINE.map((estado) => porEstado.get(estado) ?? {
    estado,
    total: 0,
    porcentaje: 0,
    horas_promedio: null,
  });
  const maximo = Math.max(1, ...filas.map((f) => f.total));

  return (
    <ul className={cn("flex flex-col gap-2.5 transition-opacity", loading && "opacity-40")}>
      {filas.map((f) => {
        const info = infoEstadoPipeline(f.estado);
        const ancho = (f.total / maximo) * 100;
        return (
          <li key={f.estado} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-text-100">{info.label}</span>
              <span className="flex items-center gap-3 font-mono tabular-nums text-text-400">
                {f.horas_promedio !== null && (
                  <span
                    className="text-text-600"
                    title="Tiempo promedio que un lead pasa en esta etapa"
                  >
                    ~{formatoHoras(f.horas_promedio)}
                  </span>
                )}
                <span>
                  {fmtInt.format(f.total)}
                  <span className="ml-1.5 text-text-600">{formatoPorcentaje(f.porcentaje)}</span>
                </span>
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-sm bg-bg-700"
              role="progressbar"
              aria-label={`${info.label}: ${f.total} leads`}
              aria-valuenow={Math.round(f.porcentaje)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  "h-full rounded-sm transition-[width] duration-300",
                  COLOR_BARRA[f.estado] ?? "bg-series-1",
                )}
                style={{ width: `${ancho}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
