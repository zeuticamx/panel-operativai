import type { AccesoPlanOut, BloqueoPlanDetalle, CodigoBloqueo, Herramienta } from "./types";

/**
 * Qué herramienta del plan hay detrás de cada pantalla del portal.
 *
 * Espejo de las dependencias `requiere_herramienta(...)` de los routers
 * del backend: si una pantalla nueva llama a una API gateada, va acá. El
 * backend vuelve a comprobar en cada petición — esto es para no montar una
 * pantalla que solo va a recibir 402, no la seguridad.
 *
 * Se resuelve por el prefijo más largo: /vendedores/cartera es CRM de campo
 * aunque /vendedores sea el embudo.
 */
interface RutaHerramienta {
  prefijo: string;
  herramienta: Herramienta;
  /** Con el plan vencido se puede seguir mirando (GET); ver deps.requiere_herramienta. */
  lecturaSinPlan?: boolean;
}

const RUTAS: RutaHerramienta[] = [
  { prefijo: "/agente", herramienta: "agente" },
  { prefijo: "/conversaciones", herramienta: "agente", lecturaSinPlan: true },
  { prefijo: "/canales", herramienta: "agente" },
  { prefijo: "/herramientas", herramienta: "herramientas" },
  { prefijo: "/vendedores", herramienta: "vendedores" },
  { prefijo: "/vendedores/cartera", herramienta: "crm_campo" },
  { prefijo: "/vendedores/actividad", herramienta: "crm_campo" },
  { prefijo: "/calendario", herramienta: "calendario" },
];

/** Siempre abiertas: por acá se sale de un bloqueo (o no son del negocio). */
const RUTAS_LIBRES = ["/suscripcion", "/pagos", "/gerencia"];

function coincidePrefijo(pathname: string, prefijo: string): boolean {
  return pathname === prefijo || pathname.startsWith(prefijo + "/");
}

export function esRutaLibre(pathname: string): boolean {
  return RUTAS_LIBRES.some((p) => coincidePrefijo(pathname, p));
}

export function herramientaDeRuta(pathname: string): RutaHerramienta | null {
  let mejor: RutaHerramienta | null = null;
  for (const r of RUTAS) {
    if (coincidePrefijo(pathname, r.prefijo) && (!mejor || r.prefijo.length > mejor.prefijo.length)) mejor = r;
  }
  return mejor;
}

export const HERRAMIENTAS_INFO: Record<
  Herramienta,
  { nombre: string; frase: string; beneficios: string[] }
> = {
  agente: {
    nombre: "Agente de IA",
    frase: "El agente de IA",
    beneficios: [
      "Respuestas automáticas en WhatsApp, Instagram y Facebook",
      "Historial de conversaciones y respuesta manual",
      "Conexión de canales",
    ],
  },
  vendedores: {
    nombre: "Gestión de vendedores",
    frase: "La gestión de vendedores",
    beneficios: [
      "Embudo de ventas con los leads del chat",
      "Reparto automático entre tu equipo",
      "Métricas de conversión por vendedor",
    ],
  },
  herramientas: {
    nombre: "Herramientas del agente",
    frase: "Las herramientas del agente",
    beneficios: [
      "Tu agente consulta Google Sheets y Google Docs",
      "Respuestas con tu inventario, precios o políticas al día",
    ],
  },
  crm_campo: {
    nombre: "CRM de campo",
    frase: "El CRM de campo",
    beneficios: [
      "Cartera de clientes con ubicación",
      "Check-in de visitas con geocerca",
      "Reportes de actividad de tu equipo en calle",
    ],
  },
  calendario: {
    nombre: "Calendario",
    frase: "El calendario",
    beneficios: [
      "Tus clientes reservan citas desde el chat",
      "Agenda por proveedor, servicios y horarios",
      "Corte diario de lo cobrado",
    ],
  },
};

/** Mismo criterio que AccesoPlan.codigo_bloqueo en el backend. */
function codigoPara(acceso: AccesoPlanOut, herramienta: Herramienta): CodigoBloqueo | null {
  if (acceso.herramientas.includes(herramienta)) return null;
  if (acceso.estado === "suspendido") return "cuenta_suspendida";
  if (acceso.estado === "vigente") return "plan_insuficiente";
  return "plan_requerido";
}

/**
 * El mismo detalle que mandaría el backend en un 402, armado con lo que ya
 * trajo /pagos/acceso. Así la vista de bloqueo de una pantalla y el modal
 * de un 402 en mitad de la sesión muestran exactamente lo mismo.
 */
export function bloqueoLocal(
  acceso: AccesoPlanOut,
  herramienta: Herramienta,
): BloqueoPlanDetalle | null {
  const codigo = codigoPara(acceso, herramienta);
  if (!codigo) return null;
  return {
    codigo,
    herramienta,
    estado: acceso.estado,
    plan_actual: acceso.plan,
    planes_que_la_incluyen: acceso.planes
      .filter((p) => p.herramientas.includes(herramienta))
      .map((p) => p.nombre),
    mensaje: "",
  };
}

/**
 * ¿Hay que tapar esta pantalla? No, si el plan la incluye; tampoco si solo
 * falta renovar y la pantalla admite lectura sin plan (el backend deja pasar
 * los GET y el modal aparece recién al intentar operar).
 */
export function bloqueoDePantalla(
  acceso: AccesoPlanOut,
  pathname: string,
): BloqueoPlanDetalle | null {
  const ruta = herramientaDeRuta(pathname);

  // Cuenta suspendida por la plataforma: nada del portal del negocio (ni el
  // dashboard, que lee conversaciones), salvo por dónde se resuelve.
  if (acceso.estado === "suspendido") {
    return esRutaLibre(pathname) ? null : bloqueoLocal(acceso, ruta?.herramienta ?? "agente");
  }

  if (!ruta) return null;
  const bloqueo = bloqueoLocal(acceso, ruta.herramienta);
  if (bloqueo?.codigo === "plan_requerido" && ruta.lecturaSinPlan) return null;
  return bloqueo;
}

/** Plan al que conviene mandar: el primero (más barato) de la grilla que la incluye. */
export function planSugerido(bloqueo: BloqueoPlanDetalle): string | null {
  // Renovar: el que ya tenía, si ese incluye la herramienta.
  if (
    bloqueo.codigo === "plan_requerido" &&
    bloqueo.plan_actual &&
    bloqueo.planes_que_la_incluyen.includes(bloqueo.plan_actual)
  ) {
    return bloqueo.plan_actual;
  }
  return bloqueo.planes_que_la_incluyen[0] ?? null;
}

export function capitalizar(nombre: string): string {
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

interface Textos {
  titulo: string;
  descripcion: string;
  cta: { etiqueta: string; href: string } | null;
}

/**
 * Qué decir en cada caso. Sin tono de error: es una invitación a seguir,
 * no un "acceso denegado".
 */
export function textosBloqueo(bloqueo: BloqueoPlanDetalle): Textos {
  const info = HERRAMIENTAS_INFO[bloqueo.herramienta];
  const plan = planSugerido(bloqueo);
  const href = `/suscripcion${plan ? `?plan=${encodeURIComponent(plan)}` : ""}`;

  // "El calendario" → "el calendario", para usarlo a mitad de frase.
  const loQueSeUsa = info.frase.charAt(0).toLowerCase() + info.frase.slice(1);

  if (bloqueo.codigo === "cuenta_suspendida") {
    return {
      titulo: "Tu cuenta está en pausa",
      descripcion:
        "Por ahora las herramientas del portal no están disponibles. Tu información sigue guardada; comunícate con el equipo de OperativAI para reactivarla.",
      cta: null,
    };
  }

  if (bloqueo.codigo === "plan_requerido") {
    const sinPlan = bloqueo.estado === "sin_plan";
    return {
      titulo: sinPlan ? "Elige un plan para empezar" : "Tu plan no está activo",
      descripcion: sinPlan
        ? `Para usar ${loQueSeUsa} necesitas un plan. Elige el tuyo y empieza hoy mismo.`
        : `Renueva tu plan para volver a usar ${loQueSeUsa}. Tu información sigue guardada.`,
      cta: { etiqueta: sinPlan ? "Ver planes" : "Renovar plan", href },
    };
  }

  const actual = bloqueo.plan_actual ? ` (${capitalizar(bloqueo.plan_actual)})` : "";
  return {
    titulo: plan
      ? `${info.nombre} está en el plan ${capitalizar(plan)}`
      : `${info.nombre} no está en tu plan`,
    descripcion: plan
      ? `Tu plan actual${actual} no incluye esta herramienta. Mejóralo y úsala al momento.`
      : "Ningún plan disponible la incluye por ahora. Comunícate con el equipo de OperativAI y lo vemos contigo.",
    cta: plan ? { etiqueta: `Ver plan ${capitalizar(plan)}`, href } : null,
  };
}
