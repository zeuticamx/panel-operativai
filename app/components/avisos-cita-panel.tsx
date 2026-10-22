"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/auth";
import {
  avisoDecisionPendiente,
  cuerpoPatchAviso,
  mensajeErrorOferta,
  motivoVisible,
  puedeActivarAviso,
  puedeEditarAvisos,
  puedeVerPanelAvisos,
} from "@/lib/avisos-cita";
import type { ConfigAvisos, ConfigAvisosPatchIn, FuncionAviso, TipoAviso } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { EstadoPlantillaBadge } from "./status";
import { Aviso, Interruptor } from "./ui";
import { useUsuario } from "./usuario-context";

const ETIQUETA_TIPO: Record<TipoAviso, string> = {
  recordatorio: "Recordatorio de cita",
  cancelacion: "Cancelación de cita",
};

/**
 * Panel "Avisos de cita" del Calendario (spec 007, RF-5/RF-6/RF-7): por
 * función, interruptor, plantilla, estado ante Meta y su texto.
 *
 * Solo lo ven owner/superadmin/member (el backend da 403 al resto, así que ni
 * se le llama). Escribe solo gerencia fuera de "ver como"; con el calendario
 * apagado queda informativo. Activar una función cuya plantilla no existe o
 * cayó la crea en el backend (con sufijo si hace falta); desactivar solo baja
 * el flag. Tras cada acción se vuelve a pedir el estado.
 */
export function AvisosCitaPanel() {
  const { usuario } = useUsuario();
  const visible = puedeVerPanelAvisos(usuario?.role);
  const config = useApi<ConfigAvisos>(visible ? "/api/avisos-cita/config" : null);
  const [enviando, setEnviando] = useState<TipoAviso | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const datos = config.data;
  const editable = datos ? puedeEditarAvisos(usuario, datos) : false;
  const decision = datos ? avisoDecisionPendiente(datos, editable) : null;

  async function cambiar(tipo: TipoAviso, activo: boolean) {
    setEnviando(tipo);
    setError(null);
    try {
      await apiFetch<ConfigAvisos>("/api/avisos-cita/config", {
        method: "PATCH",
        json: cuerpoPatchAviso(tipo, activo) satisfies ConfigAvisosPatchIn,
      });
    } catch (e) {
      setError(mensajeErrorOferta(e));
    } finally {
      // Con éxito o sin él, el estado real es el del backend.
      await config.recargar(true);
      setEnviando(null);
    }
  }

  return (
    <section
      aria-labelledby="avisos-cita-titulo"
      className="rounded-md border border-bg-700 bg-bg-900 p-4"
    >
      <h2 id="avisos-cita-titulo" className="text-sm font-medium text-text-100">
        Avisos de cita
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-text-400">
        Plantillas de WhatsApp propias de tu negocio que avisan a tus clientes de su cita, enviadas desde tu
        número principal.
      </p>

      <div className="mt-3 space-y-3">
        {config.loading && !datos && <p className="font-mono text-xs text-text-600">cargando avisos…</p>}
        {config.error && !datos && <Aviso tipo="error">{config.error}</Aviso>}

        {datos && (
          <>
            {!datos.calendario_activo && (
              <Aviso>El calendario no está activo en tu negocio: los avisos no se envían hasta que lo actives.</Aviso>
            )}
            {datos.calendario_activo && !datos.numero_emisor_ok && (
              <Aviso tipo="error">
                Hace falta un número principal de WhatsApp activo y vinculado (con su agente configurado) para
                activar o enviar los avisos. Vincúlalo en Canales.
              </Aviso>
            )}
            {decision === "accionable_rechazada" && (
              <Aviso>Antes rechazaste estos avisos. Si ahora los quieres, activa uno de los interruptores.</Aviso>
            )}
            {decision === "accionable_pendiente" && (
              <Aviso>
                Todavía no decidiste sobre los avisos. Activa un interruptor para crear su plantilla, o responde
                la oferta que aparece al entrar al portal.
              </Aviso>
            )}
            {/* RF-13: quien no edita no ve texto que invite a actuar; este reemplaza a la línea de solo lectura. */}
            {decision === "solo_lectura" && (
              <Aviso>Los avisos de cita todavía no están activados. Quien administra el negocio puede activarlos.</Aviso>
            )}
            {!editable && datos.calendario_activo && decision !== "solo_lectura" && (
              <p className="font-mono text-[11px] text-text-600">Solo lectura: quien administra el negocio cambia los avisos.</p>
            )}
            {error && <Aviso tipo="error">{error}</Aviso>}

            {datos.funciones.map((f) => (
              <FilaAviso
                key={f.tipo}
                f={f}
                deshabilitado={!editable || !puedeActivarAviso(datos, f) || enviando !== null}
                alCambiar={(v) => void cambiar(f.tipo, v)}
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function FilaAviso({
  f,
  deshabilitado,
  alCambiar,
}: {
  f: FuncionAviso;
  deshabilitado: boolean;
  alCambiar: (activo: boolean) => void;
}) {
  const motivo = motivoVisible(f);
  return (
    <div className="rounded-md border border-bg-700 bg-bg-950 p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-text-100">{ETIQUETA_TIPO[f.tipo] ?? f.tipo}</p>
          <p className="mt-0.5 font-mono text-[10px] break-all text-text-600">{f.nombre}</p>
        </div>
        <Interruptor
          checked={f.activa}
          disabled={deshabilitado}
          onChange={alCambiar}
          label={`${ETIQUETA_TIPO[f.tipo] ?? f.tipo}: ${f.activa ? "activo" : "inactivo"}`}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <EstadoPlantillaBadge estado={f.estado_plantilla} />
        {motivo && <span className="min-w-0 text-[11px] break-words text-danger">Motivo: {motivo}</span>}
      </div>
      <p className="mt-2 text-xs leading-relaxed whitespace-pre-line text-text-400">{f.texto}</p>
    </div>
  );
}
