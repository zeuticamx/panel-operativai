/**
 * Reglas de presentación de los números de WhatsApp (spec 005a, lib/numeros.ts):
 * textos de los errores 402/404/409/429, plazas usadas y libres, qué acciones
 * ofrece cada número y el cupo "0 quita el tope" del formulario de planes.
 */
import { ApiError } from "@/lib/auth";
import {
  accionesDeNumero,
  cupoParaCrear,
  cupoParaEnviar,
  cupoValido,
  esUltimoActivo,
  mensajeErrorNumero,
  textoCupo,
  textoPlazas,
} from "@/lib/numeros";
import type { NumeroWhatsApp } from "@/lib/types";

function numero(extra: Partial<NumeroWhatsApp> = {}): NumeroWhatsApp {
  return {
    id: "n1",
    phone_number_id: "1001",
    telefono_visible: null,
    bsp_provider: "neuroapi",
    connection_mode: "standard",
    estado: "activo",
    es_principal: false,
    es_linea_avisos: false,
    vinculado_en: "2026-01-01T00:00:00Z",
    pausado_en: null,
    motivo_pausa: null,
    agent_name: "Ana",
    system_prompt: "Eres Ana.",
    model: null,
    temperature: 0.7,
    history_window: 30,
    agente_activo: true,
    configuracion_incompleta: false,
    herramientas: [],
    ...extra,
  };
}

function error(status: number, codigo: string | null, extra: { libera_en?: string } = {}) {
  return new ApiError(status, "texto del servidor", null, { codigo, ...extra });
}

describe("mensajeErrorNumero", () => {
  it("402 cupo_numeros_whatsapp avisa de que no hay plazas libres", () => {
    expect(mensajeErrorNumero(error(402, "cupo_numeros_whatsapp"), "x")).toBe(
      "Tu plan no tiene plazas libres para otro número de WhatsApp activo. Mejora tu plan o pausa uno.",
    );
  });

  it("402 herramienta_no_incluida_en_plan", () => {
    expect(mensajeErrorNumero(error(402, "herramienta_no_incluida_en_plan"), "x")).toMatch(/plan no incluye/i);
  });

  it("404 numero_no_encontrado no revela a quién pertenece el número", () => {
    const m = mensajeErrorNumero(error(404, "numero_no_encontrado"), "x");
    expect(m).toBe("Número no encontrado.");
  });

  it.each([
    ["numero_ya_vinculado", /ya está vinculado a tu negocio.*reactívalo/i],
    ["numero_no_activo", /pausado/i],
    ["configuracion_incompleta", /configuración incompleta/i],
    ["numero_desvinculado", /ya no pertenece al negocio/i],
    ["usar_numeros", /número por número/i],
  ])("409 %s", (codigo, patron) => {
    expect(mensajeErrorNumero(error(409, codigo), "x")).toMatch(patron);
  });

  it("429 demasiados_intentos dice a qué hora se libera el bloqueo", () => {
    const m = mensajeErrorNumero(error(429, "demasiados_intentos", { libera_en: "2026-03-10T18:45:00Z" }), "x", "UTC");
    expect(m).toMatch(/Demasiados intentos/);
    expect(m).toMatch(/18:45/);
  });

  it("429 sin hora de liberación sigue siendo un mensaje claro", () => {
    const m = mensajeErrorNumero(error(429, "demasiados_intentos"), "x");
    expect(m).toMatch(/Demasiados intentos/);
    expect(m).not.toMatch(/undefined|null/);
  });

  it("403 de la línea de avisos explica que la gestiona la plataforma", () => {
    expect(mensajeErrorNumero(error(403, "linea_avisos_gestionada_por_plataforma"), "x")).toMatch(
      /línea de avisos.*plataforma/i,
    );
  });

  it("un código desconocido usa el texto del servidor, y un error ajeno el de reserva", () => {
    expect(mensajeErrorNumero(error(400, "otro_codigo"), "reserva")).toBe("texto del servidor");
    expect(mensajeErrorNumero(new Error(""), "reserva")).toBe("reserva");
    expect(mensajeErrorNumero("raro", "reserva")).toBe("reserva");
  });
});

describe("textoPlazas", () => {
  it("con tope muestra usadas, tope y libres", () => {
    expect(textoPlazas({ tope: 3, plazas_usadas: 2, plazas_libres: 1 })).toBe("2 de 3 plazas usadas · 1 libre");
  });

  it("en plural y con cupo lleno", () => {
    expect(textoPlazas({ tope: 5, plazas_usadas: 2, plazas_libres: 3 })).toBe("2 de 5 plazas usadas · 3 libres");
    expect(textoPlazas({ tope: 2, plazas_usadas: 2, plazas_libres: 0 })).toBe("2 de 2 plazas usadas · cupo lleno");
  });

  it("sin tope solo cuenta los activos", () => {
    expect(textoPlazas({ tope: null, plazas_usadas: 4, plazas_libres: null })).toBe("4 números activos · sin tope");
    expect(textoPlazas({ tope: null, plazas_usadas: 1, plazas_libres: null })).toBe("1 número activo · sin tope");
  });
});

describe("accionesDeNumero", () => {
  it("la gerencia del negocio puede pausar, desvincular y elegir principal en un número activo y completo", () => {
    expect(accionesDeNumero(numero(), false)).toEqual({
      editar: true,
      pausar: true,
      reactivar: false,
      desvincular: true,
      elegirPrincipal: true,
    });
  });

  it("un pausado se reactiva y no puede ser principal", () => {
    const a = accionesDeNumero(numero({ estado: "pausado" }), false);
    expect(a.reactivar).toBe(true);
    expect(a.pausar).toBe(false);
    expect(a.elegirPrincipal).toBe(false);
    expect(a.desvincular).toBe(true);
  });

  it("el principal no ofrece volver a elegirlo, y un incompleto no puede serlo", () => {
    expect(accionesDeNumero(numero({ es_principal: true }), false).elegirPrincipal).toBe(false);
    expect(accionesDeNumero(numero({ configuracion_incompleta: true }), false).elegirPrincipal).toBe(false);
  });

  it("la línea de avisos de la plataforma no se pausa, desvincula ni elige principal, pero sí se edita", () => {
    expect(accionesDeNumero(numero({ es_linea_avisos: true }), false)).toEqual({
      editar: true,
      pausar: false,
      reactivar: false,
      desvincular: false,
      elegirPrincipal: false,
    });
  });

  it("en solo lectura (member) no hay ninguna acción", () => {
    expect(accionesDeNumero(numero(), true)).toEqual({
      editar: false,
      pausar: false,
      reactivar: false,
      desvincular: false,
      elegirPrincipal: false,
    });
  });
});

describe("esUltimoActivo", () => {
  it("avisa cuando se pausa el único número activo", () => {
    expect(esUltimoActivo([numero({ id: "a" }), numero({ id: "b", estado: "pausado" })], "a")).toBe(true);
  });

  it("no avisa si queda otro activo", () => {
    expect(esUltimoActivo([numero({ id: "a" }), numero({ id: "b" })], "a")).toBe(false);
  });

  it("la línea de avisos no cuenta como número activo (D5, P18)", () => {
    expect(esUltimoActivo([numero({ id: "a" }), numero({ id: "av", es_linea_avisos: true })], "a")).toBe(true);
  });
});

describe("cupo de números en el formulario de planes", () => {
  it("vacío o un entero >= 0 es válido; negativo, decimal o texto no", () => {
    for (const ok of ["", "  ", "0", "1", "12"]) expect(cupoValido(ok)).toBe(true);
    for (const mal of ["-1", "1.5", "abc", "1e2"]) expect(cupoValido(mal)).toBe(false);
  });

  it("al crear, vacío y 0 dejan el plan sin tope", () => {
    expect(cupoParaCrear("")).toBeNull();
    expect(cupoParaCrear("0")).toBeNull();
    expect(cupoParaCrear("3")).toBe(3);
  });

  it("al editar, 0 quita el tope y vacío lo quita solo si había uno (null = no tocar)", () => {
    expect(cupoParaEnviar("0", 3)).toBe(0);
    expect(cupoParaEnviar("0", null)).toBe(0);
    expect(cupoParaEnviar("", 3)).toBe(0);
    expect(cupoParaEnviar("", null)).toBeNull();
    expect(cupoParaEnviar("2", 3)).toBe(2);
  });

  it("textoCupo", () => {
    expect(textoCupo(null)).toBe("sin tope");
    expect(textoCupo(1)).toBe("1 número");
    expect(textoCupo(4)).toBe("4 números");
  });
});
