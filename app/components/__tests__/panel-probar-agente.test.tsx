/**
 * Panel "Probar agente" de /agente:
 *  - manda el BORRADOR del formulario y la conversación, y muestra la respuesta;
 *  - si falla, devuelve el mensaje al cuadro para reintentar;
 *  - sin cupo (429) o con la configuración incompleta no deja enviar.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PanelProbarAgente } from "@/app/components/panel-probar-agente";
import { ApiError, apiFetch } from "@/lib/auth";
import type { ProbarAgenteOut } from "@/lib/types";

jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return { ...actual, apiFetch: jest.fn() };
});

const mockApiFetch = apiFetch as jest.Mock;

const BORRADOR = {
  agent_name: " Asistente ",
  system_prompt: "Barbería El Corte.",
  model: null,
  temperature: 0.7,
  history_window: 30,
};

function respuesta(sobre: Partial<ProbarAgenteOut> = {}): ProbarAgenteOut {
  return {
    texto: "El corte cuesta 200.",
    modelo: "claude-sonnet-5",
    transferida: false,
    herramientas: [],
    tokens_entrada: 10,
    tokens_salida: 5,
    restantes_hoy: 19,
    ...sobre,
  };
}

function montar(props: Partial<React.ComponentProps<typeof PanelProbarAgente>> = {}) {
  return render(
    <PanelProbarAgente
      abierto
      onCerrar={jest.fn()}
      borrador={BORRADOR}
      numeroId={null}
      sucio={false}
      incompleto={false}
      {...props}
    />,
  );
}

function escribirYEnviar(texto: string) {
  fireEvent.change(screen.getByLabelText("Mensaje de prueba"), { target: { value: texto } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
}

beforeEach(() => mockApiFetch.mockReset());

test("manda el borrador y la conversación, y muestra la respuesta y los mensajes que quedan", async () => {
  mockApiFetch.mockResolvedValue(respuesta({ herramientas: [{ tool_key: "consultar_servicios", parametros: {} }] }));
  montar();

  escribirYEnviar("¿cuánto cuesta el corte?");

  expect(await screen.findByText("El corte cuesta 200.")).toBeInTheDocument();
  const [ruta, opciones] = mockApiFetch.mock.calls[0];
  expect(ruta).toBe("/api/agente/probar");
  expect(opciones.json).toEqual({
    ...BORRADOR,
    agent_name: "Asistente",
    mensajes: [{ role: "user", content: "¿cuánto cuesta el corte?" }],
  });
  expect(screen.getByText(/19 de hoy/)).toBeInTheDocument();
  expect(screen.getByText("Usó 1 herramienta")).toBeInTheDocument();
});

test("un número de WhatsApp viaja como numero_id", async () => {
  mockApiFetch.mockResolvedValue(respuesta());
  montar({ numeroId: "abc-123" });

  escribirYEnviar("hola");

  await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
  expect(mockApiFetch.mock.calls[0][0]).toBe("/api/agente/probar?numero_id=abc-123");
});

test("si falla, el mensaje vuelve al cuadro y se explica el error", async () => {
  mockApiFetch.mockRejectedValue(new ApiError(503, "El agente no está disponible en este momento."));
  montar();

  escribirYEnviar("hola");

  expect(await screen.findByText("El agente no está disponible en este momento.")).toBeInTheDocument();
  expect(screen.getByLabelText("Mensaje de prueba")).toHaveValue("hola");
});

test("al agotar el cupo diario (429) ya no se puede enviar", async () => {
  mockApiFetch.mockRejectedValue(new ApiError(429, "Llegaste al límite de 20 mensajes de prueba de hoy."));
  montar();

  escribirYEnviar("hola");

  expect(await screen.findByText(/Llegaste al límite de 20 mensajes/)).toBeInTheDocument();
  expect(screen.getByLabelText("Mensaje de prueba")).toBeDisabled();
});

test("con la configuración incompleta no deja probar", () => {
  montar({ incompleto: true });

  expect(screen.getByText(/Completa el nombre y las instrucciones/)).toBeInTheDocument();
  expect(screen.getByLabelText("Mensaje de prueba")).toBeDisabled();
});

test("avisa cuando el agente habría transferido la conversación", async () => {
  mockApiFetch.mockResolvedValue(respuesta({ transferida: true }));
  montar();

  escribirYEnviar("quiero hablar con una persona");

  expect(await screen.findByText(/habría pasado esta conversación a una persona/)).toBeInTheDocument();
});
