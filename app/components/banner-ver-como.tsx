"use client";

import { useEffect, useState } from "react";
import { Eye, LogOut, Pencil } from "lucide-react";
import { apiFetch, mensajeDeError, terminarVerComo } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { useDatosEnVivo } from "@/lib/use-websocket-alertas";
import type { SolicitudEscrituraOut } from "@/lib/types";
import { Boton } from "./ui";
import { useUsuario } from "./usuario-context";

const MOTIVO_MIN = 5;

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Aviso permanente mientras alguien de plataforma ve el portal como un
 * negocio. No se puede cerrar: es lo único que distingue esta sesión de la
 * del dueño, y olvidarse de en qué portal está uno es exactamente el
 * error que tiene que evitar.
 *
 * Por defecto es solo lectura. Desde acá soporte puede pedirle permiso de
 * edición al dueño (routers/acceso_soporte.py); mientras él no lo apruebe,
 * el backend sigue rechazando toda escritura.
 *
 * Al salir se recarga la página entera en vez de navegar: todo lo que se
 * cargó con la identidad del negocio (usuario, alertas, socket) tiene que
 * volver a pedirse con la del gerente.
 */
export function BannerVerComo() {
  const { usuario } = useUsuario();
  const expira = usuario?.impersonacion_expira ?? null;
  const impersonando = Boolean(usuario?.impersonado_por);
  const [ahora, setAhora] = useState(() => Date.now());

  // Los hooks van antes del `return null`: la ruta es null mientras no es
  // una sesión de "ver como", así que no pide nada fuera de ella.
  const solicitud = useApi<SolicitudEscrituraOut | null>(
    impersonando ? "/api/acceso-soporte/estado" : null,
    { refrescarCada: 30_000, alVolverAlFoco: true },
  );
  const { recargar } = solicitud;
  useDatosEnVivo(["acceso_soporte"], () => void recargar(true));

  const [pidiendo, setPidiendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expira) return;
    const id = setInterval(() => setAhora(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [expira]);

  const minutos = expira
    ? Math.max(0, Math.ceil((new Date(expira).getTime() - ahora) / 60_000))
    : 0;

  // Vencido: se sale solo. Esperar al próximo 401 dejaría la pantalla
  // mostrando datos viejos como si la sesión siguiera viva.
  useEffect(() => {
    if (expira && minutos === 0) window.location.replace(terminarVerComo());
  }, [expira, minutos]);

  if (!usuario?.impersonado_por) return null;

  const salir = () => window.location.replace(terminarVerComo());

  const actual = solicitud.data;
  const editando = actual?.estado === "aprobada" && actual.concede_hasta !== null;
  const esperando = actual?.estado === "pendiente";

  const llamar = async (ruta: string, json?: object) => {
    setEnviando(true);
    setError(null);
    try {
      await apiFetch(`/api/acceso-soporte/${ruta}`, { method: "POST", json });
      setPidiendo(false);
      setMotivo("");
      await recargar(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo completar la acción."));
    } finally {
      setEnviando(false);
    }
  };

  const textoModo = editando
    ? `edición autorizada hasta ${horaCorta(actual!.concede_hasta!)}`
    : esperando
      ? "solo lectura · esperando la autorización del dueño"
      : "solo lectura";

  return (
    <div
      role="status"
      className="flex flex-col gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-xs text-text-100"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {editando ? (
          <Pencil size={14} className="shrink-0 text-danger" aria-hidden />
        ) : (
          <Eye size={14} className="shrink-0 text-warning" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          Viendo como <strong>{usuario.nombre_negocio ?? "este negocio"}</strong>{" "}
          <span className="font-mono text-text-400">({usuario.email})</span> · {textoModo} ·{" "}
          <span className="font-mono text-text-400">
            {minutos} min restantes · abierto por {usuario.impersonado_por}
          </span>
        </span>
        {editando && (
          <Boton
            variante="secundario"
            className="px-2 py-1 text-xs"
            loading={enviando}
            onClick={() => void llamar("cancelar")}
          >
            Soltar edición
          </Boton>
        )}
        {esperando && (
          <Boton
            variante="secundario"
            className="px-2 py-1 text-xs"
            loading={enviando}
            onClick={() => void llamar("cancelar")}
          >
            Cancelar solicitud
          </Boton>
        )}
        {!editando && !esperando && !pidiendo && (
          <Boton
            variante="secundario"
            className="px-2 py-1 text-xs"
            onClick={() => setPidiendo(true)}
          >
            <Pencil size={12} aria-hidden />
            Pedir permiso de edición
          </Boton>
        )}
        <button
          type="button"
          onClick={salir}
          className="flex cursor-pointer items-center gap-1.5 rounded border border-warning/50 px-2 py-1 font-medium hover:bg-warning/20"
        >
          <LogOut size={12} aria-hidden />
          Volver a plataforma
        </button>
      </div>

      {!editando && !esperando && actual && actual.estado !== "cancelada" && (
        <p className="font-mono text-[11px] text-text-400">
          Última solicitud: {actual.estado}
          {actual.estado === "terminada" ? " (el tiempo autorizado terminó)" : ""}.
        </p>
      )}

      {pidiendo && (
        <form
          className="flex flex-wrap items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void llamar("solicitar", { motivo: motivo.trim() });
          }}
        >
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Qué necesitas corregir y por qué (lo verá el dueño)"
            aria-label="Motivo de la solicitud de edición"
            className="min-w-0 flex-1 rounded border border-bg-700 bg-bg-900 px-2 py-1 text-xs text-text-100"
          />
          <Boton
            type="submit"
            variante="primario"
            className="px-2 py-1 text-xs"
            loading={enviando}
            disabled={motivo.trim().length < MOTIVO_MIN}
          >
            Enviar al dueño
          </Boton>
          <Boton variante="fantasma" className="px-2 py-1 text-xs" onClick={() => setPidiendo(false)}>
            Cancelar
          </Boton>
        </form>
      )}

      {error && (
        <p role="alert" className="font-mono text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
