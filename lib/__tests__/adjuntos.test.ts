/**
 * Validación previa de adjuntos de WhatsApp en el navegador. El backend
 * vuelve a validar por los bytes; esto solo evita subir lo que va a rebotar.
 */
import {
  ADJUNTO_DOCUMENTO_MAX_BYTES,
  ADJUNTO_IMAGEN_MAX_BYTES,
  formatoBytes,
  validarAdjunto,
} from "@/lib/adjuntos";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("validarAdjunto", () => {
  it.each([
    ["foto.jpg", "image/jpeg"],
    ["foto.JPEG", "image/jpeg"],
    ["captura.png", "image/png"],
    ["contrato.pdf", "application/pdf"],
    ["oferta.docx", DOCX],
    ["oferta.docx", ""], // algunos navegadores no informan el tipo
  ])("acepta %s (%s)", (name, type) => {
    expect(validarAdjunto({ name, type, size: 1000 })).toBeNull();
  });

  it.each([
    ["animado.gif", "image/gif"],
    ["hoja.xlsx", "application/vnd.ms-excel"],
    ["viejo.doc", "application/msword"],
    ["sin-extension", ""],
  ])("rechaza %s por tipo", (name, type) => {
    expect(validarAdjunto({ name, type, size: 1000 })).toMatch(/JPG o PNG.*PDF o DOCX/);
  });

  it("rechaza una extensión cuyo tipo declarado no coincide", () => {
    expect(validarAdjunto({ name: "falso.png", type: "application/pdf", size: 10 })).not.toBeNull();
  });

  it("rechaza un archivo vacío", () => {
    expect(validarAdjunto({ name: "a.pdf", type: "application/pdf", size: 0 })).toMatch(/vacío/);
  });

  it("aplica el tope de imágenes en el borde", () => {
    const img = { name: "a.png", type: "image/png" };
    expect(validarAdjunto({ ...img, size: ADJUNTO_IMAGEN_MAX_BYTES })).toBeNull();
    expect(validarAdjunto({ ...img, size: ADJUNTO_IMAGEN_MAX_BYTES + 1 })).toMatch(/5 MB/);
  });

  it("aplica un tope distinto a los documentos", () => {
    const doc = { name: "a.pdf", type: "application/pdf" };
    // Pasa del tope de imágenes pero no del de documentos.
    expect(validarAdjunto({ ...doc, size: ADJUNTO_IMAGEN_MAX_BYTES + 1 })).toBeNull();
    expect(validarAdjunto({ ...doc, size: ADJUNTO_DOCUMENTO_MAX_BYTES + 1 })).toMatch(/16 MB/);
  });
});

describe("formatoBytes", () => {
  it("elige la unidad", () => {
    expect(formatoBytes(500)).toBe("500 B");
    expect(formatoBytes(2048)).toBe("2 KB");
    expect(formatoBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatoBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});
