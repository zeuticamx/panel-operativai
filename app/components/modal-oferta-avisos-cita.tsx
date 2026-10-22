"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { apiFetch } from "@/lib/auth";
import {
  CLAVE_OFERTA_AVISOS_MOSTRADA,
  TEXTO_ACEPTADA,
  debeMostrarOfertaAvisos,
  mensajeErrorOferta,
} from "@/lib/avisos-cita";
import type { ConfigAvisos, OfertaAvisosIn } from "@/lib/types";
import { ofertaAvisosYaMostrada, publicarOfertaAvisosAbierta } from "@/lib/oferta-avisos-estado";
import { useApi } from "@/lib/use-api";
import { Aviso, Boton } from "./ui";
import { useUsuario } from "./usuario-context";

function marcarMostrada(): void {
  try {
    sessionStorage.setItem(CLAVE_OFERTA_AVISOS_MOSTRADA, "1");
  } catch {
    // Sin storage (modo privado estricto): a lo sumo se vuelve a mostrar.
  }
}

const ETIQUETA_TIPO: Record<string, string> = {
  recordatorio: "Recordatorio de cita",
  cancelacion: "Cancelación de cita",
};

/**
 * Oferta de los avisos de cita del negocio (spec 007, RF-1/RF-4): se abre una
 * vez por pestaña cuando /auth/yo trae `oferta_avisos_cita_pendiente`.
 * "Crear plantillas" las crea en la cuenta de WhatsApp del negocio y "No por
 * ahora" las deja desactivadas.
 *
 * Escape y el clic fuera NO cierran: rechazar es una decisión que se guarda en
 * el backend y no debe tomarse por accidente; se cierra con los botones.
 */
export function ModalOfertaAvisosCita() {
  const { usuario } = useUsuario();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState<OfertaAvisosIn["accion"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Texto de confirmación tras decidir; mientras exista, el modal ya no ofrece decidir.
  const [confirmacion, setConfirmacion] = useState<string | null>(null);

  useEffect(() => {
    if (!debeMostrarOfertaAvisos(usuario, ofertaAvisosYaMostrada())) return;
    marcarMostrada();
    // Se publica en el mismo paso que la clave, sin hueco en el que el recorrido crea que ya se liberó.
    publicarOfertaAvisosAbierta(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se abre una sola vez al llegar /auth/yo
    setAbierto(true);
  }, [usuario]);

  // Al cerrarse el modal, o al desmontarse abierto (p. ej. cierre de sesión), el recorrido se libera.
  useEffect(() => {
    if (!abierto) return;
    publicarOfertaAvisosAbierta(true);
    return () => publicarOfertaAvisosAbierta(false);
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
  }

  const config = useApi<ConfigAvisos>(abierto ? "/api/avisos-cita/config" : null);

  async function decidir(accion: OfertaAvisosIn["accion"]) {
    setEnviando(accion);
    setError(null);
    try {
      const res = await apiFetch<ConfigAvisos>("/api/avisos-cita/oferta", {
        method: "POST",
        json: { accion } satisfies OfertaAvisosIn,
      });
      setConfirmacion(res.mensaje ?? (accion === "aceptar" ? TEXTO_ACEPTADA : "Listo."));
    } catch (e) {
      setError(mensajeErrorOferta(e));
    } finally {
      setEnviando(null);
    }
  }

  const ocupado = enviando !== null;

  return (
    <Dialog.Root open={abierto}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl"
        >
          <Dialog.Title className="text-sm font-medium text-text-100">
            Avisos automáticos de tus citas
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs leading-relaxed text-text-400">
            Podemos avisar por WhatsApp a tus clientes cuando se acerca su cita y cuando se cancela,
            con plantillas propias de tu negocio enviadas desde tu número principal. Meta debe aprobarlas
            antes de usarse.
          </Dialog.Description>

          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
            {confirmacion ? (
              <Aviso tipo="exito">{confirmacion}</Aviso>
            ) : (
              <>
                {config.loading && !config.data && (
                  <p className="font-mono text-xs text-text-600">cargando plantillas…</p>
                )}
                {config.error && !config.data && <Aviso tipo="error">{config.error}</Aviso>}
                {config.data?.funciones.map((f) => (
                  <div key={f.tipo} className="rounded-md border border-bg-700 bg-bg-950 p-3">
                    <p className="text-xs font-medium text-text-100">{ETIQUETA_TIPO[f.tipo] ?? f.tipo}</p>
                    <p className="mt-0.5 font-mono text-[10px] break-all text-text-600">{f.nombre}</p>
                    <p className="mt-2 text-xs leading-relaxed whitespace-pre-line text-text-400">{f.texto}</p>
                  </div>
                ))}
                {error && <Aviso tipo="error">{error}</Aviso>}
              </>
            )}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {confirmacion ? (
              <Boton variante="primario" onClick={cerrar}>
                Entendido
              </Boton>
            ) : (
              <>
                <Boton variante="secundario" disabled={ocupado} loading={enviando === "rechazar"} onClick={() => decidir("rechazar")}>
                  No por ahora
                </Boton>
                <Boton
                  variante="primario"
                  disabled={ocupado || !config.data}
                  loading={enviando === "aceptar"}
                  onClick={() => decidir("aceptar")}
                >
                  Crear plantillas
                </Boton>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
