/**
 * Panel "Avisos de cita" del Calendario (spec 007, RF-5/RF-6/RF-7).
 * Se mockean la sesión y la red.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AvisosCitaPanel } from "@/app/components/avisos-cita-panel";
import { useUsuario } from "@/app/components/usuario-context";
import { ApiError, apiFetch } from "@/lib/auth";
import type { ConfigAvisos, FuncionAviso } from "@/lib/types";

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));
jest.mock("@/app/components/usuario-context", () => ({ useUsuario: jest.fn() }));

const mockApiFetch = apiFetch as jest.Mock;
const mockUsuario = useUsuario as jest.Mock;

function fn(tipo: "recordatorio" | "cancelacion", extra: Partial<FuncionAviso> = {}): FuncionAviso {
  return {
    tipo,
    nombre: `${tipo}_cita_x`,
    texto: tipo === "recordatorio" ? "Hola {{1}}, te recordamos tu cita." : "Tu cita fue cancelada.",
    activa: false,
    estado_plantilla: "NO_CREADA",
    motivo_rechazo: null,
    ...extra,
  };
}

function config(extra: Partial<ConfigAvisos> = {}, f: Partial<FuncionAviso>[] = []): ConfigAvisos {
  return {
    oferta: "aceptada",
    calendario_activo: true,
    numero_emisor_ok: true,
    mensaje: null,
    funciones: [fn("recordatorio", f[0]), fn("cancelacion", f[1])],
    ...extra,
  };
}

function conRol(role: string, extra: Record<string, unknown> = {}) {
  mockUsuario.mockReturnValue({ usuario: { role, impersonado_por: null, ...extra }, loading: false, error: null });
}

function servir(c: ConfigAvisos) {
  mockApiFetch.mockImplementation(async (ruta: string) => {
    if (ruta === "/api/avisos-cita/config") return c;
    throw new Error(`ruta inesperada ${ruta}`);
  });
}

beforeEach(() => {
  mockApiFetch.mockReset();
  conRol("owner");
});

describe("AvisosCitaPanel", () => {
  it("muestra nombre, texto y estado de cada plantilla", async () => {
    servir(config({}, [{ estado_plantilla: "APPROVED", activa: true }]));
    render(<AvisosCitaPanel />);
    expect(await screen.findByText("recordatorio_cita_x")).toBeInTheDocument();
    expect(screen.getByText(/te recordamos tu cita/)).toBeInTheDocument();
    expect(screen.getByText("Tu cita fue cancelada.")).toBeInTheDocument();
    expect(screen.getByText("Aprobada")).toBeInTheDocument();
    expect(screen.getByText("Sin crear")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /Recordatorio/i })).toBeChecked();
  });

  it("PENDING dice esperando aprobación y no es un error", async () => {
    servir(config({}, [{ estado_plantilla: "PENDING", activa: true }]));
    render(<AvisosCitaPanel />);
    expect(await screen.findByText("Esperando aprobación de Meta")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("REJECTED muestra el motivo", async () => {
    servir(config({}, [{ estado_plantilla: "REJECTED", motivo_rechazo: "Contenido no permitido" }]));
    render(<AvisosCitaPanel />);
    expect(await screen.findByText("Rechazada por Meta")).toBeInTheDocument();
    expect(screen.getByText(/Contenido no permitido/)).toBeInTheDocument();
  });

  it("member ve todo pero los interruptores están deshabilitados", async () => {
    conRol("member");
    servir(config());
    render(<AvisosCitaPanel />);
    await screen.findByText("recordatorio_cita_x");
    for (const s of screen.getAllByRole("switch")) expect(s).toBeDisabled();
  });

  it("vendedor y proveedor no ven el panel ni llaman al endpoint", () => {
    for (const rol of ["vendedor", "proveedor"]) {
      conRol(rol);
      const { container, unmount } = render(<AvisosCitaPanel />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("numero_emisor_ok=false avisa y no deja activar", async () => {
    servir(config({ numero_emisor_ok: false }));
    render(<AvisosCitaPanel />);
    expect(await screen.findByText(/número principal de WhatsApp activo/)).toBeInTheDocument();
    for (const s of screen.getAllByRole("switch")) expect(s).toBeDisabled();
  });

  it("calendario inactivo: modo informativo sin acciones", async () => {
    servir(config({ calendario_activo: false }));
    render(<AvisosCitaPanel />);
    expect(await screen.findByText(/calendario no está activo/i)).toBeInTheDocument();
    for (const s of screen.getAllByRole("switch")) expect(s).toBeDisabled();
  });

  it("el interruptor llama PATCH con el flag correcto y refresca", async () => {
    servir(config());
    render(<AvisosCitaPanel />);
    await userEvent.click(await screen.findByRole("switch", { name: /Cancelación/i }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/avisos-cita/config", {
        method: "PATCH",
        json: { cancelacion_activo: true },
      }),
    );
  });

  it("desactivar manda activo=false", async () => {
    servir(config({}, [{ activa: true, estado_plantilla: "APPROVED" }]));
    render(<AvisosCitaPanel />);
    await userEvent.click(await screen.findByRole("switch", { name: /Recordatorio/i }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/avisos-cita/config", {
        method: "PATCH",
        json: { recordatorio_activo: false },
      }),
    );
  });

  it("un 409 se muestra con su texto", async () => {
    servir(config());
    render(<AvisosCitaPanel />);
    const sw = await screen.findByRole("switch", { name: /Recordatorio/i });
    mockApiFetch.mockImplementation(async () => {
      throw new ApiError(409, "x", null, { codigo: "plantilla_existente_no_utilizable" });
    });
    await userEvent.click(sw);
    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText(/Ya existen plantillas/)).toBeInTheDocument();
  });

  it("oferta rechazada invita a activar; pendiente explica cómo aceptar", async () => {
    servir(config({ oferta: "rechazada" }));
    const { unmount } = render(<AvisosCitaPanel />);
    expect(await screen.findByText(/rechazaste/i)).toBeInTheDocument();
    unmount();
    servir(config({ oferta: "pendiente" }));
    render(<AvisosCitaPanel />);
    expect(await screen.findByText(/todavía no decidiste/i)).toBeInTheDocument();
  });

  it("RF-13: member con oferta pendiente o rechazada no ve textos accionables, sino el neutro", async () => {
    conRol("member");
    for (const oferta of ["pendiente", "rechazada"] as const) {
      servir(config({ oferta }));
      const { unmount } = render(<AvisosCitaPanel />);
      await screen.findByText("recordatorio_cita_x");
      expect(screen.queryByText(/Activa un interruptor/)).not.toBeInTheDocument();
      expect(screen.queryByText(/responde\s+la oferta/)).not.toBeInTheDocument();
      expect(screen.queryByText(/activa uno de los interruptores/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Todavía no decidiste/)).not.toBeInTheDocument();
      expect(screen.queryByText(/rechazaste/)).not.toBeInTheDocument();
      expect(
        screen.getByText("Los avisos de cita todavía no están activados. Quien administra el negocio puede activarlos."),
      ).toBeInTheDocument();
      // No se duplica el mensaje de solo lectura.
      expect(screen.queryByText(/^Solo lectura/)).not.toBeInTheDocument();
      for (const s of screen.getAllByRole("switch")) expect(s).toBeDisabled();
      unmount();
    }
  });

  it("RF-13: member con la oferta aceptada conserva la línea de solo lectura", async () => {
    conRol("member");
    servir(config());
    render(<AvisosCitaPanel />);
    await screen.findByText("recordatorio_cita_x");
    expect(screen.getByText(/^Solo lectura/)).toBeInTheDocument();
    expect(screen.queryByText(/todavía no están activados/)).not.toBeInTheDocument();
  });

  it("RF-13: owner conserva los textos accionables", async () => {
    servir(config({ oferta: "pendiente" }));
    const { unmount } = render(<AvisosCitaPanel />);
    expect(await screen.findByText(/Activa un interruptor/)).toBeInTheDocument();
    expect(screen.getByText(/responde\s+la oferta/)).toBeInTheDocument();
    expect(screen.queryByText(/todavía no están activados/)).not.toBeInTheDocument();
    unmount();
    servir(config({ oferta: "rechazada" }));
    render(<AvisosCitaPanel />);
    expect(await screen.findByText(/activa uno de los interruptores/)).toBeInTheDocument();
  });
});
