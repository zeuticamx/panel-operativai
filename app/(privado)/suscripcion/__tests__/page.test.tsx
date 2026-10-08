/**
 * Tests de /suscripcion:
 *  - las leyendas: los precios son netos (sin IVA sumado en pantalla ni al
 *    cobrar) y los créditos se explican en la página;
 *  - los botones de plan con una suscripción recurrente de Stripe viva, que
 *    el backend no deja volver a contratar (409).
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
};

const SUSCRIPCION: SuscripcionOut = {
  plan: "starter",
  estado_suscripcion: "activa",
  fecha_renovacion: "2026-11-01T00:00:00Z",
  precio_monthly: "199.00",
  creditos_disponibles: "50",
  creditos_gastados: "10",
  suscripcion_recurrente: false,
  cancela_al_vencer: false,
  portal_disponible: false,
};

const PLAN_PRO: PlanOut = { ...PLAN_STARTER, nombre: "pro", precio_monthly: "499.00" };

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

describe("Leyendas en /suscripcion", () => {
  it("cada tarjeta de plan y de créditos avisa que los precios son netos", () => {
    render(<SuscripcionPage />);

    // 1 tarjeta de plan + 1 paquete de créditos.
    expect(screen.getAllByText("Los precios son Netos")).toHaveLength(2);
  });

  it("explica qué es un crédito", () => {
    render(<SuscripcionPage />);

    expect(
      screen.getAllByText("Créditos: se utilizan al ejecutar herramientas y funciones del agente de IA.").length,
    ).toBeGreaterThan(0);
  });

  it("ya no menciona IVA", () => {
    render(<SuscripcionPage />);

    expect(screen.queryByText(/IVA/)).not.toBeInTheDocument();
    expect(screen.getByText("$199.00 / mes")).toBeInTheDocument();
  });
});

describe("Botones de plan con suscripción recurrente", () => {
  function conSuscripcion(extra: Partial<SuscripcionOut>) {
    mockApiPorRuta({
      "/api/pagos/catalogo": { ...CATALOGO, planes: [PLAN_STARTER, PLAN_PRO] },
      "/api/pagos/suscripcion": { ...SUSCRIPCION, ...extra },
      "/api/pagos/historial": [],
    });
  }

  it("sin suscripción recurrente se puede renovar a mano y contratar otro plan", () => {
    conSuscripcion({});
    render(<SuscripcionPage />);

    expect(screen.getByRole("button", { name: /Renovar ahora/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Contratar ahora/ })).toBeEnabled();
  });

  it("con renovación automática el plan actual no se renueva a mano y los demás no se contratan", () => {
    conSuscripcion({ suscripcion_recurrente: true });
    render(<SuscripcionPage />);

    expect(screen.getByRole("button", { name: "Se renueva automáticamente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Contratar ahora/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Renovar ahora/ })).not.toBeInTheDocument();
    expect(screen.getByText(/se cobra sola el/)).toBeInTheDocument();
  });

  it("con la cancelación programada lo dice en el botón y en el estado", () => {
    conSuscripcion({ suscripcion_recurrente: true, cancela_al_vencer: true });
    render(<SuscripcionPage />);

    expect(screen.getByRole("button", { name: "Cancelación programada" })).toBeDisabled();
    expect(screen.getByText(/cancelada · vigente hasta/)).toBeInTheDocument();
  });
});
