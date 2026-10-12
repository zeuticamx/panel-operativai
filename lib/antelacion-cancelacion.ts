/** Textos y validación de la regla "antelación mínima para cancelar" (spec 001, R10). */

export const ETIQUETA_ANTELACION = "Antelación mínima para cancelar (horas)";
export const AYUDA_ANTELACION =
  "Si el cliente cancela con menos anticipación, la cancelación se permite y se marca como tardía. Vacío = sin regla.";
export const MENSAJE_RESERVA_NO_CONFIRMADA =
  "Esta cita ya no está confirmada; se actualizó la agenda.";

export const ANTELACION_MAX_HORAS = 720;

/**
 * Vacío -> `valor: null` (sin regla; el PATCH lo manda explícito para borrarla).
 * Si no, entero entre 0 y 720.
 */
export function parsearAntelacion(
  texto: string,
): { valor: number | null; error: null } | { valor: null; error: string } {
  const t = texto.trim();
  if (t === "") return { valor: null, error: null };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > ANTELACION_MAX_HORAS) {
    return {
      valor: null,
      error: `La antelación debe ser un número entero de horas entre 0 y ${ANTELACION_MAX_HORAS}.`,
    };
  }
  return { valor: n, error: null };
}
