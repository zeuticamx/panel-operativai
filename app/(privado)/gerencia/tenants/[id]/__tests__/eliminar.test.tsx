/**
 * Ficha de un negocio en gerencia: el botón de eliminar solo se habilita
 * cuando el backend dice `eliminable`, muestra por qué no, y el borrado
 * pide escribir el nombre exacto antes de llamar a la API.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DetalleTenantPage from "@/app/(privado)/gerencia/tenants/[id]/page";
import { ApiError, apiFetch } from "@/lib/auth";
import type { EliminacionTenantOut, TenantGerenciaOut } from "@/lib/types";
import { useApi } from "@/lib/use-api";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
  usePathname: () => "/gerencia/tenants/t-1",
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));

const mockUseApi = useApi as jest.Mock;
const mockApiFetch = apiFetch as jest.Mock;

const NOMBRE = "Ferretería Juárez";

const TENANT: TenantGerenciaOut = {
  tenant_id: "t-1",
  nombre: NOMBRE,
  email: "dueno@ferreteria.com",
  alta: "2026-01-10T00:00:00Z",
  estado: "baja",
  estado_motivo: "cierre a pedido del cliente",
  estado_actualizado_en: null,
  estado_actualizado_por: null,
  agente_ia_activo: true,
  gestion_vendedores_activo: false,
  calendario_activo: false,
  agente_operando: false,
  plan: null,
  estado_suscripcion: null,
  origen_suscripcion: null,
  fecha_renovacion: null,
  precio_monthly: null,
  creditos_disponibles: "0",
  creditos_gastados: "0",
  usuarios_portal: 2,
  vendedores_activos: 0,
  canales_activos: 0,
  ultimo_mensaje: null,
  consumo: { tokens_entrada: 0, tokens_salida: 0, tokens_total: 0, costo_usd: "0", llamadas: 0 },
  ingreso_periodo: "0",
  costo_moneda: null,
  margen: null,
  tipo_cambio_fuente: "ninguno",
};

const ELIMINABLE: EliminacionTenantOut = {
  eliminable: true,
  bloqueos: [],
  creditos_disponibles: "0",
  usuarios_portal: 2,
  conversaciones: 37,
  transacciones: 4,
};

function conRevision(revision: EliminacionTenantOut, tenant: TenantGerenciaOut = TENANT) {
  mockUseApi.mockImplementation((ruta: string) => {
    const data = ruta.endsWith("/eliminacion")
      ? revision
      : ruta.startsWith("/api/gerencia/tenants/t-1?")
        ? tenant
        : [];
    return { data, loading: false, error: null, recargar: jest.fn(async () => {}) };
  });
}

function botonEliminar(): HTMLElement {
  const zona = screen.getByRole("region", { name: "Eliminar negocio" });
  return within(zona).getByRole("button", { name: /Eliminar negocio/ });
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

it("con el negocio activo el botón está deshabilitado y pide darlo de baja primero", () => {
  conRevision(
    {
      ...ELIMINABLE,
      eliminable: false,
      bloqueos: [
        {
          codigo: "cuenta_activa",
          mensaje: "Primero hay que dar de baja el negocio (estado 'Baja').",
        },
      ],
    },
    { ...TENANT, estado: "activo" },
  );
  render(<DetalleTenantPage />);

  expect(botonEliminar()).toBeDisabled();
  expect(screen.getByText(/Primero hay que dar de baja el negocio/)).toBeInTheDocument();
});

it("con suscripción vigente el botón está deshabilitado aunque esté en baja", () => {
  conRevision({
    ...ELIMINABLE,
    eliminable: false,
    bloqueos: [
      {
        codigo: "suscripcion_vigente",
        mensaje: "Tiene una suscripción vigente hasta el 12/10/2026.",
      },
    ],
  });
  render(<DetalleTenantPage />);

  expect(botonEliminar()).toBeDisabled();
  expect(screen.getByText(/suscripción vigente hasta el 12\/10\/2026/)).toBeInTheDocument();
});

it("mientras no llega la revisión, el botón no se habilita", () => {
  mockUseApi.mockImplementation((ruta: string) => ({
    data: ruta.endsWith("/eliminacion") ? null : ruta.includes("?dias=") ? TENANT : [],
    loading: ruta.endsWith("/eliminacion"),
    error: null,
    recargar: jest.fn(),
  }));
  render(<DetalleTenantPage />);

  expect(botonEliminar()).toBeDisabled();
});

it("la confirmación exige el nombre exacto y advierte los créditos sin usar", async () => {
  conRevision({ ...ELIMINABLE, creditos_disponibles: "40" });
  const user = userEvent.setup();
  render(<DetalleTenantPage />);

  await user.click(botonEliminar());
  const dialogo = await screen.findByRole("dialog");

  expect(within(dialogo).getByText(/37 conversaciones/)).toBeInTheDocument();
  expect(within(dialogo).getByText(/créditos sin usar que se pierden/)).toBeInTheDocument();

  const confirmar = within(dialogo).getByRole("button", { name: "Eliminar definitivamente" });
  expect(confirmar).toBeDisabled();

  await user.type(within(dialogo).getByLabelText(/Escribe/), "Ferreteria Juarez");
  expect(confirmar).toBeDisabled();
  expect(mockApiFetch).not.toHaveBeenCalled();
});

it("confirmado, llama al endpoint y muestra que se eliminó", async () => {
  conRevision(ELIMINABLE);
  mockApiFetch.mockResolvedValue(null);
  const user = userEvent.setup();
  render(<DetalleTenantPage />);

  await user.click(botonEliminar());
  const dialogo = await screen.findByRole("dialog");
  await user.type(within(dialogo).getByLabelText(/Escribe/), NOMBRE);
  await user.click(within(dialogo).getByRole("button", { name: "Eliminar definitivamente" }));

  await waitFor(() =>
    expect(mockApiFetch).toHaveBeenCalledWith("/api/gerencia/tenants/t-1/eliminar", {
      method: "POST",
      json: { confirmacion: NOMBRE },
    }),
  );
  expect(await screen.findByText(/se eliminó definitivamente/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Volver a negocios/ })).toHaveAttribute(
    "href",
    "/gerencia/tenants",
  );
});

it("si el backend lo bloquea (409), muestra su mensaje y no da por eliminado", async () => {
  conRevision(ELIMINABLE);
  mockApiFetch.mockRejectedValue(
    new ApiError(409, "Tiene una suscripción vigente. Hay que esperar a que termine."),
  );
  const user = userEvent.setup();
  render(<DetalleTenantPage />);

  await user.click(botonEliminar());
  const dialogo = await screen.findByRole("dialog");
  await user.type(within(dialogo).getByLabelText(/Escribe/), NOMBRE);
  await user.click(within(dialogo).getByRole("button", { name: "Eliminar definitivamente" }));

  expect(await within(dialogo).findByText(/Tiene una suscripción vigente/)).toBeInTheDocument();
  expect(screen.queryByText(/se eliminó definitivamente/)).not.toBeInTheDocument();
});
