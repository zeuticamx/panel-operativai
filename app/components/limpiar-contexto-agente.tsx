"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Eraser } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import {
  TEXTO_ABRIR_LIMPIAR_CONTEXTO,
  TEXTO_BOTON_CANCELAR,
  TEXTO_BOTON_LIMPIAR,
  TEXTO_CARGANDO_LIMPIEZA,
  TEXTO_CUERPO_LIMPIAR_CONTEXTO,
  TEXTO_ERROR_LIMPIAR_CONTEXTO,
  TITULO_LIMPIAR_CONTEXTO,
  formatearCorte,
} from "@/lib/contexto-conversacion";
import type { LimpiarContextoOut } from "@/lib/types";
import { Aviso, Boton } from "@/app/components/ui";

/**
 * «Limpiar contexto del agente» (spec 003). Solo el dueño ve el botón
 * (`puedeLimpiar` lo decide el backend); el indicador con la fecha del último
 * corte lo ve quien abra la conversación. Los mensajes no se borran: el
 * agente deja de leer los anteriores al corte.
 */
export function LimpiarContextoAgente({
  conversacionId,
  puedeLimpiar,
  limpiadoEn,
  onLimpiado,
}: {
  conversacionId: string;
  puedeLimpiar: boolean;
  limpiadoEn: string | null;
  onLimpiado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!puedeLimpiar && !limpiadoEn) return null;

  const cambiarAbierto = (v: boolean) => {
    if (enviando) return;
    setAbierto(v);
    if (!v) setError(null);
  };

  const limpiar = async () => {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await apiFetch<LimpiarContextoOut>(
        `/api/conversaciones/${encodeURIComponent(conversacionId)}/limpiar-contexto`,
        { method: "POST" },
      );
      setAbierto(false);
      onLimpiado();
    } catch (e) {
      setError(mensajeDeError(e, TEXTO_ERROR_LIMPIAR_CONTEXTO));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-bg-700 px-4 py-2">
      {limpiadoEn && (
        <p className="min-w-0 text-xs text-text-400">
          Contexto del agente limpiado el {formatearCorte(limpiadoEn)}
        </p>
      )}

      {puedeLimpiar && (
        <>
          <Boton variante="secundario" onClick={() => setAbierto(true)}>
            <Eraser size={13} aria-hidden />
            {TEXTO_ABRIR_LIMPIAR_CONTEXTO}
          </Boton>

          <Dialog.Root open={abierto} onOpenChange={cambiarAbierto}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
              <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
                <Dialog.Title className="text-sm font-medium text-text-100">
                  {TITULO_LIMPIAR_CONTEXTO}
                </Dialog.Title>
                <Dialog.Description className="mt-1.5 text-xs leading-relaxed break-words text-text-400">
                  {TEXTO_CUERPO_LIMPIAR_CONTEXTO}
                </Dialog.Description>

                {error && (
                  <div className="mt-3">
                    <Aviso tipo="error">{error}</Aviso>
                  </div>
                )}

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Dialog.Close asChild>
                    <Boton variante="secundario" disabled={enviando}>
                      {TEXTO_BOTON_CANCELAR}
                    </Boton>
                  </Dialog.Close>
                  <Boton variante="peligro" onClick={() => void limpiar()} disabled={enviando}>
                    {enviando ? TEXTO_CARGANDO_LIMPIEZA : TEXTO_BOTON_LIMPIAR}
                  </Boton>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      )}
    </div>
  );
}
