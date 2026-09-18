/**
 * Exporta el dashboard de Reportes (embudo, tendencia, comparativa,
 * conversión) a un .xlsx descargable. Mismo patrón que `exportar-embudo.ts`:
 * `exceljs` se importa dinámicamente adentro de la función, y no a nivel de
 * módulo, porque solo hace falta cuando alguien pulsa "Exportar".
 */
import type { Workbook, Worksheet } from "exceljs";
import type {
  ConversionPipelineOut,
  MetricasPipelineOut,
  TendenciaPipelineOut,
} from "./types";
import { formatoHoras, formatoMes, infoEstadoPipeline } from "./formato";
import { argbEtapa } from "./colores-etapa";
import { descargarArchivo, fechaArchivo } from "./descargar-archivo";

const FORMATO_MONEDA = '"$"#,##0.00';
/** Ya es 0–100 (no una fracción): el "%" es solo texto, no el multiplicador de Excel. */
const FORMATO_PORCENTAJE = '0.0"%"';

function aNumero(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isNaN(n) ? null : n;
}

function autoAjustarColumnas(ws: Worksheet) {
  ws.columns.forEach((columna) => {
    if (columna.style?.numFmt) return;
    let max = (columna.header?.length ?? 10) + 2;
    columna.eachCell?.({ includeEmpty: false }, (celda) => {
      const texto = typeof celda.value === "string" ? celda.value : String(celda.value ?? "");
      max = Math.max(max, texto.length + 2);
    });
    columna.width = Math.min(Math.max(max, 10), 50);
  });
}

function estilizarHeader(ws: Worksheet) {
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  header.alignment = { vertical: "middle" };
}

function hojaEmbudo(wb: Workbook, metricas: MetricasPipelineOut) {
  const ws = wb.addWorksheet("Embudo por etapa");
  ws.columns = [
    { header: "Etapa", key: "etapa", width: 18 },
    { header: "Total", key: "total", width: 10 },
    { header: "% del total", key: "porcentaje", width: 12, style: { numFmt: FORMATO_PORCENTAJE } },
    { header: "Tiempo promedio", key: "tiempo", width: 18 },
  ];
  for (const e of metricas.etapas) {
    const fila = ws.addRow({
      etapa: infoEstadoPipeline(e.estado).label,
      total: e.total,
      porcentaje: e.porcentaje,
      tiempo: formatoHoras(e.horas_promedio),
    });
    const { fill, texto } = argbEtapa(e.estado);
    fila.getCell("etapa").fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    fila.getCell("etapa").font = { color: { argb: texto }, bold: true };
  }
  estilizarHeader(ws);
  autoAjustarColumnas(ws);
}

function hojaTendencia(wb: Workbook, tendencia: TendenciaPipelineOut) {
  const ws = wb.addWorksheet("Tendencia mensual", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Mes", key: "mes", width: 14 },
    { header: "Nuevos", key: "nuevos", width: 10 },
    { header: "Ganados", key: "ganados", width: 10 },
    { header: "Perdidos", key: "perdidos", width: 10 },
    { header: "Monto ganado", key: "monto", width: 16, style: { numFmt: FORMATO_MONEDA } },
  ];
  for (const m of tendencia.meses) {
    ws.addRow({
      mes: formatoMes(m.periodo),
      nuevos: m.nuevos,
      ganados: m.ganados,
      perdidos: m.perdidos,
      monto: aNumero(m.monto_ganado),
    });
  }
  estilizarHeader(ws);
  autoAjustarColumnas(ws);
}

function hojaComparativa(wb: Workbook, metricas: MetricasPipelineOut) {
  const ws = wb.addWorksheet("Comparativa vendedores");
  ws.columns = [
    { header: "Vendedor", key: "vendedor", width: 22 },
    { header: "Ganados", key: "ganados", width: 10 },
    { header: "Perdidos", key: "perdidos", width: 10 },
    { header: "Tasa %", key: "tasa", width: 10, style: { numFmt: FORMATO_PORCENTAJE } },
    { header: "Monto ganado", key: "monto", width: 16, style: { numFmt: FORMATO_MONEDA } },
  ];
  const ordenado = [...metricas.ranking].sort((a, b) => b.ganados - a.ganados);
  for (const r of ordenado) {
    ws.addRow({
      vendedor: r.activo ? r.nombre : `${r.nombre} (inactivo)`,
      ganados: r.ganados,
      perdidos: r.perdidos,
      tasa: r.tasa_cierre,
      monto: aNumero(r.monto_ganado),
    });
  }
  estilizarHeader(ws);
  autoAjustarColumnas(ws);
}

function hojaConversion(wb: Workbook, conversion: ConversionPipelineOut) {
  const ws = wb.addWorksheet("Conversión");
  ws.columns = [
    { header: "Etapa", key: "etapa", width: 18 },
    { header: "Leads que llegaron", key: "alcanzados", width: 18 },
    { header: "% del total", key: "porcentaje", width: 12, style: { numFmt: FORMATO_PORCENTAJE } },
  ];
  for (const e of conversion.etapas) {
    const fila = ws.addRow({
      etapa: infoEstadoPipeline(e.estado).label,
      alcanzados: e.alcanzados,
      porcentaje: e.porcentaje,
    });
    const { fill, texto } = argbEtapa(e.estado);
    fila.getCell("etapa").fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    fila.getCell("etapa").font = { color: { argb: texto }, bold: true };
  }
  estilizarHeader(ws);
  autoAjustarColumnas(ws);
}

/** Arma el .xlsx del dashboard de reportes y dispara la descarga. */
export async function exportarReportesExcel(
  metricas: MetricasPipelineOut,
  tendencia: TendenciaPipelineOut,
  conversion: ConversionPipelineOut,
): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "OperativAI";
  wb.created = new Date();

  hojaEmbudo(wb, metricas);
  hojaTendencia(wb, tendencia);
  hojaComparativa(wb, metricas);
  hojaConversion(wb, conversion);

  const buffer = await wb.xlsx.writeBuffer();
  descargarArchivo(
    buffer,
    `reportes_${fechaArchivo()}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
