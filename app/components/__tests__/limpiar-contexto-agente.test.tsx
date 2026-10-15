/**
 * Botón, diálogo e indicador de «Limpiar contexto del agente» (spec 003,
 * RF13-RF15). Se mockea la red (apiFetch).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LimpiarContextoAgente } from "@/app/components/limpiar-contexto-agente";
import { apiFetch } from "@/lib/auth";
import {
  TEXTO_ABRIR_LIMPIAR_CONTEXTO,
  TEXTO_CUERPO_LIMPIAR_CONTEXTO,
  TEXTO_ERROR_LIMPIAR_CONTEXTO,
  TITULO_LIMPIAR_CONTEXTO,
  formatearCorte,
} from "@/lib/contexto-conversacion";

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.Mock;
const CORTE = "2026-10-14T15:30:00Z";

beforeEach(() => mockApiFetch.mockReset());

function montar(props: Partial<React.ComponentProps<typeof LimpiarContextoAgente>> = {}) {
  const onLimpiado = jest.fn();
  render(
    <LimpiarContextoAgente
      conversacionId="c1"
      puedeLimpiar
      limpiadoEn={null}
      onLimpiado={onLimpiado}
      {...props}
    />,
  );
  return { onLimpiado };
}

const botonAbrir = () => screen.queryByRole("button", { name: TEXTO_ABRIR_LIMPIAR_CONTEXTO });

describe("LimpiarContextoAgente", () => {
  it("sin permiso no hay botón, pero el indicador con la fecha sí aparece", () => {
    montar({ puedeLimpiar: false, limpiadoEn: CORTE });
    expect(botonAbrir()).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatearCorte(CORTE)))).toBeInTheDocument();
  });

  it("sin permiso y sin corte no muestra nada", () => {
    montar({ puedeLimpiar: false });
    expect(botonAbrir()).not.toBeInTheDocument();
    expect(screen.queryByText(/contexto limpiado/i)).not.toBeInTheDocument();
  });

  it("con permiso abre el diálogo con título y cuerpo; Cancelar cierra sin llamar a la API", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(botonAbrir()!);
    const dialogo = await screen.findByRole("dialog", { name: TITULO_LIMPIAR_CONTEXTO });
    expect(dialogo).toHaveTextContent(TEXTO_CUERPO_LIMPIAR_CONTEXTO);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("durante la petición el botón de confirmar queda deshabilitado y dice «Limpiando…»", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    montar();
    await user.click(botonAbrir()!);
    await user.click(await screen.findByRole("button", { name: "Limpiar contexto" }));
    const cargando = await screen.findByRole("button", { name: /Limpiando…/ });
    expect(cargando).toBeDisabled();
  });

  it("si falla, el diálogo sigue abierto y muestra el error", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockRejectedValue(new Error(""));
    const { onLimpiado } = montar();
    await user.click(botonAbrir()!);
    await user.click(await screen.findByRole("button", { name: "Limpiar contexto" }));
    expect(await screen.findByText(TEXTO_ERROR_LIMPIAR_CONTEXTO)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onLimpiado).not.toHaveBeenCalled();
  });

  it("si sale bien llama al endpoint, cierra el diálogo y avisa una vez", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({ contexto_limpiado_en: CORTE });
    const { onLimpiado } = montar();
    await user.click(botonAbrir()!);
    await user.click(await screen.findByRole("button", { name: "Limpiar contexto" }));
    await waitFor(() => expect(onLimpiado).toHaveBeenCalledTimes(1));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/conversaciones/c1/limpiar-contexto",
      expect.objectContaining({ method: "POST" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
