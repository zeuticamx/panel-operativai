/**
 * Tests de lib/exportar-reportes-pdf.tsx: exportarReportesPDF (ya existía).
 * Mismo mock de @react-pdf/renderer que exportar-embudo-pdf.test.ts — ver
 * el comentario ahí para el porqué.
 */
jest.mock("@react-pdf/renderer", () => ({
  Document: "Document",
  Page: "Page",
  View: "View",
  Text: "Text",
  Image: "Image",
  StyleSheet: { create: (styles: unknown) => styles },
  pdf: jest.fn(() => ({
    toBlob: async () => new Blob(["%PDF-mock"], { type: "application/pdf" }),
  })),
}));

import { exportarReportesPDF } from "@/lib/exportar-reportes-pdf";
import { descargarArchivo } from "@/lib/descargar-archivo";
import type { ConversionPipelineOut, MetricasPipelineOut, TendenciaPipelineOut } from "@/lib/types";

jest.mock("@/lib/descargar-archivo", () => ({
  descargarArchivo: jest.fn(),
  fechaArchivo: () => "2026-01-15",
}));

const mockDescargarArchivo = descargarArchivo as jest.Mock;

const METRICAS: MetricasPipelineOut = {
  total_clientes: 10,
  etapas: [{ estado: "nuevo", total: 10, porcentaje: 100, horas_promedio: null }],
  tasa_conversion_global: 30,
  ranking: [],
};
const TENDENCIA: TendenciaPipelineOut = { meses: [] };
const CONVERSION: ConversionPipelineOut = { desde: null, hasta: null, total_leads: 10, etapas: [] };

beforeEach(() => {
  jest.clearAllMocks();
});

test("llama a descargarArchivo con el nombre y mimetype de un .pdf", async () => {
  await exportarReportesPDF(METRICAS, TENDENCIA, CONVERSION, null);

  expect(mockDescargarArchivo).toHaveBeenCalledTimes(1);
  const [blob, nombre, tipo] = mockDescargarArchivo.mock.calls[0];
  expect(nombre).toBe("reportes_2026-01-15.pdf");
  expect(tipo).toBe("application/pdf");
  expect(blob).toBeInstanceOf(Blob);
});

test("con un rango de fechas explícito tampoco lanza", async () => {
  await expect(
    exportarReportesPDF(METRICAS, TENDENCIA, CONVERSION, {
      desde: "2026-01-01T00:00:00Z",
      hasta: "2026-01-31T00:00:00Z",
    }),
  ).resolves.toBeUndefined();
});
