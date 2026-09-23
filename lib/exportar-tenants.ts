/**
 * Exporta el listado de negocios del panel de plataforma a CSV.
 *
 * CSV y no .xlsx como el embudo: es una tabla plana para pegar en una hoja
 * o cruzar con otra cosa, y no vale la pena cargar exceljs para eso.
 *
 * Separado en una función pura (`tenantsACsv`) y la descarga, para poder
 * probar el contenido sin DOM.
 */
import type { TenantGerenciaOut } from "./types";
import { descargarArchivo, fechaArchivo } from "./descargar-archivo";

/**
 * BOM de UTF-8: sin él, Excel abre el archivo como Windows-1252 y cada
 * "Ferretería" sale como "FerreterÃ­a". Otros programas lo ignoran.
 */
const BOM = "﻿";

const COLUMNAS: { titulo: string; valor: (t: TenantGerenciaOut) => string | number | null }[] = [
  { titulo: "tenant_id", valor: (t) => t.tenant_id },
  { titulo: "negocio", valor: (t) => t.nombre },
  { titulo: "correo", valor: (t) => t.email },
  { titulo: "estado", valor: (t) => t.estado },
  { titulo: "motivo_estado", valor: (t) => t.estado_motivo },
  { titulo: "agente_operando", valor: (t) => (t.agente_operando ? "si" : "no") },
  { titulo: "plan", valor: (t) => t.plan },
  { titulo: "estado_suscripcion", valor: (t) => t.estado_suscripcion },
  { titulo: "precio_mensual", valor: (t) => t.precio_monthly },
  { titulo: "creditos_disponibles", valor: (t) => t.creditos_disponibles },
  { titulo: "tokens", valor: (t) => t.consumo.tokens_total },
  { titulo: "llamadas_modelo", valor: (t) => t.consumo.llamadas },
  { titulo: "costo_usd", valor: (t) => t.consumo.costo_usd },
  { titulo: "ingreso_periodo", valor: (t) => t.ingreso_periodo },
  { titulo: "costo_moneda", valor: (t) => t.costo_moneda },
  { titulo: "margen", valor: (t) => t.margen },
  { titulo: "usuarios_portal", valor: (t) => t.usuarios_portal },
  { titulo: "vendedores_activos", valor: (t) => t.vendedores_activos },
  { titulo: "canales_activos", valor: (t) => t.canales_activos },
  { titulo: "alta", valor: (t) => t.alta },
  { titulo: "ultimo_mensaje", valor: (t) => t.ultimo_mensaje },
];

/**
 * RFC 4180: comillas si hay coma, comilla, salto de línea o espacio en los
 * bordes; las comillas internas se duplican.
 *
 * También se neutraliza la inyección de fórmulas: un nombre de negocio que
 * empiece con `=`, `+`, `-` o `@` Excel lo ejecuta como fórmula al abrir.
 * El nombre lo escribe el cliente al registrarse, así que no es un dato de
 * confianza. Los números reales (negativos incluidos, como un margen) no
 * pasan por acá porque llegan como `number` o como string numérico.
 */
export function celdaCsv(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return String(valor);

  let texto = valor;
  const esNumero = texto.trim() !== "" && !Number.isNaN(Number(texto));
  if (!esNumero && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;

  return /[",\n\r]|^\s|\s$/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function tenantsACsv(items: TenantGerenciaOut[]): string {
  const filas = [
    COLUMNAS.map((c) => c.titulo).join(","),
    ...items.map((t) => COLUMNAS.map((c) => celdaCsv(c.valor(t))).join(",")),
  ];
  // CRLF: es lo que espera Excel y lo que dice la RFC.
  return BOM + filas.join("\r\n") + "\r\n";
}

export function descargarTenantsCsv(items: TenantGerenciaOut[], dias: number): void {
  descargarArchivo(
    tenantsACsv(items),
    `negocios-${dias}d-${fechaArchivo()}.csv`,
    "text/csv;charset=utf-8",
  );
}
