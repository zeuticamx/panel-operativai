/**
 * Tests de la leyenda de IVA en /suscripcion: los precios del catálogo se
 * muestran sin IVA (ver backend/services/pagos.py::con_iva), así que la
 * pantalla tiene que avisarlo — con el porcentaje real que manda el
 * backend en `catalogo.iva_tasa`, no un texto fijo que se pueda
 * desincronizar de lo que de verdad se cobra.
 */
import { render, screen } from "@testing-library/react";

import SuscripcionPage from "@/app/(privado)/suscripcion/page";
import { useUsuario } from "@/app/components/usuario-context";
import type { CatalogoPagosOut, PlanOut, SuscripcionOut } from "@/lib/types";
import { useApi } from "@/lib/use-api";

jest.mock("@/app/components/usuario-context", () => ({ useUsuario: jest.fn() }));
jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));
jest.mock("@/app/components/centro-notificaciones", () => ({ CentroNotificaciones: () => null }));

const mockUseUsuario = useUsuario as jest.Mock;
const mockUseApi = useApi as jest.Mock;

const PLAN_STARTER: PlanOut = {
  nombre: "starter",
  descripcion: "Plan básico",
  precio_monthly: "199.00",
  precio_annual: null,
  max_vendedores: 3,
  max_leads_mensuales: 1000,
  creditos_incluidos_mensual: "100",
  agente_ia_activo: true,
  gestion_vendedores_activo: true,
  herramientas_activo: false,
  crm_campo_activo: false,
  calendario_activo: false,
};

const CATALOGO: CatalogoPagosOut = {
  planes: [PLAN_STARTER],
  paquetes: [{ creditos: "500", precio: "129.99" }],
  iva_tasa: "0.16",
};

const SUSCRIPCION: SuscripcionOut = {
  plan: "starter",
  estado_suscripcion: "activa",
  fecha_renovacion: "2026-11-01T00:00:00Z",
  precio_monthly: "199.00",
  creditos_disponibles: "50",
  creditos_gastados: "10",
};

function mockApiPorRuta(respuestas: Record<string, unknown>) {
  mockUseApi.mockImplementation((path: string | null) => ({
    data: path ? (respuestas[path] ?? null) : null,
    loading: false,
    error: null,
    recargar: jest.fn(),
  }));
}

beforeEach(() => {
  mockUseUsuario.mockReturnValue({
    usuario: { id: "u", email: "a@b.c", full_name: null, role: "owner", tenant_id: "t" },
    loading: false,
    error: null,
  });
  mockApiPorRuta({
    "/api/pagos/catalogo": CATALOGO,
    "/api/pagos/suscripcion": SUSCRIPCION,
    "/api/pagos/historial": [],
  });
});

describe("Leyenda de IVA en /suscripcion", () => {
  it("avisa, con el porcentaje real, que los precios del catálogo no lo incluyen", () => {
    render(<SuscripcionPage />);

    expect(screen.getByText("precios más IVA (16%)")).toBeInTheDocument();
  });

  it("cada tarjeta de plan repite el aviso junto a su precio", () => {
    render(<SuscripcionPage />);

    expect(screen.getByText("más IVA (16%)")).toBeInTheDocument();
  });

  it("el plan vigente también aclara que su precio es antes de IVA", () => {
    render(<SuscripcionPage />);

    expect(screen.getByText("$199.00 / mes + IVA")).toBeInTheDocument();
  });

  it("usa la tasa que manda el backend, no un 16% fijo", () => {
    mockApiPorRuta({
      "/api/pagos/catalogo": { ...CATALOGO, iva_tasa: "0.08" },
      "/api/pagos/suscripcion": SUSCRIPCION,
      "/api/pagos/historial": [],
    });

    render(<SuscripcionPage />);

    expect(screen.getByText("precios más IVA (8%)")).toBeInTheDocument();
    expect(screen.queryByText(/16%/)).not.toBeInTheDocument();
  });

  it("mientras el catálogo no cargó, no muestra una leyenda a medias", () => {
    mockApiPorRuta({ "/api/pagos/suscripcion": SUSCRIPCION, "/api/pagos/historial": [] });

    render(<SuscripcionPage />);

    expect(screen.queryByText(/más IVA/)).not.toBeInTheDocument();
  });
});
