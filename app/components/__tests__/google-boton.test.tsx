/**
 * GoogleBoton: Google solo admite una configuración por página, así que
 * `initialize()` se llama una vez aunque el botón se monte varias veces
 * (volver a /login, StrictMode), y el callback llega siempre al botón que
 * esté montado ahora.
 *
 * Es un solo test secuencial a propósito: lo que se prueba es el estado a
 * nivel de módulo (`inicializado`), que persiste entre montajes igual que
 * en el navegador. Partirlo en varios tests haría depender cada uno del
 * orden, y aislar el módulo carga una segunda copia de React.
 */
import { render, waitFor } from "@testing-library/react";

import { GoogleBoton } from "@/app/components/google-boton";

jest.mock("@/lib/google-identity", () => ({
  GOOGLE_CLIENT_ID: "cliente-de-prueba",
  cargarGoogleIdentity: () => Promise.resolve(),
}));

const initialize = jest.fn();
const renderButton = jest.fn();

beforeEach(() => {
  window.google = { accounts: { id: { initialize, renderButton } } };
});

describe("GoogleBoton", () => {
  it("inicializa Google una sola vez y entrega el credential al botón montado", async () => {
    const viejo = jest.fn();
    const nuevo = jest.fn();

    // Primera visita a la pantalla.
    const primero = render(<GoogleBoton onCredential={viejo} />);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
    expect(initialize).toHaveBeenCalledTimes(1);
    primero.unmount();

    // Vuelve a la pantalla: se dibuja el botón de nuevo, sin re-inicializar.
    const segundo = render(<GoogleBoton onCredential={nuevo} />);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(2));
    expect(initialize).toHaveBeenCalledTimes(1);

    // El callback quedó registrado en la única inicialización y llega al
    // botón de ahora, no al que ya se desmontó.
    const { callback } = initialize.mock.calls[0][0];
    callback({ credential: "jwt-de-google" });
    expect(nuevo).toHaveBeenCalledWith("jwt-de-google");
    expect(viejo).not.toHaveBeenCalled();

    // Un credential tardío, sin ningún botón montado, se ignora sin romper.
    segundo.unmount();
    expect(() => callback({ credential: "tarde" })).not.toThrow();
    expect(nuevo).toHaveBeenCalledTimes(1);
  });
});
