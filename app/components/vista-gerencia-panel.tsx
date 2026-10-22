"use client";

import { useState } from "react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { VistaGerenciaOut } from "@/lib/types";
import { Aviso, Boton, ConfirmDialog } from "./ui";
import { useUsuario } from "./usuario-context";

/**
 * Acceso del equipo de OperativAI a las conversaciones del número de WhatsApp de este
 * negocio. Solo aparece en el negocio dueño de ese número (`aplica`) y solo para
 * owner/superadmin con sesión propia; el backend repite las dos comprobaciones.
 */
export function VistaGerenciaPanel() {
  const { usuario } = useUsuario();
  const visible =
    !!usuario &&
    !usuario.impersonado_por &&
    (usuario.role === "owner" || usuario.role === "superadmin");
  const estado = useApi<VistaGerenciaOut>(visible ? "/api/vista-gerencia" : null);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible || !estado.data?.aplica) return null;
  const revocada = estado.data.revocada;

  async function cambiar(accion: "revocar" | "restablecer") {
    setOcupado(true);
    setError(null);
    try {
      await apiFetch<VistaGerenciaOut>(`/api/vista-gerencia/${accion}`, { method: "POST" });
      setConfirmar(false);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo guardar tu decisión."));
    } finally {
      await estado.recargar(true);
      setOcupado(false);
    }
  }

  return (
    <section
      aria-labelledby="vista-gerencia-titulo"
      className="rounded-md border border-bg-700 bg-bg-900 p-4"
    >
      <h2 id="vista-gerencia-titulo" className="text-sm font-medium text-text-100">
        Acceso del equipo de OperativAI
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-text-400">
        {revocada
          ? "Revocaste el acceso: el equipo de plataforma ya no puede ver ni responder las conversaciones de tu negocio."
          : "El equipo de plataforma puede ver y responder las conversaciones de tu número de WhatsApp para dar soporte."}
      </p>
      {error && (
        <Aviso tipo="error" className="mt-3">
          {error}
        </Aviso>
      )}
      <div className="mt-3">
        {revocada ? (
          <Boton variante="secundario" disabled={ocupado} onClick={() => void cambiar("restablecer")}>
            Restablecer acceso
          </Boton>
        ) : (
          <Boton variante="peligro" disabled={ocupado} onClick={() => setConfirmar(true)}>
            Revocar acceso
          </Boton>
        )}
      </div>
      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        titulo="¿Revocar el acceso del equipo?"
        descripcion="Dejarán de ver las conversaciones de tu negocio y de poder responderlas. Puedes restablecerlo cuando quieras."
        confirmar="Revocar"
        peligro
        loading={ocupado}
        onConfirm={() => void cambiar("revocar")}
      />
    </section>
  );
}
