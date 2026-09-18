import { infoEstadoPipeline } from "./formato";

/**
 * Color por etapa del embudo, compartido entre los exportadores (Excel,
 * PDF) y cualquier otro reporte futuro. Mismos tonos que `ESTADO_PIPELINE_INFO`
 * en `lib/formato.ts`, pero en hex: fuera del DOM no hay clases de Tailwind
 * ni tokens CSS que resolver.
 */
const ETAPA_HEX: Record<string, { fondo: string; texto: string }> = {
  nuevo: { fondo: "3987E5", texto: "FFFFFF" }, // series-1 (info)
  contactado: { fondo: "E2E8F0", texto: "0F172A" }, // neutral
  en_seguimiento: { fondo: "E2E8F0", texto: "0F172A" }, // neutral
  cotizado: { fondo: "F59E0B", texto: "0F172A" }, // warning
  negociacion: { fondo: "F59E0B", texto: "0F172A" }, // warning
  ganado: { fondo: "22C55E", texto: "FFFFFF" }, // success
  perdido: { fondo: "EF4444", texto: "FFFFFF" }, // danger
};

const DEFECTO = { fondo: "E2E8F0", texto: "0F172A" };

function colorEtapa(estado: string): { fondo: string; texto: string } {
  return ETAPA_HEX[estado] ?? DEFECTO;
}

/** Formato ARGB que espera ExcelJS ("FF" + RRGGBB). */
export function argbEtapa(estado: string): { fill: string; texto: string } {
  const { fondo, texto } = colorEtapa(estado);
  return { fill: `FF${fondo}`, texto: `FF${texto}` };
}

/** Formato CSS/react-pdf ("#RRGGBB"). */
export function cssEtapa(estado: string): { fondo: string; texto: string } {
  const { fondo, texto } = colorEtapa(estado);
  return { fondo: `#${fondo}`, texto: `#${texto}` };
}

/**
 * Clase Tailwind de relleno sólido por etapa, para barras/columnas en el
 * DOM (gráficos de reportes). Mismo tono que `ESTADO_PIPELINE_INFO`, no el
 * hex de arriba: acá sí hay tokens CSS que respetan tema claro/oscuro.
 */
const TONE_BG: Record<string, string> = {
  neutral: "bg-bg-600",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-series-1",
};

export function claseFondoEtapa(estado: string): string {
  return TONE_BG[infoEstadoPipeline(estado).tone] ?? TONE_BG.neutral;
}

/**
 * Mismo tono que `claseFondoEtapa`, pero como referencia a la variable CSS
 * en vez de una clase Tailwind — para librerías que pintan sobre SVG y
 * necesitan un color en un atributo (`fill`, `stroke`), como Recharts.
 * Al ser `var(--x)` y no un hex calculado, sigue respondiendo al cambio de
 * tema claro/oscuro en vivo, sin volver a renderizar el gráfico.
 */
const TONE_VAR: Record<string, string> = {
  neutral: "var(--bg-600)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--series-1)",
};

export function varFondoEtapa(estado: string): string {
  return TONE_VAR[infoEstadoPipeline(estado).tone] ?? TONE_VAR.neutral;
}
