/**
 * Tests de lib/exportar-reportes.ts: exportarReportesExcel (ya existía).
 * No hay exportarReportePDF/exportarReporteExcel acá — el PDF vive aparte
 * en exportar-reportes-pdf.tsx (ver su propio test file).
 */
import ExcelJS from "exceljs";
import { exportarReportesExcel } from "@/lib/exportar-reportes";
import { descargarArchivo } from "@/lib/descargar-archivo";
import type {
  ConversionPipelineOut,
  MetricasPipelineOut,
  RankingVendedorOut,
  TendenciaPipelineOut,
} from "@/lib/types";

jest.mock("@/lib/descargar-archivo", () => ({
  descargarArchivo: jest.fn(),
  fechaArchivo: () => "2026-01-15",
}));

const mockDescargarArchivo = descargarArchivo as jest.Mock;

const METRICAS: MetricasPipelineOut = {
  total_clientes: 10,
  etapas: [
    { estado: "nuevo", total: 10, porcentaje: 100, horas_promedio: null },
    { estado: "ganado", total: 3, porcentaje: 30, horas_promedio: 48 },
  ],
  tasa_conversion_global: 30,
  ranking: [],
};

const TENDENCIA: TendenciaPipelineOut = {
  meses: [{ periodo: "2025-12", nuevos: 5, ganados: 2, perdidos: 1, monto_ganado: "2000" }],
};

const CONVERSION: ConversionPipelineOut = {
  desde: null,
  hasta: null,
  total_leads: 10,
  etapas: [
    { estado: "nuevo", alcanzados: 10, porcentaje: 100 },
    { estado: "ganado", alcanzados: 3, porcentaje: 30 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("llama a descargarArchivo con el nombre y mimetype de un .xlsx", async () => {
  await exportarReportesExcel(METRICAS, TENDENCIA, CONVERSION);

  expect(mockDescargarArchivo).toHaveBeenCalledTimes(1);
  const [buffer, nombre, tipo] = mockDescargarArchivo.mock.calls[0];
  expect(nombre).toBe("reportes_2026-01-15.xlsx");
  expect(tipo).toBe(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  expect((buffer as ArrayBuffer).byteLength).toBeGreaterThan(0);
});

test("arma las 4 hojas del dashboard", async () => {
  await exportarReportesExcel(METRICAS, TENDENCIA, CONVERSION);

  const [buffer] = mockDescargarArchivo.mock.calls[0];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);

  expect(wb.worksheets.map((ws) => ws.name)).toEqual([
    "Embudo por etapa",
    "Tendencia mensual",
    "Comparativa vendedores",
    "Conversión",
  ]);
});

test("la hoja de comparativa ordena a los vendedores por ganados descendente", async () => {
  const ranking: RankingVendedorOut[] = [
    { vendedor_id: "1", nombre: "Beto", activo: true, abiertos: 0, ganados: 5, perdidos: 1, monto_ganado: "100", tasa_cierre: 80 },
    { vendedor_id: "2", nombre: "Ana", activo: true, abiertos: 0, ganados: 12, perdidos: 2, monto_ganado: "200", tasa_cierre: 85 },
    { vendedor_id: "3", nombre: "Caro", activo: false, abiertos: 0, ganados: 8, perdidos: 0, monto_ganado: "50", tasa_cierre: 100 },
  ];
  await exportarReportesExcel({ ...METRICAS, ranking }, TENDENCIA, CONVERSION);

  const [buffer] = mockDescargarArchivo.mock.calls[0];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);

  const hoja = wb.getWorksheet("Comparativa vendedores")!;
  const nombres = [2, 3, 4].map((fila) => hoja.getRow(fila).getCell(1).value);
  // "Caro" está inactiva: la hoja lo marca en el propio texto de la celda,
  // igual que hojaRanking en exportar-embudo.ts.
  expect(nombres).toEqual(["Ana", "Caro (inactivo)", "Beto"]);
});

test("con ranking, tendencia y conversión vacíos no lanza, y las hojas quedan solo con encabezado", async () => {
  const vacias: MetricasPipelineOut = { total_clientes: 0, etapas: [], tasa_conversion_global: null, ranking: [] };
  const sinMeses: TendenciaPipelineOut = { meses: [] };
  const sinEtapas: ConversionPipelineOut = { desde: null, hasta: null, total_leads: 0, etapas: [] };

  await expect(exportarReportesExcel(vacias, sinMeses, sinEtapas)).resolves.toBeUndefined();

  const [buffer] = mockDescargarArchivo.mock.calls[0];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);

  expect(wb.getWorksheet("Tendencia mensual")!.rowCount).toBe(1); // solo el encabezado
});
