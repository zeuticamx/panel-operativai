/**
 * Tests de lib/exportar-embudo-pdf.tsx: exportarEmbudoPDF (ya existía).
 *
 * @react-pdf/renderer se mockea por completo: construye el PDF real
 * (rasteriza texto, carga /imagenes/LOGO_OPERATIVAI.png) y no hay servidor
 * ni sistema de archivos con esa ruta en el entorno de test, así que
 * intentarlo de verdad sería lento y frágil sin aportar nada — la lógica
 * que vale la pena probar es la de construirDocumento() (qué datos entran
 * al documento), no el renderizado a vector de react-pdf. Como el mock
 * nunca renderiza el árbol de elementos (nuestro `pdf()` mockeado no lo
 * toca), Document/Page/View/Text/Image pueden ser strings inertes.
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

import { pdf } from "@react-pdf/renderer";
import { exportarEmbudoPDF } from "@/lib/exportar-embudo-pdf";
import { descargarArchivo } from "@/lib/descargar-archivo";
import type { MetricasPipelineOut, PipelineOut } from "@/lib/types";

jest.mock("@/lib/descargar-archivo", () => ({
  descargarArchivo: jest.fn(),
  fechaArchivo: () => "2026-01-15",
}));

const mockDescargarArchivo = descargarArchivo as jest.Mock;
const mockPdf = pdf as jest.Mock;

function lead(overrides: Partial<PipelineOut> = {}): PipelineOut {
  return {
    id: "lead-1",
    user_id: "user-1",
    cliente_nombre: "Juan Pérez",
    cliente_handle: "5215512345678",
    vendedor_id: "vendedor-1",
    vendedor_nombre: "Ana",
    estado: "nuevo",
    monto_estimado: "1500.5",
    motivo_perdida: null,
    actualizado_en: "2026-01-10T12:00:00Z",
    transiciones_posibles: ["contactado"],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("llama a descargarArchivo con el nombre y mimetype de un .pdf", async () => {
  await exportarEmbudoPDF([lead()]);

  expect(mockDescargarArchivo).toHaveBeenCalledTimes(1);
  const [blob, nombre, tipo] = mockDescargarArchivo.mock.calls[0];
  expect(nombre).toBe("embudo_2026-01-15.pdf");
  expect(tipo).toBe("application/pdf");
  expect(blob).toBeInstanceOf(Blob);
});

test("funciona solo con `leads`: metricas, tendencia y filtros son opcionales", async () => {
  await expect(exportarEmbudoPDF([lead()])).resolves.toBeUndefined();
  expect(mockPdf).toHaveBeenCalledTimes(1);
});

test("con leads vacíos no lanza (portada + tabla vacía)", async () => {
  await expect(exportarEmbudoPDF([])).resolves.toBeUndefined();
  expect(mockDescargarArchivo).toHaveBeenCalledTimes(1);
});

test("con metricas y tendencia completas tampoco lanza", async () => {
  const metricas: MetricasPipelineOut = {
    total_clientes: 1,
    etapas: [{ estado: "nuevo", total: 1, porcentaje: 100, horas_promedio: null }],
    tasa_conversion_global: 50,
    ranking: [
      { vendedor_id: "1", nombre: "Ana", activo: true, abiertos: 1, ganados: 3, perdidos: 1, monto_ganado: "500", tasa_cierre: 75 },
    ],
  };
  await expect(
    exportarEmbudoPDF([lead()], metricas, { meses: [] }, { fechaInicio: "2026-01-01", fechaFin: "2026-01-31" }),
  ).resolves.toBeUndefined();
});
