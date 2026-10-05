/**
 * Adjuntar y mostrar archivos en el chat: el compositor valida antes de
 * enviar y manda multipart; el hilo pinta imágenes y documentos. Se mockea
 * la red (apiFetch).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MensajeComposer } from "@/app/components/mensaje-composer";
import { ThreadViewer } from "@/app/components/thread-viewer";
import { apiFetch } from "@/lib/auth";
import type { MensajeOut } from "@/lib/types";

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.Mock;

function composer(extra: Partial<React.ComponentProps<typeof MensajeComposer>> = {}) {
  const onCambio = jest.fn();
  render(
    <MensajeComposer
      status="transferred"
      enviarUrl="/api/c/1/mensajes"
      tomarUrl="/api/c/1/tomar"
      volverIaUrl="/api/c/1/volver-a-ia"
      adjuntosUrl="/api/c/1/adjuntos"
      onCambio={onCambio}
      {...extra}
    />,
  );
  return { onCambio, input: screen.queryByTestId("input-adjunto") as HTMLInputElement | null };
}

const pdf = () => new File(["%PDF-1.7 contenido"], "contrato.pdf", { type: "application/pdf" });

beforeEach(() => mockApiFetch.mockReset());

describe("MensajeComposer con adjuntos", () => {
  it("sin adjuntosUrl (otros canales) no ofrece adjuntar", () => {
    const { input } = composer({ adjuntosUrl: undefined });
    expect(input).toBeNull();
    expect(screen.queryByLabelText("Adjuntar archivo")).toBeNull();
  });

  it("envía el archivo como multipart con el texto como leyenda", async () => {
    mockApiFetch.mockResolvedValue({});
    const { input, onCambio } = composer();
    const user = userEvent.setup();

    await user.upload(input!, pdf());
    expect(screen.getByText("contrato.pdf")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Leyenda (opcional)…"), "Tu contrato");
    await user.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => expect(onCambio).toHaveBeenCalled());
    const [ruta, opts] = mockApiFetch.mock.calls[0];
    expect(ruta).toBe("/api/c/1/adjuntos");
    expect(opts.method).toBe("POST");
    const campos = Object.fromEntries((opts.body as FormData).entries());
    expect((campos.archivo as File).name).toBe("contrato.pdf");
    expect(campos.leyenda).toBe("Tu contrato");
    // Y se limpia el archivo elegido.
    expect(screen.queryByText("contrato.pdf")).toBeNull();
  });

  it("permite enviar el archivo sin texto", async () => {
    mockApiFetch.mockResolvedValue({});
    const { input } = composer();
    const user = userEvent.setup();

    await user.upload(input!, pdf());
    await user.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    const campos = Object.fromEntries((mockApiFetch.mock.calls[0][1].body as FormData).entries());
    expect(campos.leyenda).toBeUndefined();
  });

  it("rechaza un tipo no permitido sin llamar a la API", async () => {
    const { input } = composer();
    const user = userEvent.setup({ applyAccept: false });

    await user.upload(input!, new File(["GIF89a"], "animado.gif", { type: "image/gif" }));

    expect(await screen.findByText(/JPG o PNG.*PDF o DOCX/)).toBeInTheDocument();
    expect(screen.queryByText("animado.gif")).toBeNull();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("quitar el archivo vuelve al envío de texto", async () => {
    const { input } = composer();
    const user = userEvent.setup();

    await user.upload(input!, pdf());
    await user.click(screen.getByLabelText("Quitar archivo"));

    expect(screen.queryByText("contrato.pdf")).toBeNull();
    expect(screen.getByRole("button", { name: /enviar/i })).toBeDisabled();
  });
});

const base: MensajeOut = {
  id: "m1",
  role: "user",
  content: "[Imagen]",
  created_at: "2026-10-05T10:00:00Z",
  enviado_por: null,
  adjuntos: [],
};

describe("ThreadViewer con adjuntos", () => {
  beforeEach(() => {
    global.URL.createObjectURL = jest.fn(() => "blob:foto");
    global.URL.revokeObjectURL = jest.fn();
  });

  it("muestra la imagen recibida y oculta la etiqueta automática", async () => {
    mockApiFetch.mockResolvedValue(new Blob(["x"], { type: "image/png" }));
    const mensajes = [
      { ...base, adjuntos: [{ id: "a1", mime: "image/png", nombre: "foto.png", bytes: 10 }] },
    ];

    render(<ThreadViewer mensajes={mensajes} adjuntoUrl={(a) => `/api/c/1/adjuntos/${a}`} />);

    const img = await screen.findByAltText("foto.png");
    expect(img).toHaveAttribute("src", "blob:foto");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/c/1/adjuntos/a1", { respuesta: "blob" });
    expect(screen.queryByText("[Imagen]")).toBeNull();
  });

  it("muestra un documento como tarjeta con nombre y tamaño, y conserva la leyenda", () => {
    const mensajes = [
      {
        ...base,
        role: "human",
        content: "Tu contrato",
        adjuntos: [{ id: "a2", mime: "application/pdf", nombre: "contrato.pdf", bytes: 2048 }],
      },
    ];

    render(<ThreadViewer mensajes={mensajes} adjuntoUrl={(a) => `/x/${a}`} />);

    expect(screen.getByText("contrato.pdf")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(screen.getByText("Tu contrato")).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled(); // no descarga hasta que se pida
  });

  it("un mensaje sin adjuntos se ve como siempre", () => {
    render(
      <ThreadViewer
        mensajes={[{ ...base, content: "Hola" }]}
        adjuntoUrl={(a) => `/x/${a}`}
      />,
    );
    expect(screen.getByText("Hola")).toBeInTheDocument();
  });
});
