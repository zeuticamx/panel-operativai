import { ApiError } from "@/lib/auth";
import { debeMostrarOfertaAvisos, mensajeErrorOferta, ofertaAvisosRetieneRecorrido } from "@/lib/avisos-cita";

describe("debeMostrarOfertaAvisos", () => {
  const pendiente = { role: "owner", oferta_avisos_cita_pendiente: true, impersonado_por: null };

  it("muestra a un owner con la oferta pendiente que no la vio en la pestaña", () => {
    expect(debeMostrarOfertaAvisos(pendiente, false)).toBe(true);
    expect(debeMostrarOfertaAvisos({ ...pendiente, role: "superadmin" }, false)).toBe(true);
  });
  it("no muestra sin usuario, sin oferta pendiente o si ya se mostró", () => {
    expect(debeMostrarOfertaAvisos(null, false)).toBe(false);
    expect(debeMostrarOfertaAvisos({ ...pendiente, oferta_avisos_cita_pendiente: false }, false)).toBe(false);
    expect(debeMostrarOfertaAvisos({ role: "owner" }, false)).toBe(false);
    expect(debeMostrarOfertaAvisos(pendiente, true)).toBe(false);
  });
  it("nunca en sesión impersonada ni a roles que no deciden", () => {
    expect(debeMostrarOfertaAvisos({ ...pendiente, impersonado_por: "soporte@x" }, false)).toBe(false);
    for (const role of ["member", "vendedor", "proveedor"]) {
      expect(debeMostrarOfertaAvisos({ ...pendiente, role }, false)).toBe(false);
    }
  });
});

describe("ofertaAvisosRetieneRecorrido (RF-12)", () => {
  const pendiente = { role: "owner", oferta_avisos_cita_pendiente: true, impersonado_por: null };

  it("retiene con la oferta pendiente que se abrirá en esta pestaña", () => {
    expect(ofertaAvisosRetieneRecorrido(pendiente, false, false)).toBe(true);
  });
  it("retiene mientras el modal está abierto, aunque la clave ya valga 1", () => {
    expect(ofertaAvisosRetieneRecorrido(pendiente, true, true)).toBe(true);
  });
  it("libera cuando ya se mostró y el modal se cerró", () => {
    expect(ofertaAvisosRetieneRecorrido(pendiente, true, false)).toBe(false);
  });
  it("no retiene sin oferta pendiente, sin permiso o impersonado", () => {
    expect(ofertaAvisosRetieneRecorrido(null, false, false)).toBe(false);
    expect(ofertaAvisosRetieneRecorrido({ ...pendiente, oferta_avisos_cita_pendiente: false }, false, false)).toBe(false);
    expect(ofertaAvisosRetieneRecorrido({ ...pendiente, role: "member" }, false, false)).toBe(false);
    expect(ofertaAvisosRetieneRecorrido({ ...pendiente, impersonado_por: "soporte@x" }, false, false)).toBe(false);
  });
});

describe("mensajeErrorOferta", () => {
  const err = (status: number, codigo: string | null, detail = "x") =>
    new ApiError(status, detail, null, { codigo });

  it("explica el número principal ante sin_numero_emisor", () => {
    expect(mensajeErrorOferta(err(409, "sin_numero_emisor"))).toMatch(/número principal de WhatsApp activo/);
  });
  it("explica calendario_inactivo y plantilla_existente_no_utilizable", () => {
    expect(mensajeErrorOferta(err(409, "calendario_inactivo"))).toMatch(/calendario/);
    expect(mensajeErrorOferta(err(409, "plantilla_existente_no_utilizable"))).toMatch(/Elimina alguna/);
  });
  it("un 502 habla del proveedor y de reintentar", () => {
    expect(mensajeErrorOferta(err(502, null))).toMatch(/proveedor.*de nuevo/);
  });
  it("otro ApiError usa su detalle; lo desconocido, un texto genérico", () => {
    expect(mensajeErrorOferta(err(403, null, "Sin permiso"))).toBe("Sin permiso");
    expect(mensajeErrorOferta(new Error("boom"))).toBe("No se pudo completar la acción");
  });
});
