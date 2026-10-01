/**
 * Botón y modal "Reportar un problema". Se mockea la red (apiFetch) y el
 * aviso (sonner); la validación real y el límite por hora son del backend.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import { ReportarProblema } from "@/app/components/reportar-problema";
import { Sidebar } from "@/app/components/sidebar";
import { ApiError, apiFetch } from "@/lib/auth";
import { useUsuario } from "@/app/components/usuario-context";

jest.mock("sonner", () => ({ toast: { success: jest.fn() } }));
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/app/components/usuario-context", () => ({ useUsuario: jest.fn() }));
jest.mock("@/app/components/plan-context", () => ({ usePlan: () => ({ acceso: null }) }));
jest.mock("@/lib/foto-perfil", () => ({
  ...jest.requireActual("@/lib/foto-perfil"),
  useFotoPerfil: () => null,
}));

const mockApiFetch = apiFetch as jest.Mock;
const RESUMEN = "No carga el calendario";
const DESCRIPCION = "Al abrir Calendario se queda en blanco y no muestra citas.";

/** El FormData con el que se llamó a la API, como objeto plano. */
function enviado(): { ruta: string; opts: RequestInit; campos: Record<string, FormDataEntryValue> } {
  const [ruta, opts] = mockApiFetch.mock.calls[0];
  return { ruta, opts, campos: Object.fromEntries((opts.body as FormData).entries()) };
}

async function abrir(opciones: Parameters<typeof userEvent.setup>[0] = {}) {
  const user = userEvent.setup(opciones);
  render(<ReportarProblema />);
  await user.click(screen.getByRole("button", { name: "Reportar un problema" }));
  await screen.findByRole("dialog");
  return user;
}

async function llenar(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Resumen"), RESUMEN);
  await user.type(screen.getByLabelText("Descripción"), DESCRIPCION);
}

beforeEach(() => {
  mockApiFetch.mockReset();
  (toast.success as jest.Mock).mockReset();
});

// ============================================================
// Acceso visible
// ============================================================
describe("acceso", () => {
  it("el sidebar tiene el botón, expandido", () => {
    (useUsuario as jest.Mock).mockReturnValue({
      usuario: { id: "u", email: "a@b.com", role: "owner", tenant_id: "t", es_gerencia_plataforma: false },
      loading: false,
      error: null,
    });
    render(<Sidebar />);

    expect(screen.getByRole("button", { name: "Reportar un problema" })).toBeVisible();
    expect(screen.getByText("Reportar un problema")).toBeInTheDocument();
  });

  it("colapsado queda como ícono, con nombre accesible", () => {
    render(<ReportarProblema expandido={false} />);

    const boton = screen.getByRole("button", { name: "Reportar un problema" });
    expect(boton).toHaveAttribute("title", "Reportar un problema");
    expect(screen.queryByText("Reportar un problema")).not.toBeInTheDocument();
  });

  it("abre un modal accesible con el formulario", async () => {
    await abrir();

    const dialogo = screen.getByRole("dialog", { name: "Reportar un problema" });
    expect(dialogo).toBeInTheDocument();
    expect(screen.getByLabelText("Resumen")).toBeInTheDocument();
    expect(screen.getByLabelText("Descripción")).toBeInTheDocument();
    expect(screen.getByLabelText("Captura de pantalla")).toBeInTheDocument();
  });
});

// ============================================================
// Campos obligatorios
// ============================================================
describe("validación", () => {
  it("no envía con los campos vacíos y avisa cuáles faltan", async () => {
    const user = await abrir();

    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(screen.getByText(/Cuéntanos en breve qué pasó/)).toBeInTheDocument();
    expect(screen.getByText(/Describe el problema con un poco más de detalle/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // sigue abierto
  });

  it("los espacios no cuentan como texto", async () => {
    const user = await abrir();
    await user.type(screen.getByLabelText("Resumen"), "        ");
    await user.type(screen.getByLabelText("Descripción"), "                ");

    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("rechaza un adjunto que no es imagen, sin enviarlo", async () => {
    // Sin filtro `accept`: simula quien arrastra o fuerza un archivo que el
    // selector no ofrecería. La validación no puede depender de él.
    const user = await abrir({ applyAccept: false });

    await user.upload(
      screen.getByLabelText("Captura de pantalla"),
      new File(["%PDF"], "informe.pdf", { type: "application/pdf" }),
    );

    expect(screen.getByText("El adjunto tiene que ser una imagen PNG o JPG.")).toBeInTheDocument();
    expect(screen.queryByText("informe.pdf")).not.toBeInTheDocument();
  });

  it("rechaza una imagen de más de 5 MB", async () => {
    const user = await abrir();
    const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("Captura de pantalla"), grande);

    expect(screen.getByText("La imagen pesa más de 5 MB.")).toBeInTheDocument();
  });
});

// ============================================================
// Envío
// ============================================================
describe("envío", () => {
  it("manda multipart con resumen, descripción y el contexto del navegador", async () => {
    mockApiFetch.mockResolvedValueOnce({ id: "r-1" });
    const user = await abrir();
    await llenar(user);

    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));
    const { ruta, opts, campos } = enviado();
    expect(ruta).toBe("/api/incidencias");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeInstanceOf(FormData); // y no `json`: lleva archivo
    expect(campos.resumen).toBe(RESUMEN);
    expect(campos.descripcion).toBe(DESCRIPCION);

    const contexto = JSON.parse(campos.contexto as string);
    expect(contexto).toMatchObject({
      ruta: expect.any(String),
      navegador: expect.any(String),
      sistema_operativo: expect.any(String),
      pantalla: { ancho: expect.any(Number), alto: expect.any(Number) },
      ventana: { ancho: expect.any(Number), alto: expect.any(Number) },
    });
    expect(campos.adjunto).toBeUndefined();
  });

  it("incluye la imagen adjunta", async () => {
    mockApiFetch.mockResolvedValueOnce({ id: "r-1" });
    const user = await abrir();
    await llenar(user);
    const captura = new File(["png"], "captura.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Captura de pantalla"), captura);
    expect(screen.getByText("captura.png")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    expect((enviado().campos.adjunto as File).name).toBe("captura.png");
  });

  it("al éxito cierra el modal y confirma con un aviso, sin recargar la página", async () => {
    mockApiFetch.mockResolvedValueOnce({ id: "r-1" });
    const user = await abrir();
    await llenar(user);

    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith(
      "Reporte recibido",
      expect.objectContaining({ description: expect.stringContaining("Gracias") }),
    );
  });

  it("tras enviar, abrirlo de nuevo muestra el formulario vacío", async () => {
    mockApiFetch.mockResolvedValueOnce({ id: "r-1" });
    const user = await abrir();
    await llenar(user);
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Reportar un problema" }));

    expect(await screen.findByLabelText("Resumen")).toHaveValue("");
  });

  it("si falla, el modal sigue abierto con el texto escrito y el error", async () => {
    mockApiFetch.mockRejectedValueOnce(
      new ApiError(429, "Ya enviaste 3 reportes en la última hora. Inténtalo de nuevo más tarde."),
    );
    const user = await abrir();
    await llenar(user);

    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));

    expect(await screen.findByText(/Ya enviaste 3 reportes/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Resumen")).toHaveValue(RESUMEN);
    expect(screen.getByLabelText("Descripción")).toHaveValue(DESCRIPCION);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("un doble clic no envía dos reportes", async () => {
    let resolver: (v: unknown) => void = () => {};
    mockApiFetch.mockReturnValueOnce(new Promise((r) => (resolver = r)));
    const user = await abrir();
    await llenar(user);

    const boton = screen.getByRole("button", { name: "Enviar reporte" });
    await user.dblClick(boton);

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    resolver({ id: "r-1" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
