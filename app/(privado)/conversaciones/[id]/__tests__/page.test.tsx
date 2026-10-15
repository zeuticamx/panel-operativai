/**
 * Criterio 22 (spec 002): mientras el historial de citas carga o falla, se
 * puede leer el hilo y enviar un mensaje. Se mockea la red y los hooks de
 * contexto; el panel y el composer son los reales.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ConversacionDetallePage from "@/app/(privado)/conversaciones/[id]/page";
import { ApiError, apiFetch } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { ConversacionDetalleOut } from "@/lib/types";

jest.mock("next/navigation", () => ({ useParams: () => ({ id: "c1" }) }));
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));
jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));
jest.mock("@/lib/use-conversacion-live", () => ({ useConversacionLive: jest.fn() }));
jest.mock("@/app/components/usuario-context", () => ({
  useUsuario: () => ({
    usuario: { id: "yo", role: "owner", nombre_negocio: "Negocio" },
    loading: false,
    error: null,
  }),
}));
jest.mock("@/app/components/centro-notificaciones", () => ({ CentroNotificaciones: () => null }));
jest.mock("@/app/components/recorrido", () => ({ BotonAyuda: () => null }));
jest.mock("@/app/components/panel-asignacion", () => ({ PanelAsignacion: () => null }));

const mockApiFetch = apiFetch as jest.Mock;
const mockUseApi = useApi as jest.Mock;

const CONVERSACION = {
  id: "c1",
  channel_type: "whatsapp",
  status: "transferred",
  started_at: "2026-03-01T10:00:00",
  usuario_nombre: "Cliente Prueba",
  usuario_handle: "5215500000000",
  usuario_username: null,
  ultimo_mensaje_cliente_at: null,
  minutos_restantes_ventana: 600,
  asignado_a: "yo",
  asignado_nombre: "Yo",
  asignado_rol: "owner",
  asignado_en: null,
  asignado_origen: null,
  asignacion_nota: null,
  mensajes: [
    {
      id: "m1",
      role: "user",
      content: "Hola, quiero ver mis citas",
      created_at: "2026-03-01T10:00:00",
    },
  ],
} as unknown as ConversacionDetalleOut;

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  mockApiFetch.mockReset();
  mockUseApi.mockReset();
  mockUseApi.mockReturnValue({
    data: CONVERSACION,
    loading: false,
    error: null,
    recargar: jest.fn(),
  });
});

function esHistorial(ruta: unknown): boolean {
  return typeof ruta === "string" && ruta.endsWith("/historial-citas");
}

async function escribirYEnviar() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Responder como humano…"), "Hola, te atiendo");
  const enviar = screen.getByRole("button", { name: /enviar/i });
  expect(enviar).toBeEnabled();
  await user.click(enviar);
  await waitFor(() =>
    expect(mockApiFetch).toHaveBeenCalledWith("/api/conversaciones/c1/mensajes", {
      method: "POST",
      json: { texto: "Hola, te atiendo" },
    }),
  );
}

describe("conversación con limpiar contexto (spec 003)", () => {
  it("con permiso, el botón está visible junto al hilo y al composer", () => {
    mockUseApi.mockReturnValue({
      data: { ...CONVERSACION, puede_limpiar_contexto: true, contexto_limpiado_en: null },
      loading: false,
      error: null,
      recargar: jest.fn(),
    });
    mockApiFetch.mockResolvedValue({});
    render(<ConversacionDetallePage />);

    expect(screen.getByRole("button", { name: "Limpiar contexto del agente" })).toBeVisible();
    expect(screen.getByText("Hola, quiero ver mis citas")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Responder como humano…")).toBeInTheDocument();
  });
});

describe("conversación con historial de citas", () => {
  it("con el historial pendiente, el hilo y el composer están y se puede enviar", async () => {
    mockApiFetch.mockImplementation((ruta: string) =>
      esHistorial(ruta) ? new Promise(() => {}) : Promise.resolve({}),
    );
    render(<ConversacionDetallePage />);

    expect(screen.getByText("Historial de citas")).toBeInTheDocument();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.getByText("Hola, quiero ver mis citas")).toBeInTheDocument();
    await escribirYEnviar();
  });

  it("con el historial fallando, aparece Reintentar y el composer sigue operable", async () => {
    mockApiFetch.mockImplementation((ruta: string) =>
      esHistorial(ruta) ? Promise.reject(new ApiError(500, "boom")) : Promise.resolve({}),
    );
    render(<ConversacionDetallePage />);

    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByText("Hola, quiero ver mis citas")).toBeInTheDocument();
    await escribirYEnviar();
  });
});
