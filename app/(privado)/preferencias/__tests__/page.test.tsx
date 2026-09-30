/**
 * /preferencias: inputs del perfil, lo que se manda al guardar, la foto
 * (tipo inválido no se sube) y los avisos de datos faltantes.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PreferenciasPage from "@/app/(privado)/preferencias/page";
import { useUsuario } from "@/app/components/usuario-context";
import { apiFetch } from "@/lib/auth";
import { prepararFoto } from "@/lib/foto-perfil";
import type { PerfilOut } from "@/lib/types";
import { useApi } from "@/lib/use-api";

jest.mock("@/app/components/usuario-context", () => ({ useUsuario: jest.fn() }));
jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));
jest.mock("@/app/components/centro-notificaciones", () => ({ CentroNotificaciones: () => null }));
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));
jest.mock("@/lib/foto-perfil", () => ({
  ...jest.requireActual("@/lib/foto-perfil"),
  useFotoPerfil: () => null,
  prepararFoto: jest.fn(),
}));

const mockUseUsuario = useUsuario as jest.Mock;
const mockUseApi = useApi as jest.Mock;
const mockApiFetch = apiFetch as jest.Mock;
const mockPrepararFoto = prepararFoto as jest.Mock;

const VACIO: PerfilOut = {
  nombres: null,
  apellido_paterno: null,
  apellido_materno: null,
  fecha_nacimiento: null,
  genero: null,
  empresa: null,
  completo: false,
  faltantes: ["nombres", "apellido_paterno", "fecha_nacimiento", "genero"],
  tiene_foto: false,
  foto_version: null,
  recordatorio_dias_restantes: 18,
};

const recargarPerfil = jest.fn(async () => {});
const recargarUsuario = jest.fn();

function conPerfil(perfil: PerfilOut, usuarioExtra: Record<string, unknown> = {}) {
  mockUseApi.mockReturnValue({ data: perfil, loading: false, error: null, recargar: recargarPerfil });
  mockUseUsuario.mockReturnValue({
    usuario: { id: "u", email: "ana@negocio.com", role: "member", tenant_id: "t", ...usuarioExtra },
    loading: false,
    error: null,
    recargar: recargarUsuario,
  });
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockPrepararFoto.mockReset();
  recargarPerfil.mockClear();
  recargarUsuario.mockClear();
  conPerfil(VACIO);
});

it("muestra todos los campos del perfil y las tres opciones de género", () => {
  render(<PreferenciasPage />);

  for (const etiqueta of [
    "Nombre(s)",
    "Apellido paterno",
    "Apellido materno",
    "Fecha de nacimiento",
    "Género",
    "Empresa",
  ]) {
    expect(screen.getByLabelText(etiqueta)).toBeInTheDocument();
  }
  expect(screen.getByLabelText("Elegir foto de perfil")).toHaveAttribute(
    "accept",
    "image/png,image/jpeg,.png,.jpg,.jpeg",
  );
  const opciones = Array.from(
    (screen.getByLabelText("Género") as HTMLSelectElement).options,
  ).map((o) => o.textContent);
  expect(opciones).toEqual(["Selecciona…", "Femenino", "Masculino", "Prefiero no decirlo"]);
});

it("la empresa llega puesta (el negocio de la cuenta) y el correo se ve de solo lectura", () => {
  conPerfil({ ...VACIO, empresa: "Ferretería Juárez" });
  render(<PreferenciasPage />);

  expect(screen.getByLabelText("Empresa")).toHaveValue("Ferretería Juárez");
  const correo = screen.getByLabelText("Correo");
  expect(correo).toHaveValue("ana@negocio.com");
  expect(correo).toBeDisabled();
});

it("avisa qué falta y cuántos días de recordatorios quedan", () => {
  render(<PreferenciasPage />);

  expect(
    screen.getByText(/faltan: nombre\(s\), apellido paterno, fecha de nacimiento, género\./),
  ).toBeInTheDocument();
  expect(screen.getByText(/durante 18 días más/)).toBeInTheDocument();
});

it("con el perfil completo no hay aviso de faltantes", () => {
  conPerfil({
    ...VACIO,
    nombres: "Ana",
    apellido_paterno: "Pérez",
    fecha_nacimiento: "1990-05-17",
    genero: "femenino",
    completo: true,
    faltantes: [],
    recordatorio_dias_restantes: null,
  });
  render(<PreferenciasPage />);

  expect(screen.queryByText(/faltan:/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Nombre(s)")).toHaveValue("Ana");
});

it("guarda el perfil con los opcionales vacíos como null y refresca el sidebar", async () => {
  mockApiFetch.mockResolvedValue({ ...VACIO, completo: true, faltantes: [] });
  const user = userEvent.setup();
  render(<PreferenciasPage />);

  await user.type(screen.getByLabelText("Nombre(s)"), "  María José ");
  await user.type(screen.getByLabelText("Apellido paterno"), "Pérez");
  await user.type(screen.getByLabelText("Fecha de nacimiento"), "1990-05-17");
  await user.selectOptions(screen.getByLabelText("Género"), "prefiero_no_decirlo");
  await user.click(screen.getByRole("button", { name: "Guardar" }));

  await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
  expect(mockApiFetch).toHaveBeenCalledWith("/api/perfil", {
    method: "PUT",
    json: {
      nombres: "María José",
      apellido_paterno: "Pérez",
      apellido_materno: null,
      fecha_nacimiento: "1990-05-17",
      genero: "prefiero_no_decirlo",
      empresa: null,
    },
  });
  expect(await screen.findByText("Perfil guardado.")).toBeInTheDocument();
  expect(recargarUsuario).toHaveBeenCalled();
});

it("un nombre con números no se deja guardar", async () => {
  const user = userEvent.setup();
  render(<PreferenciasPage />);

  await user.type(screen.getByLabelText("Nombre(s)"), "Ana2");

  expect(screen.getByText("Solo letras, espacios, guion, apóstrofo o punto")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
});

it("una foto de tipo inválido se rechaza sin llamar al backend", async () => {
  const { FotoInvalida } = jest.requireActual("@/lib/foto-perfil");
  mockPrepararFoto.mockRejectedValue(new FotoInvalida("La foto tiene que ser JPG, JPEG o PNG."));
  const user = userEvent.setup({ applyAccept: false });
  render(<PreferenciasPage />);

  await user.upload(
    screen.getByLabelText("Elegir foto de perfil"),
    new File(["x"], "yo.gif", { type: "image/gif" }),
  );

  expect(await screen.findByText("La foto tiene que ser JPG, JPEG o PNG.")).toBeInTheDocument();
  expect(mockApiFetch).not.toHaveBeenCalled();
});

it("una foto válida se sube ya preparada, como multipart", async () => {
  const preparada = new File(["img"], "yo.jpg", { type: "image/jpeg" });
  mockPrepararFoto.mockResolvedValue(preparada);
  mockApiFetch.mockResolvedValue({ ...VACIO, tiene_foto: true, foto_version: "1" });
  const user = userEvent.setup();
  render(<PreferenciasPage />);

  await user.upload(
    screen.getByLabelText("Elegir foto de perfil"),
    new File(["x"], "grande.jpg", { type: "image/jpeg" }),
  );

  await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
  const [ruta, opciones] = mockApiFetch.mock.calls[0];
  expect(ruta).toBe("/api/perfil/foto");
  expect(opciones.method).toBe("PUT");
  expect((opciones.body as FormData).get("archivo")).toBe(preparada);
  expect(recargarUsuario).toHaveBeenCalled();
});

it("en 'ver como' todo queda de solo lectura", () => {
  conPerfil(VACIO, { impersonado_por: "gerente@operativai.com.mx" });
  render(<PreferenciasPage />);

  expect(screen.getByLabelText("Nombre(s)")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Subir foto/ })).toBeDisabled();
});
