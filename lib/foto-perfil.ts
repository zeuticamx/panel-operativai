"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./auth";

/**
 * Foto de perfil del lado del navegador.
 *
 * El backend (services/imagen.py) solo acepta JPEG/PNG de hasta 642x642 px
 * y 2 MB, y RECHAZA lo que exceda: redimensionar allá exigiría Pillow. Acá
 * se redimensiona con <canvas> antes de subir, sin librerías, para que una
 * foto de celular de 4000x3000 no rebote.
 *
 * La imagen se re-codifica siempre, aunque ya mida menos del máximo: así
 * además se descartan los metadatos EXIF (la ubicación GPS de una foto de
 * celular, por ejemplo), que el canvas no copia.
 */

export const FOTO_MAX_PX = 642;
export const FOTO_MAX_BYTES = 2 * 1024 * 1024;

type MimeFoto = "image/png" | "image/jpeg";

const EXTENSIONES: Record<string, MimeFoto> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** `accept` del input: el selector de archivos solo ofrece estos. */
export const ACCEPT_FOTO = "image/png,image/jpeg,.png,.jpg,.jpeg";

export class FotoInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "FotoInvalida";
  }
}

/**
 * JPEG o PNG por extensión y por tipo declarado. El backend vuelve a
 * mirarlo por los bytes; esto es para avisar antes de subir nada.
 */
export function tipoDeFoto(archivo: File): MimeFoto {
  const extension = archivo.name.toLowerCase().split(".").pop() ?? "";
  const porExtension = EXTENSIONES[extension];
  if (!porExtension || (archivo.type && archivo.type !== porExtension)) {
    throw new FotoInvalida("La foto tiene que ser JPG, JPEG o PNG.");
  }
  return porExtension;
}

/** Escala para que ningún lado pase de `max`, sin agrandar ni deformar. */
export function medidasAjustadas(
  ancho: number,
  alto: number,
  max: number = FOTO_MAX_PX,
): { ancho: number; alto: number } {
  const factor = Math.min(1, max / Math.max(ancho, alto));
  return {
    ancho: Math.max(1, Math.round(ancho * factor)),
    alto: Math.max(1, Math.round(alto * factor)),
  };
}

/**
 * Valida, redimensiona a 642 px como máximo y re-codifica. Devuelve el
 * archivo listo para PUT /api/perfil/foto, o lanza FotoInvalida.
 */
export async function prepararFoto(archivo: File): Promise<File> {
  const mime = tipoDeFoto(archivo);

  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo);
  } catch {
    throw new FotoInvalida("No se pudo leer la imagen. ¿Está dañada?");
  }

  const { ancho, alto } = medidasAjustadas(imagen.width, imagen.height);
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new FotoInvalida("Tu navegador no pudo procesar la imagen.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imagen, 0, 0, ancho, alto);
  imagen.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, mime === "image/jpeg" ? 0.9 : undefined),
  );
  if (!blob) throw new FotoInvalida("No se pudo procesar la imagen.");
  if (blob.size > FOTO_MAX_BYTES) {
    throw new FotoInvalida("La foto sigue pesando más de 2 MB. Prueba con otra.");
  }

  const base = archivo.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${base}.${mime === "image/png" ? "png" : "jpg"}`, { type: mime });
}

/**
 * URL local (blob:) de la foto propia. La foto se sirve con token, así que
 * no sirve un <img src="/api/..."> directo: se pide con apiFetch.
 * `version` (foto_version del backend) cambia al reemplazarla: es lo que
 * hace que se vuelva a pedir. null/undefined = sin foto.
 */
export function useFotoPerfil(version: string | null | undefined): string | null {
  // La URL se guarda junto a la versión que la produjo: así, sin foto (o
  // mientras llega la nueva) se devuelve null derivándolo, sin un setState
  // síncrono dentro del efecto.
  const [foto, setFoto] = useState<{ version: string; url: string } | null>(null);

  useEffect(() => {
    if (!version) return;
    let cancelado = false;
    let creada: string | null = null;
    apiFetch<Blob>(`/api/perfil/foto?v=${encodeURIComponent(version)}`, { respuesta: "blob" })
      .then((blob) => {
        if (cancelado) return;
        creada = URL.createObjectURL(blob);
        setFoto({ version, url: creada });
      })
      .catch(() => {
        // Sin foto disponible: se queda con las iniciales.
      });
    return () => {
      cancelado = true;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [version]);

  return version && foto?.version === version ? foto.url : null;
}

/** "María José" + "Pérez" -> "MP"; sin datos, la inicial del correo. */
export function iniciales(
  nombres: string | null | undefined,
  apellido: string | null | undefined,
  email: string | null | undefined,
): string {
  const a = nombres?.trim()?.[0];
  const b = apellido?.trim()?.[0];
  if (a || b) return `${a ?? ""}${b ?? ""}`.toUpperCase();
  return (email?.trim()?.[0] ?? "?").toUpperCase();
}
