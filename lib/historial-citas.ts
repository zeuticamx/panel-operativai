/**
 * Historial de citas de un cliente (spec 002, R15-R17, R20, R21).
 * Funciones puras: textos fijos y regla de visibilidad de la acción.
 * El backend vuelve a decidir plan, calendario y visibilidad en cada petición;
 * esto solo evita ofrecer la acción donde nunca aplica.
 */

/** Canales de cliente final (lista blanca; el widget web queda fuera). */
export const CANALES_HISTORIAL_CITAS: readonly string[] = [
  "whatsapp",
  "instagram",
  "facebook",
];

/** Roles que pueden ver la acción (el vendedor no). */
const ROLES_HISTORIAL_CITAS: readonly string[] = [
  "owner",
  "superadmin",
  "member",
  "proveedor",
];

export const TEXTO_HAY_MAS_CITAS = "Hay citas anteriores que no se muestran.";
export const TEXTO_VACIO_EQUIPO =
  "Este cliente aún no tiene citas pasadas ni canceladas.";
export const TEXTO_VACIO_PROVEEDOR = "No hay citas tuyas con este cliente.";

export function canalAdmiteHistorialCitas(canal: string | null | undefined): boolean {
  return canal != null && CANALES_HISTORIAL_CITAS.includes(canal);
}

/** Texto del historial vacío según el rol (el proveedor no habla de otros proveedores). */
export function textoHistorialVacio(rol: string | null | undefined): string {
  return rol === "proveedor" ? TEXTO_VACIO_PROVEEDOR : TEXTO_VACIO_EQUIPO;
}

export function mostrarAccionHistorialCitas(args: {
  rol: string | null | undefined;
  canal: string | null | undefined;
}): boolean {
  return (
    args.rol != null &&
    ROLES_HISTORIAL_CITAS.includes(args.rol) &&
    canalAdmiteHistorialCitas(args.canal)
  );
}

const PARED_ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

/**
 * Fecha y hora de una cita en la zona del NEGOCIO (R12): el backend manda el
 * ISO con el desfase de esa zona (p. ej. "2026-01-09T14:00:00-06:00") y aquí se
 * muestra la hora de pared tal cual viene, sin convertir a la del navegador.
 * Mismo estilo que `formatoFechaHora` ("09 ene 2026, 14:00"). Un texto que no
 * es una fecha ISO válida se devuelve tal cual para no ocultar el dato ni romper.
 */
export function formatoFechaHoraNegocio(iso: string): string {
  const m = PARED_ISO.exec(iso);
  if (!m) return iso;
  const [anio, mes, dia, hora, minuto] = m.slice(1).map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto));
  // Date.UTC desborda (mes 13 -> año siguiente): si no coincide, no es válida.
  if (
    d.getUTCFullYear() !== anio ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia ||
    d.getUTCHours() !== hora
  ) {
    return iso;
  }
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
