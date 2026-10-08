"use client";

import { useState } from "react";
import { UserCheck, UserMinus, UserX } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { etiquetaRol } from "@/lib/roles";
import { useApi } from "@/lib/use-api";
import type { AsignableOut, AsignacionConversacion } from "@/lib/types";
import { Aviso, Boton, selectClass } from "@/app/components/ui";
import { Badge } from "@/app/components/badge";

/**
 * Quién tiene la conversación, y cómo cambiarlo.
 *
 *   dueño / administrador   la asigna, reasigna o quita a cualquiera
 *   quien la tiene          puede soltarla
 *   el resto                solo ve quién la tiene
 *
 * El backend vuelve a decidir cada acción (routers/conversaciones.py): esto
 * solo evita ofrecer un botón que va a recibir 403.
 */
export function PanelAsignacion({
  conversacionId,
  asignacion,
  status,
  esGerencia,
  miId,
  onCambio,
}: {
  conversacionId: string;
  asignacion: AsignacionConversacion;
  status: string;
  esGerencia: boolean;
  miId: string | null;
  onCambio: () => void;
}) {
  const asignables = useApi<AsignableOut[]>(esGerencia ? "/api/conversaciones/asignables" : null);
  const [elegido, setElegido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tiene = asignacion.asignado_a;
  const esMia = tiene !== null && tiene === miId;
  const url = `/api/conversaciones/${encodeURIComponent(conversacionId)}/asignacion`;

  // Una conversación con la IA y sin dueño no tiene nada que mostrar a quien
  // no puede asignarla.
  if (!esGerencia && !tiene && status !== "transferred") return null;

  const ejecutar = async (metodo: "PUT" | "DELETE", json?: object) => {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await apiFetch(url, { method: metodo, json });
      setElegido("");
      onCambio();
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo cambiar la asignación."));
    } finally {
      setGuardando(false);
    }
  };

  const opciones = (asignables.data ?? []).filter((a) => a.id !== tiene);

  return (
    <div
      data-tour="conversacion.asignacion"
      className="flex flex-col gap-2 border-b border-bg-700 bg-bg-900 px-4 py-2"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {tiene ? (
          <>
            <UserCheck size={13} aria-hidden className="text-text-400" />
            <span className="text-text-400">Asignada a</span>
            <span className="font-medium text-text-100">{esMia ? "ti" : asignacion.asignado_nombre}</span>
            {asignacion.asignado_rol && <Badge>{etiquetaRol(asignacion.asignado_rol)}</Badge>}
            {asignacion.asignado_origen === "agente" && (
              <Badge tone="info" title="La asignó el agente de IA al transferirla">
                por el agente
              </Badge>
            )}
          </>
        ) : (
          <>
            <UserX size={13} aria-hidden className="text-warning" />
            <span className="text-warning">Sin asignar</span>
          </>
        )}

        {esMia && !esGerencia && (
          <Boton variante="fantasma" onClick={() => void ejecutar("DELETE")} loading={guardando} className="min-h-8">
            <UserMinus size={13} aria-hidden />
            Soltar
          </Boton>
        )}

        {esGerencia && (
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <label htmlFor="asignar-a" className="sr-only">
              Asignar a
            </label>
            <select
              id="asignar-a"
              value={elegido}
              onChange={(e) => setElegido(e.target.value)}
              disabled={guardando || asignables.loading}
              className={`${selectClass} w-auto py-1.5 text-xs`}
            >
              <option value="">{tiene ? "Reasignar a…" : "Asignar a…"}</option>
              {opciones.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} · {etiquetaRol(a.role)}
                </option>
              ))}
            </select>
            <Boton
              variante="secundario"
              onClick={() => void ejecutar("PUT", { asignado_a: elegido })}
              disabled={!elegido}
              loading={guardando}
              className="min-h-8"
            >
              {tiene ? "Reasignar" : "Asignar"}
            </Boton>
            {tiene && (
              <Boton
                variante="fantasma"
                onClick={() => void ejecutar("DELETE")}
                disabled={guardando}
                className="min-h-8"
              >
                <UserMinus size={13} aria-hidden />
                Quitar
              </Boton>
            )}
          </span>
        )}
      </div>

      {esGerencia && asignacion.asignacion_nota && <Aviso tipo="info">{asignacion.asignacion_nota}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
    </div>
  );
}
