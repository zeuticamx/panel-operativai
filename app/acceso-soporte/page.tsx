"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { DURACIONES_ESCRITURA, type InfoEnlaceEscrituraOut } from "@/lib/types";
import { AuthShell } from "@/app/components/auth-shell";
import { Aviso, Boton, Cargando, selectClass } from "@/app/components/ui";

/**
 * Responder, desde el enlace del correo, la solicitud de soporte para editar
 * la cuenta del negocio (routers/acceso_soporte.py, /enlace/*).
 *
 * El token llega en el fragmento (#t=...) y no en la query: el fragmento no
 * viaja al servidor, así que no queda en logs de acceso. Al backend se manda
 * en el body. Abrir el enlace NO aprueba nada: hace falta pulsar el botón, de
 * modo que un escáner de correo que solo visita la URL no puede autorizar.
 */
function leerToken(): string | null {
  const m = /[#&]t=([^&]+)/.exec(window.location.hash);
  return m ? decodeURIComponent(m[1]) : null;
}

function suscribirHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

const ESTADO_FINAL: Record<string, string> = {
  aprobada: "Aprobaste la edición. Soporte ya puede editar tu cuenta durante el tiempo elegido.",
  rechazada: "Rechazaste la solicitud. Soporte sigue sin poder editar tu cuenta.",
  vencida: "La solicitud venció. Si aún la necesitan, soporte tendrá que pedirla de nuevo.",
  revocada: "Esta autorización ya fue retirada.",
  cancelada: "Soporte retiró la solicitud.",
  terminada: "El tiempo de edición autorizado ya terminó.",
};

export default function AccesoSoportePage() {
  // undefined en servidor e hidratación; null si el enlace no trae token.
  const token = useSyncExternalStore(suscribirHash, leerToken, () => undefined);

  const [info, setInfo] = useState<InfoEnlaceEscrituraOut | null>(null);
  const [errorEnlace, setErrorEnlace] = useState<string | null>(null);
  const [duracion, setDuracion] = useState<number>(30);
  const [enviando, setEnviando] = useState<"aprobar" | "rechazar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    apiFetch<InfoEnlaceEscrituraOut>("/api/acceso-soporte/enlace/leer", {
      method: "POST",
      json: { token },
      auth: false,
    })
      .then((r) => {
        if (vigente) setInfo(r);
      })
      .catch((e) => {
        if (vigente) setErrorEnlace(mensajeDeError(e, "Este enlace no es válido."));
      });
    return () => {
      vigente = false;
    };
  }, [token]);

  const responder = async (accion: "aprobar" | "rechazar") => {
    if (!token) return;
    setEnviando(accion);
    setError(null);
    try {
      const r = await apiFetch<InfoEnlaceEscrituraOut>(`/api/acceso-soporte/enlace/${accion}`, {
        method: "POST",
        json: accion === "aprobar" ? { token, duracion_min: duracion } : { token },
        auth: false,
      });
      setInfo(r);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo registrar tu respuesta."));
    } finally {
      setEnviando(null);
    }
  };

  const pie = (
    <Link href="/login" className="text-text-400 hover:text-text-100">
      Ir a mi portal
    </Link>
  );

  if (token === undefined || (token && !info && !errorEnlace)) {
    return (
      <AuthShell titulo="Permiso de soporte" sub="Revisando tu enlace…" pie={pie}>
        <Cargando />
      </AuthShell>
    );
  }

  if (!token || errorEnlace || !info) {
    return (
      <AuthShell titulo="Enlace no válido" sub="No pudimos usar este enlace" pie={pie}>
        <Aviso tipo="error">{errorEnlace ?? "Falta el código del enlace. Abre el correo de nuevo."}</Aviso>
      </AuthShell>
    );
  }

  const pendiente = info.estado === "pendiente";

  return (
    <AuthShell
      titulo="Permiso de soporte"
      sub={`Cuenta de ${info.tenant_nombre}`}
      pie={pie}
    >
      <div className="space-y-4">
        <p className="text-sm text-text-100">
          <strong>{info.gerente_email}</strong> (soporte de OperativAI) pide permiso para{" "}
          <strong>editar</strong> tu cuenta, no solo verla.
        </p>
        <p className="rounded-md border border-bg-700 px-3 py-2 font-mono text-xs text-text-400">
          Motivo: {info.motivo}
        </p>

        {pendiente ? (
          <>
            <label className="block text-xs text-text-400">
              Duración de la edición
              <select
                className={selectClass}
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
              >
                {DURACIONES_ESCRITURA.map((m) => (
                  <option key={m} value={m}>
                    {m} minutos
                  </option>
                ))}
              </select>
            </label>
            <Aviso tipo="info">
              No se pueden tocar contraseñas, equipo, pagos ni credenciales de canales, ni aun con
              tu permiso. Puedes retirarlo cuando quieras desde tu portal.
            </Aviso>
            {error && <Aviso tipo="error">{error}</Aviso>}
            <div className="flex flex-wrap gap-2">
              <Boton
                variante="primario"
                loading={enviando === "aprobar"}
                disabled={enviando !== null}
                onClick={() => void responder("aprobar")}
              >
                Aprobar edición
              </Boton>
              <Boton
                variante="peligro"
                loading={enviando === "rechazar"}
                disabled={enviando !== null}
                onClick={() => void responder("rechazar")}
              >
                Rechazar
              </Boton>
            </div>
          </>
        ) : (
          <Aviso tipo={info.estado === "aprobada" ? "exito" : "info"}>
            {ESTADO_FINAL[info.estado] ?? "Esta solicitud ya fue atendida."}
          </Aviso>
        )}
      </div>
    </AuthShell>
  );
}
