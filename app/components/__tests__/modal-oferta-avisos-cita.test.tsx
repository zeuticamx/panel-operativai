/**
 * Modal de oferta de avisos de cita (spec 007, RF-1 / RF-4). Se mockean la
 * sesión (usuario-context) y la red (apiFetch).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ModalOfertaAvisosCita } from "@/app/components/modal-oferta-avisos-cita";
import { useUsuario } from "@/app/components/usuario-context";
import { ApiError, apiFetch } from "@/lib/auth";
import { CLAVE_OFERTA_AVISOS_MOSTRADA } from "@/lib/avisos-cita";
import { leerOfertaAvisosAbierta } from "@/lib/oferta-avisos-estado";
import type { ConfigAvisos } from "@/lib/types";

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));
jest.mock("@/app/components/usuario-context", () => ({ useUsuario: jest.fn() }));

const mockApiFetch = apiFetch as jest.Mock;
const mockUsuario = useUsuario as jest.Mock;

const CONFIG: ConfigAvisos = {
  oferta: "pendiente",
  calendario_activo: true,
  numero_emisor_ok: true,
  mensaje: null,
  funciones: [
    {
      tipo: "recordatorio",
      nombre: "recordatorio_cita_x",
      texto: "Hola {{1}}, te recordamos tu cita.",
      activa: false,
      estado_plantilla: "NO_CREADA",
      motivo_rechazo: null,
    },
    {
      tipo: "cancelacion",
      nombre: "cancelacion_cita_x",
      texto: "Tu cita fue cancelada.",
      activa: false,
      estado_plantilla: "NO_CREADA",
      motivo_rechazo: null,
    },
  ],
};

function conUsuario(extra: Record<string, unknown> = {}) {
  mockUsuario.mockReturnValue({
    usuario: { role: "owner", oferta_avisos_cita_pendiente: true, impersonado_por: null, ...extra },
    loading: false,
    error: null,
  });
}

function responderConfig() {
  mockApiFetch.mockImplementation(async (ruta: string) => {
    if (ruta === "/api/avisos-cita/config") return CONFIG;
    if (ruta === "/api/avisos-cita/oferta") return { ...CONFIG, oferta: "aceptada" };
    throw new Error(`ruta inesperada ${ruta}`);
  });
}

beforeEach(() => {
  mockApiFetch.mockReset();
  sessionStorage.clear();
});

describe("ModalOfertaAvisosCita", () => {
  it("no dibuja nada si no hay oferta pendiente", () => {
    conUsuario({ oferta_avisos_cita_pendiente: false });
    render(<ModalOfertaAvisosCita />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("no se abre en sesión impersonada ni para un member", () => {
    conUsuario({ impersonado_por: "soporte@x" });
    const { unmount } = render(<ModalOfertaAvisosCita />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
    conUsuario({ role: "member" });
    render(<ModalOfertaAvisosCita />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("se abre con las 2 plantillas tal cual vienen del backend y se marca como mostrado", async () => {
    conUsuario();
    responderConfig();
    render(<ModalOfertaAvisosCita />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText(CONFIG.funciones[0].texto)).toBeInTheDocument();
    expect(screen.getByText(CONFIG.funciones[1].texto)).toBeInTheDocument();
    expect(screen.getByText(CONFIG.funciones[0].nombre)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear plantillas" })).toBeEnabled();
    expect(sessionStorage.getItem(CLAVE_OFERTA_AVISOS_MOSTRADA)).toBe("1");
  });

  it("no se vuelve a abrir en la misma pestaña", () => {
    conUsuario();
    sessionStorage.setItem(CLAVE_OFERTA_AVISOS_MOSTRADA, "1");
    render(<ModalOfertaAvisosCita />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("aceptar manda la acción, confirma y se cierra con Entendido", async () => {
    conUsuario();
    responderConfig();
    const user = userEvent.setup();
    render(<ModalOfertaAvisosCita />);
    await screen.findByText(CONFIG.funciones[0].texto);
    await user.click(screen.getByRole("button", { name: "Crear plantillas" }));
    expect(mockApiFetch).toHaveBeenCalledWith("/api/avisos-cita/oferta", {
      method: "POST",
      json: { accion: "aceptar" },
    });
    await user.click(await screen.findByRole("button", { name: "Entendido" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rechazar muestra el mensaje de confirmación del backend", async () => {
    conUsuario();
    mockApiFetch.mockImplementation(async (ruta: string, op?: { json?: { accion: string } }) =>
      op?.json?.accion === "rechazar" ? { ...CONFIG, oferta: "rechazada", mensaje: "Quedaron desactivadas." } : CONFIG,
    );
    const user = userEvent.setup();
    render(<ModalOfertaAvisosCita />);
    await user.click(await screen.findByRole("button", { name: "No por ahora" }));
    expect(await screen.findByText("Quedaron desactivadas.")).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/avisos-cita/oferta", {
      method: "POST",
      json: { accion: "rechazar" },
    });
  });

  it("un 409 sin_numero_emisor se muestra y deja reintentar", async () => {
    conUsuario();
    mockApiFetch.mockImplementation(async (ruta: string) => {
      if (ruta === "/api/avisos-cita/config") return CONFIG;
      throw new ApiError(409, "x", null, { codigo: "sin_numero_emisor" });
    });
    const user = userEvent.setup();
    render(<ModalOfertaAvisosCita />);
    await screen.findByText(CONFIG.funciones[0].texto);
    await user.click(screen.getByRole("button", { name: "Crear plantillas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/número principal de WhatsApp activo/);
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear plantillas" })).toBeEnabled());
  });

  it("un 502 muestra el error del proveedor", async () => {
    conUsuario();
    mockApiFetch.mockImplementation(async (ruta: string) => {
      if (ruta === "/api/avisos-cita/config") return CONFIG;
      throw new ApiError(502, "bad gateway");
    });
    const user = userEvent.setup();
    render(<ModalOfertaAvisosCita />);
    await screen.findByText(CONFIG.funciones[0].texto);
    await user.click(screen.getByRole("button", { name: "Crear plantillas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/proveedor/);
  });

  it("deshabilita los botones mientras se envía", async () => {
    conUsuario();
    let resolver: (v: ConfigAvisos) => void = () => {};
    mockApiFetch.mockImplementation((ruta: string) =>
      ruta === "/api/avisos-cita/config" ? Promise.resolve(CONFIG) : new Promise((r) => (resolver = r)),
    );
    const user = userEvent.setup();
    render(<ModalOfertaAvisosCita />);
    await screen.findByText(CONFIG.funciones[0].texto);
    await user.click(screen.getByRole("button", { name: "Crear plantillas" }));
    expect(screen.getByRole("button", { name: "No por ahora" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Crear plantillas/ })).toBeDisabled();
    resolver({ ...CONFIG, oferta: "aceptada" });
    await screen.findByRole("button", { name: "Entendido" });
  });

  it("Escape no cierra el modal: rechazar es una decisión que se guarda", async () => {
    conUsuario();
    responderConfig();
    const user = userEvent.setup();
    render(<ModalOfertaAvisosCita />);
    await screen.findByText(CONFIG.funciones[0].texto);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("RF-12: publica «abierto» al abrir y «cerrado» con Entendido", async () => {
    conUsuario();
    responderConfig();
    const user = userEvent.setup();
    expect(leerOfertaAvisosAbierta()).toBe(false);
    render(<ModalOfertaAvisosCita />);
    await screen.findByText(CONFIG.funciones[0].texto);
    expect(leerOfertaAvisosAbierta()).toBe(true);
    await user.click(screen.getByRole("button", { name: "Crear plantillas" }));
    await user.click(await screen.findByRole("button", { name: "Entendido" }));
    expect(leerOfertaAvisosAbierta()).toBe(false);
  });

  it("RF-12: publica «cerrado» con No por ahora + Entendido", async () => {
    conUsuario();
    mockApiFetch.mockImplementation(async (ruta: string, op?: { json?: { accion: string } }) =>
      op?.json?.accion === "rechazar" ? { ...CONFIG, oferta: "rechazada", mensaje: "Quedaron desactivadas." } : CONFIG,
    );
    const user = userEvent.setup();
    render(<ModalOfertaAvisosCita />);
    await user.click(await screen.findByRole("button", { name: "No por ahora" }));
    expect(leerOfertaAvisosAbierta()).toBe(true); // aún no se cierra: falta «Entendido»
    await user.click(await screen.findByRole("button", { name: "Entendido" }));
    expect(leerOfertaAvisosAbierta()).toBe(false);
  });

  it("RF-12: desmontar con el modal abierto también publica «cerrado»", async () => {
    conUsuario();
    responderConfig();
    const { unmount } = render(<ModalOfertaAvisosCita />);
    await screen.findByText(CONFIG.funciones[0].texto);
    expect(leerOfertaAvisosAbierta()).toBe(true);
    unmount();
    expect(leerOfertaAvisosAbierta()).toBe(false);
  });
});
