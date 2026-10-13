/**
 * /agente con los límites del plan (limites_plan de GET /api/agente):
 *  - un modelo que el plan no incluye sale deshabilitado;
 *  - con modelos limitados no hay "Predeterminado del sistema";
 *  - el tope de mensajes de contexto sale del plan, y pasarse bloquea Guardar.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import AgentePage from "@/app/(privado)/agente/page";
import type { AgenteConfig, ModelosOut } from "@/lib/types";
import { useApi } from "@/lib/use-api";

jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));
jest.mock("@/app/components/centro-notificaciones", () => ({ CentroNotificaciones: () => null }));

const mockUseApi = useApi as jest.Mock;

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-5";
const OPUS = "claude-opus-5";

const MODELOS: ModelosOut = { modelos: [HAIKU, OPUS, SONNET] };

function config(sobre: Partial<AgenteConfig> = {}): AgenteConfig {
  return {
    agent_name: "Asistente",
    system_prompt: "Eres un asistente de pruebas del negocio.",
    model: HAIKU,
    temperature: 0.7,
    history_window: 30,
    is_active: true,
    limites_plan: {
      plan: "starter",
      modelos_permitidos: [HAIKU],
      modelo_por_defecto: HAIKU,
      historial_maximo: 50,
    },
    ...sobre,
  };
}

function montar(cfg: AgenteConfig) {
  mockUseApi.mockImplementation((path: string | null) => ({
    data: path === "/api/agente" ? cfg : path === "/api/agente/modelos" ? MODELOS : null,
    loading: false,
    error: null,
    recargar: jest.fn(),
  }));
  render(<AgentePage />);
}

describe("Límites del plan en /agente", () => {
  it("deshabilita los modelos que el plan no incluye", () => {
    montar(config());

    const opus = screen.getByRole("option", { name: /claude-opus-5/ });
    expect(opus).toBeDisabled();
    expect(opus).toHaveTextContent("requiere otro plan");
    expect(screen.getByRole("option", { name: HAIKU })).toBeEnabled();
  });

  it("con modelos limitados no ofrece el predeterminado del sistema", () => {
    montar(config());

    expect(screen.queryByRole("option", { name: /Predeterminado del sistema/ })).toBeNull();
  });

  it("un plan sin límites ofrece todo y el predeterminado", () => {
    montar(
      config({
        limites_plan: {
          plan: "enterprise",
          modelos_permitidos: [HAIKU, OPUS, SONNET],
          modelo_por_defecto: null,
          historial_maximo: 200,
        },
      }),
    );

    expect(screen.getByRole("option", { name: /Predeterminado del sistema/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: OPUS })).toBeEnabled();
  });

  it("el tope de mensajes de contexto es el del plan y pasarse bloquea Guardar", () => {
    montar(config());

    const campo = screen.getByLabelText(/Mensajes de contexto/);
    expect(campo).toHaveAttribute("max", "50");

    fireEvent.change(campo, { target: { value: "51" } });

    expect(screen.getByText(/Tu plan permite hasta 50 mensajes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar/ })).toBeDisabled();
  });

  it("dentro del tope, Guardar queda habilitado", () => {
    montar(config());

    fireEvent.change(screen.getByLabelText(/Mensajes de contexto/), { target: { value: "50" } });

    expect(screen.getByRole("button", { name: /Guardar/ })).toBeEnabled();
  });
});
