"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ImagePlus, LifeBuoy, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { capturarContexto } from "@/lib/contexto-reporte";
import type { ReporteCreadoOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Aviso, Boton, Campo, inputClass } from "./ui";

// Mismos rangos que services/incidencias.py: el backend es el que manda.
const RESUMEN_MIN = 5;
const RESUMEN_MAX = 120;
const DESCRIPCION_MIN = 10;
const DESCRIPCION_MAX = 4000;
const ADJUNTO_MAX_BYTES = 5 * 1024 * 1024;

/** Imagen por extensión y tipo declarado; el backend la vuelve a mirar por los bytes. */
function errorDeAdjunto(archivo: File): string | null {
  const extension = archivo.name.toLowerCase().split(".").pop() ?? "";
  const tipos: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
  const esperado = tipos[extension];
  if (!esperado || (archivo.type && archivo.type !== esperado)) {
    return "El adjunto tiene que ser una imagen PNG o JPG.";
  }
  if (archivo.size > ADJUNTO_MAX_BYTES) {
    return `La imagen pesa más de ${ADJUNTO_MAX_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}

/**
 * Botón "Reportar un problema" y su formulario en un modal.
 *
 * El envío es un fetch, no una navegación: la persona sigue en la pantalla
 * donde estaba, con su estado intacto. Si falla, el modal se queda abierto
 * con lo que escribió; si sale bien, se cierra y un aviso lo confirma.
 *
 * El contexto técnico (ruta, navegador, SO, resolución) se lee al enviar, no
 * al abrir: así es el de ese momento y no hay que pedírselo a nadie.
 */
export function ReportarProblema({ expandido = true }: { expandido?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [resumen, setResumen] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);

  const resumenLimpio = resumen.trim();
  const descripcionLimpia = descripcion.trim();

  const errorResumen =
    tocado && resumenLimpio.length < RESUMEN_MIN
      ? `Cuéntanos en breve qué pasó (mínimo ${RESUMEN_MIN} caracteres)`
      : null;
  const errorDescripcion =
    tocado && descripcionLimpia.length < DESCRIPCION_MIN
      ? `Describe el problema con un poco más de detalle (mínimo ${DESCRIPCION_MIN} caracteres)`
      : null;

  const reiniciar = () => {
    setResumen("");
    setDescripcion("");
    setAdjunto(null);
    setErrorAdjunto(null);
    setTocado(false);
    setError(null);
    if (inputArchivo.current) inputArchivo.current.value = "";
  };

  // Mientras se envía no se puede cerrar: perdería el resultado del envío.
  const cambiarApertura = (valor: boolean) => {
    if (enviando) return;
    setAbierto(valor);
    // Al cerrar sin enviar se conserva el borrador: abrirlo de nuevo no
    // debería costar volver a escribir.
    if (valor) setError(null);
  };

  const elegirArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0] ?? null;
    setError(null);
    if (!archivo) {
      setAdjunto(null);
      setErrorAdjunto(null);
      return;
    }
    const problema = errorDeAdjunto(archivo);
    setErrorAdjunto(problema);
    setAdjunto(problema ? null : archivo);
    if (problema && inputArchivo.current) inputArchivo.current.value = "";
  };

  const quitarArchivo = () => {
    setAdjunto(null);
    setErrorAdjunto(null);
    if (inputArchivo.current) inputArchivo.current.value = "";
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setTocado(true);
    if (enviando) return;
    if (resumenLimpio.length < RESUMEN_MIN || descripcionLimpia.length < DESCRIPCION_MIN) return;

    setEnviando(true);
    setError(null);
    try {
      const datos = new FormData();
      datos.append("resumen", resumenLimpio);
      datos.append("descripcion", descripcionLimpia);
      datos.append("contexto", JSON.stringify(capturarContexto()));
      if (adjunto) datos.append("adjunto", adjunto);

      await apiFetch<ReporteCreadoOut>("/api/incidencias", { method: "POST", body: datos });

      setAbierto(false);
      reiniciar();
      toast.success("Reporte recibido", {
        description: "Gracias por avisarnos. Lo revisaremos lo antes posible.",
      });
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo enviar el reporte. Inténtalo de nuevo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => cambiarApertura(true)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm text-text-400 hover:bg-bg-800 hover:text-text-100"
        aria-label="Reportar un problema"
        title={expandido ? undefined : "Reportar un problema"}
      >
        <LifeBuoy size={16} className="shrink-0" aria-hidden />
        {expandido && <span>Reportar un problema</span>}
      </button>

      <Dialog.Root open={abierto} onOpenChange={cambiarApertura}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl"
            aria-describedby="reporte-descripcion"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-sm font-medium text-text-100">
                  Reportar un problema
                </Dialog.Title>
                <Dialog.Description
                  id="reporte-descripcion"
                  className="mt-1 text-xs text-text-400"
                >
                  Cuéntanos qué pasó. Junto con tu reporte enviamos la pantalla en la que estás y
                  datos de tu navegador para poder reproducirlo.
                </Dialog.Description>
              </div>
              <Dialog.Close
                disabled={enviando}
                className="cursor-pointer rounded p-1 text-text-400 hover:bg-bg-800 hover:text-text-100 disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X size={16} aria-hidden />
              </Dialog.Close>
            </div>

            <form onSubmit={enviar} className="mt-5 flex flex-col gap-4" noValidate>
              <Campo id="reporte-resumen" label="Resumen" error={errorResumen}>
                <input
                  id="reporte-resumen"
                  type="text"
                  value={resumen}
                  onChange={(e) => setResumen(e.target.value)}
                  disabled={enviando}
                  maxLength={RESUMEN_MAX}
                  placeholder="Ej. No carga el calendario"
                  autoFocus
                  required
                  className={inputClass}
                />
              </Campo>

              <Campo
                id="reporte-descripcion-texto"
                label="Descripción"
                hint={`${descripcion.length}/${DESCRIPCION_MAX}`}
                error={errorDescripcion}
              >
                <textarea
                  id="reporte-descripcion-texto"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  disabled={enviando}
                  maxLength={DESCRIPCION_MAX}
                  rows={5}
                  placeholder="¿Qué estabas haciendo? ¿Qué esperabas que pasara y qué pasó?"
                  required
                  className={cn(inputClass, "resize-y")}
                />
              </Campo>

              <Campo
                id="reporte-adjunto"
                label="Captura de pantalla"
                hint="Opcional · PNG o JPG, hasta 5 MB"
                error={errorAdjunto}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={inputArchivo}
                    id="reporte-adjunto"
                    type="file"
                    accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                    onChange={elegirArchivo}
                    disabled={enviando}
                    className="sr-only"
                  />
                  <Boton
                    variante="secundario"
                    onClick={() => inputArchivo.current?.click()}
                    disabled={enviando}
                    className="min-h-8"
                  >
                    <ImagePlus size={13} aria-hidden />
                    {adjunto ? "Cambiar imagen" : "Adjuntar imagen"}
                  </Boton>
                  {adjunto && (
                    <span className="flex min-w-0 items-center gap-1 text-xs text-text-400">
                      <span className="truncate">{adjunto.name}</span>
                      <button
                        type="button"
                        onClick={quitarArchivo}
                        disabled={enviando}
                        className="cursor-pointer rounded p-0.5 hover:bg-bg-800 hover:text-text-100"
                        aria-label="Quitar imagen"
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </span>
                  )}
                </div>
              </Campo>

              {error && <Aviso tipo="error">{error}</Aviso>}

              <div className="flex justify-end gap-2">
                <Boton variante="secundario" onClick={() => cambiarApertura(false)} disabled={enviando}>
                  Cancelar
                </Boton>
                <Boton type="submit" variante="primario" loading={enviando}>
                  {enviando ? "Enviando…" : "Enviar reporte"}
                </Boton>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
