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
