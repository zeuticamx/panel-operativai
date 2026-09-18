/**
 * Tests de integración de app/(privado)/vendedores/page.tsx.
 *
 * Se mockean por completo los módulos que no son el objeto de esta prueba
 * (contexto de sesión, dialogs, centro de notificaciones con su socket) y
 * las 3 funciones de exportación (@/lib/exportar-embudo,
 * @/lib/exportar-embudo-pdf): lo que se prueba acá es que la página arme
 * bien el estado (carga / módulo apagado / datos), calcule los KPIs
 * correctos, y que cada botón de exportar llame a la función que le toca
 * con los argumentos correctos. El contenido real de cada exportación (CSV/
 * Excel/PDF) ya se prueba en lib/__tests__/exportar-*.test.ts.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import VendedoresPage from "@/app/(privado)/vendedores/page";
import { useServicios } from "@/app/components/modulo-vendedores";
import { exportarEmbudoCSV, exportarEmbudoExcel } from "@/lib/exportar-embudo";
import { exportarEmbudoPDF } from "@/lib/exportar-embudo-pdf";
import type { MetricasPipelineOut, PipelineOut, VendedorOut } from "@/lib/types";

jest.mock("@/app/components/modulo-vendedores", () => ({
  useServicios: jest.fn(),
  esGerencia: () => true,
  VendedoresTabs: () => null,
  ModuloApagado: () => <p>módulo de vendedores apagado</p>,
}));

jest.mock("@/app/components/centro-notificaciones", () => ({
  CentroNotificaciones: () => null,
}));
jest.mock("@/app/components/alertas-stats", () => ({ AlertasStats: () => null }));
jest.mock("@/app/components/crear-cliente-form", () => ({ CrearClienteForm: () => null }));
jest.mock("@/app/components/cambiar-estado-lead", () => ({ CambiarEstadoLead: () => null }));
jest.mock("@/app/components/lead-drawer", () => ({ LeadDrawer: () => null }));

jest.mock("@/lib/exportar-embudo", () => ({
  exportarEmbudoCSV: jest.fn(),
  exportarEmbudoExcel: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/exportar-embudo-pdf", () => ({
  exportarEmbudoPDF: jest.fn().mockResolvedValue(undefined),
}));

const mockUseServicios = useServicios as jest.Mock;
const mockExportarCSV = exportarEmbudoCSV as jest.Mock;
const mockExportarExcel = exportarEmbudoExcel as jest.Mock;
const mockExportarPDF = exportarEmbudoPDF as jest.Mock;

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

function conServicios(overrides: Partial<{ loading: boolean; activo: boolean }> = {}) {
  const { loading = false, activo = true } = overrides;
  mockUseServicios.mockReturnValue({
    data: loading ? null : { tenant_id: TENANT_ID, agente_ia_activo: true, gestion_vendedores_activo: activo },
    loading,
    error: null,
    recargar: jest.fn(),
    tenantId: TENANT_ID,
  });
}

const LEADS: PipelineOut[] = [
  {
    id: "lead-abierto",
    user_id: "user-1",
    cliente_nombre: "Juan Pérez",
    cliente_handle: "5215512345678",
    vendedor_id: "vendedor-1",
    vendedor_nombre: "Ana",
    estado: "nuevo",
    monto_estimado: "1500",
    motivo_perdida: null,
    actualizado_en: "2026-01-10T12:00:00Z",
    transiciones_posibles: ["contactado"],
  },
  {
    id: "lead-sin-vendedor",
    user_id: "user-2",
    cliente_nombre: "María López",
    cliente_handle: null,
    vendedor_id: null,
    vendedor_nombre: null,
    estado: "contactado",
    monto_estimado: null,
    motivo_perdida: null,
    actualizado_en: "2026-01-09T12:00:00Z",
    transiciones_posibles: ["en_seguimiento"],
  },
  {
    id: "lead-ganado",
    user_id: "user-3",
    cliente_nombre: "Cliente Cerrado",
    cliente_handle: null,
    vendedor_id: "vendedor-1",
    vendedor_nombre: "Ana",
    estado: "ganado",
    monto_estimado: "3000",
    motivo_perdida: null,
    actualizado_en: "2026-01-08T12:00:00Z",
    transiciones_posibles: [],
  },
];

const METRICAS: MetricasPipelineOut = {
  total_clientes: 3,
  etapas: [
    { estado: "nuevo", total: 1, porcentaje: 33.3, horas_promedio: null },
    { estado: "contactado", total: 1, porcentaje: 33.3, horas_promedio: null },
    { estado: "ganado", total: 1, porcentaje: 33.3, horas_promedio: 24 },
  ],
  tasa_conversion_global: 100,
  ranking: [
    { vendedor_id: "vendedor-1", nombre: "Ana", activo: true, abiertos: 1, ganados: 1, perdidos: 0, monto_ganado: "3000", tasa_cierre: 100 },
  ],
};

const VENDEDORES: VendedorOut[] = [
  { id: "vendedor-1", tenant_id: TENANT_ID, portal_user_id: null, nombre: "Ana", telefono: null, activo: true, creado_en: "2026-01-01T00:00:00Z" } as VendedorOut,
];

/**
 * Espera a que los leads hayan cargado. No se puede usar getByText a secas:
 * EmbudoEtapas (el kanban visual, sin mockear porque es puramente
 * presentacional) repite el nombre de cada cliente en su propia tarjeta,
 * además de la tabla — el mismo nombre aparece más de una vez a propósito.
 */
async function esperarLeadsCargados() {
  await waitFor(() => {
    expect(screen.getAllByText("Juan Pérez").length).toBeGreaterThan(0);
  });
}

function mockFetchFeliz() {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    const responder = (data: unknown) =>
      Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(data) });
    if (url.includes("/pipeline?limite=")) return responder(LEADS);
    if (url.includes("/vendedores?activo=true")) return responder(VENDEDORES);
    if (url.includes("/metricas")) return responder(METRICAS);
    return responder(null);
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
  jest.clearAllMocks();
});

test("muestra el estado de carga mientras useServicios está pendiente", () => {
  conServicios({ loading: true });
  mockFetchFeliz();

  render(<VendedoresPage />);

  expect(screen.getByText(/cargando/i)).toBeInTheDocument();
});

test("muestra ModuloApagado cuando gestion_vendedores_activo es false", () => {
  conServicios({ activo: false });
  mockFetchFeliz();

  render(<VendedoresPage />);

  expect(screen.getByText(/módulo de vendedores apagado/i)).toBeInTheDocument();
});

test("renderiza los KPIs y la lista de leads con los datos reales", async () => {
  conServicios();
  mockFetchFeliz();

  render(<VendedoresPage />);
  await esperarLeadsCargados();

  expect(screen.getAllByText("María López").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Cliente Cerrado").length).toBeGreaterThan(0);

  // KPIs derivados de la lista (ver VendedoresPage): 2 abiertos (nuevo +
  // contactado), 1 sin vendedor (el de "contactado", que no está cerrado),
  // 1 ganado, 100% de conversión.
  //
  // getByText a secas es ambiguo para varios de estos labels: "Sin
  // vendedor" también es una <option> del filtro, "Ganados" también es un
  // <th> de la tabla de ranking. El label del StatCard es siempre el único
  // <span> con ese texto exacto.
  function statCard(label: string): HTMLElement {
    return screen
      .getAllByText(label)
      .find((el) => el.tagName === "SPAN")!
      .closest("div")!;
  }

  expect(within(statCard("Leads abiertos")).getByText("2")).toBeInTheDocument();
  expect(within(statCard("Sin vendedor")).getByText("1")).toBeInTheDocument();
  expect(within(statCard("Ganados")).getByText("1")).toBeInTheDocument();
  expect(within(statCard("Conversión")).getByText("100%")).toBeInTheDocument();

  expect(screen.getByRole("button", { name: /excel/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /pdf/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /csv/i })).toBeInTheDocument();
});

test("cada botón de exportar llama a la función que le corresponde con los leads y métricas actuales", async () => {
  conServicios();
  mockFetchFeliz();
  const user = userEvent.setup();

  render(<VendedoresPage />);
  await esperarLeadsCargados();

  await user.click(screen.getByRole("button", { name: /csv/i }));
  await waitFor(() => expect(mockExportarCSV).toHaveBeenCalledTimes(1));
  expect(mockExportarCSV.mock.calls[0][0]).toHaveLength(3);

  await user.click(screen.getByRole("button", { name: /excel/i }));
  await waitFor(() => expect(mockExportarExcel).toHaveBeenCalledTimes(1));
  expect(mockExportarExcel.mock.calls[0][0]).toHaveLength(3);
  expect(mockExportarExcel.mock.calls[0][1]).toEqual(METRICAS);

  await user.click(screen.getByRole("button", { name: /^pdf$/i }));
  await waitFor(() => expect(mockExportarPDF).toHaveBeenCalledTimes(1));
});

test("si la exportación falla, muestra un aviso de error (role=alert)", async () => {
  conServicios();
  mockFetchFeliz();
  mockExportarCSV.mockImplementationOnce(() => {
    throw new Error("disco lleno");
  });
  const user = userEvent.setup();

  render(<VendedoresPage />);
  await esperarLeadsCargados();

  await user.click(screen.getByRole("button", { name: /csv/i }));

  await waitFor(() => {
    expect(screen.getByRole("alert")).toHaveTextContent("disco lleno");
  });
});
