"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BarShapeProps } from "recharts";
import { useApi } from "@/lib/use-api";
import type { MetricasPipelineOut } from "@/lib/types";
import { ESTADOS_PIPELINE, fmtInt, formatoPorcentaje, infoEstadoPipeline } from "@/lib/formato";
import { varFondoEtapa } from "@/lib/colores-etapa";
import { useServicios } from "@/app/components/modulo-vendedores";
import { Aviso } from "@/app/components/ui";

export interface EmbudoGraficoFiltros {
  /** "YYYY-MM-DD". Sin filtro, se ve el histórico completo del embudo. */
  fechaInicio?: string;
  fechaFin?: string;
}

interface FilaGrafico {
  estado: string;
  etiqueta: string;
  cantidad: number;
  porcentaje: number;
  color: string;
}

/**
 * `hasta` es exclusivo en el backend: sumarle un día al fin del rango es
 * lo que hace que el día final quede incluido completo (mismo cálculo que
 * la página de Reportes).
 */
function rangoISO(
  fechaInicio: string | undefined,
  fechaFin: string | undefined,
): { desde: string | null; hasta: string | null } {
  if (!fechaInicio || !fechaFin) return { desde: null, hasta: null };
  const d = new Date(`${fechaInicio}T00:00:00`);
  const h = new Date(`${fechaFin}T00:00:00`);
  h.setDate(h.getDate() + 1);
  return { desde: d.toISOString(), hasta: h.toISOString() };
}

/**
 * Embudo de ventas: barras de clientes por etapa + línea de % sobre el
 * total superpuesta, con Recharts. El resto de los gráficos del portal son
 * SVG/divs a mano (ver `chart-embudo.tsx`); este usa Recharts a pedido,
 * pero contra los mismos datos reales de siempre —
 * GET /api/tenants/{id}/metricas — no un endpoint aparte.
 *
 * OJO: son dos ejes Y (cantidad y %). Es el pedido explícito ("línea de
 * conversión superpuesta"), pero vale la nota — un eje dual es más difícil
 * de leer a simple vista que dos gráficos separados o una sola escala.
 */
export function EmbudoGrafico({ filtros = {} }: { filtros?: EmbudoGraficoFiltros }) {
  const servicios = useServicios();
  const activo = servicios.data?.gestion_vendedores_activo ?? false;
  const base = activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}` : null;

  const { fechaInicio, fechaFin } = filtros;
  const { desde, hasta } = useMemo(() => rangoISO(fechaInicio, fechaFin), [fechaInicio, fechaFin]);
  const query = desde && hasta ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : "";

  const metricas = useApi<MetricasPipelineOut>(base ? `${base}/metricas${query}` : null);

  // Siempre los 7 estados de ESTADOS_PIPELINE, en orden, en 0 si no hay
  // datos — igual que ChartEmbudo: una etapa vacía se ve vacía, no
  // desaparece del eje X.
  const datos: FilaGrafico[] = useMemo(() => {
    const porEstado = new Map((metricas.data?.etapas ?? []).map((e) => [e.estado, e]));
    return ESTADOS_PIPELINE.map((estado) => {
      const e = porEstado.get(estado);
      return {
        estado,
        etiqueta: infoEstadoPipeline(estado).label,
        cantidad: e?.total ?? 0,
        porcentaje: e?.porcentaje ?? 0,
        color: varFondoEtapa(estado),
      };
    });
  }, [metricas.data]);

  if (metricas.error) {
    return <Aviso tipo="error">{metricas.error}</Aviso>;
  }

  if (metricas.loading && !metricas.data) {
    return (
      <div className="flex h-72 items-center justify-center font-mono text-xs text-text-600">
        cargando…
      </div>
    );
  }

  return (
    <div className="h-72 w-full" role="img" aria-label="Embudo de ventas por etapa, con porcentaje del total">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="etiqueta"
            tick={{ fill: "var(--text-600)", fontSize: 11 }}
            axisLine={{ stroke: "var(--grid)" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="cantidad"
            allowDecimals={false}
            tick={{ fill: "var(--text-600)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <YAxis
            yAxisId="porcentaje"
            orientation="right"
            domain={[0, 100]}
            unit="%"
            tick={{ fill: "var(--text-600)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<TooltipEmbudo />} cursor={{ fill: "var(--bg-800)" }} />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-400)" }} />
          <Bar
            yAxisId="cantidad"
            dataKey="cantidad"
            name="Clientes"
            maxBarSize={56}
            shape={BarraColoreada}
            // Cada barra ya se pinta por su cuenta en BarraColoreada (una
            // etapa, un color); este `fill` no se ve en el gráfico, solo lo
            // usan la leyenda y el tooltip para el cuadrito de "Clientes".
            fill="var(--series-1)"
          />
          <Line
            yAxisId="porcentaje"
            type="monotone"
            dataKey="porcentaje"
            name="% del total"
            stroke="var(--series-2)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--series-2)", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Barra con el color de su propia etapa. `Cell` (el patrón clásico de
 * Recharts para esto) está deprecado desde la v3 en favor de `shape`.
 */
function BarraColoreada(props: BarShapeProps) {
  const { x, y, width, height, payload } = props;
  const fila = payload as FilaGrafico;
  return <rect x={x} y={y} width={width} height={height} rx={4} fill={fila.color} />;
}

interface TooltipEmbudoProps {
  active?: boolean;
  payload?: { payload: FilaGrafico }[];
}

function TooltipEmbudo({ active, payload }: TooltipEmbudoProps) {
  const fila = payload?.[0]?.payload;
  if (!active || !fila) return null;

  return (
    <div className="rounded-md border border-bg-700 bg-bg-900 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-text-100">{fila.etiqueta}</p>
      <p className="font-mono tabular-nums text-text-400">
        {fmtInt.format(fila.cantidad)} clientes · {formatoPorcentaje(fila.porcentaje)}
      </p>
    </div>
  );
}
