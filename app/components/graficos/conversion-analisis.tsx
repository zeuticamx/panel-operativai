"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BarShapeProps } from "recharts";
import { useApi } from "@/lib/use-api";
import type { ConversionPipelineOut } from "@/lib/types";
import { fmtInt, formatoPorcentaje, infoEstadoPipeline } from "@/lib/formato";
import { useServicios } from "@/app/components/modulo-vendedores";
import { Aviso } from "@/app/components/ui";

export interface ConversionAnalisisFiltros {
  /** "YYYY-MM-DD" */
  fechaInicio?: string;
  fechaFin?: string;
}

interface FilaGrafico {
  etiqueta: string;
  porcentaje: number;
  cantidad: number;
  color: string;
}

/** Meta de conversión por transición, marcada con la línea de referencia. */
const META_PORCENTAJE = 50;

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

function colorPorPorcentaje(pct: number): string {
  if (pct > 60) return "var(--success)";
  if (pct >= 40) return "var(--warning)";
  return "var(--danger)";
}

/**
 * % de conversión por transición entre etapas consecutivas del embudo
 * (de los que llegaron a la etapa de origen, cuántos llegaron también a la
 * siguiente).
 *
 * Fuente real: GET /api/tenants/{id}/metricas/conversion — no existe
 * /api/reportes/conversion. Ese endpoint ya da, por etapa, cuántos leads la
 * alcanzaron alguna vez (`alcanzados`); el % *por transición* que pide este
 * gráfico no es un campo aparte, se deriva acá como
 * alcanzados[destino] / alcanzados[origen] — la misma lógica que ya usa
 * `ChartConversion` (la versión SVG a mano) para el "% no llegó aquí".
 *
 * Los estados reales son 6, no los 5 del pedido: no existe la etapa
 * "propuesta" — la real es "cotizado" — y falta "en_seguimiento" entre
 * Contactado y Cotizado. Eso da 5 transiciones reales, una más que el
 * ejemplo del pedido.
 */
export function ConversionAnalisis({ filtros = {} }: { filtros?: ConversionAnalisisFiltros }) {
  const servicios = useServicios();
  const activo = servicios.data?.gestion_vendedores_activo ?? false;
  const base = activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}` : null;

  const { fechaInicio, fechaFin } = filtros;
  const { desde, hasta } = useMemo(() => rangoISO(fechaInicio, fechaFin), [fechaInicio, fechaFin]);
  const query = desde && hasta ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : "";

  const conversion = useApi<ConversionPipelineOut>(base ? `${base}/metricas/conversion${query}` : null);

  const datos: FilaGrafico[] = useMemo(() => {
    const etapas = conversion.data?.etapas ?? [];
    const filas: FilaGrafico[] = [];
    for (let i = 1; i < etapas.length; i++) {
      const origen = etapas[i - 1];
      const destino = etapas[i];
      const pct = origen.alcanzados > 0 ? (destino.alcanzados / origen.alcanzados) * 100 : 0;
      filas.push({
        etiqueta: `${infoEstadoPipeline(origen.estado).label} → ${infoEstadoPipeline(destino.estado).label}`,
        porcentaje: Math.round(pct * 10) / 10,
        cantidad: destino.alcanzados,
        color: colorPorPorcentaje(pct),
      });
    }
    return filas;
  }, [conversion.data]);

  if (conversion.error) {
    return <Aviso tipo="error">{conversion.error}</Aviso>;
  }

  if (conversion.loading && !conversion.data) {
    return (
      <div className="flex h-80 items-center justify-center font-mono text-xs text-text-600">cargando…</div>
    );
  }

  if (datos.length === 0) {
    return (
      <p className="flex h-80 items-center justify-center font-mono text-xs text-text-600">
        sin datos en este rango
      </p>
    );
  }

  // Las etiquetas combinan dos nombres de etapa ("En seguimiento →
  // Cotizado"): a -30° no entran 5 sin recortarse en una pantalla angosta.
  // Mismo patrón que ComparativaVendedores — el contenedor scrollea en vez
  // de recortar el texto.
  const anchoMinimo = datos.length * 130;

  return (
    <div
      className="h-80 w-full overflow-x-auto"
      role="img"
      aria-label="Porcentaje de conversión por transición del embudo, con meta de 50%"
    >
      <div style={{ width: "100%", minWidth: anchoMinimo }} className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="etiqueta"
              angle={-30}
              textAnchor="end"
              interval={0}
              height={100}
              tick={{ fill: "var(--text-600)", fontSize: 11 }}
              axisLine={{ stroke: "var(--grid)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              unit="%"
              tick={{ fill: "var(--text-600)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <ReferenceLine
              y={META_PORCENTAJE}
              stroke="var(--text-600)"
              strokeDasharray="4 4"
              label={{
                value: `Meta: ${META_PORCENTAJE}%`,
                position: "insideTopRight",
                fill: "var(--text-600)",
                fontSize: 10,
              }}
            />
            <Tooltip content={<TooltipConversion />} cursor={{ fill: "var(--bg-800)" }} />
            <Bar dataKey="porcentaje" name="% de conversión" maxBarSize={56} shape={BarraColoreada} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Barra con color según el propio %. `Cell` (el patrón clásico de Recharts
 * para esto) está deprecado desde la v3 en favor de `shape`.
 */
function BarraColoreada(props: BarShapeProps) {
  const { x, y, width, height, payload } = props;
  const fila = payload as FilaGrafico;
  return <rect x={x} y={y} width={width} height={height} rx={4} fill={fila.color} />;
}

interface TooltipConversionProps {
  active?: boolean;
  payload?: { payload: FilaGrafico }[];
}

function TooltipConversion({ active, payload }: TooltipConversionProps) {
  const fila = payload?.[0]?.payload;
  if (!active || !fila) return null;

  return (
    <div className="rounded-md border border-bg-700 bg-bg-900 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-text-100">{fila.etiqueta}</p>
      <p className="font-mono tabular-nums text-text-400">{formatoPorcentaje(fila.porcentaje)} de conversión</p>
      <p className="font-mono tabular-nums text-text-600">{fmtInt.format(fila.cantidad)} clientes llegaron</p>
    </div>
  );
}
