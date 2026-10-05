"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import type { AdjuntoOut } from "@/lib/types";
import { descargarAdjunto, esImagen, formatoBytes, useAdjuntoBlob } from "@/lib/adjuntos";

/**
 * Un archivo dentro de la burbuja: miniatura si es imagen, tarjeta con
 * descarga si es documento. `url` es la ruta autenticada del adjunto.
 */
export function AdjuntoMensaje({ adjunto, url }: { adjunto: AdjuntoOut; url: string }) {
  const imagen = esImagen(adjunto.mime);
  const { src, error } = useAdjuntoBlob(imagen ? url : null);
  const [fallo, setFallo] = useState(false);

  if (imagen) {
    if (error) {
      return <span className="text-xs text-text-600">No se pudo cargar la imagen.</span>;
    }
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element -- object URL del Blob autenticado
      <img
        src={src}
        alt={adjunto.nombre}
        className="max-h-64 max-w-full rounded border border-bg-700 object-contain"
      />
    ) : (
      <span className="font-mono text-xs text-text-600">cargando imagen…</span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setFallo(false);
        descargarAdjunto(url, adjunto.nombre).catch(() => setFallo(true));
      }}
      title="Descargar"
      className="flex items-center gap-2 rounded border border-bg-700 bg-bg-900 px-2.5 py-2 text-left hover:bg-hover"
    >
      <FileText size={16} aria-hidden className="shrink-0 text-text-400" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-text-100">{adjunto.nombre}</span>
        <span className="font-mono text-[11px] text-text-600">
          {fallo ? "No se pudo descargar" : formatoBytes(adjunto.bytes)}
        </span>
      </span>
    </button>
  );
}
