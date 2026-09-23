/**
 * Tests de lib/exportar-embudo.ts: exportarEmbudoCSV (nueva) y
 * exportarEmbudoExcel (ya existía, con 3 hojas y exceljs real — se prueba
 * de verdad, no se mockea, porque no toca el DOM).
 *
 * descargarArchivo() sí se mockea: lo que interesa acá es qué CONTENIDO se
 * arma (el csv/buffer), no el mecanismo de descarga del navegador (eso ya
 * lo cubre el polyfill de URL.createObjectURL en jest.setup.ts para quien
 * no la mockee).
 */
import ExcelJS from "exceljs";
import { exportarEmbudoCSV, exportarEmbudoExcel } from "@/lib/exportar-embudo";
import { descargarArchivo } from "@/lib/descargar-archivo";
import type { MetricasPipelineOut, PipelineOut } from "@/lib/types";

jest.mock("@/lib/descargar-archivo", () => ({
  descargarArchivo: jest.fn(),
  fechaArchivo: () => "2026-01-15",
}));

const mockDescargarArchivo = descargarArchivo as jest.Mock;

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

// ============================================================
// exportarEmbudoCSV
// ============================================================
describe("exportarEmbudoCSV", () => {
  function csvGenerado(): string {
    const [contenido] = mockDescargarArchivo.mock.calls[0];
    return contenido as string;
  }

  test("arma el encabezado esperado con BOM UTF-8 y llama a descargarArchivo con .csv", () => {
    exportarEmbudoCSV([lead()]);

    expect(mockDescargarArchivo).toHaveBeenCalledTimes(1);
    const [contenido, nombre, tipo] = mockDescargarArchivo.mock.calls[0];
    expect(nombre).toBe("embudo_2026-01-15.csv");
    expect(tipo).toBe("text/csv;charset=utf-8;");
    expect(contenido.startsWith("﻿")).toBe(true);

    const primeraLinea = (contenido as string).slice(1).split("\r\n")[0];
    expect(primeraLinea).toBe("Cliente,Handle,Etapa,Vendedor,Monto,Última actividad");
  });

  test("usa 'Sin nombre' y 'Sin asignar' cuando cliente_nombre/vendedor_nombre son null", () => {
    exportarEmbudoCSV([
      lead({ cliente_nombre: null, cliente_handle: null, vendedor_nombre: null }),
    ]);

    const filas = csvGenerado().split("\r\n");
    expect(filas[1]).toBe("Sin nombre,,Nuevo,Sin asignar,1500.5,2026-01-10T12:00:00Z");
  });

  test("monto_estimado null no se escribe como la palabra 'null'", () => {
    exportarEmbudoCSV([lead({ monto_estimado: null })]);

    const filas = csvGenerado().split("\r\n");
    const columnas = filas[1].split(",");
    expect(columnas[4]).toBe("");
    expect(csvGenerado()).not.toContain("null");
  });

  test("escapa un cliente_nombre con coma y comillas según RFC 4180", () => {
    exportarEmbudoCSV([lead({ cliente_nombre: 'Abarrotes "La Esquina", S.A.' })]);

    const filas = csvGenerado().split("\r\n");
    expect(filas[1].startsWith('"Abarrotes ""La Esquina"", S.A."')).toBe(true);
  });

  test("neutraliza un cliente_nombre que Excel ejecutaría como fórmula", () => {
    // cliente_nombre/vendedor_nombre no son datos de confianza: vienen de
    // WhatsApp/IG/FB o los escribe el dueño del negocio (ver celdaCsv).
    exportarEmbudoCSV([
      lead({
        cliente_nombre: '=HYPERLINK("http://evil.test")',
        vendedor_nombre: "+52 no es un vendedor",
      }),
    ]);

    const columnas = csvGenerado().split("\r\n")[1].split(",");
    expect(columnas[0]).toBe('"\'=HYPERLINK(""http://evil.test"")"');
    expect(columnas[3]).toBe("'+52 no es un vendedor");
  });

  test("ordena los leads por actualizado_en descendente, sin importar el orden de entrada", () => {
    const viejo = lead({ id: "viejo", cliente_nombre: "Viejo", actualizado_en: "2026-01-01T00:00:00Z" });
    const nuevo = lead({ id: "nuevo", cliente_nombre: "Nuevo", actualizado_en: "2026-01-20T00:00:00Z" });

    exportarEmbudoCSV([viejo, nuevo]);

    const filas = csvGenerado().split("\r\n");
    expect(filas[1]).toContain("Nuevo");
    expect(filas[2]).toContain("Viejo");
  });
});

// ============================================================
// exportarEmbudoExcel (ya existía — se confirma que sigue intacto)
// ============================================================
describe("exportarEmbudoExcel", () => {
  const metricas: MetricasPipelineOut = {
    total_clientes: 1,
    etapas: [
      { estado: "nuevo", total: 1, porcentaje: 100, horas_promedio: 4 },
    ],
    tasa_conversion_global: 50,
    ranking: [
      {
        vendedor_id: "vendedor-1",
        nombre: "Ana",
        activo: true,
        abiertos: 1,
        ganados: 3,
        perdidos: 1,
        monto_ganado: "4500",
        tasa_cierre: 75,
      },
    ],
  };

  test("llama a descargarArchivo con el nombre y mimetype de un .xlsx", async () => {
    await exportarEmbudoExcel([lead()]);

    expect(mockDescargarArchivo).toHaveBeenCalledTimes(1);
    const [buffer, nombre, tipo] = mockDescargarArchivo.mock.calls[0];
    expect(nombre).toBe("embudo_2026-01-15.xlsx");
    expect(tipo).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect((buffer as ArrayBuffer).byteLength).toBeGreaterThan(0);
  });

  test("sin `metricas`, el .xlsx solo trae la hoja de Leads", async () => {
    await exportarEmbudoExcel([lead()]);

    const [buffer] = mockDescargarArchivo.mock.calls[0];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as ArrayBuffer);

    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Clientes"]);
  });

  test("con `metricas`, arma las 3 hojas y la fila del lead trae el monto correcto", async () => {
    await exportarEmbudoExcel([lead({ monto_estimado: "1500.5" })], metricas);

    const [buffer] = mockDescargarArchivo.mock.calls[0];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as ArrayBuffer);

    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      "Clientes",
      "Resumen por Etapa",
      "Ranking Vendedores",
    ]);

    const hojaLeads = wb.getWorksheet("Clientes")!;
    const filaLead = hojaLeads.getRow(2);
    expect(filaLead.getCell(1).value).toBe("Juan Pérez"); // Cliente
    expect(filaLead.getCell(5).value).toBe(1500.5); // Monto, como número (no string)
  });
});
