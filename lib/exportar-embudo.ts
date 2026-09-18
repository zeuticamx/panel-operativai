/**
 * Exporta el embudo de venta a un .xlsx descargable.
 *
 * `exceljs` se importa dinámicamente adentro de la función: es una
 * dependencia pesada que solo hace falta cuando alguien pulsa "Exportar",
 * así que no tiene sentido que viaje en el bundle inicial de la página.
 */
import type { Workbook, Worksheet } from "exceljs";
import type { MetricasPipelineOut, PipelineOut } from "./types";
import { formatoHoras, infoEstadoPipeline } from "./formato";
import { argbEtapa } from "./colores-etapa";
import { descargarArchivo, fechaArchivo } from "./descargar-archivo";

const FORMATO_MONEDA = '"$"#,##0.00';
const FORMATO_FECHA = "dd/mm/yyyy hh:mm";
/** Ya es 0–100 (no una fracción): el "%" es solo texto, no el multiplicador de Excel. */
const FORMATO_PORCENTAJE = '0.0"%"';

function aNumero(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isNaN(n) ? null : n;
}

function aFecha(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Ancho de columna por contenido real, con un piso y un techo razonables.
 *
 * Las columnas con `numFmt` (moneda, fecha) se saltan a propósito: su ancho
 * ya viene declarado y `cell.text` en una celda `Date`/numérica no respeta
 * el formato antes de guardarse, así que medirla ahí infla la columna al
 * tope con el `toString()` completo en vez de "dd/mm/yyyy hh:mm".
 */
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
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  header.alignment = { vertical: "middle" };
}

// ------------------------------------------------------------
// Hoja 1: Leads
// ------------------------------------------------------------
function hojaLeads(wb: Workbook, leads: PipelineOut[]) {
  const ws = wb.addWorksheet("Clientes", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = [
    { header: "Cliente", key: "cliente", width: 24 },
    { header: "Handle", key: "handle", width: 18 },
    { header: "Etapa", key: "etapa", width: 16 },
    { header: "Vendedor", key: "vendedor", width: 20 },
    { header: "Monto", key: "monto", width: 14, style: { numFmt: FORMATO_MONEDA } },
    { header: "Última actividad", key: "actividad", width: 18, style: { numFmt: FORMATO_FECHA } },
  ];

  // Explícito y no confiar en el orden con que llegó `leads`: el que llama
  // puede pasar una lista ya filtrada/buscada en otro orden.
  const ordenados = [...leads].sort(
    (a, b) => new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime(),
  );

  for (const l of ordenados) {
    const fila = ws.addRow({
      cliente: l.cliente_nombre ?? l.cliente_handle ?? "Sin nombre",
      handle: l.cliente_handle ?? "",
      etapa: infoEstadoPipeline(l.estado).label,
      vendedor: l.vendedor_nombre ?? "Sin asignar",
      monto: aNumero(l.monto_estimado),
      actividad: aFecha(l.actualizado_en),
    });

    const { fill, texto } = argbEtapa(l.estado);
    fila.getCell("etapa").fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    fila.getCell("etapa").font = { color: { argb: texto }, bold: true };
  }

  ws.autoFilter = { from: "A1", to: "F1" };
  estilizarHeader(ws);
  autoAjustarColumnas(ws);
}

// ------------------------------------------------------------
// Hoja 2: Resumen (métricas por etapa)
// ------------------------------------------------------------
function hojaResumen(wb: Workbook, metricas: MetricasPipelineOut, leads: PipelineOut[]) {
  const ws = wb.addWorksheet("Resumen por Etapa");

  ws.columns = [
    { header: "Etapa", key: "etapa", width: 18 },
    { header: "Total", key: "total", width: 10 },
    {
      header: "%",
      key: "porcentaje",
      width: 10,
      style: { numFmt: FORMATO_PORCENTAJE, alignment: { horizontal: "center" } },
    },
    { header: "Monto Total", key: "monto", width: 18, style: { numFmt: FORMATO_MONEDA } },
    { header: "Tiempo promedio", key: "tiempo", width: 18 },
  ];

  // El backend no manda un monto agregado por etapa: se suma acá mismo a
  // partir de los leads, igual que el resto del portal deriva sus métricas
  // de la lista en vez de pedir otra consulta.
  for (const e of metricas.etapas) {
    const monto = leads
      .filter((l) => l.estado === e.estado)
      .reduce((acc, l) => acc + (aNumero(l.monto_estimado) ?? 0), 0);

    const fila = ws.addRow({
      etapa: infoEstadoPipeline(e.estado).label,
      total: e.total,
      porcentaje: e.porcentaje,
      monto: monto > 0 ? monto : null,
      tiempo: formatoHoras(e.horas_promedio),
    });

    const { fill, texto } = argbEtapa(e.estado);
    fila.getCell("etapa").fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    fila.getCell("etapa").font = { color: { argb: texto }, bold: true };
  }

  estilizarHeader(ws);
  autoAjustarColumnas(ws);
}

// ------------------------------------------------------------
// Hoja 3: Ranking de vendedores
// ------------------------------------------------------------
function hojaRanking(wb: Workbook, metricas: MetricasPipelineOut) {
  const ws = wb.addWorksheet("Ranking Vendedores");

  ws.columns = [
    { header: "Vendedor", key: "vendedor", width: 22 },
    { header: "Cierres", key: "cierres", width: 12, style: { alignment: { horizontal: "right" } } },
    { header: "Pérdidas", key: "perdidas", width: 12, style: { alignment: { horizontal: "right" } } },
    {
      header: "Tasa %",
      key: "tasa",
      width: 12,
      style: { numFmt: FORMATO_PORCENTAJE, alignment: { horizontal: "right" } },
    },
    {
      header: "Monto Ganado",
      key: "monto",
      width: 18,
      style: { numFmt: FORMATO_MONEDA, alignment: { horizontal: "right" } },
    },
  ];

  // Explícito y no confiar en el orden del backend: mismo criterio que
  // hojaLeads con `actualizado_en`.
  const ordenados = [...metricas.ranking].sort((a, b) => b.ganados - a.ganados);

  for (const r of ordenados) {
    const fila = ws.addRow({
      // "Cierres" = ganados: es la misma columna que la tabla de ranking del
      // portal llama "Ganados", al lado de "Pérdidas" por separado.
      vendedor: r.activo ? r.nombre : `${r.nombre} (inactivo)`,
      cierres: r.ganados,
      perdidas: r.perdidos,
      tasa: r.tasa_cierre,
      monto: aNumero(r.monto_ganado),
    });

    // "Números grandes" del pedido: los 4 valores de la fila, no el nombre.
    for (const key of ["cierres", "perdidas", "tasa", "monto"] as const) {
      fila.getCell(key).font = { size: 16 };
    }
  }

  estilizarHeader(ws);
  autoAjustarColumnas(ws);
}

/**
 * Arma el .xlsx del embudo y dispara la descarga en el navegador.
 * `metricas` es opcional: sin ella solo se genera la hoja de Leads.
 */
export async function exportarEmbudoExcel(
  leads: PipelineOut[],
  metricas?: MetricasPipelineOut,
): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "OperativAI";
  wb.created = new Date();

  hojaLeads(wb, leads);
  if (metricas) {
    hojaResumen(wb, metricas, leads);
    hojaRanking(wb, metricas);
  }

  const buffer = await wb.xlsx.writeBuffer();
  descargarArchivo(
    buffer,
    `embudo_${fechaArchivo()}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

// ------------------------------------------------------------
// CSV (mismas columnas que la hoja "Clientes" del Excel, en texto plano
// para quien quiera pegarlo en una herramienta que no abre .xlsx)
// ------------------------------------------------------------
const ENCABEZADOS_CSV = ["Cliente", "Handle", "Etapa", "Vendedor", "Monto", "Última actividad"];

/** RFC 4180: solo hace falta comillas si el valor trae coma, comillas o salto de línea. */
function csvEscape(valor: string): string {
  if (/["\n\r,]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

/**
 * Arma el .csv del embudo y dispara la descarga. Sin estilos ni hojas
 * extra (eso es lo que da el Excel) — solo la lista de clientes.
 */
export function exportarEmbudoCSV(leads: PipelineOut[]): void {
  // Mismo orden que hojaLeads: no confiar en el orden con que llegó `leads`.
  const ordenados = [...leads].sort(
    (a, b) => new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime(),
  );

  const filas = ordenados.map((l) => [
    l.cliente_nombre ?? l.cliente_handle ?? "Sin nombre",
    l.cliente_handle ?? "",
    infoEstadoPipeline(l.estado).label,
    l.vendedor_nombre ?? "Sin asignar",
    aNumero(l.monto_estimado)?.toString() ?? "",
    // ISO tal cual: es un archivo para procesar, no para leer a simple
    // vista (eso es lo que ya hacen el Excel y el PDF con `tiempoRelativo`).
    l.actualizado_en,
  ]);

  // ﻿ (BOM): sin él, Excel en Windows adivina Latin-1 y los acentos
  // de "Última actividad" (o de un nombre de cliente) llegan corruptos.
  const contenido =
    "﻿" +
    [ENCABEZADOS_CSV, ...filas].map((fila) => fila.map(csvEscape).join(",")).join("\r\n");

  descargarArchivo(contenido, `embudo_${fechaArchivo()}.csv`, "text/csv;charset=utf-8;");
}
