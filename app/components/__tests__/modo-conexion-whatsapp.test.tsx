/**
 * Selector de modo de conexión de WhatsApp: exclusivo API (estándar) o
 * coexistencia con la app de WhatsApp Business. La coexistencia depende del plan.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ModoConexionDialog } from "@/app/components/modo-conexion-whatsapp";

function abrir(coexistenciaPermitida: boolean) {
  const onConfirm = jest.fn();
  render(
    <ModoConexionDialog
      open
      onOpenChange={jest.fn()}
      coexistenciaPermitida={coexistenciaPermitida}
      onConfirm={onConfirm}
    />,
  );
  return onConfirm;
}

describe("ModoConexionDialog", () => {
  it("parte en modo exclusivo API y confirma ese modo", async () => {
    const onConfirm = abrir(true);
    expect(screen.getByRole("radio", { name: /modo exclusivo api/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /modo coexistencia/i })).not.toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: /continuar con meta/i }));
    expect(onConfirm).toHaveBeenCalledWith("standard");
  });

  it("permite elegir coexistencia cuando el plan la incluye", async () => {
    const onConfirm = abrir(true);
    await userEvent.click(screen.getByRole("radio", { name: /modo coexistencia/i }));
    await userEvent.click(screen.getByRole("button", { name: /continuar con meta/i }));
    expect(onConfirm).toHaveBeenCalledWith("coexistence");
  });

  it("bloquea la coexistencia y lo explica cuando el plan no la incluye", async () => {
    const onConfirm = abrir(false);
    const coexistencia = screen.getByRole("radio", { name: /modo coexistencia/i });
    expect(coexistencia).toBeDisabled();
    expect(screen.getByText(/tu plan no incluye el modo coexistencia/i)).toBeInTheDocument();

    await userEvent.click(coexistencia);
    await userEvent.click(screen.getByRole("button", { name: /continuar con meta/i }));
    expect(onConfirm).toHaveBeenCalledWith("standard");
  });
});
