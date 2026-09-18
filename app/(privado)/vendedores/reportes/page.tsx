"use client";

import { useMemo, useState, type ReactNode } from "react";
import { FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { useApi, useDebounce } from "@/lib/use-api";
import type {
  ConversionPipelineOut,
  MetricasPipelineOut,
  TendenciaPipelineOut,
} from "@/lib/types";
import { mensajeDeError } from "@/lib/auth";
import { exportarReportesExcel } from "@/lib/exportar-reportes";
import { exportarReportesPDF } from "@/lib/exportar-reportes-pdf";
import { cn } from "@/lib/utils";
import { ChartComparativa } from "@/app/components/chart-comparativa";
import { ChartConversion } from "@/app/components/chart-conversion";
import { ChartEmbudo } from "@/app/components/chart-embudo";
import { ChartTendencia } from "@/app/components/chart-tendencia";
import {
  ModuloApagado,
  VendedoresTabs,
  useServicios,
} from "@/app/components/modulo-vendedores";
import { Aviso, Boton, Cargando, PageHeader, inputClass } from "@/app/components/ui";

interface RangoFechas {
  fechaInicio: string;
  fechaFin: string;
}

/** "YYYY-MM-DD" en hora local, para que el input type="date" y el default coincidan. */
function fechaLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function hoy(): string {
  return fechaLocal(new Date());
}

function haceDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return fechaLocal(d);
}

export default function ReportesPage() {
  const servicios = useServicios();
  const activo = servicios.data?.gestion_vendedores_activo ?? false;
  const base = activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}` : null;

  const [filtros, setFiltros] = useState<RangoFechas>(() => ({
    fechaInicio: haceDias(30),
    fechaFin: hoy(),
  }));
  // 500ms: que teclear/cambiar la fecha no dispare un fetch por cada click del picker.
  const filtrosDebounced = useDebounce(filtros, 500);

  const rangoInvalido = filtros.fechaInicio > filtros.fechaFin;
  const rangoInvalidoDebounced = filtrosDebounced.fechaInicio > filtrosDebounced.fechaFin;

  // `hasta` es exclusivo en el backend, así que el día final completo
  // requiere sumarle uno: si no, un lead dado de alta hoy a las 3pm
  // quedaría fuera de un rango que "termina hoy".
  const { desde, hasta } = useMemo(() => {
    if (rangoInvalidoDebounced) return { desde: null, hasta: null };
    const d = new Date(`${filtrosDebounced.fechaInicio}T00:00:00`);
    const h = new Date(`${filtrosDebounced.fechaFin}T00:00:00`);
    h.setDate(h.getDate() + 1);
    return { desde: d.toISOString(), hasta: h.toISOString() };
  }, [filtrosDebounced, rangoInvalidoDebounced]);

  const rangoQuery =
    desde && hasta ? `desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : null;

  const metricas = useApi<MetricasPipelineOut>(
    base && rangoQuery ? `${base}/metricas?${rangoQuery}` : null,
  );
  const conversion = useApi<ConversionPipelineOut>(
    base && rangoQuery ? `${base}/metricas/conversion?${rangoQuery}` : null,
  );
  // Tendencia es siempre "los últimos 12 meses": no depende del filtro de
  // arriba, es una vista macro aparte (ver aviso en la propia tarjeta).
  const tendencia = useApi<TendenciaPipelineOut>(base ? `${base}/metricas/tendencia?meses=12` : null);

  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);
  const [errorExportar, setErrorExportar] = useState<string | null>(null);

  const listoParaExportar = !!(metricas.data && tendencia.data && conversion.data) && !rangoInvalido;
  const cargandoAlgo = metricas.loading || tendencia.loading || conversion.loading;

  const refrescar = () => {
    metricas.recargar();
    tendencia.recargar();
    conversion.recargar();
  };

  const exportar = async (formato: "excel" | "pdf") => {
    if (!metricas.data || !tendencia.data || !conversion.data) return;
    setErrorExportar(null);
    setExportando(formato);
    try {
      if (formato === "excel") {
        await exportarReportesExcel(metricas.data, tendencia.data, conversion.data);
      } else {
        await exportarReportesPDF(metricas.data, tendencia.data, conversion.data, {
          desde: filtrosDebounced.fechaInicio,
          hasta: filtrosDebounced.fechaFin,
        });
      }
    } catch (e) {
      setErrorExportar(mensajeDeError(e, "No se pudo exportar el reporte."));
    } finally {
      setExportando(null);
    }
  };

  const cargandoInicial = servicios.loading && !servicios.data;

  return (
    <>
      <PageHeader
        titulo="Vendedores"
        sub={<VendedoresTabs />}
        acciones={
          activo && (
            <>
              <label className="sr-only" htmlFor="reportes-desde">
                Desde
              </label>
              <input
                id="reportes-desde"
                type="date"
                value={filtros.fechaInicio}
                max={filtros.fechaFin}
                onChange={(e) => setFiltros((f) => ({ ...f, fechaInicio: e.target.value }))}
                className={cn(inputClass, "w-[9.5rem] py-1.5 text-xs")}
              />
              <span className="text-xs text-text-600" aria-hidden>
                –
              </span>
              <label className="sr-only" htmlFor="reportes-hasta">
                Hasta
              </label>
              <input
                id="reportes-hasta"
                type="date"
                value={filtros.fechaFin}
                min={filtros.fechaInicio}
                max={hoy()}
                onChange={(e) => setFiltros((f) => ({ ...f, fechaFin: e.target.value }))}
                className={cn(inputClass, "w-[9.5rem] py-1.5 text-xs")}
              />
              <Boton variante="fantasma" onClick={refrescar} loading={cargandoAlgo} title="Actualizar">
                <RefreshCw size={13} aria-hidden />
                Actualizar
              </Boton>
              <Boton
                variante="fantasma"
                onClick={() => exportar("excel")}
                loading={exportando === "excel"}
                disabled={!listoParaExportar || exportando !== null}
                title="Exportar a Excel"
              >
                <FileSpreadsheet size={13} aria-hidden />
                Excel
              </Boton>
              <Boton
                variante="fantasma"
                onClick={() => exportar("pdf")}
                loading={exportando === "pdf"}
                disabled={!listoParaExportar || exportando !== null}
                title="Exportar a PDF"
              >
                <FileText size={13} aria-hidden />
                PDF
              </Boton>
            </>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          {servicios.error && <Aviso tipo="error">{servicios.error}</Aviso>}
          {errorExportar && <Aviso tipo="error">{errorExportar}</Aviso>}
          {rangoInvalido && (
            <Aviso tipo="error">La fecha &quot;Desde&quot; tiene que ser anterior a &quot;Hasta&quot;.</Aviso>
          )}

          {cargandoInicial ? (
            <Cargando />
          ) : !activo ? (
            servicios.tenantId && (
              <ModuloApagado tenantId={servicios.tenantId} onActivado={() => servicios.recargar()} />
            )
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ReporteCard
                titulo="Embudo por etapa"
                descripcion="leads actuales de los dados de alta en el rango"
                cargando={metricas.loading && !metricas.data}
                error={metricas.error}
                vacio={metricas.data?.total_clientes === 0}
              >
                {metricas.data && <ChartEmbudo etapas={metricas.data.etapas} />}
              </ReporteCard>

              <ReporteCard
                titulo="Tendencia mensual"
                descripcion="últimos 12 meses · no usa el filtro de fecha de arriba"
                cargando={tendencia.loading && !tendencia.data}
                error={tendencia.error}
                vacio={tendencia.data?.meses.every((m) => m.nuevos === 0 && m.ganados === 0)}
              >
                {tendencia.data && <ChartTendencia meses={tendencia.data.meses} />}
              </ReporteCard>

              <ReporteCard
                titulo="Comparativa de vendedores"
                descripcion="ventas ganadas, leads dados de alta en el rango"
                cargando={metricas.loading && !metricas.data}
                error={metricas.error}
                vacio={metricas.data?.ranking.length === 0}
              >
                {metricas.data && <ChartComparativa ranking={metricas.data.ranking} />}
              </ReporteCard>

              <ReporteCard
                titulo="Conversión entre etapas"
                descripcion="de los leads del rango, cuántos llegaron a cada etapa"
                cargando={conversion.loading && !conversion.data}
                error={conversion.error}
                vacio={conversion.data?.total_leads === 0}
              >
                {conversion.data && <ChartConversion etapas={conversion.data.etapas} />}
              </ReporteCard>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ReporteCard({
  titulo,
  descripcion,
  cargando,
  error,
  vacio,
  children,
}: {
  titulo: string;
  descripcion: string;
  cargando: boolean;
  error: string | null;
  vacio?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-md border border-bg-700 bg-bg-900 p-4">
      <header className="mb-3">
        <h2 className="text-sm font-medium text-text-100">{titulo}</h2>
        <p className="font-mono text-[11px] text-text-600">{descripcion}</p>
      </header>
      {error ? (
        <Aviso tipo="error">{error}</Aviso>
      ) : cargando ? (
        <ChartSkeleton />
      ) : vacio ? (
        <p className="py-8 text-center font-mono text-xs text-text-600">sin datos en este rango</p>
      ) : (
        children
      )}
    </section>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      {[92, 78, 85, 64, 70].map((w, i) => (
        <div key={i} className="h-4 animate-pulse rounded-sm bg-bg-800" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}
