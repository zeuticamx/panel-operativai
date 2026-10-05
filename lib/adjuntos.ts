"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./auth";

/**
 * Archivos adjuntos de WhatsApp (imágenes y documentos) en el chat del portal.
 *
 * Los topes y los tipos replican backend/services/adjuntos.py (el backend
 * valida de nuevo por los bytes del archivo y manda en caso de duda). Esto
 * solo sirve para avisar ANTES de subir un archivo que va a rebotar.
 */

export const ADJUNTO_IMAGEN_MAX_BYTES = 5 * 1024 * 1024;
export const ADJUNTO_DOCUMENTO_MAX_BYTES = 16 * 1024 * 1024;

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Por extensión: tipo MIME esperado y si es imagen (cambia el tope). */
const TIPOS: Record<string, { mime: string; imagen: boolean }> = {
  jpg: { mime: "image/jpeg", imagen: true },
  jpeg: { mime: "image/jpeg", imagen: true },
  png: { mime: "image/png", imagen: true },
  pdf: { mime: "application/pdf", imagen: false },
  docx: { mime: MIME_DOCX, imagen: false },
};

/** `accept` del input: el selector de archivos solo ofrece estos. */
export const ACCEPT_ADJUNTO = `image/png,image/jpeg,application/pdf,${MIME_DOCX},.png,.jpg,.jpeg,.pdf,.docx`;

export function formatoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

export function esImagen(mime: string): boolean {
  return mime === "image/jpeg" || mime === "image/png";
}

/** Mensaje de error si el archivo no se puede enviar; null si está bien. */
export function validarAdjunto(archivo: Pick<File, "name" | "type" | "size">): string | null {
  const extension = archivo.name.toLowerCase().split(".").pop() ?? "";
  const tipo = TIPOS[extension];
  if (!tipo || (archivo.type && archivo.type !== tipo.mime)) {
    return "Solo se pueden enviar imágenes JPG o PNG y documentos PDF o DOCX.";
  }
  if (archivo.size === 0) return "El archivo está vacío.";

  const tope = tipo.imagen ? ADJUNTO_IMAGEN_MAX_BYTES : ADJUNTO_DOCUMENTO_MAX_BYTES;
  if (archivo.size > tope) {
    return `${tipo.imagen ? "Las imágenes" : "Los documentos"} pueden pesar hasta ${formatoBytes(tope)}.`;
  }
  return null;
}

/**
 * Los adjuntos viven detrás del JWT, así que un <img src> directo no
 * funcionaría: se piden con apiFetch como Blob y se muestran por object URL.
 */
export function useAdjuntoBlob(url: string | null): { src: string | null; error: boolean } {
  // El resultado se guarda junto a la URL que lo produjo: si cambia la URL,
  // el resultado viejo deja de aplicar sin tener que resetearlo en el efecto.
  const [resultado, setResultado] = useState<{ url: string; src: string | null; error: boolean } | null>(null);

  useEffect(() => {
    if (!url) return;
    let activo = true;
    let objeto: string | null = null;
    apiFetch<Blob>(url, { respuesta: "blob" })
      .then((blob) => {
        if (!activo) return;
        objeto = URL.createObjectURL(blob);
        setResultado({ url, src: objeto, error: false });
      })
      .catch(() => {
        if (activo) setResultado({ url, src: null, error: true });
      });
    return () => {
      activo = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [url]);

  const vigente = resultado && resultado.url === url ? resultado : null;
  return { src: vigente?.src ?? null, error: vigente?.error ?? false };
}

/** Baja un adjunto (autenticado) y lo guarda con su nombre. */
export async function descargarAdjunto(url: string, nombre: string): Promise<void> {
  const blob = await apiFetch<Blob>(url, { respuesta: "blob" });
  const objeto = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objeto;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(objeto);
}
