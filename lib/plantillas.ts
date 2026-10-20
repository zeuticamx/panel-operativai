import type { ComponentePlantilla, EstadoPlantillaMeta } from "./types";

/** Espejo de services/plantillas_reglas.py: el backend vuelve a validar todo. */
export const MAX_CUERPO = 1024;
export const MAX_ENCABEZADO = 60;
export const MAX_PIE = 60;
export const NOMBRE_RE = /^[a-z0-9_]{1,512}$/;

const VARIABLE_RE = /\{\{\s*(\d+)\s*\}\}/g;

/** Números de variable en orden de aparición, sin repetidos. */
export function variablesDe(texto: string): number[] {
  const vistas: number[] = [];
  for (const m of texto.matchAll(VARIABLE_RE)) {
    const n = Number(m[1]);
    if (!vistas.includes(n)) vistas.push(n);
  }
  return vistas;
}

/** Cuántos valores pide el texto: el mayor {{n}}, o 0 si no tiene. */
export function cantidadDeVariables(texto: string): number {
  const v = variablesDe(texto);
  return v.length ? Math.max(...v) : 0;
}

/** True si las variables son {{1}}..{{n}} sin saltos. */
export function variablesConsecutivas(texto: string): boolean {
  const v = [...variablesDe(texto)].sort((a, b) => a - b);
  return v.every((n, i) => n === i + 1);
}

/** Reemplaza {{n}} por valores[n-1]; deja `{{n}}` visible si todavía no hay valor. */
export function rellenar(texto: string, valores: string[]): string {
  return texto.replace(VARIABLE_RE, (marca, n: string) => {
    const valor = valores[Number(n) - 1];
    return valor && valor.trim() ? valor : marca;
  });
}

/** Normaliza lo que escribe la persona a un slug válido para Meta. */
export function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
}

export function textoDe(componentes: ComponentePlantilla[], tipo: string): string | undefined {
  return componentes.find((c) => c.type.toUpperCase() === tipo)?.text;
}

export const ESTADO_PLANTILLA: Record<
  EstadoPlantillaMeta,
  { etiqueta: string; tono: "success" | "warning" | "danger" | "neutral" }
> = {
  APPROVED: { etiqueta: "Aprobada", tono: "success" },
  PENDING: { etiqueta: "Pendiente", tono: "warning" },
  REJECTED: { etiqueta: "Rechazada", tono: "danger" },
  PAUSED: { etiqueta: "Pausada", tono: "warning" },
  DISABLED: { etiqueta: "Deshabilitada", tono: "danger" },
};

export const CATEGORIA_ETIQUETA = {
  UTILITY: "Utilidad",
  MARKETING: "Marketing",
  AUTHENTICATION: "Autenticación",
} as const;
