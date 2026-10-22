import { ApiError } from "./auth";
import { fmtInt } from "./formato";
import type { ListaNumeros, NumeroDeConversacion, NumeroWhatsApp } from "./types";

/**
 * Reglas de presentación de los números de WhatsApp de un negocio (spec 005a).
 * Son funciones puras: el servidor decide siempre (cupo, pertenencia, estado);
 * esto solo traduce sus respuestas a texto y decide qué botones se dibujan.
 */

const LOCALE_HORA = "es";

/** Textos por código del contrato de la spec ("Contrato de códigos"). */
const TEXTO_POR_CODIGO: Record<string, string> = {
  // 402
  cupo_numeros_whatsapp:
    "Tu plan no tiene plazas libres para otro número de WhatsApp activo. Mejora tu plan o pausa uno.",
  herramienta_no_incluida_en_plan: "Tu plan no incluye esta herramienta. Mejora tu plan para activarla.",
  coexistencia_no_incluida_en_plan:
    "Tu plan no incluye el modo coexistencia. Mejora tu plan o conecta el número en modo exclusivo API.",
  // 403
  linea_avisos_gestionada_por_plataforma:
    "La línea de avisos de la plataforma no puede ser el número principal.",
  // 404: igual para un número ajeno, uno inexistente o uno que no se puede vincular (RF-3, RF-4).
  numero_no_encontrado: "Número no encontrado.",
  // 409
  numero_ya_vinculado: "Ese número ya está vinculado a tu negocio. Si está pausado, reactívalo.",
  numero_no_activo: "El número está pausado. Reactívalo para continuar.",
  linea_avisos_sin_credencial: "Este negocio no tiene conectada la cuenta de WhatsApp de avisos.",
  configuracion_incompleta:
    "El número tiene la configuración incompleta: falta el nombre del agente o sus instrucciones.",
  numero_desvinculado: "El número ya no pertenece al negocio: esta conversación es de solo lectura.",
  usar_numeros: "WhatsApp se gestiona número por número: pausa o desvincula cada número desde la lista.",
  // 400
  temperatura_fuera_de_rango: "La temperatura debe estar entre 0 y 1.",
  cupo_no_valido: "El tope de números debe ser un entero mayor o igual que 0 (0 quita el tope).",
};

function horaDeLiberacion(iso: string, zona?: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(LOCALE_HORA, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zona });
}

/**
 * Mensaje para mostrar ante un error de las acciones sobre números (402, 404,
 * 409, 429 y el 403 de la línea de avisos). Se decide por `codigo`; un código
 * que no conoce deja el texto del servidor, y un error que no es de la API usa
 * `respaldo`. `zona` (opcional) fija la zona de la hora del 429; por defecto, la del navegador.
 */
export function mensajeErrorNumero(e: unknown, respaldo: string, zona?: string): string {
  if (e instanceof ApiError) {
    if (e.codigo === "demasiados_intentos" || e.status === 429) {
      const hora = e.liberaEn ? horaDeLiberacion(e.liberaEn, zona) : null;
      const base = "Demasiados intentos de vincular números.";
      return hora ? `${base} Podrás volver a intentarlo a las ${hora}.` : `${base} Inténtalo de nuevo más tarde.`;
    }
    if (e.codigo && TEXTO_POR_CODIGO[e.codigo]) return TEXTO_POR_CODIGO[e.codigo];
    return e.detail || respaldo;
  }
  if (e instanceof Error) return e.message || respaldo;
  return respaldo;
}

/** "2 de 3 plazas usadas · 1 libre" (P17: tope, plazas usadas y libres). */
export function textoPlazas(l: Pick<ListaNumeros, "tope" | "plazas_usadas" | "plazas_libres">): string {
  if (l.tope === null) {
    const n = l.plazas_usadas;
    return `${fmtInt.format(n)} ${n === 1 ? "número activo" : "números activos"} · sin tope`;
  }
  const libres = l.plazas_libres ?? Math.max(0, l.tope - l.plazas_usadas);
  const resto = libres === 0 ? "cupo lleno" : `${fmtInt.format(libres)} ${libres === 1 ? "libre" : "libres"}`;
  return `${fmtInt.format(l.plazas_usadas)} de ${fmtInt.format(l.tope)} plazas usadas · ${resto}`;
}

export interface AccionesNumero {
  editar: boolean;
  pausar: boolean;
  reactivar: boolean;
  desvincular: boolean;
  elegirPrincipal: boolean;
  /** Hacer de este número la línea de avisos (solo en el negocio que aloja los avisos). */
  elegirAvisos: boolean;
}

/**
 * Qué botones ofrece un número. `soloLectura` = member (RF-18): ve todo y no
 * toca nada. La línea de avisos de la plataforma es un agente más: se edita, se
 * prueba, se pausa y se desvincula; lo único que no puede es ser el principal
 * (CHECK de sql/56) ni contar para el cupo. Se puede mover la marca a otro número
 * activo (`elegirAvisos`), solo desde el negocio que aloja los avisos. Espejo de lo que el servidor
 * permite: él vuelve a decidir en cada petición.
 */
export function accionesDeNumero(
  n: NumeroWhatsApp,
  soloLectura: boolean,
  puedeElegirAvisos = false,
): AccionesNumero {
  if (soloLectura) {
    return {
      editar: false,
      pausar: false,
      reactivar: false,
      desvincular: false,
      elegirPrincipal: false,
      elegirAvisos: false,
    };
  }
  return {
    editar: true,
    pausar: n.estado === "activo",
    reactivar: n.estado === "pausado",
    desvincular: true,
    elegirPrincipal: !n.es_linea_avisos && n.estado === "activo" && !n.es_principal && !n.configuracion_incompleta,
    elegirAvisos: puedeElegirAvisos && !n.es_linea_avisos && n.estado === "activo",
  };
}

/**
 * Pausar este número deja al negocio sin ningún número activo (D5): la
 * confirmación lo advierte. La línea de avisos no cuenta como activo (P18).
 */
export function esUltimoActivo(numeros: NumeroWhatsApp[], numeroId: string): boolean {
  // Pausar la línea de avisos no deja al negocio sin número: ella no cuenta como activo.
  if (numeros.find((n) => n.id === numeroId)?.es_linea_avisos) return false;
  return !numeros.some((n) => n.id !== numeroId && n.estado === "activo" && !n.es_linea_avisos);
}

/** Nombre para mostrar de un número: teléfono visible si lo hay, si no el identificador. */
export function nombreNumero(n: Pick<NumeroWhatsApp, "telefono_visible" | "phone_number_id">): string {
  return n.telefono_visible?.trim() || n.phone_number_id;
}

/**
 * Etiqueta para distinguir de qué número/agente es una conversación, cuando
 * el negocio tiene más de uno (con uno solo no hace falta: null). Mismo
 * criterio de nombre que el selector de números: el nombre del agente si lo
 * tiene configurado, si no el teléfono — y el sufijo "(línea de avisos)"
 * cuando es la línea que gestiona la plataforma.
 */
export function etiquetaNumeroConversacion(
  c: NumeroDeConversacion,
): { texto: string; title: string } | null {
  if (!c.agente_canal_id || !c.tiene_varios_numeros) return null;
  const telefono = c.numero_telefono_visible?.trim() || c.numero_phone_number_id || "";
  const nombre = c.numero_agent_name?.trim() || telefono;
  const texto = c.numero_es_linea_avisos ? `${nombre} (línea de avisos)` : nombre;
  return {
    texto,
    title: telefono ? `Agente de ${telefono}` : "Agente de este número",
  };
}

// ------------------------------------------------------------
// Cupo de números en el panel de planes (RF-1)
// ------------------------------------------------------------
/** Vacío o un entero >= 0. El servidor responde 400 `cupo_no_valido` con otra cosa. */
export function cupoValido(texto: string): boolean {
  const t = texto.trim();
  return t === "" || /^\d+$/.test(t);
}

/** Al crear un plan: vacío y 0 son "sin tope" (null); un entero >= 1 fija el tope. */
export function cupoParaCrear(texto: string): number | null {
  const t = texto.trim();
  if (t === "" || Number(t) === 0) return null;
  return Number(t);
}

/**
 * Al editar: en PATCH `null` es "no tocar" y `0` es "quitar el tope". Un campo
 * vacío sobre un plan que tenía tope lo quita (0); si no tenía, no toca nada.
 */
export function cupoParaEnviar(texto: string, actual: number | null): number | null {
  const t = texto.trim();
  if (t === "") return actual === null ? null : 0;
  return Number(t);
}

/** "sin tope", "1 número", "4 números". */
export function textoCupo(tope: number | null): string {
  if (tope === null) return "sin tope";
  return `${fmtInt.format(tope)} ${tope === 1 ? "número" : "números"}`;
}
