/**
 * Editor de la configuración del agente por número (spec 005a, RF-5, RF-18).
 * El member lee la configuración sin ningún botón de edición; la gerencia
 * guarda con PUT parcial a /api/agente/numeros/{id}. Se mockea la red.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EditorAgente } from "@/app/components/editor-agente";
import { ApiError, apiFetch } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { NumeroConfig } from "@/lib/types";

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));
jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));
jest.mock("@/app/components/ui", () => ({
  ...jest.requireActual("@/app/components/ui"),
  // PageHeader arrastra la campana de alertas (socket.io); aquí solo importan sus acciones.
  PageHeader: ({ titulo, sub, acciones }: { titulo: React.ReactNode; sub?: React.ReactNode; acciones?: React.ReactNode }) => (
    <header>
      <h1>{titulo}</h1>
      <div>{sub}</div>
      <div>{acciones}</div>
    </header>
  ),
}));

const mockApiFetch = apiFetch as jest.Mock;
const mockUseApi = useApi as jest.Mock;

function config(extra: Partial<NumeroConfig> = {}): NumeroConfig {
  return {
    id: "n1",
    phone_number_id: "1001",
    estado: "activo",
    es_principal: false,
    es_linea_avisos: false,
    agent_name: "Ana",
    system_prompt: "Eres Ana, asistente de la tienda.",
    model: null,
    temperature: 0.7,
    history_window: 30,
    agente_activo: true,
    configuracion_incompleta: false,
    limites_plan: null,
    herramientas: [],
    ...extra,
  };
}

function conDatos(c: NumeroConfig) {
  mockUseApi.mockImplementation((ruta: string) =>
    ruta === "/api/agente/modelos"
      ? { data: { modelos: [] }, loading: false, error: null, recargar: jest.fn() }
      : { data: c, loading: false, error: null, recargar: jest.fn() },
  );
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockUseApi.mockReset();
});

describe("EditorAgente de un número", () => {
  it("el member ve la configuración sin botones de edición y con los campos bloqueados", () => {
    conDatos(config());
    render(<EditorAgente destino={{ tipo: "numero", id: "n1" }} soloLectura />);
    expect(screen.getByDisplayValue("Ana")).toBeDisabled();
    expect(screen.getByLabelText(/Instrucciones del agente/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Descartar/ })).not.toBeInTheDocument();
    expect(screen.getByText("solo lectura")).toBeInTheDocument();
  });

  it("la gerencia edita y guarda con PUT parcial al número", async () => {
    conDatos(config());
    mockApiFetch.mockResolvedValue(config({ agent_name: "Beto" }));
    render(<EditorAgente destino={{ tipo: "numero", id: "n1" }} />);
    const nombre = screen.getByDisplayValue("Ana");
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Beto");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/agente/numeros/n1",
        expect.objectContaining({
          method: "PUT",
          json: expect.objectContaining({ agent_name: "Beto", agente_activo: true }),
        }),
      ),
    );
    expect(await screen.findByText(/Configuración guardada/)).toBeInTheDocument();
  });

  it("muestra el aviso de configuración incompleta", () => {
    conDatos(config({ system_prompt: "", configuracion_incompleta: true }));
    render(<EditorAgente destino={{ tipo: "numero", id: "n1" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Configuración incompleta");
  });

  it("temperatura fuera de rango: muestra el mensaje del servidor", async () => {
    conDatos(config());
    mockApiFetch.mockRejectedValue(new ApiError(400, "x", null, { codigo: "temperatura_fuera_de_rango" }));
    render(<EditorAgente destino={{ tipo: "numero", id: "n1" }} />);
    const nombre = screen.getByDisplayValue("Ana");
    await userEvent.type(nombre, "x");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("La temperatura debe estar entre 0 y 1.")).toBeInTheDocument();
  });

  it("un número pausado avisa de que no responde pero deja editar", () => {
    conDatos(config({ estado: "pausado" }));
    render(<EditorAgente destino={{ tipo: "numero", id: "n1" }} />);
    expect(screen.getByText(/Este número está pausado/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ana")).toBeEnabled();
  });
});
