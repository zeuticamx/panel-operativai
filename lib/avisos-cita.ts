import { ApiError } from "./auth";
import type {
  ConfigAvisos,
  ConfigAvisosPatchIn,
  EstadoPlantillaAviso,
  FuncionAviso,
  TipoAviso,
  UsuarioOut,
} from "./types";

/** Recuerda en la pestaña que ya se le mostró la oferta de avisos de cita a este usuario. */
export const CLAVE_OFERTA_AVISOS_MOSTRADA = "operativai.oferta-avisos-cita-mostrada";

/** Roles que pueden decidir la oferta (gerencia_actual del backend). */
const ROLES_QUE_DECIDEN = ["owner", "superadmin"];

/**
 * ¿Abrir la oferta de avisos de cita (spec 007)? Solo owner/superadmin, solo
 * si /auth/yo la trae pendiente, nunca en "ver como" y una vez por pestaña.
 * El backend ya filtra rol e impersonación; acá se repite por defensa.
 */
export function debeMostrarOfertaAvisos(
  usuario: Pick<UsuarioOut, "role" | "oferta_avisos_cita_pendiente" | "impersonado_por"> | null,
  yaMostrada: boolean,
): boolean {
  if (!usuario?.oferta_avisos_cita_pendiente || usuario.impersonado_por) return false;
  if (!ROLES_QUE_DECIDEN.includes(usuario.role)) return false;
  return !yaMostrada;
}

/**
 * ¿Debe esperar el recorrido de primera visita (RF-12)? Sí mientras el modal de
 * oferta esté abierto o vaya a abrirse en esta pestaña. Ojo: con el modal
 * abierto la clave de sessionStorage ya vale "1", así que `abierto` cuenta aparte.
 */
export function ofertaAvisosRetieneRecorrido(
  usuario: Pick<UsuarioOut, "role" | "oferta_avisos_cita_pendiente" | "impersonado_por"> | null,
  yaMostrada: boolean,
  abierto: boolean,
): boolean {
  return abierto || debeMostrarOfertaAvisos(usuario, yaMostrada);
}

export const TEXTO_ACEPTADA = "Listo: las plantillas se enviaron a Meta para su aprobación. Los avisos empiezan cuando se aprueben.";

/** Mensaje comprensible de un error de POST /oferta según su código o estado HTTP. */
export function mensajeErrorOferta(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.codigo) {
      case "calendario_inactivo":
        return "El módulo de calendario no está activo en tu negocio. Actívalo para poder usar los avisos de cita.";
      case "sin_numero_emisor":
        return "Hace falta un número principal de WhatsApp activo, vinculado y con su agente configurado (nombre e instrucciones). Vincúlalo en Canales y vuelve a intentarlo.";
      case "plantilla_existente_no_utilizable":
        return "Ya existen plantillas con esos nombres y ninguna se puede usar. Elimina alguna desde Plantillas de WhatsApp y vuelve a intentarlo.";
      default:
    }
    if (e.status === 502) {
      return "El proveedor de WhatsApp no respondió bien al crear las plantillas. Inténtalo de nuevo en unos minutos.";
    }
    return e.detail || "No se pudo completar la acción";
  }
  return "No se pudo completar la acción";
}

// ---- Panel "Avisos de cita" del Calendario (spec 007, RF-5/RF-6/RF-7) ----

export type TonoEstadoAviso = "neutro" | "espera" | "ok" | "error";

const INFO_ESTADO: Record<EstadoPlantillaAviso, { etiqueta: string; tono: TonoEstadoAviso }> = {
  NO_CREADA: { etiqueta: "Sin crear", tono: "neutro" },
  // Meta tarda en revisar: es una espera normal, no un fallo (D4).
  PENDING: { etiqueta: "Esperando aprobación de Meta", tono: "espera" },
  APPROVED: { etiqueta: "Aprobada", tono: "ok" },
  REJECTED: { etiqueta: "Rechazada por Meta", tono: "error" },
  PAUSED: { etiqueta: "Pausada por Meta", tono: "error" },
  DISABLED: { etiqueta: "Deshabilitada por Meta", tono: "error" },
};

export function infoEstadoPlantilla(estado: EstadoPlantillaAviso): { etiqueta: string; tono: TonoEstadoAviso } {
  return INFO_ESTADO[estado] ?? { etiqueta: estado, tono: "neutro" };
}

/** Motivo a mostrar: solo si la plantilla cayó (rechazada/pausada/deshabilitada) y hay texto. */
export function motivoVisible(f: Pick<FuncionAviso, "estado_plantilla" | "motivo_rechazo">): string | null {
  if (infoEstadoPlantilla(f.estado_plantilla).tono !== "error") return null;
  return f.motivo_rechazo?.trim() || null;
}

/** Quién ve el panel: los roles que el backend deja leer (negocio_actual). */
export function puedeVerPanelAvisos(role: string | undefined): boolean {
  return role === "owner" || role === "superadmin" || role === "member";
}

/** Puede escribir: gerencia, fuera de "ver como" y con el calendario activo. */
export function puedeEditarAvisos(
  usuario: Pick<UsuarioOut, "role" | "impersonado_por"> | null,
  config: Pick<ConfigAvisos, "calendario_activo">,
): boolean {
  if (!usuario || usuario.impersonado_por) return false;
  if (!ROLES_QUE_DECIDEN.includes(usuario.role)) return false;
  return config.calendario_activo;
}

export type DecisionPendienteAviso = "accionable_pendiente" | "accionable_rechazada" | "solo_lectura" | null;

/**
 * Qué aviso de "oferta sin activar" toca en el panel (RF-13). Con el calendario
 * activo y la oferta pendiente o rechazada: quien puede editar ve el texto que
 * invita a actuar; quien no (member, "ver como") ve uno neutro de solo lectura.
 */
export function avisoDecisionPendiente(
  config: Pick<ConfigAvisos, "oferta" | "calendario_activo">,
  editable: boolean,
): DecisionPendienteAviso {
  if (!config.calendario_activo) return null;
  if (config.oferta !== "pendiente" && config.oferta !== "rechazada") return null;
  if (!editable) return "solo_lectura";
  return config.oferta === "pendiente" ? "accionable_pendiente" : "accionable_rechazada";
}

/** Sin número emisor válido (D6) no se puede activar; apagar sí. */
export function puedeActivarAviso(config: Pick<ConfigAvisos, "numero_emisor_ok">, f: Pick<FuncionAviso, "activa">): boolean {
  return f.activa || config.numero_emisor_ok;
}

export function cuerpoPatchAviso(tipo: TipoAviso, activo: boolean): ConfigAvisosPatchIn {
  return tipo === "recordatorio" ? { recordatorio_activo: activo } : { cancelacion_activo: activo };
}
