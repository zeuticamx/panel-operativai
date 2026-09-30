/**
 * Aceptación de Términos y Condiciones en /registro y /login.
 *
 * Se mockea la red (apiFetch), el router y el botón de Google (lo dibuja
 * Google en un iframe: aquí es un botón que entrega un credential de
 * prueba). Lo que se prueba es qué se le deja hacer a la persona y qué se le
 * manda al backend — la validación real es la del backend.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import LoginPage from "@/app/login/page";
import RegistroPage from "@/app/registro/page";
import { ApiError, apiFetch } from "@/lib/auth";

const replace = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
jest.mock("@/lib/google-identity", () => ({ GOOGLE_CLIENT_ID: "cliente-de-prueba" }));
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
  getAccessToken: jest.fn(() => null),
  setTokens: jest.fn(),
}));
jest.mock("@/app/components/google-boton", () => ({
  GoogleBoton: ({
    onCredential,
    disabled,
  }: {
    onCredential: (c: string) => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={() => onCredential("credential-de-google")}>
      Continuar con Google
    </button>
  ),
}));

const mockApiFetch = apiFetch as jest.Mock;

const TOKENS = { access_token: "a", refresh_token: "r", token_type: "bearer" };
const error428 = () =>
  new ApiError(428, "Para continuar debes aceptar los Términos y Condiciones.");

/** Los cuerpos que recibió el backend, en orden, para una ruta. */
function cuerpos(ruta: string): Record<string, unknown>[] {
  return mockApiFetch.mock.calls
    .filter(([path]) => path === ruta)
    .map(([, opts]) => opts.json as Record<string, unknown>);
}

beforeEach(() => {
  mockApiFetch.mockReset();
  replace.mockReset();
});

// ============================================================
// /registro
// ============================================================
describe("/registro", () => {
  async function llenarDatos() {
    const user = userEvent.setup();
    render(<RegistroPage />);
    await user.type(screen.getByLabelText("Nombre del negocio"), "Ferretería El Tornillo");
    await user.type(screen.getByLabelText(/^Correo/), "dueno@negocio.com");
    await user.type(screen.getByLabelText("Contraseña"), "una-clave-segura");
    return user;
  }

  it("muestra la casilla desmarcada con enlaces a los términos y a la privacidad", () => {
    render(<RegistroPage />);

    expect(screen.getByRole("checkbox", { name: /Acepto los Términos y Condiciones/ })).not.toBeChecked();
    expect(screen.getByRole("link", { name: "Términos y Condiciones" })).toHaveAttribute(
      "href",
      "/condiciones",
    );
    expect(screen.getByRole("link", { name: "Aviso de privacidad" })).toHaveAttribute(
      "href",
      "/privacidad",
    );
  });

  it("sin marcar la casilla no se puede continuar aunque el formulario esté completo", async () => {
    await llenarDatos();

    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("al marcarla se habilita y el alta viaja con acepta_terminos: true", async () => {
    mockApiFetch.mockResolvedValue({ email: "dueno@negocio.com", expira_en_minutos: 10, reenviar_en_segundos: 60 });
    const user = await llenarDatos();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(cuerpos("/api/auth/registro")).toHaveLength(1));
    expect(cuerpos("/api/auth/registro")[0]).toMatchObject({
      email: "dueno@negocio.com",
      acepta_terminos: true,
    });
  });

  it("el botón de Google está deshabilitado hasta marcar la casilla", async () => {
    const user = userEvent.setup();
    render(<RegistroPage />);

    expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeDisabled();
    expect(screen.getByText("Acepta los términos para continuar con Google")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeEnabled();
  });

  it("con Google, la aceptación viaja junto al credential", async () => {
    mockApiFetch.mockResolvedValue(TOKENS);
    const user = userEvent.setup();
    render(<RegistroPage />);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Continuar con Google" }));

    await waitFor(() => expect(cuerpos("/api/auth/google")).toHaveLength(1));
    expect(cuerpos("/api/auth/google")[0]).toEqual({
      credential: "credential-de-google",
      acepta_terminos: true,
    });
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });
});

// ============================================================
// /login
// ============================================================
describe("/login", () => {
  async function escribirCredenciales() {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText("Correo"), "dueno@negocio.com");
    await user.type(screen.getByLabelText("Contraseña"), "una-clave-segura");
    return user;
  }

  it("una cuenta que ya aceptó entra directo, sin pedir nada y sin mandar la aceptación", async () => {
    mockApiFetch.mockResolvedValue(TOKENS);
    const user = await escribirCredenciales();

    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(cuerpos("/api/auth/login")[0]).toEqual({
      email: "dueno@negocio.com",
      password: "una-clave-segura",
    });
    expect(screen.queryByText("Antes de continuar")).not.toBeInTheDocument();
  });

  it("una cuenta anterior a los términos debe aceptarlos antes de entrar", async () => {
    mockApiFetch.mockRejectedValueOnce(error428()).mockResolvedValueOnce(TOKENS);
    const user = await escribirCredenciales();

    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    // Paso intermedio: no hubo sesión y el botón espera la casilla.
    expect(await screen.findByText("Antes de continuar")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Aceptar y continuar" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Aceptar y continuar" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(cuerpos("/api/auth/login")[1]).toEqual({
      email: "dueno@negocio.com",
      password: "una-clave-segura",
      acepta_terminos: true,
    });
  });

  it("con Google, un correo nuevo abre el paso de aceptación y reenvía el mismo credential", async () => {
    mockApiFetch.mockRejectedValueOnce(error428()).mockResolvedValueOnce(TOKENS);
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Continuar con Google" }));

    expect(await screen.findByText("Antes de continuar")).toBeInTheDocument();
    // La primera llamada no llevaba aceptación: el backend no crea la cuenta.
    expect(cuerpos("/api/auth/google")[0]).toEqual({ credential: "credential-de-google" });
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Aceptar y continuar" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(cuerpos("/api/auth/google")[1]).toEqual({
      credential: "credential-de-google",
      acepta_terminos: true,
    });
  });

  it("cancelar el paso de aceptación vuelve al formulario sin iniciar sesión", async () => {
    mockApiFetch.mockRejectedValueOnce(error428());
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: "Continuar con Google" }));
    await screen.findByText("Antes de continuar");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("Iniciar sesión")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it("si el token de Google venció mientras se aceptaba, pide volver a pulsar el botón", async () => {
    mockApiFetch
      .mockRejectedValueOnce(error428())
      .mockRejectedValueOnce(new ApiError(401, "Token de Google inválido"));
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: "Continuar con Google" }));
    await screen.findByText("Antes de continuar");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Aceptar y continuar" }));

    expect(await screen.findByText(/La sesión de Google venció/)).toBeInTheDocument();
    expect(screen.getByText("Iniciar sesión")).toBeInTheDocument();
  });

  it("un error que no es de términos se muestra como siempre", async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(401, "Correo o contraseña incorrectos"));
    const user = await escribirCredenciales();

    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByText("Correo o contraseña incorrectos")).toBeInTheDocument();
    expect(screen.queryByText("Antes de continuar")).not.toBeInTheDocument();
  });
});
