/** Helpers de formato: fechas, números y etiquetas de canal. Todo en es-MX. */

const LOCALE = "es-MX";

const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
export const fmtInt = new Intl.NumberFormat(LOCALE);

/** Hora relativa legible: "hace instantes", "hace 3 minutos", "ayer". */
export function tiempoRelativo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) return "hace instantes";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");

  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");

  const days = Math.round(hours / 24);
  return rtf.format(-days, "day");
}

export function formatoHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

export function formatoFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Fecha corta para listas: hora si es hoy, "dd mmm" si no. */
export function formatoCorto(iso: string, now: number = Date.now()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hoy = new Date(now);
  const mismoDia =
    d.getFullYear() === hoy.getFullYear() &&
    d.getMonth() === hoy.getMonth() &&
    d.getDate() === hoy.getDate();
  if (mismoDia) return formatoHora(iso);
  return d.toLocaleDateString(LOCALE, { day: "2-digit", month: "short" });
}

// ------------------------------------------------------------
// Canales
// ------------------------------------------------------------
export const CANALES = ["whatsapp", "instagram", "facebook"] as const;
export type CanalTipo = (typeof CANALES)[number];

export const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
};

export function etiquetaCanal(tipo: string): string {
  return CANAL_LABEL[tipo] ?? tipo;
}

/**
 * Qué representa `usuario_handle` según el canal — no es lo mismo en todos:
 * en WhatsApp el id de contacto es el número de teléfono, pero en Instagram
 * y Messenger la API solo entrega un id numérico interno de la app (PSID/
 * IGSID), no un @usuario. Sin esta aclaración, ese número se confunde con
 * un nombre de usuario que no existe en los datos.
 */
export function etiquetaIdentificador(tipo: string): string {
  switch (tipo) {
    case "whatsapp":
      return "Número";
    case "instagram":
      return "ID de Instagram";
    case "facebook":
      return "ID de Messenger";
    default:
      return "Identificador";
  }
}

// ------------------------------------------------------------
// Ventana de 24h de Meta (WhatsApp/Messenger/Instagram)
// ------------------------------------------------------------
export interface EstadoVentana {
  tono: "success" | "warning" | "danger";
  texto: string;
  /** Versión corta para espacios chicos (listas). */
  textoCorto: string;
}

function duracionCorta(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Fuera de la ventana de 24h desde el último mensaje del cliente, Meta
 * solo permite mandar plantillas (WhatsApp) o directamente nada
 * (Messenger/Instagram). `minutosRestantes` ya viene calculado del
 * backend — negativo si ya se cerró, null si el cliente nunca escribió
 * (ahí no aplica el concepto de ventana).
 */
export function estadoVentanaMeta(minutosRestantes: number | null): EstadoVentana | null {
  if (minutosRestantes === null) return null;

  if (minutosRestantes < 0) {
    const texto = duracionCorta(-minutosRestantes);
    return {
      tono: "danger",
      texto: `Ventana cerrada · hace ${texto}`,
      textoCorto: `Cerrada hace ${texto}`,
    };
  }

  const texto = duracionCorta(minutosRestantes);
  if (minutosRestantes < 120) {
    return {
      tono: "warning",
      texto: `Ventana por cerrar · quedan ${texto}`,
      textoCorto: `Cierra en ${texto}`,
    };
  }
  return {
    tono: "success",
    texto: `Ventana abierta · quedan ${texto}`,
    textoCorto: `Abierta · ${texto}`,
  };
}

/** Iniciales para avatar; cae al handle o "?" si no hay nombre. */
export function iniciales(nombre: string | null, handle: string | null): string {
  const base = (nombre ?? "").trim();
  if (base) {
    const partes = base.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return base.slice(0, 2).toUpperCase();
  }
  const h = (handle ?? "").replace(/\D/g, "");
  if (h) return h.slice(-2);
  return "?";
}
