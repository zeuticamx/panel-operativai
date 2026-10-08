"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { useDatosEnVivo } from "@/lib/use-websocket-alertas";
import { DURACIONES_ESCRITURA, type SolicitudEscrituraOut } from "@/lib/types";
import { Boton, selectClass } from "./ui";
import { useUsuario } from "./usuario-context";

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Aviso persistente para el dueño cuando soporte pide permiso para editar su
 * cuenta (o ya lo tiene). Es la otra mitad del flujo del correo: se puede
 * responder desde acá o desde el enlace, lo que llegue primero.
 *
 * Solo para owner/superadmin y nunca dentro de una sesión de "ver como"
 * (el backend también lo exige: si no, soporte se aprobaría a sí mismo).
 */
export function AccesoSoporteDueno() {
  const { usuario } = useUsuario();
  const aplica =
    !!usuario &&
    !usuario.impersonado_por &&
    (usuario.role === "owner" || usuario.role === "superadmin");

  const lista = useApi<SolicitudEscrituraOut[]>(aplica ? "/api/acceso-soporte/solicitudes" : null, {
    refrescarCada: 30_000,
    alVolverAlFoco: true,
  });
  const { recargar } = lista;
  useDatosEnVivo(["acceso_soporte"], () => void recargar(true));

  const [duraciones, setDuraciones] = useState<Record<string, number>>({});
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!aplica) return null;
  const vivas = (lista.data ?? []).filter(
    (s) => s.estado === "pendiente" || s.estado === "aprobada",
  );
  if (vivas.length === 0 && !error) return null;

  const responder = async (id: string, accion: "aprobar" | "rechazar" | "revocar") => {
    setOcupada(id);
    setError(null);
    try {
      await apiFetch(`/api/acceso-soporte/${id}/${accion}`, {
        method: "POST",
        json: accion === "aprobar" ? { duracion_min: duraciones[id] ?? 30 } : undefined,
      });
      await recargar(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo registrar tu respuesta."));
    } finally {
      setOcupada(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-xs text-text-100">
      {vivas.map((s) => (
        <div key={s.id} role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <ShieldAlert size={14} className="shrink-0 text-warning" aria-hidden />
          {s.estado === "pendiente" ? (
            <>
              <span className="min-w-0 flex-1">
                <strong>{s.gerente_email}</strong> (soporte) pide permiso para <strong>editar</strong>{" "}
                tu cuenta, no solo verla. Motivo:{" "}
                <span className="text-text-400">{s.motivo}</span>
              </span>
              <label className="flex items-center gap-1 text-text-400">
                Duración
                <select
                  className={selectClass}
                  value={duraciones[s.id] ?? 30}
                  onChange={(e) =>
                    setDuraciones((d) => ({ ...d, [s.id]: Number(e.target.value) }))
                  }
                >
                  {DURACIONES_ESCRITURA.map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </label>
              <Boton
                variante="primario"
                className="px-2 py-1 text-xs"
                loading={ocupada === s.id}
                onClick={() => void responder(s.id, "aprobar")}
              >
                Aprobar
              </Boton>
              <Boton
                variante="peligro"
                className="px-2 py-1 text-xs"
                disabled={ocupada === s.id}
                onClick={() => void responder(s.id, "rechazar")}
              >
                Rechazar
              </Boton>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1">
                <strong>{s.gerente_email}</strong> (soporte) puede editar tu cuenta hasta las{" "}
                {s.concede_hasta ? horaCorta(s.concede_hasta) : "—"}.
              </span>
              <Boton
                variante="peligro"
                className="px-2 py-1 text-xs"
                loading={ocupada === s.id}
                onClick={() => void responder(s.id, "revocar")}
              >
                Revocar ahora
              </Boton>
            </>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="font-mono text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
