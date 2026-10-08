/**
 * Asignación de conversaciones en el portal: quién la tiene, quién puede
 * contestar y qué botones se ofrecen según el rol. El backend vuelve a
 * decidir cada acción; acá se prueba que la pantalla no ofrezca lo que va a
 * recibir 403. Se mockea la red (apiFetch / useApi).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MensajeComposer } from "@/app/components/mensaje-composer";
import { PanelAsignacion } from "@/app/components/panel-asignacion";
import { apiFetch } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { AsignacionConversacion } from "@/lib/types";

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));
jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));

const mockApiFetch = apiFetch as jest.Mock;
const mockUseApi = useApi as jest.Mock;

const SIN_ASIGNAR: AsignacionConversacion = {
  asignado_a: null,
  asignado_nombre: null,
  asignado_rol: null,
  asignado_en: null,
  asignado_origen: null,
  asignacion_nota: null,
};
const DE_ANA: AsignacionConversacion = {
  ...SIN_ASIGNAR,
  asignado_a: "ana",
  asignado_nombre: "Ana López",
  asignado_rol: "vendedor",
  asignado_origen: "agente",
};

beforeEach(() => {
  mockApiFetch.mockReset();
  mockUseApi.mockReset();
  mockUseApi.mockReturnValue({
    data: [
      { id: "ana", nombre: "Ana López", email: "ana@x.com", role: "vendedor" },
      { id: "beto", nombre: "Beto Ruiz", email: "beto@x.com", role: "proveedor" },
    ],
    loading: false,
    error: null,
    recargar: jest.fn(),
  });
});

function panel(props: Partial<React.ComponentProps<typeof PanelAsignacion>> = {}) {
  const onCambio = jest.fn();
  render(
    <PanelAsignacion
      conversacionId="c1"
      asignacion={SIN_ASIGNAR}
      status="transferred"
      esGerencia={false}
      miId="yo"
      onCambio={onCambio}
      {...props}
    />,
  );
  return { onCambio };
}

describe("PanelAsignacion", () => {
  it("el dueño asigna a una persona del equipo", async () => {
    mockApiFetch.mockResolvedValue({});
    const { onCambio } = panel({ esGerencia: true });

    expect(screen.getByText("Sin asignar")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Asignar a"), "beto");
    await userEvent.click(screen.getByRole("button", { name: "Asignar" }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/conversaciones/c1/asignacion", {
        method: "PUT",
        json: { asignado_a: "beto" },
      }),
    );
    expect(onCambio).toHaveBeenCalled();
  });

  it("el dueño ve quién la tiene, puede reasignarla o quitarla, y lee la nota del agente", async () => {
    mockApiFetch.mockResolvedValue({});
    panel({
      esGerencia: true,
      asignacion: { ...DE_ANA, asignacion_nota: "No se pudo asignar automáticamente: sin vendedor." },
    });

    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(screen.getByText("por el agente")).toBeInTheDocument();
    expect(screen.getByText(/No se pudo asignar automáticamente/)).toBeInTheDocument();
    // La persona que ya la tiene no se ofrece como destino.
    expect(screen.queryByRole("option", { name: /Ana López/ })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /Quitar/ }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/conversaciones/c1/asignacion", {
        method: "DELETE",
        json: undefined,
      }),
    );
  });

  it("un colaborador solo ve quién la tiene: ni asigna ni quita ni ve la nota", () => {
    panel({ asignacion: { ...DE_ANA, asignacion_nota: "nota interna" } });

    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(screen.queryByLabelText("Asignar a")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("nota interna")).toBeNull();
  });

  it("quien la tiene puede soltarla", async () => {
    mockApiFetch.mockResolvedValue({});
    panel({ asignacion: { ...DE_ANA, asignado_a: "yo" }, miId: "yo" });

    expect(screen.getByText("ti")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Soltar/ }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/conversaciones/c1/asignacion", expect.objectContaining({ method: "DELETE" })));
  });

  it("no pide la lista de asignables a quien no es gerencia", () => {
    panel({ asignacion: DE_ANA });
    expect(mockUseApi).toHaveBeenCalledWith(null);
  });

  it("con la IA al frente y sin dueño, no muestra nada a quien no puede asignar", () => {
    panel({ status: "active" });
    expect(screen.queryByText("Sin asignar")).toBeNull();
  });
});

describe("MensajeComposer con asignación", () => {
  function composer(asignacion: React.ComponentProps<typeof MensajeComposer>["asignacion"]) {
    const onCambio = jest.fn();
    render(
      <MensajeComposer
        status="transferred"
        enviarUrl="/api/c/1/mensajes"
        tomarUrl="/api/c/1/tomar"
        volverIaUrl="/api/c/1/volver-a-ia"
        asignacion={asignacion}
        onCambio={onCambio}
      />,
    );
    return { onCambio };
  }

  it("si la tiene otra persona, el colaborador no puede contestar ni devolverla a la IA", () => {
    composer({ asignadoA: "ana", asignadoNombre: "Ana López", miId: "yo", esGerencia: false });

    expect(screen.getByText(/La conversación la tiene Ana López/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Responder como humano/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Volver a IA/ })).toBeNull();
  });

  it("el dueño sí puede contestar aunque la tenga otra persona", () => {
    composer({ asignadoA: "ana", asignadoNombre: "Ana López", miId: "yo", esGerencia: true });

    expect(screen.getByPlaceholderText(/Responder como humano/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tomar conversación/ })).toBeNull();
  });

  it("si nadie la tiene, ofrece tomarla", async () => {
    mockApiFetch.mockResolvedValue({});
    const { onCambio } = composer({ asignadoA: null, asignadoNombre: null, miId: "yo", esGerencia: false });

    await userEvent.click(screen.getByRole("button", { name: /Tomar conversación/ }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith("/api/c/1/tomar", { method: "POST" }));
    expect(onCambio).toHaveBeenCalled();
  });

  it("si ya es mía, contesta y no vuelve a ofrecer tomarla", () => {
    composer({ asignadoA: "yo", asignadoNombre: "Yo", miId: "yo", esGerencia: false });

    expect(screen.getByPlaceholderText(/Responder como humano/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tomar conversación/ })).toBeNull();
  });
});
