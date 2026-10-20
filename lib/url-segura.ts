/**
 * Devuelve la URL tal cual si es un enlace https válido; si no (esquemas como
 * `javascript:` o `data:`, http plano, texto suelto, vacío), devuelve null.
 * Se usa antes de pintar un `href` con una URL que capturó un usuario.
 */
export function urlSegura(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.trim()).protocol === "https:" ? url.trim() : null;
  } catch {
    return null;
  }
}
