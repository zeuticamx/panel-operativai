/**
 * Tests de lib/exportar-tenants.ts. Solo el contenido: la descarga es
 * descargarArchivo(), que ya se prueba por su lado.
 */
import { celdaCsv, tenantsACsv } from "@/lib/exportar-tenants";
import type { TenantGerenciaOut } from "@/lib/types";

function tenant(overrides: Partial<TenantGerenciaOut> = {}): TenantGerenciaOut {
  return {
    tenant_id: "11111111-1111-1111-1111-111111111111",
    nombre: "Ferretería El Tornillo",
    email: "dueno@ejemplo.com",
    alta: "2026-01-10T12:00:00Z",
    estado: "activo",
    estado_motivo: null,
    estado_actualizado_en: null,
    estado_actualizado_por: null,
    agente_ia_activo: true,
    gestion_vendedores_activo: false,
    agente_operando: true,
    plan: "pro",
    estado_suscripcion: "activa",
    fecha_renovacion: null,
    precio_monthly: "99.99",
    creditos_disponibles: "10.00",
    creditos_gastados: "0",
    usuarios_portal: 2,
    vendedores_activos: 0,
    canales_activos: 1,
    ultimo_mensaje: null,
    consumo: {
      tokens_entrada: 900,
      tokens_salida: 100,
      tokens_total: 1000,
      costo_usd: "0.0150",
      llamadas: 4,
    },
    ingreso_periodo: "99.99",
    costo_moneda: null,
    margen: null,
    tipo_cambio_fuente: "ninguno",
    ...overrides,
  };
}

describe("celdaCsv", () => {
  it("deja pasar texto simple y números tal cual", () => {
    expect(celdaCsv("pro")).toBe("pro");
    expect(celdaCsv(1000)).toBe("1000");
  });

  it("null y undefined son celda vacía, no la palabra null", () => {
    expect(celdaCsv(null)).toBe("");
    expect(celdaCsv(undefined)).toBe("");
  });

  it("entrecomilla comas, comillas y saltos de línea (RFC 4180)", () => {
    expect(celdaCsv("Pérez, Hnos.")).toBe('"Pérez, Hnos."');
    expect(celdaCsv('El "Tornillo"')).toBe('"El ""Tornillo"""');
    expect(celdaCsv("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
  });

  it("neutraliza nombres que Excel ejecutaría como fórmula", () => {
    // El nombre del negocio lo escribe el cliente al registrarse.
    expect(celdaCsv("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(celdaCsv("+52 tienda")).toBe("'+52 tienda");
    expect(celdaCsv("@sum")).toBe("'@sum");
  });

  it("no toca un margen negativo: es un número, no una fórmula", () => {
    expect(celdaCsv("-250.00")).toBe("-250.00");
  });
});

describe("tenantsACsv", () => {
  it("empieza con BOM para que Excel lea los acentos", () => {
    expect(tenantsACsv([]).charCodeAt(0)).toBe(0xfeff);
  });

  it("una fila de encabezado más una por negocio, separadas por CRLF", () => {
    const csv = tenantsACsv([tenant(), tenant({ tenant_id: "otro" })]).slice(1);
    const filas = csv.trimEnd().split("\r\n");
    expect(filas).toHaveLength(3);
    expect(filas[0].split(",")[0]).toBe("tenant_id");
    expect(filas[1]).toContain("Ferretería El Tornillo");
  });

  it("sin tipo de cambio, costo y margen van vacíos y no en cero", () => {
    const [encabezado, fila] = tenantsACsv([tenant()]).slice(1).trimEnd().split("\r\n");
    const columnas = encabezado.split(",");
    const valores = fila.split(",");
    expect(valores[columnas.indexOf("margen")]).toBe("");
    expect(valores[columnas.indexOf("costo_moneda")]).toBe("");
    expect(valores[columnas.indexOf("tokens")]).toBe("1000");
  });

  it("incluye el correo, y en blanco (no 'null') cuando el negocio no tiene ninguno", () => {
    const con = tenantsACsv([tenant()]).slice(1).trimEnd().split("\r\n");
    const columnas = con[0].split(",");
    expect(con[1].split(",")[columnas.indexOf("correo")]).toBe("dueno@ejemplo.com");

    const sin = tenantsACsv([tenant({ email: null })]).slice(1).trimEnd().split("\r\n");
    expect(sin[1].split(",")[columnas.indexOf("correo")]).toBe("");
  });
});
