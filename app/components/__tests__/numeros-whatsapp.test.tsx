/**
 * Pantalla de números de WhatsApp (spec 005a): qué acciones ve cada rol, la
 * línea de avisos sin pausar ni desvincular, plazas usadas y libres y los
 * mensajes de los errores 402, 404, 409 y 429 al vincular. Se mockea la red.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ListaDeNumeros, NumerosWhatsApp } from "@/app/components/numeros-whatsapp";
import { ApiError, apiFetch } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { ListaNumeros, NumeroWhatsApp } from "@/lib/types";

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));
jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

const mockApiFetch = apiFetch as jest.Mock;
const mockUseApi = useApi as jest.Mock;

function numero(extra: Partial<NumeroWhatsApp> = {}): NumeroWhatsApp {
  return {
    id: "n1",
    phone_number_id: "1001",
    telefono_visible: "+52 55 1111 1111",
    bsp_provider: "neuroapi",
    connection_mode: "standard",
    estado: "activo",
    es_principal: false,
    es_linea_avisos: false,
    vinculado_en: "2026-01-01T00:00:00Z",
    pausado_en: null,
    motivo_pausa: null,
    agent_name: "Ana",
    system_prompt: "Eres Ana.",
    model: null,
    temperature: 0.7,
    history_window: 30,
    agente_activo: true,
    configuracion_incompleta: false,
    herramientas: [],
    ...extra,
  };
}

function lista(numeros: NumeroWhatsApp[], extra: Partial<ListaNumeros> = {}): ListaNumeros {
  return { numeros, tope: 3, plazas_usadas: 2, plazas_libres: 1, coexistencia_permitida: true, ...extra };
}

const LISTA_VARIOS = lista([
  numero({ id: "a", phone_number_id: "1001", telefono_visible: "+52 1", es_principal: true }),
  numero({ id: "b", phone_number_id: "1002", telefono_visible: "+52 2", estado: "pausado" }),
  numero({ id: "av", phone_number_id: "9000", telefono_visible: "+52 9", es_linea_avisos: true }),
]);

function fila(texto: string): HTMLElement {
  const li = screen.getByText(texto).closest("li");
  if (!li) throw new Error(`No hay fila para ${texto}`);
  return li;
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockUseApi.mockReset();
});

describe("ListaDeNumeros", () => {
  it("muestra las plazas usadas y libres", () => {
    render(<ListaDeNumeros lista={LISTA_VARIOS} />);
    expect(screen.getByTestId("plazas")).toHaveTextContent("2 de 3 plazas usadas · 1 libre");
  });

  it("sin tope dice cuántos activos hay", () => {
    render(<ListaDeNumeros lista={lista([numero()], { tope: null, plazas_usadas: 1, plazas_libres: null })} />);
    expect(screen.getByTestId("plazas")).toHaveTextContent("1 número activo · sin tope");
  });

  it("marca principal, pausado y línea de avisos de plataforma", () => {
    render(<ListaDeNumeros lista={LISTA_VARIOS} />);
    expect(within(fila("+52 1")).getByText("principal")).toBeInTheDocument();
    expect(within(fila("+52 2")).getByText("pausado")).toBeInTheDocument();
    expect(within(fila("+52 9")).getByText("línea de avisos de plataforma")).toBeInTheDocument();
  });

  it("la línea de avisos no tiene Pausar ni Desvincular, pero sí Configurar", () => {
    render(<ListaDeNumeros lista={LISTA_VARIOS} />);
    const avisos = within(fila("+52 9"));
    expect(avisos.queryByRole("button", { name: "Pausar" })).not.toBeInTheDocument();
    expect(avisos.queryByRole("button", { name: "Desvincular" })).not.toBeInTheDocument();
    expect(avisos.queryByRole("button", { name: "Hacer principal" })).not.toBeInTheDocument();
    expect(avisos.getByRole("link", { name: /Configurar/ })).toBeInTheDocument();
  });

  it("un número normal ofrece pausar, desvincular y hacer principal; el pausado, reactivar", () => {
    render(
      <ListaDeNumeros
        lista={lista([numero({ id: "a" }), numero({ id: "b", telefono_visible: "+52 2", estado: "pausado" })])}
      />,
    );
    const activo = within(fila("+52 55 1111 1111"));
    expect(activo.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
    expect(activo.getByRole("button", { name: "Desvincular" })).toBeInTheDocument();
    expect(activo.getByRole("button", { name: "Hacer principal" })).toBeInTheDocument();
    expect(within(fila("+52 2")).getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
  });

  it("para el member (solo lectura) no hay ningún botón ni enlace de edición", () => {
    render(<ListaDeNumeros lista={LISTA_VARIOS} soloLectura />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("+52 1")).toBeInTheDocument();
  });

  it("avisa de la configuración incompleta y no deja hacerlo principal", () => {
    render(<ListaDeNumeros lista={lista([numero({ configuracion_incompleta: true, system_prompt: "" })])} />);
    expect(screen.getByText("configuración incompleta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hacer principal" })).not.toBeInTheDocument();
  });

  it("dispara los callbacks con el número de la fila", async () => {
    const onPausar = jest.fn();
    const onReactivar = jest.fn();
    render(<ListaDeNumeros lista={LISTA_VARIOS} onPausar={onPausar} onReactivar={onReactivar} />);
    await userEvent.click(within(fila("+52 1")).getByRole("button", { name: "Pausar" }));
    await userEvent.click(within(fila("+52 2")).getByRole("button", { name: "Reactivar" }));
    expect(onPausar).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    expect(onReactivar).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }));
  });
});

describe("NumerosWhatsApp", () => {
  function conLista(l: ListaNumeros | null) {
    mockUseApi.mockReturnValue({
      data: l,
      loading: false,
      error: null,
      recargar: jest.fn().mockResolvedValue(undefined),
    });
  }

  it("el member no ve los botones de conectar ni las acciones", () => {
    conLista(LISTA_VARIOS);
    render(<NumerosWhatsApp soloLectura />);
    expect(screen.queryByRole("button", { name: /Conectar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pausar" })).not.toBeInTheDocument();
    expect(screen.getByTestId("plazas")).toBeInTheDocument();
  });

  it("la gerencia ve Conectar WhatsApp y Conectar manualmente", () => {
    conLista(LISTA_VARIOS);
    render(<NumerosWhatsApp />);
    expect(screen.getByRole("button", { name: /Conectar WhatsApp/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar manualmente" })).toBeInTheDocument();
  });

  async function vincularConError(error: ApiError) {
    conLista(LISTA_VARIOS);
    mockApiFetch.mockRejectedValue(error);
    render(<NumerosWhatsApp />);
    await userEvent.click(screen.getByRole("button", { name: "Conectar manualmente" }));
    await userEvent.type(screen.getByLabelText("Id de línea"), "5555");
    await userEvent.click(screen.getByRole("button", { name: "Vincular" }));
    return screen.findByRole("alert");
  }

  it("402: cupo lleno", async () => {
    const alerta = await vincularConError(new ApiError(402, "x", null, { codigo: "cupo_numeros_whatsapp" }));
    expect(alerta).toHaveTextContent("no tiene plazas libres");
  });

  it("404: número no encontrado", async () => {
    const alerta = await vincularConError(new ApiError(404, "x", null, { codigo: "numero_no_encontrado" }));
    expect(alerta).toHaveTextContent("Número no encontrado.");
  });

  it("409: ya vinculado", async () => {
    const alerta = await vincularConError(new ApiError(409, "x", null, { codigo: "numero_ya_vinculado" }));
    expect(alerta).toHaveTextContent("ya está vinculado a tu negocio");
  });

  it("429: demasiados intentos", async () => {
    const alerta = await vincularConError(
      new ApiError(429, "x", null, { codigo: "demasiados_intentos", libera_en: "2026-03-10T18:45:00Z" }),
    );
    expect(alerta).toHaveTextContent("Demasiados intentos de vincular números");
  });

  it("al vincular bien llama al endpoint con el id y recarga la lista", async () => {
    const recargar = jest.fn().mockResolvedValue(undefined);
    mockUseApi.mockReturnValue({ data: LISTA_VARIOS, loading: false, error: null, recargar });
    mockApiFetch.mockResolvedValue(numero({ id: "nuevo" }));
    render(<NumerosWhatsApp />);
    await userEvent.click(screen.getByRole("button", { name: "Conectar manualmente" }));
    await userEvent.type(screen.getByLabelText("Id de línea"), "5555");
    await userEvent.click(screen.getByRole("button", { name: "Vincular" }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/canales/whatsapp/conectar", {
        method: "POST",
        json: { phone_number_id: "5555" },
      }),
    );
    await waitFor(() => expect(recargar).toHaveBeenCalled());
  });

  it("pausar el último activo advierte que el negocio no responderá", async () => {
    conLista(lista([numero({ id: "a", telefono_visible: "+52 1" })], { plazas_usadas: 1, plazas_libres: 2 }));
    render(<NumerosWhatsApp />);
    await userEvent.click(screen.getByRole("button", { name: "Pausar" }));
    expect(await screen.findByText(/no responderá por WhatsApp mientras no tenga un número/)).toBeInTheDocument();
  });

  it("pausar con otro activo no muestra esa advertencia", async () => {
    conLista(lista([numero({ id: "a", telefono_visible: "+52 1" }), numero({ id: "b", telefono_visible: "+52 2" })]));
    render(<NumerosWhatsApp />);
    await userEvent.click(within(fila("+52 1")).getByRole("button", { name: "Pausar" }));
    await screen.findByText(/Deja de responder y libera una plaza/);
    expect(screen.queryByText(/mientras no tenga un número/)).not.toBeInTheDocument();
  });
});
