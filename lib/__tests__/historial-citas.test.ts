import {
  CANALES_HISTORIAL_CITAS,
  TEXTO_HAY_MAS_CITAS,
  canalAdmiteHistorialCitas,
  formatoFechaHoraNegocio,
  mostrarAccionHistorialCitas,
  textoHistorialVacio,
} from "@/lib/historial-citas";

describe("textos fijos (R16, R17)", () => {
  it("el aviso de hay_mas es el mismo texto de la spec", () => {
    expect(TEXTO_HAY_MAS_CITAS).toBe("Hay citas anteriores que no se muestran.");
  });

  it.each(["owner", "superadmin", "member"])("vacío de %s", (rol) => {
    expect(textoHistorialVacio(rol)).toBe(
      "Este cliente aún no tiene citas pasadas ni canceladas.",
    );
  });

  it("vacío del proveedor no habla de otros proveedores", () => {
    expect(textoHistorialVacio("proveedor")).toBe(
      "No hay citas tuyas con este cliente.",
    );
  });
});

describe("canales admitidos (R20)", () => {
  it("solo whatsapp, instagram y facebook", () => {
    expect([...CANALES_HISTORIAL_CITAS].sort()).toEqual([
      "facebook",
      "instagram",
      "whatsapp",
    ]);
  });

  it.each(["web", "widget", "", "WhatsApp ", "telegram"])("rechaza %p", (c) => {
    expect(canalAdmiteHistorialCitas(c)).toBe(false);
  });

  it("rechaza nulo e indefinido", () => {
    expect(canalAdmiteHistorialCitas(null)).toBe(false);
    expect(canalAdmiteHistorialCitas(undefined)).toBe(false);
  });
});

describe("mostrarAccionHistorialCitas (criterio 20)", () => {
  it.each(["owner", "superadmin", "member", "proveedor"])(
    "%s la ve en un canal admitido",
    (rol) => {
      for (const canal of ["whatsapp", "instagram", "facebook"]) {
        expect(mostrarAccionHistorialCitas({ rol, canal })).toBe(true);
      }
    },
  );

  it("el vendedor no la ve en ningún canal", () => {
    for (const canal of ["whatsapp", "instagram", "facebook"]) {
      expect(mostrarAccionHistorialCitas({ rol: "vendedor", canal })).toBe(false);
    }
  });

  it("un canal no admitido no la muestra a nadie", () => {
    for (const rol of ["owner", "member", "proveedor"]) {
      expect(mostrarAccionHistorialCitas({ rol, canal: "web" })).toBe(false);
      expect(mostrarAccionHistorialCitas({ rol, canal: null })).toBe(false);
    }
  });

  it("sin rol conocido no se muestra", () => {
    expect(mostrarAccionHistorialCitas({ rol: null, canal: "whatsapp" })).toBe(false);
    expect(mostrarAccionHistorialCitas({ rol: "otro", canal: "whatsapp" })).toBe(false);
  });
});

describe("formatoFechaHoraNegocio", () => {
  const zonaOriginal = process.env.TZ;
  afterEach(() => {
    if (zonaOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = zonaOriginal;
  });

  it.each(["Asia/Tokyo", "America/Los_Angeles", "UTC"])(
    "muestra la hora de pared del texto ISO sin convertir (TZ=%s)",
    (tz) => {
      process.env.TZ = tz;
      const a = formatoFechaHoraNegocio("2026-01-09T14:00:00-06:00");
      const b = formatoFechaHoraNegocio("2026-01-09T15:00:00-05:00");
      expect(a).toMatch(/02:00\s*p\.\s*m\./);
      expect(b).toMatch(/03:00\s*p\.\s*m\./);
      expect(a).toContain("2026");
      expect(a).toMatch(/09/);
    },
  );

  it("no cruza de día por la zona del navegador", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(formatoFechaHoraNegocio("2026-01-09T23:30:00-06:00")).toMatch(/09.*11:30\s*p\.\s*m\./);
  });

  it("un texto inválido se devuelve tal cual, sin reventar", () => {
    expect(formatoFechaHoraNegocio("no es fecha")).toBe("no es fecha");
    expect(formatoFechaHoraNegocio("2026-13-45T99:00:00-06:00")).toBe("2026-13-45T99:00:00-06:00");
  });
});
