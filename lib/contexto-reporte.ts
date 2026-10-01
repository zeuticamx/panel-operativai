/**
 * Contexto técnico que acompaña a un reporte de incidencia: dónde estaba la
 * persona y con qué. Lo arma el navegador y el backend (services/
 * incidencias.py) solo conserva estas mismas claves, así que agregar un
 * campo acá exige agregarlo allá.
 *
 * Es ayuda para depurar, no una fuente de verdad: quién reporta sale del
 * token en el servidor.
 */

export interface ContextoReporte {
  /** Ruta + query de la pantalla, sin el hash y sin parámetros sensibles. */
  ruta: string;
  navegador: string;
  sistema_operativo: string;
  user_agent: string;
  idioma: string;
  zona_horaria: string;
  pantalla: { ancho: number; alto: number };
  ventana: { ancho: number; alto: number };
}

/**
 * Parámetros de la URL que nunca deben viajar en un reporte: códigos de
 * OAuth y tokens que a veces aterrizan en el query (p. ej. al volver de
 * Meta o de Google).
 */
const PARAMS_SENSIBLES = new Set([
  "code",
  "state",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "password",
  "key",
]);

export function rutaSegura(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  for (const clave of [...params.keys()]) {
    if (PARAMS_SENSIBLES.has(clave.toLowerCase())) params.delete(clave);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Navegador y versión mayor. El orden importa: Edge y Opera dicen "Chrome". */
export function detectarNavegador(ua: string): string {
  const reglas: [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
    [/OPR\/(\d+)/, "Opera"],
    [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
    [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"],
    [/Version\/(\d+)[^]*Safari\//, "Safari"],
  ];
  for (const [patron, nombre] of reglas) {
    const m = ua.match(patron);
    if (m) return `${nombre} ${m[1]}`;
  }
  return "Desconocido";
}

/**
 * Sistema operativo. "Windows NT 10.0" es Windows 10 y 11 por igual: el
 * user agent no los distingue, así que se reporta solo "Windows". iPadOS
 * se hace pasar por Mac, y se reconoce por tener pantalla táctil.
 */
export function detectarSistemaOperativo(ua: string, puntosTactiles = 0): string {
  if (/Android (\d+)/.test(ua)) return `Android ${ua.match(/Android (\d+)/)![1]}`;
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Macintosh|Mac OS X/.test(ua)) return puntosTactiles > 1 ? "iPadOS" : "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux|X11/.test(ua)) return "Linux";
  return "Desconocido";
}

/** Lee el navegador de la persona. Solo corre en el cliente. */
export function capturarContexto(): ContextoReporte {
  const ua = navigator.userAgent;
  let zona = "";
  try {
    zona = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    // sin Intl: el campo queda vacío y el backend lo omite
  }

  return {
    ruta: rutaSegura(window.location.pathname, window.location.search),
    navegador: detectarNavegador(ua),
    sistema_operativo: detectarSistemaOperativo(ua, navigator.maxTouchPoints),
    user_agent: ua,
    idioma: navigator.language ?? "",
    zona_horaria: zona,
    pantalla: { ancho: window.screen.width, alto: window.screen.height },
    ventana: { ancho: window.innerWidth, alto: window.innerHeight },
  };
}
