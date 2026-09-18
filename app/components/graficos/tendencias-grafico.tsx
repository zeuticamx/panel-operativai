"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LegendPayload } from "recharts";
import { useApi } from "@/lib/use-api";
import type { TendenciaPipelineOut } from "@/lib/types";
import { fmtInt, formatoMes } from "@/lib/formato";
import { useServicios } from "@/app/components/modulo-vendedores";
import { Aviso } from "@/app/components/ui";

export interface TendenciasGraficoFiltros {
  /** "YYYY-MM-DD". No se usa hoy — ver nota en TendenciasGrafico. */
  fechaInicio?: string;
  fechaFin?: string;
}

interface FilaGrafico {
  periodo: string;
  etiqueta: string;
  total: number;
  ganados: number;
  perdidos: number;
}

type SerieKey = "total" | "ganados" | "perdidos";

const SERIES: { key: SerieKey; nombre: string; color: string }[] = [
  { key: "total", nombre: "Total", color: "var(--series-1)" },
  { key: "ganados", nombre: "Ganados", color: "var(--success)" },
  { key: "perdidos", nombre: "Perdidos", color: "var(--danger)" },
];

/** `formatoMes` da "ene 2026"; acá solo se capitaliza para el eje. */
function etiquetaMes(periodo: string): string {
  const base = formatoMes(periodo);
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Cierres por mes (ganados/perdidos/total), últimos 12 meses.
 *
 * `filtros` queda en la firma por paridad con el resto de los gráficos de
 * este dashboard, pero no se usa: igual que ChartTendencia (la versión SVG
 * a mano de la página de Reportes), esta vista es siempre "los últimos 12
 * meses" — un rango de fechas arbitrario no encaja con una serie de tiempo
 * pensada para verse completa de un vistazo.
 *
 * Fuente real: GET /api/tenants/{id}/metricas/tendencia?meses=12 (no existe
 * /api/reportes/tendencias). El backend no manda "total": se deriva acá
 * mismo como ganados + perdidos, igual que el resto del portal deriva sus
 * métricas de los datos que sí llegan en vez de pedir otra consulta.
 */
export function TendenciasGrafico({}: { filtros?: TendenciasGraficoFiltros } = {}) {
  const servicios = useServicios();
  const activo = servicios.data?.gestion_vendedores_activo ?? false;
  const base = activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}` : null;

  const tendencia = useApi<TendenciaPipelineOut>(base ? `${base}/metricas/tendencia?meses=12` : null);

  const [ocultas, setOcultas] = useState<Partial<Record<SerieKey, boolean>>>({});

  const datos: FilaGrafico[] = useMemo(
    () =>
      (tendencia.data?.meses ?? []).map((m) => ({
        periodo: m.periodo,
        etiqueta: etiquetaMes(m.periodo),
        total: m.ganados + m.perdidos,
        ganados: m.ganados,
        perdidos: m.perdidos,
      })),
    [tendencia.data],
  );

  const alClicLeyenda = (entry: LegendPayload) => {
    const key = entry.dataKey as SerieKey | undefined;
    if (!key) return;
    setOcultas((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (tendencia.error) {
    return <Aviso tipo="error">{tendencia.error}</Aviso>;
  }

  if (tendencia.loading && !tendencia.data) {
    return (
      <div className="flex h-72 items-center justify-center font-mono text-xs text-text-600">cargando…</div>
    );
  }

  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label="Cierres ganados y perdidos por mes, últimos 12 meses"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="etiqueta"
            tick={{ fill: "var(--text-600)", fontSize: 11 }}
            axisLine={{ stroke: "var(--grid)" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--text-600)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip content={<TooltipTendencias />} cursor={{ stroke: "var(--grid)" }} />
          <Legend
            onClick={alClicLeyenda}
            wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
            formatter={(value: string, entry: LegendPayload) => {
              const key = entry.dataKey as SerieKey | undefined;
              const apagada = key ? !!ocultas[key] : false;
              return (
                <span
                  style={{
                    color: apagada ? "var(--text-600)" : "var(--text-400)",
                    textDecoration: apagada ? "line-through" : "none",
                  }}
                >
                  {value}
                </span>
              );
            }}
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.nombre}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              hide={!!ocultas[s.key]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipTendenciasPayloadItem {
  dataKey?: string;
  value?: number;
  color?: string;
  name?: string;
}

interface TooltipTendenciasProps {
  active?: boolean;
  payload?: TooltipTendenciasPayloadItem[];
  label?: string;
}

function TooltipTendencias({ active, payload, label }: TooltipTendenciasProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border border-bg-700 bg-bg-900 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-text-100">{label}</p>
      <div className="flex flex-col gap-0.5">
        {payload.map((item) => (
          <p
            key={item.dataKey}
            className="flex items-center gap-1.5 font-mono tabular-nums text-text-400"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
            {item.name}: {fmtInt.format(item.value ?? 0)}
          </p>
        ))}
      </div>
    </div>
  );
}
