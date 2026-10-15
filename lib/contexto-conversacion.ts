import { formatoFechaHora } from "@/lib/formato";

/** Textos del diálogo «Limpiar contexto del agente» (spec 003, RF13 y RF14). */
export const TEXTO_ABRIR_LIMPIAR_CONTEXTO = "Limpiar contexto del agente";
export const TITULO_LIMPIAR_CONTEXTO = "¿Limpiar el contexto del agente?";
export const TEXTO_CUERPO_LIMPIAR_CONTEXTO =
  "El agente dejará de usar los mensajes anteriores a este momento al responder. El historial no se borra: seguirás viendo todos los mensajes. Si el agente ya estaba respondiendo, esa respuesta saldrá con el contexto anterior.";
export const TEXTO_BOTON_CANCELAR = "Cancelar";
export const TEXTO_BOTON_LIMPIAR = "Limpiar contexto";
export const TEXTO_CARGANDO_LIMPIEZA = "Limpiando…";
export const TEXTO_ERROR_LIMPIAR_CONTEXTO = "No se pudo limpiar el contexto.";

/** Fecha y hora local del último corte de contexto (llega con zona horaria). */
export function formatearCorte(iso: string): string {
  return formatoFechaHora(iso);
}
