"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/auth";
import { infoEstadoReserva } from "@/lib/formato";
import {
  TEXTO_HAY_MAS_CITAS,
  formatoFechaHoraNegocio,
  mostrarAccionHistorialCitas,
  textoHistorialVacio,
} from "@/lib/historial-citas";
import type { HistorialCitasOut } from "@/lib/types";
import { Badge } from "@/app/components/badge";
import { Boton } from "@/app/components/ui";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "oculto" }
  | { tipo: "listo"; datos: HistorialCitasOut };

/** Respuestas con las que el backend dice "esto no aplica aquí" (plan, calendario, rol, no visible). */
const ESTADOS_OCULTAR = [402, 409, 403, 404];

/**
 * Últimas citas pasadas o canceladas del cliente de la conversación.
 *
 * Consulta al montar y se oculta ante 402/409/403/404: el frontend no conoce
 * el plan ni el calendario, el backend decide. Un fallo (o la carga) solo
 * afecta a este panel, nunca al hilo ni al composer. Es el único lugar donde
 * se ofrece el historial (no hay entrada desde el detalle de una cita).
 */
export function HistorialCitasCliente({
  conversacionId,
  canal,
  rol,
}: {
  conversacionId: string;
  canal: string | null | undefined;
  rol: string | null | undefined;
}) {
  const aplica = mostrarAccionHistorialCitas({ rol, canal });
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  // Cada reintento cambia `intento` y relanza la consulta del efecto.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!aplica) return;
    // Descarta la respuesta si cambia la conversación o se desmonta el panel.
    let vigente = true;
    const consultar = async () => {
      try {
        const datos = await apiFetch<HistorialCitasOut>(
          `/api/conversaciones/${encodeURIComponent(conversacionId)}/historial-citas`,
        );
        if (vigente) setEstado({ tipo: "listo", datos });
      } catch (e) {
        if (!vigente) return;
        const sinAplicar = e instanceof ApiError && ESTADOS_OCULTAR.includes(e.status);
        setEstado({ tipo: sinAplicar ? "oculto" : "error" });
      }
    };
    void consultar();
    return () => {
      vigente = false;
    };
  }, [aplica, conversacionId, intento]);

  const reintentar = () => {
    setEstado({ tipo: "cargando" });
    setIntento((n) => n + 1);
  };

  if (!aplica || estado.tipo === "oculto") return null;

  return (
    <section
      data-tour="conversacion.historial-citas"
      aria-label="Historial de citas"
      className="border-b border-bg-700 bg-bg-900 px-4 py-2"
    >
      <div className="flex items-center gap-2 text-xs">
        <History size={13} aria-hidden className="text-text-400" />
        <h2 className="font-medium text-text-100">Historial de citas</h2>
      </div>

      {estado.tipo === "cargando" && (
        <p className="mt-2 font-mono text-xs text-text-600">cargando historial…</p>
      )}

      {estado.tipo === "error" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-400">
          <span role="alert">No se pudo cargar el historial.</span>
          <Boton variante="secundario" onClick={reintentar} className="min-h-8 px-3">
            Reintentar
          </Boton>
        </div>
      )}

      {estado.tipo === "listo" &&
        (estado.datos.citas.length === 0 ? (
          <p className="mt-2 text-xs text-text-400">{textoHistorialVacio(rol)}</p>
        ) : (
          <>
            <ul className="mt-2 max-h-48 divide-y divide-bg-700 overflow-y-auto">
              {estado.datos.citas.map((c, i) => {
                const info = infoEstadoReserva(c.estado);
                return (
                  <li
                    key={`${c.fecha_hora_inicio}-${i}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-xs"
                  >
                    <span className="font-mono text-text-400">
                      {formatoFechaHoraNegocio(c.fecha_hora_inicio)}
                    </span>
                    <span className="min-w-0 break-words font-medium text-text-100">
                      {c.servicio_nombre}
                    </span>
                    <span className="min-w-0 break-words text-text-400">{c.proveedor_nombre}</span>
                    <Badge tone={info.tone}>{info.label}</Badge>
                    {c.cancelacion_tardia && <Badge tone="warning">Cancelación tardía</Badge>}
                  </li>
                );
              })}
            </ul>
            {estado.datos.hay_mas && (
              <p className="mt-1 text-[11px] text-text-600">{TEXTO_HAY_MAS_CITAS}</p>
            )}
          </>
        ))}
    </section>
  );
}
