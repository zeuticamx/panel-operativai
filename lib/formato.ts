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

// ------------------------------------------------------------
// Embudo de venta (módulo de vendedores)
// ------------------------------------------------------------
/** Mismo orden que pipeline_estados.py del backend: es el orden del embudo. */
export const ESTADOS_PIPELINE = [
  "nuevo",
  "contactado",
  "en_seguimiento",
  "cotizado",
  "negociacion",
  "ganado",
  "perdido",
] as const;

/** Estados que ya no ocupan al vendedor. */
export const ESTADOS_CERRADOS: ReadonlySet<string> = new Set(["ganado", "perdido"]);

export const ESTADO_PIPELINE_INFO: Record<
  string,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }
> = {
  nuevo: { label: "Nuevo", tone: "info" },
  contactado: { label: "Contactado", tone: "neutral" },
  en_seguimiento: { label: "En seguimiento", tone: "neutral" },
  cotizado: { label: "Cotizado", tone: "warning" },
  negociacion: { label: "Negociación", tone: "warning" },
  ganado: { label: "Ganado", tone: "success" },
  perdido: { label: "Perdido", tone: "danger" },
};

export function infoEstadoPipeline(estado: string) {
  return ESTADO_PIPELINE_INFO[estado] ?? { label: estado, tone: "neutral" as const };
}

export const ESTRATEGIA_INFO: Record<
  "carga" | "round_robin" | "manual",
  { label: string; descripcion: string }
> = {
  carga: {
    label: "Por carga",
    descripcion:
      "Cada lead nuevo va al vendedor con menos clientes abiertos. Si empatan, al que lleva más tiempo sin recibir uno.",
  },
  round_robin: {
    label: "Por turnos",
    descripcion:
      "Los leads se reparten uno a uno en orden, dando la vuelta al equipo completo antes de repetir.",
  },
  manual: {
    label: "Manual",
    descripcion:
      "Nadie recibe leads en automático. Cada cliente queda pendiente hasta que gerencia le asigna un vendedor desde aquí.",
  },
};

/** Montos del embudo. El backend manda Decimal como string. */
const fmtMonto = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "MXN",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 2,
});

export function formatoMonto(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = typeof valor === "number" ? valor : Number(valor);
  if (Number.isNaN(n)) return "—";
  return fmtMonto.format(n);
}

/** "3 h", "1.5 d", "20 min": para el tiempo promedio por etapa. */
export function formatoHoras(horas: number | null | undefined): string {
  if (horas === null || horas === undefined) return "—";
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `${horas < 10 ? horas.toFixed(1) : Math.round(horas)} h`;
  const dias = horas / 24;
  return `${dias < 10 ? dias.toFixed(1) : Math.round(dias)} d`;
}

export function formatoPorcentaje(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return `${Math.round(valor)}%`;
}

/** "2026-01" -> "ene 2026": etiqueta de mes para el eje de la tendencia. */
export function formatoMes(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes) return periodo;
  const d = new Date(Date.UTC(anio, mes - 1, 1));
  return d.toLocaleDateString(LOCALE, { month: "short", year: "numeric", timeZone: "UTC" });
}

// ------------------------------------------------------------
// CRM de campo
// ------------------------------------------------------------
export const ESTADOS_CLIENTE = ["prospecto", "activo", "inactivo", "perdido"] as const;
export const PRIORIDADES_CLIENTE = ["alta", "media", "baja"] as const;

export const ESTADO_CLIENTE_INFO: Record<
  string,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }
> = {
  prospecto: { label: "Prospecto", tone: "info" },
  activo: { label: "Activo", tone: "success" },
  inactivo: { label: "Inactivo", tone: "neutral" },
  perdido: { label: "Perdido", tone: "danger" },
};

export const PRIORIDAD_INFO: Record<
  string,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" }
> = {
  alta: { label: "Alta", tone: "danger" },
  media: { label: "Media", tone: "warning" },
  baja: { label: "Baja", tone: "neutral" },
};

export function infoEstadoCliente(estado: string) {
  return ESTADO_CLIENTE_INFO[estado] ?? { label: estado, tone: "neutral" as const };
}

export function infoPrioridad(prioridad: string) {
  return PRIORIDAD_INFO[prioridad] ?? { label: prioridad, tone: "neutral" as const };
}

export const ESTADO_TAREA_INFO: Record<
  string,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" }
> = {
  pendiente: { label: "Pendiente", tone: "warning" },
  completada: { label: "Completada", tone: "success" },
  vencida: { label: "Vencida", tone: "danger" },
};

export function infoEstadoTarea(estado: string) {
  return ESTADO_TAREA_INFO[estado] ?? { label: estado, tone: "neutral" as const };
}

/** Distancias de geocerca: metros por debajo del km, km por encima. */
export function formatoDistancia(metros: number | null | undefined): string {
  if (metros === null || metros === undefined) return "—";
  if (metros < 1000) return `${Math.round(metros)} m`;
  const km = metros / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Enlace a Google Maps. El portal no carga un SDK de mapas por una coordenada. */
export function urlMapa(latitud: number, longitud: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;
}

// ------------------------------------------------------------
// Calendario (reservas)
// ------------------------------------------------------------
/** Índice 0=lunes … 6=domingo, igual que proveedor_horarios.dia_semana del backend. */
export const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export const ESTADO_RESERVA_INFO: Record<
  string,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }
> = {
  confirmada: { label: "Confirmada", tone: "info" },
  completada: { label: "Completada", tone: "success" },
  no_asistio: { label: "No asistió", tone: "warning" },
  cancelada: { label: "Cancelada", tone: "danger" },
};

/** Bitácora de reservas: una entrada por tipo de evento auditado. */
export const EVENTO_AUDITORIA_INFO: Record<
  string,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }
> = {
  creada: { label: "Creada", tone: "info" },
  reprogramada: { label: "Reprogramada", tone: "neutral" },
  cambio_barbero: { label: "Cambio de barbero", tone: "neutral" },
  cancelada: { label: "Cancelada", tone: "danger" },
  completada: { label: "Completada", tone: "success" },
  no_asistio: { label: "No asistió", tone: "warning" },
};

export function infoEventoAuditoria(evento: string) {
  return EVENTO_AUDITORIA_INFO[evento] ?? { label: evento, tone: "neutral" as const };
}

export function infoEstadoReserva(estado: string) {
  return ESTADO_RESERVA_INFO[estado] ?? { label: estado, tone: "neutral" as const };
}

/** "09:30:00" -> 570 (minutos desde medianoche). */
export function minutosDeHHMM(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

/** Recorta [restaInicio, restaFin) de cada ventana, partiéndola en dos si el corte cae en medio. */
function restarIntervalo(
  ventanas: Array<[number, number]>,
  restaInicio: number,
  restaFin: number,
): Array<[number, number]> {
  const resultado: Array<[number, number]> = [];
  for (const [inicio, fin] of ventanas) {
    if (restaFin <= inicio || restaInicio >= fin) {
      resultado.push([inicio, fin]);
      continue;
    }
    if (restaInicio > inicio) resultado.push([inicio, restaInicio]);
    if (restaFin < fin) resultado.push([restaFin, fin]);
  }
  return resultado;
}

/**
 * Ventanas de atención (en minutos locales desde medianoche) de un
 * proveedor para una fecha puntual — espejo en el navegador de
 * calendario_slots.ventanas_del_dia del backend, para poder deshabilitar en
 * la grilla las franjas fuera de horario sin ir al servidor por cada celda.
 *
 * Si hay una excepción para esa fecha, REEMPLAZA por completo al horario
 * semanal (igual que en el backend): día no disponible -> sin ventanas,
 * horario especial -> solo esa ventana. Los `descansos` aplicables a esa
 * fecha (recurrentes de ese día de la semana, o puntuales de esa fecha
 * exacta) se restan al final, sea cual sea el origen de la ventana.
 */
export function ventanasDelDia(
  fechaISO: string,
  horarios: { dia_semana: number; hora_inicio: string; hora_fin: string }[],
  excepcion: { disponible: boolean; hora_inicio: string | null; hora_fin: string | null } | undefined,
  descansos: Array<{
    dia_semana: number | null;
    fecha: string | null;
    hora_inicio: string;
    hora_fin: string;
  }> = [],
): Array<[number, number]> {
  // Date#getDay() es 0=domingo..6=sábado; el backend usa 0=lunes..6=domingo
  // (igual que Python date.weekday()), así que hay que rotar el índice.
  const dow = new Date(`${fechaISO}T00:00:00`).getDay();
  const diaSemana = dow === 0 ? 6 : dow - 1;

  let ventanas: Array<[number, number]>;
  if (excepcion) {
    if (!excepcion.disponible || !excepcion.hora_inicio || !excepcion.hora_fin) return [];
    ventanas = [[minutosDeHHMM(excepcion.hora_inicio), minutosDeHHMM(excepcion.hora_fin)]];
  } else {
    ventanas = horarios
      .filter((h) => h.dia_semana === diaSemana)
      .map((h): [number, number] => [minutosDeHHMM(h.hora_inicio), minutosDeHHMM(h.hora_fin)]);
  }

  for (const d of descansos) {
    const aplica = d.fecha === fechaISO || (d.fecha === null && d.dia_semana === diaSemana);
    if (aplica) ventanas = restarIntervalo(ventanas, minutosDeHHMM(d.hora_inicio), minutosDeHHMM(d.hora_fin));
  }

  return ventanas;
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
