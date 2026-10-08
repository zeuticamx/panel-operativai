import type {
  CanalOnboarding,
  GiroNegocio,
  OnboardingRespuestas,
  TonoAgente,
  UsuarioOut,
} from "./types";

/**
 * Textos y valores por defecto del cuestionario de bienvenida
 * (/bienvenida). Las claves son espejo de schemas.GiroNegocio / TonoAgente
 * del backend; el prompt que sale de cada giro lo arma el backend
 * (services/onboarding.py), acá solo se elige.
 */

interface InfoGiro {
  valor: GiroNegocio;
  etiqueta: string;
  ejemplo: string;
  /** Lo que se deja marcado al elegirlo; el dueño lo puede cambiar. */
  agendaCitas: boolean;
  vendePorChat: boolean;
}

export const GIROS: InfoGiro[] = [
  {
    valor: "salon_belleza",
    etiqueta: "Barbería, salón o spa",
    ejemplo: "cortes, uñas, masajes",
    agendaCitas: true,
    vendePorChat: false,
  },
  {
    valor: "salud",
    etiqueta: "Consultorio o clínica",
    ejemplo: "médico, dentista, psicólogo",
    agendaCitas: true,
    vendePorChat: false,
  },
  {
    valor: "restaurante",
    etiqueta: "Restaurante o comida",
    ejemplo: "pedidos, reservaciones",
    agendaCitas: false,
    vendePorChat: false,
  },
  {
    valor: "tienda",
    etiqueta: "Tienda",
    ejemplo: "ferretería, ropa, refacciones",
    agendaCitas: false,
    vendePorChat: true,
  },
  {
    valor: "inmobiliaria",
    etiqueta: "Inmobiliaria",
    ejemplo: "venta y renta de inmuebles",
    agendaCitas: false,
    vendePorChat: true,
  },
  {
    valor: "servicios_profesionales",
    etiqueta: "Servicios profesionales",
    ejemplo: "despacho, agencia, consultoría",
    agendaCitas: true,
    vendePorChat: true,
  },
  {
    valor: "educacion",
    etiqueta: "Escuela o cursos",
    ejemplo: "academia, talleres, idiomas",
    agendaCitas: false,
    vendePorChat: true,
  },
  { valor: "otro", etiqueta: "Otro", ejemplo: "cuéntanos abajo qué haces", agendaCitas: false, vendePorChat: false },
];

export const TONOS: { valor: TonoAgente; etiqueta: string; ejemplo: string }[] = [
  { valor: "cercano", etiqueta: "Cercano", ejemplo: "«¡Hola! Claro, te ayudo con eso.»" },
  { valor: "formal", etiqueta: "Formal", ejemplo: "«Buen día. Con gusto le ayudo.»" },
  { valor: "juvenil", etiqueta: "Relajado", ejemplo: "«¡Qué onda! Va, te lo checo 🙌»" },
];

export const CANALES_ONBOARDING: { valor: CanalOnboarding; etiqueta: string }[] = [
  { valor: "whatsapp", etiqueta: "WhatsApp" },
  { valor: "instagram", etiqueta: "Instagram" },
  { valor: "facebook", etiqueta: "Facebook" },
];

/** Límites espejo de OnboardingRespuestasIn. */
export const DESCRIPCION_MAX = 300;
export const HORARIO_MAX = 200;
export const EQUIPO_MAX = 1000;

export function etiquetaGiro(giro: GiroNegocio): string {
  return GIROS.find((g) => g.valor === giro)?.etiqueta ?? giro;
}

export function etiquetaTono(tono: TonoAgente): string {
  return TONOS.find((t) => t.valor === tono)?.etiqueta ?? tono;
}

export function respuestasIniciales(): OnboardingRespuestas {
  return {
    giro: "otro",
    descripcion: "",
    agenda_citas: false,
    vende_por_chat: false,
    visitas_campo: false,
    consulta_sistemas: false,
    num_vendedores: 0,
    num_proveedores: 0,
    canales: ["whatsapp"],
    tono: "cercano",
    horario: "",
  };
}

/** Al elegir un giro se marcan sus valores típicos; lo demás no se toca. */
export function conGiro(r: OnboardingRespuestas, giro: GiroNegocio): OnboardingRespuestas {
  const info = GIROS.find((g) => g.valor === giro);
  if (!info) return { ...r, giro };
  return { ...r, giro, agenda_citas: info.agendaCitas, vende_por_chat: info.vendePorChat };
}

/** Recuerda en la pestaña que ya se le mostró el cuestionario a este usuario. */
export const CLAVE_BIENVENIDA_MOSTRADA = "operativai.bienvenida-mostrada";

/**
 * ¿Mandar al cuestionario? Solo al aterrizar en el dashboard (que es a
 * donde lleva el login y el alta) y una vez por pestaña: es omitible, así
 * que si el dueño se va a otra pantalla no se le vuelve a imponer. El
 * backend ya filtra rol y "ver como" en `onboarding_pendiente`.
 */
export function debeIrABienvenida(
  usuario: Pick<UsuarioOut, "onboarding_pendiente" | "impersonado_por"> | null,
  pathname: string,
  yaMostrada: boolean,
): boolean {
  if (!usuario?.onboarding_pendiente || usuario.impersonado_por) return false;
  return pathname === "/dashboard" && !yaMostrada;
}
