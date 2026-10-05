/**
 * Gestión de la cuenta del dueño:
 *  - PortalStripe: pide la URL del Customer Portal al hacer clic y navega.
 *  - BorrarCuenta: muestra los bloqueos sin dejar seguir; si no hay, exige
 *    pasar la advertencia, escribir ELIMINAR y la contraseña; al terminar
 *    limpia la sesión y sale al login.
 * Se mockea la red (apiFetch). La navegación (location.assign/replace) no
 * se puede espiar en jsdom 22+ (propiedades no configurables, ver
 * canales/__tests__/page.test.tsx): se prueba qué se pide y qué se muestra.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BorrarCuenta } from "@/app/components/borrar-cuenta";
import { PortalStripe } from "@/app/components/portal-stripe";
import { ApiError, apiFetch, clearTokens } from "@/lib/auth";
import type { EliminacionCuentaOut } from "@/lib/types";

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
  clearTokens: jest.fn(),
}));
jest.mock("@/app/components/google-boton", () => ({
  GoogleBoton: ({ onCredential }: { onCredential: (c: string) => void }) => (
    <button type="button" onClick={() => onCredential("cred-google")}>
      Continuar con Google
    </button>
  ),
}));

const mockApiFetch = apiFetch as jest.Mock;

beforeEach(() => {
  mockApiFetch.mockReset();
  (clearTokens as jest.Mock).mockReset();
});

// ------------------------------------------------------------
// Portal de Stripe
// ------------------------------------------------------------
describe("PortalStripe", () => {
  it("pide la sesión al backend al hacer clic, sin errores", async () => {
    mockApiFetch.mockResolvedValue({ url: "https://billing.stripe.com/p/s_1" });
    render(<PortalStripe fechaRenovacion="2026-11-01T00:00:00Z" cancelaAlVencer={false} />);
    expect(mockApiFetch).not.toHaveBeenCalled(); // la URL es de un solo uso: no se pide antes

    await userEvent.click(screen.getByRole("button", { name: /gestionar \/ cancelar/i }));

    expect(mockApiFetch).toHaveBeenCalledWith("/api/pagos/portal-cliente", { method: "POST" });
    expect(screen.queryByText(/no se pudo/i)).toBeNull();
  });

  it("advierte que cancelar no reembolsa y que borrar antes pierde los días pagados", () => {
    render(<PortalStripe fechaRenovacion="2026-11-01T00:00:00Z" cancelaAlVencer={false} />);
    expect(screen.getByText(/no se reembolsa/i)).toBeInTheDocument();
    expect(screen.getByText(/los días pagados se pierden/i)).toBeInTheDocument();
  });

  it("muestra el error si Stripe no responde y no navega", async () => {
    mockApiFetch.mockRejectedValue(new ApiError(502, "No se pudo abrir el portal de Stripe."));
    render(<PortalStripe fechaRenovacion={null} cancelaAlVencer={false} />);

    await userEvent.click(screen.getByRole("button", { name: /gestionar \/ cancelar/i }));

    expect(await screen.findByText("No se pudo abrir el portal de Stripe.")).toBeInTheDocument();
    // Se puede reintentar: el botón vuelve a estar disponible.
    expect(screen.getByRole("button", { name: /gestionar \/ cancelar/i })).toBeEnabled();
  });
});

// ------------------------------------------------------------
// Borrar cuenta
// ------------------------------------------------------------
const REVISION: EliminacionCuentaOut = {
  eliminable: true,
  bloqueos: [],
  pagado_hasta: null,
  creditos_disponibles: "0",
  usuarios_portal: 3,
  conversaciones: 42,
  verificacion: "password",
};

/** GET de la revisión con `revision`; el POST, lo que diga `post`. */
function api(revision: EliminacionCuentaOut, post: () => Promise<unknown> = async () => null) {
  mockApiFetch.mockImplementation((ruta: string) =>
    ruta === "/api/cuenta/eliminacion" ? Promise.resolve(revision) : post(),
  );
}

async function abrir() {
  await userEvent.click(screen.getByRole("button", { name: "Borrar cuenta" }));
}

describe("BorrarCuenta", () => {
  it("con una suscripción activa explica por qué y no deja continuar", async () => {
    api({
      ...REVISION,
      eliminable: false,
      bloqueos: [{ codigo: "suscripcion_vigente", mensaje: "Tu suscripción sigue activa." }],
    });
    render(<BorrarCuenta />);
    await abrir();

    expect(await screen.findByText("Tu suscripción sigue activa.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continuar/i })).toBeNull();
    expect(screen.queryByLabelText(/contraseña/i)).toBeNull();
  });

  it("con pagos pendientes también bloquea", async () => {
    api({
      ...REVISION,
      eliminable: false,
      bloqueos: [{ codigo: "adeudo_pendiente", mensaje: "Tienes pagos pendientes con Stripe." }],
    });
    render(<BorrarCuenta />);
    await abrir();
    expect(await screen.findByText("Tienes pagos pendientes con Stripe.")).toBeInTheDocument();
  });

  it("advierte lo que se pierde, incluidos los días pagados", async () => {
    api({ ...REVISION, pagado_hasta: "2026-11-01T00:00:00Z" });
    render(<BorrarCuenta />);
    await abrir();

    expect(await screen.findByText(/irreversible/i)).toBeInTheDocument();
    expect(screen.getByText(/3 usuarios del portal/)).toBeInTheDocument();
    expect(screen.getByText(/42 conversaciones/)).toBeInTheDocument();
    expect(screen.getByText(/esos días se pierden/i)).toBeInTheDocument();
  });

  it("exige ELIMINAR exacto y la contraseña antes de habilitar el borrado", async () => {
    api(REVISION);
    const user = userEvent.setup();
    render(<BorrarCuenta />);
    await abrir();
    await user.click(await screen.findByRole("button", { name: /entiendo, continuar/i }));

    const borrar = screen.getByRole("button", { name: /borrar cuenta definitivamente/i });
    expect(borrar).toBeDisabled();

    await user.type(screen.getByLabelText(/escribe eliminar/i), "eliminar");
    await user.type(screen.getByLabelText(/contraseña actual/i), "secreta");
    expect(borrar).toBeDisabled(); // minúsculas no valen

    await user.clear(screen.getByLabelText(/escribe eliminar/i));
    await user.type(screen.getByLabelText(/escribe eliminar/i), "ELIMINAR");
    expect(borrar).toBeEnabled();

    await user.click(borrar);

    await waitFor(() => expect(clearTokens).toHaveBeenCalled());
    expect(mockApiFetch).toHaveBeenCalledWith("/api/cuenta/eliminar", {
      method: "POST",
      json: { confirmacion: "ELIMINAR", password: "secreta", google_credential: null },
    });
  });

  it("si el backend rechaza (contraseña, bloqueo nuevo) muestra el motivo y no sale", async () => {
    api(REVISION, () => Promise.reject(new ApiError(403, "La contraseña no es correcta")));
    const user = userEvent.setup();
    render(<BorrarCuenta />);
    await abrir();
    await user.click(await screen.findByRole("button", { name: /entiendo, continuar/i }));
    await user.type(screen.getByLabelText(/escribe eliminar/i), "ELIMINAR");
    await user.type(screen.getByLabelText(/contraseña actual/i), "mala");
    await user.click(screen.getByRole("button", { name: /borrar cuenta definitivamente/i }));

    expect(await screen.findByText("La contraseña no es correcta")).toBeInTheDocument();
    expect(clearTokens).not.toHaveBeenCalled();
    // Puede corregir y reintentar.
    expect(screen.getByRole("button", { name: /borrar cuenta definitivamente/i })).toBeEnabled();
  });

  it("en cuentas solo de Google pide volver a entrar con Google", async () => {
    api({ ...REVISION, verificacion: "google" });
    const user = userEvent.setup();
    render(<BorrarCuenta />);
    await abrir();
    await user.click(await screen.findByRole("button", { name: /entiendo, continuar/i }));

    expect(screen.queryByLabelText(/contraseña actual/i)).toBeNull();
    await user.type(screen.getByLabelText(/escribe eliminar/i), "ELIMINAR");
    const borrar = screen.getByRole("button", { name: /borrar cuenta definitivamente/i });
    expect(borrar).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /continuar con google/i }));
    await user.click(borrar);

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/cuenta/eliminar", {
        method: "POST",
        json: { confirmacion: "ELIMINAR", password: null, google_credential: "cred-google" },
      }),
    );
  });

  it("cancelar en la advertencia no borra nada", async () => {
    api(REVISION);
    render(<BorrarCuenta />);
    await abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(mockApiFetch).toHaveBeenCalledTimes(1); // solo la revisión
  });
});
