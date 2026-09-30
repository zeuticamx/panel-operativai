/**
 * lib/foto-perfil.ts: validar el tipo y redimensionar con canvas antes de
 * subir. jsdom no implementa canvas ni createImageBitmap: se simulan, y lo
 * que se prueba es qué medidas y qué tipo se le piden.
 */
import {
  FOTO_MAX_BYTES,
  FotoInvalida,
  medidasAjustadas,
  prepararFoto,
  tipoDeFoto,
} from "@/lib/foto-perfil";

function archivo(nombre: string, tipo: string, bytes = 10): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

describe("tipoDeFoto", () => {
  it.each([
    ["yo.png", "image/png", "image/png"],
    ["yo.PNG", "image/png", "image/png"],
    ["yo.jpg", "image/jpeg", "image/jpeg"],
    ["yo.jpeg", "image/jpeg", "image/jpeg"],
    // Algunos navegadores no informan el tipo: vale la extensión.
    ["yo.jpg", "", "image/jpeg"],
  ])("acepta %s (%s)", (nombre, tipo, esperado) => {
    expect(tipoDeFoto(archivo(nombre, tipo))).toBe(esperado);
  });

  it.each([
    ["yo.gif", "image/gif"],
    ["yo.webp", "image/webp"],
    ["yo.svg", "image/svg+xml"],
    ["yo.heic", "image/heic"],
    ["yo", "image/png"],
    // Renombrado: la extensión dice PNG, el tipo no.
    ["yo.png", "image/gif"],
    ["yo.jpg", "image/png"],
  ])("rechaza %s (%s)", (nombre, tipo) => {
    expect(() => tipoDeFoto(archivo(nombre, tipo))).toThrow(FotoInvalida);
  });
});

describe("medidasAjustadas", () => {
  it.each([
    [4000, 3000, 642, 482],
    [3000, 4000, 482, 642],
    [700, 100, 642, 92],
    [642, 642, 642, 642],
    [300, 200, 300, 200], // más chica: no se agranda
    [10000, 1, 642, 1], // nunca a cero
  ])("%ix%i -> %ix%i", (ancho, alto, esperadoAncho, esperadoAlto) => {
    expect(medidasAjustadas(ancho, alto)).toEqual({ ancho: esperadoAncho, alto: esperadoAlto });
  });
});

describe("prepararFoto", () => {
  const dibujado = { ancho: 0, alto: 0, tipo: "" };
  let tamanoResultado = 1000;

  beforeEach(() => {
    tamanoResultado = 1000;
    (global as unknown as { createImageBitmap: unknown }).createImageBitmap = jest.fn(async () => ({
      width: 1600,
      height: 1200,
      close: jest.fn(),
    }));
    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(function (this: HTMLCanvasElement) {
        return {
          imageSmoothingQuality: "low",
          drawImage: () => {
            dibujado.ancho = this.width;
            dibujado.alto = this.height;
          },
        } as unknown as CanvasRenderingContext2D;
      } as unknown as HTMLCanvasElement["getContext"]);
    jest
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((cb: BlobCallback, tipo?: string) => {
        dibujado.tipo = tipo ?? "";
        cb(new Blob([new Uint8Array(tamanoResultado)], { type: tipo }));
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it("redimensiona a 642 px como máximo y conserva el formato", async () => {
    const lista = await prepararFoto(archivo("vacaciones.jpeg", "image/jpeg"));

    expect([dibujado.ancho, dibujado.alto]).toEqual([642, 482]);
    expect(dibujado.tipo).toBe("image/jpeg");
    expect(lista.type).toBe("image/jpeg");
    expect(lista.name).toBe("vacaciones.jpg");
  });

  it("un PNG sale PNG", async () => {
    const lista = await prepararFoto(archivo("logo.png", "image/png"));
    expect(lista.type).toBe("image/png");
    expect(lista.name).toBe("logo.png");
  });

  it("no toca el canvas si el tipo no es válido", async () => {
    await expect(prepararFoto(archivo("yo.gif", "image/gif"))).rejects.toThrow(FotoInvalida);
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
  });

  it("una imagen que el navegador no puede leer se rechaza", async () => {
    (global as unknown as { createImageBitmap: unknown }).createImageBitmap = jest.fn(async () => {
      throw new Error("dañada");
    });
    await expect(prepararFoto(archivo("rota.png", "image/png"))).rejects.toThrow(/No se pudo leer/);
  });

  it("si aun redimensionada pesa más de 2 MB, se rechaza", async () => {
    tamanoResultado = FOTO_MAX_BYTES + 1;
    await expect(prepararFoto(archivo("enorme.png", "image/png"))).rejects.toThrow(/2 MB/);
  });
});
