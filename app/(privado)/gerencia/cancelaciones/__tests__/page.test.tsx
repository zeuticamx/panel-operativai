/**
 * Reporte de cancelaciones tardías en gerencia: pinta las filas, muestra el
 * estado vacío y el mensaje de error (403) sin romper la pantalla, y manda
 * los filtros de fecha/granularidad al backend.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CancelacionesPage from "@/app/(privado)/gerencia/cancelaciones/page";
import type { CancelacionTardiaFilaOut } from "@/lib/types";
import { useApi } from "@/lib/use-api";

jest.mock("next/navigation", () => ({
  usePathname: () => "/gerencia/cancelaciones",
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));

const mockUseApi = useApi as jest.Mock;

const FILAS: CancelacionTardiaFilaOut[] = [
  {
    tenant_id: "t-1",
    tenant_nombre: "Clínica Norte",
    servicio_id: "s-1",
    servicio_nombre: "Limpieza dental",
    periodo: "2026-10-02",
    tardias: 2,
    total_cliente: 5,
  },
  {
    tenant_id: "t-1",
    tenant_nombre: "Clínica Norte",
    servicio_id: "s-2",
    servicio_nombre: "Ortodoncia",
    periodo: "2026-10-03",
    tardias: 0,
    total_cliente: 1,
  },
];

function conReporte(estado: {
  data: CancelacionTardiaFilaOut[] | null;
  error?: string | null;
  loading?: boolean;
}) {
  mockUseApi.mockImplementation((path: string | null) => {
    if (path?.startsWith("/api/gerencia/cancelaciones-tardias")) {
      return {
        data: estado.data,
        error: estado.error ?? null,
        loading: estado.loading ?? false,
        recargar: jest.fn(),
      };
    }
    return {
      data: {
        total: 1,
        dias: 30,
        moneda: "MXN",
        tipo_cambio_configurado: false,
        tipo_cambio_fuente: "ninguno",
        items: [{ tenant_id: "t-1", nombre: "Clínica Norte" }],
      },
      error: null,
      loading: false,
      recargar: jest.fn(),
    };
  });
}

beforeEach(() => mockUseApi.mockReset());

describe("CancelacionesPage", () => {
  it("muestra una fila por tenant, servicio y período, con los totales", () => {
    conReporte({ data: FILAS });
    render(<CancelacionesPage />);

    const tabla = screen.getByRole("table");
    expect(within(tabla).getByText("Limpieza dental")).toBeInTheDocument();
    expect(within(tabla).getByText("Ortodoncia")).toBeInTheDocument();
    expect(within(tabla).getByText("2026-10-02")).toBeInTheDocument();
    expect(within(tabla).getAllByText("Clínica Norte")).toHaveLength(2);
    expect(screen.getByText(/2 tardías de 6 cancelaciones del cliente/)).toBeInTheDocument();
  });

  it("filtra por servicio sobre las filas ya cargadas", async () => {
    conReporte({ data: FILAS });
    render(<CancelacionesPage />);

    await userEvent.selectOptions(screen.getByLabelText("Servicio"), "s-2");

    const tabla = screen.getByRole("table");
    expect(within(tabla).queryByText("Limpieza dental")).not.toBeInTheDocument();
    expect(within(tabla).getByText("Ortodoncia")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay cancelaciones", () => {
    conReporte({ data: [] });
    render(<CancelacionesPage />);

    expect(screen.getByText(/no hubo cancelaciones de clientes/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("muestra el error (403) como mensaje sin romper la pantalla", () => {
    conReporte({ data: null, error: "No tenés acceso a esta sección" });
    render(<CancelacionesPage />);

    expect(screen.getByText("No tenés acceso a esta sección")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("manda fechas y granularidad al backend", async () => {
    conReporte({ data: FILAS });
    render(<CancelacionesPage />);

    await userEvent.selectOptions(screen.getByLabelText("Agrupar por"), "mes");
    await userEvent.type(screen.getByLabelText("Desde"), "2026-09-01");

    const rutas = mockUseApi.mock.calls.map((c) => c[0] as string | null);
    const ultima = rutas.filter((r) => r?.includes("cancelaciones-tardias")).pop();
    expect(ultima).toContain("granularidad=mes");
    expect(ultima).toContain("desde=2026-09-01");
  });
});
