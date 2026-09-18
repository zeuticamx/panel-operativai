"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "@/lib/use-api";
import type { MetricasPipelineOut, RankingVendedorOut } from "@/lib/types";
import { fmtInt, formatoPorcentaje } from "@/lib/formato";
import { useServicios } from "@/app/components/modulo-vendedores";
import { Aviso } from "@/app/components/ui";

export interface ComparativaVendedoresFiltros {
  /** "YYYY-MM-DD" */
  fechaInicio?: string;
  fechaFin?: string;
}

interface FilaGrafico {
  vendedorId: string;
  etiqueta: string;
  cierres: number;
  perdidas: number;
  tasaCierre: number | null;
}

const TOPE_VENDEDORES = 10;
/** Ancho mínimo por vendedor en px, para que el scroll horizontal entre a
 *  tallar antes de que las barras se aplasten (pedido #7). */
const ANCHO_POR_BARRA = 90;

/**
 * `hasta` es exclusivo en el backend: sumarle un día al fin del rango es lo
 * que incluye el día final completo (mismo cálculo que el resto de los
 * gráficos de este dashboard).
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
 * Comparativa de cierres/pérdidas por vendedor — top 10 por cierres.
 *
 * Fuente real: GET /api/tenants/{id}/metricas (mismo endpoint que
 * EmbudoGrafico), campo `ranking`. No existe
 * /api/reportes/comparativa-vendedores; y "cierres"/"perdidas" del pedido
 * son `ganados`/`perdidos` en el backend (RankingVendedorOut).
 */
export function ComparativaVendedores({ filtros = {} }: { filtros?: ComparativaVendedoresFiltros }) {
  const servicios = useServicios();
  const activo = servicios.data?.gestion_vendedores_activo ?? false;
  const base = activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}` : null;

  const { fechaInicio, fechaFin } = filtros;
  const { desde, hasta } = useMemo(() => rangoISO(fechaInicio, fechaFin), [fechaInicio, fechaFin]);
  const query = desde && hasta ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : "";

  const metricas = useApi<MetricasPipelineOut>(base ? `${base}/metricas${query}` : null);

  const datos: FilaGrafico[] = useMemo(() => {
    const ranking: RankingVendedorOut[] = metricas.data?.ranking ?? [];
    return [...ranking]
      .sort((a, b) => b.ganados - a.ganados)
      .slice(0, TOPE_VENDEDORES)
      .map((r) => ({
        vendedorId: r.vendedor_id,
        etiqueta: r.activo ? r.nombre : `${r.nombre} (inactivo)`,
        cierres: r.ganados,
        perdidas: r.perdidos,
        tasaCierre: r.tasa_cierre,
      }));
  }, [metricas.data]);

  if (metricas.error) {
    return <Aviso tipo="error">{metricas.error}</Aviso>;
  }

  if (metricas.loading && !metricas.data) {
    return (
      <div className="flex h-80 items-center justify-center font-mono text-xs text-text-600">cargando…</div>
    );
  }

  if (datos.length === 0) {
    return (
      <p className="flex h-80 items-center justify-center font-mono text-xs text-text-600">
        todavía no hay vendedores
      </p>
    );
  }

  const anchoMinimo = datos.length * ANCHO_POR_BARRA;

  return (
    <div className="h-80 w-full overflow-x-auto" role="img" aria-label="Cierres y pérdidas por vendedor">
      <div style={{ width: "100%", minWidth: anchoMinimo }} className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 48, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="etiqueta"
              angle={-45}
              textAnchor="end"
              interval={0}
              height={60}
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
            <Tooltip content={<TooltipComparativa />} cursor={{ fill: "var(--bg-800)" }} />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-400)" }} />
            <Bar dataKey="cierres" name="Cierres" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="perdidas" name="Pérdidas" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface TooltipComparativaProps {
  active?: boolean;
  payload?: { payload: FilaGrafico }[];
}

function TooltipComparativa({ active, payload }: TooltipComparativaProps) {
  const fila = payload?.[0]?.payload;
  if (!active || !fila) return null;

  return (
    <div className="rounded-md border border-bg-700 bg-bg-900 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-text-100">{fila.etiqueta}</p>
      <p className="flex items-center gap-1.5 font-mono tabular-nums text-text-400">
        <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
        Cierres: {fmtInt.format(fila.cierres)}
      </p>
      <p className="flex items-center gap-1.5 font-mono tabular-nums text-text-400">
        <span className="h-2 w-2 rounded-full bg-danger" aria-hidden />
        Pérdidas: {fmtInt.format(fila.perdidas)}
      </p>
      <p className="mt-1 font-mono text-[11px] text-text-600">
        Tasa de cierre: {formatoPorcentaje(fila.tasaCierre)}
      </p>
    </div>
  );
}
