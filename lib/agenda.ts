import type { AgendaItemOut, PipelineOut, TipoPendiente } from "./types";

/**
 * Lógica pura de la agenda de ventas (app/components/agenda-ventas.tsx):
 * fechas al soltar, filtros y qué va al carril de "por agendar". Vive acá,
 * sin React ni FullCalendar, para poder probarla sola.
 */

const LOCALE = "es-MX";

/** Hora a la que cae algo soltado sobre un día entero (vista de mes). */
export const HORA_POR_DEFECTO = 10;

/** Estados del embudo en los que ya no hay a quién darle seguimiento. */
const ETAPAS_CERRADAS = new Set(["ganado", "perdido"]);

export interface FiltrosAgenda {
  tareas: boolean;
  seguimientos: boolean;
  completadas: boolean;
}

export const FILTROS_INICIALES: FiltrosAgenda = {
  tareas: true,
  seguimientos: true,
  completadas: false,
};

/** Clave estable de un pendiente: el id solo no alcanza (dos tablas). */
export function claveItem(item: Pick<AgendaItemOut, "tipo" | "id">): string {
  return `${item.tipo}:${item.id}`;
}

export function filtrarItems(items: AgendaItemOut[], filtros: FiltrosAgenda): AgendaItemOut[] {
  return items.filter((i) => {
    if (i.tipo === "tarea" && !filtros.tareas) return false;
    if (i.tipo === "seguimiento" && !filtros.seguimientos) return false;
    if (i.estado === "completada" && !filtros.completadas) return false;
    return true;
  });
}

/**
 * La fecha que le toca a un pendiente soltado en `destino`.
 *
 * En la vista de mes (`diaCompleto`) el destino es un día a las 00:00: se
 * conserva la hora que ya tenía (mover "la llamada de las 16:30" al jueves
 * la deja a las 16:30 del jueves), o HORA_POR_DEFECTO si no tenía ninguna
 * — un lead que se agenda por primera vez.
 */
export function fechaAlSoltar(destino: Date, diaCompleto: boolean, original: Date | null): Date {
  if (!diaCompleto) return new Date(destino);
  const d = new Date(destino);
  if (original) {
    d.setHours(original.getHours(), original.getMinutes(), 0, 0);
  } else {
    d.setHours(HORA_POR_DEFECTO, 0, 0, 0);
  }
  return d;
}

/** "jue 12 oct, 16:30" — lo que dice el aviso de "movida al…". */
export function fechaCorta(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return "—";
  const dia = d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" });
  const hora = d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  return `${dia.replace(/\./g, "")}, ${hora}`;
}

/** Valor para un <input type="datetime-local"> en la hora del navegador. */
export function aInputLocal(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * De un <input type="datetime-local"> a ISO con zona. `new Date("…T10:00")`
 * sin zona se lee como hora local, que es justo lo que el usuario escribió.
 */
export function deInputLocal(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "2026-10-12" → Date local a las 00:00, o null si no es una fecha. */
export function fechaDeParametro(valor: string | null): Date | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Query string de GET /agenda (el "+" de la zona tiene que ir escapado). */
export function rangoQuery(desde: Date, hasta: Date, vendedorId: string | null): string {
  const qs = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() });
  if (vendedorId) qs.set("vendedor_id", vendedorId);
  return qs.toString();
}

/**
 * Lo atrasado que NO se ve en la vista actual: vencido y anterior al primer
 * día visible. Lo que sí se ve ya está en rojo en la grilla; repetirlo en
 * el carril sería ruido.
 */
export function atrasadosFueraDeVista(items: AgendaItemOut[], inicioVisible: Date): AgendaItemOut[] {
  return items
    .filter((i) => i.estado === "vencida" && new Date(i.fecha) < inicioVisible)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Leads abiertos sin nada agendado: los candidatos a arrastrar al calendario. */
export function leadsSinSeguimiento(leads: PipelineOut[], vendedorId: string | null): PipelineOut[] {
  return leads.filter(
    (l) =>
      !ETAPAS_CERRADAS.has(l.estado) &&
      !l.proximo_seguimiento &&
      (vendedorId === null || l.vendedor_id === vendedorId),
  );
}

export function nombreLead(l: Pick<PipelineOut, "cliente_nombre" | "cliente_handle">): string {
  return l.cliente_nombre ?? l.cliente_handle ?? "Cliente sin nombre";
}

export const TIPO_INFO: Record<TipoPendiente, { label: string; plural: string }> = {
  tarea: { label: "Tarea de campo", plural: "Tareas" },
  seguimiento: { label: "Seguimiento de lead", plural: "Seguimientos" },
};

/** Lo que se puede arrastrar: una completada ya no se reprograma. */
export function esMovible(item: Pick<AgendaItemOut, "estado">): boolean {
  return item.estado !== "completada";
}
