/**
 * Registro de recorridos: a qué vista corresponde cada uno, que /gerencia
 * nunca tenga, que toda pantalla de usuario tenga el suyo y que cada ancla
 * exista de verdad en el código.
 */
import fs from "node:fs";
import path from "node:path";

import {
  PATRONES_CON_RECORRIDO,
  RUTAS_SIN_RECORRIDO,
  esRutaGerencia,
  marcarRecorridoVisto,
  recorridoParaRuta,
  recorridoVisto,
} from "@/lib/recorridos";

const APP = path.join(__dirname, "..", "..", "app");

function archivos(dir: string, filtro: (f: string) => boolean): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : archivos(ruta, filtro);
    return filtro(e.name) ? [ruta] : [];
  });
}

/** app/(privado)/conversaciones/[id]/page.tsx -> /conversaciones/[id] */
function rutaDePagina(archivo: string): string {
  const segmentos = path
    .relative(APP, path.dirname(archivo))
    .split(path.sep)
    .filter((s) => s && !/^\(.+\)$/.test(s));
  return "/" + segmentos.join("/");
}

const PAGINAS = archivos(APP, (f) => f === "page.tsx").map(rutaDePagina);

test("resuelve rutas fijas y dinámicas", () => {
  expect(recorridoParaRuta("/dashboard")?.clave).toBe("/dashboard");
  expect(recorridoParaRuta("/conversaciones/abc-123")?.clave).toBe("/conversaciones/[id]");
  expect(recorridoParaRuta("/vendedores/v-9")?.clave).toBe("/vendedores/[id]");
  // Una ruta fija no debe caer en el patrón dinámico hermano.
  expect(recorridoParaRuta("/vendedores/actividad")?.clave).toBe("/vendedores/actividad");
  expect(recorridoParaRuta("/no-existe")).toBeNull();
  expect(recorridoParaRuta(null)).toBeNull();
});

test.each(["/gerencia", "/gerencia/tenants", "/gerencia/tenants/t-1", "/gerencia/conversaciones/c-1"])(
  "%s no tiene recorrido",
  (ruta) => {
    expect(esRutaGerencia(ruta)).toBe(true);
    expect(recorridoParaRuta(ruta)).toBeNull();
  },
);

test("el registro no contiene ninguna ruta de gerencia", () => {
  expect(PATRONES_CON_RECORRIDO.filter(esRutaGerencia)).toEqual([]);
});

test("toda vista de usuario tiene recorrido (las de gerencia y las transitorias no)", () => {
  const sinRecorrido = PAGINAS.filter(
    (r) => !esRutaGerencia(r) && !RUTAS_SIN_RECORRIDO.includes(r) && !PATRONES_CON_RECORRIDO.includes(r),
  );
  expect(sinRecorrido).toEqual([]);
  // Y ningún recorrido apunta a una página que ya no existe.
  expect(PATRONES_CON_RECORRIDO.filter((p) => !PAGINAS.includes(p))).toEqual([]);
});

test("cada recorrido abre con una intro sin ancla y cada ancla existe en el código", () => {
  const fuente = archivos(APP, (f) => f.endsWith(".tsx"))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");

  const faltantes: string[] = [];
  for (const patron of PATRONES_CON_RECORRIDO) {
    const recorrido = recorridoParaRuta(patron.replace(/\[[^\]]+\]/g, "x"))!;
    expect(recorrido.pasos[0].ancla).toBeUndefined();
    for (const paso of recorrido.pasos) {
      if (paso.ancla && !fuente.includes(`data-tour="${paso.ancla}"`)) faltantes.push(`${patron} → ${paso.ancla}`);
    }
  }
  expect(faltantes).toEqual([]);
});

test("recuerda por usuario y por vista si ya se vio", () => {
  localStorage.clear();
  expect(recorridoVisto("u1", "/dashboard")).toBe(false);
  marcarRecorridoVisto("u1", "/dashboard");
  expect(recorridoVisto("u1", "/dashboard")).toBe(true);
  expect(recorridoVisto("u2", "/dashboard")).toBe(false);
  expect(recorridoVisto("u1", "/agente")).toBe(false);
});
