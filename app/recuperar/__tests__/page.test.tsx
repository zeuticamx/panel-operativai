/**
 * /recuperar: los dos pasos, la cuenta regresiva de 5 minutos, el error
 * genérico del backend y el reenvío. Se mockea la red (apiFetch) y el
 * router; la validación real del código es la del backend.
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RecuperarPage from "@/app/recuperar/page";
import { ApiError, apiFetch } from "@/lib/auth";

const replace = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
  getAccessToken: jest.fn(() => null),
}));

const mockApiFetch = apiFetch as jest.Mock;
const SOLICITUD = { expira_en_minutos: 5, reenviar_en_segundos: 60 };

function llamadas(ruta: string): Record<string, unknown>[] {
  return mockApiFetch.mock.calls
    .filter(([path]) => path === ruta)
    .map(([, opts]) => opts.json as Record<string, unknown>);
}

/** Avanza el reloj de a un segundo, dejando que React procese cada tic. */
async function pasar(segundos: number) {
  for (let i = 0; i < segundos; i++) {
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
  }
}

async function hastaPaso2() {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  mockApiFetch.mockResolvedValueOnce(SOLICITUD);
  render(<RecuperarPage />);
  await user.type(screen.getByLabelText("Correo de tu cuenta"), "  Dueño@Negocio.com ");
  await user.click(screen.getByRole("button", { name: "Enviar código" }));
  await screen.findByLabelText("Código");
  return user;
}

async function llenarPaso2(user: ReturnType<typeof userEvent.setup>, codigo = "123456") {
  await user.type(screen.getByLabelText("Código"), codigo);
  await user.type(screen.getByLabelText("Contraseña nueva"), "nueva-clave");
  await user.type(screen.getByLabelText("Confirma la contraseña nueva"), "nueva-clave");
}

beforeEach(() => {
  jest.useFakeTimers();
  mockApiFetch.mockReset();
  replace.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

test("pide el código con el correo normalizado y pasa al paso 2 sin confirmar si existe", async () => {
  await hastaPaso2();

  expect(llamadas("/api/auth/recuperar/solicitar")).toEqual([{ email: "dueño@negocio.com" }]);
  expect(screen.getByText(/Si dueño@negocio.com está registrado/)).toBeInTheDocument();
  expect(screen.getByText("Vence en 5:00")).toBeInTheDocument();
});

test("con código y contraseña válidos restablece y lleva al login", async () => {
  const user = await hastaPaso2();
  mockApiFetch.mockResolvedValueOnce(null); // 204
  await llenarPaso2(user);

  await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

  expect(llamadas("/api/auth/recuperar/restablecer")).toEqual([
    { email: "dueño@negocio.com", codigo: "123456", password: "nueva-clave" },
  ]);
  expect(await screen.findByText("Contraseña actualizada")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  expect(replace).toHaveBeenCalledWith("/login");
});

test("no deja enviar si las contraseñas no coinciden", async () => {
  const user = await hastaPaso2();
  await user.type(screen.getByLabelText("Código"), "123456");
  await user.type(screen.getByLabelText("Contraseña nueva"), "nueva-clave");
  await user.type(screen.getByLabelText("Confirma la contraseña nueva"), "otra-clave");
  await user.tab();

  expect(screen.getByText("Las contraseñas no coinciden")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cambiar contraseña" })).toBeDisabled();
});

test("muestra el error del backend y limpia el código", async () => {
  const user = await hastaPaso2();
  mockApiFetch.mockRejectedValueOnce(
    new ApiError(400, "El código es incorrecto o ya venció. Solicita uno nuevo."),
  );
  await llenarPaso2(user, "000000");

  await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

  expect(
    await screen.findByText("El código es incorrecto o ya venció. Solicita uno nuevo."),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Código")).toHaveValue("");
});

test("a los 5 minutos marca el código como vencido y ofrece pedir otro", async () => {
  const user = await hastaPaso2();
  await llenarPaso2(user);

  await pasar(299);
  expect(screen.getByText("Vence en 0:01")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cambiar contraseña" })).toBeEnabled();

  await pasar(1);
  expect(screen.getByText("El código venció. Solicita uno nuevo para continuar.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cambiar contraseña" })).toBeDisabled();
  expect(screen.getByLabelText("Código")).toBeDisabled();

  // Pedir otro reinicia la vigencia.
  mockApiFetch.mockResolvedValueOnce(SOLICITUD);
  await user.click(screen.getByRole("button", { name: "Solicitar nuevo código" }));
  expect(await screen.findByText("Vence en 5:00")).toBeInTheDocument();
  expect(llamadas("/api/auth/recuperar/solicitar")).toHaveLength(2);
});

test("el reenvío queda bloqueado los primeros 60 segundos", async () => {
  await hastaPaso2();

  expect(screen.getByRole("button", { name: "Solicitar nuevo código en 60s" })).toBeDisabled();
  await pasar(60);
  expect(screen.getByRole("button", { name: "Solicitar nuevo código" })).toBeEnabled();
});
