import {
  avisoDecisionPendiente,
  cuerpoPatchAviso,
  infoEstadoPlantilla,
  motivoVisible,
  puedeActivarAviso,
  puedeEditarAvisos,
  puedeVerPanelAvisos,
} from "@/lib/avisos-cita";
import type { ConfigAvisos, FuncionAviso } from "@/lib/types";

const funcion: FuncionAviso = {
  tipo: "recordatorio",
  nombre: "recordatorio_cita_x",
  texto: "Hola",
  activa: false,
  estado_plantilla: "NO_CREADA",
  motivo_rechazo: null,
};
const config: ConfigAvisos = {
  oferta: "aceptada",
  calendario_activo: true,
  numero_emisor_ok: true,
  mensaje: null,
  funciones: [funcion],
};

describe("infoEstadoPlantilla", () => {
  it("PENDING es espera, no error", () => {
    const i = infoEstadoPlantilla("PENDING");
    expect(i.etiqueta).toBe("Esperando aprobación de Meta");
    expect(i.tono).toBe("espera");
  });
  it("APPROVED es ok y NO_CREADA neutro", () => {
    expect(infoEstadoPlantilla("APPROVED").tono).toBe("ok");
    expect(infoEstadoPlantilla("NO_CREADA").tono).toBe("neutro");
  });
  it("REJECTED, PAUSED y DISABLED son error", () => {
    for (const e of ["REJECTED", "PAUSED", "DISABLED"] as const) {
      expect(infoEstadoPlantilla(e).tono).toBe("error");
    }
  });
});

describe("motivoVisible", () => {
  it("solo en estados caídos y con motivo", () => {
    expect(motivoVisible({ ...funcion, estado_plantilla: "REJECTED", motivo_rechazo: "mal" })).toBe("mal");
    expect(motivoVisible({ ...funcion, estado_plantilla: "PENDING", motivo_rechazo: "mal" })).toBeNull();
    expect(motivoVisible({ ...funcion, estado_plantilla: "REJECTED", motivo_rechazo: null })).toBeNull();
  });
});

describe("permisos", () => {
  it("el panel lo ven owner, superadmin y member", () => {
    expect(puedeVerPanelAvisos("owner")).toBe(true);
    expect(puedeVerPanelAvisos("superadmin")).toBe(true);
    expect(puedeVerPanelAvisos("member")).toBe(true);
    expect(puedeVerPanelAvisos("vendedor")).toBe(false);
    expect(puedeVerPanelAvisos("proveedor")).toBe(false);
  });
  it("edita solo gerencia, sin ver-como y con calendario activo", () => {
    expect(puedeEditarAvisos({ role: "owner", impersonado_por: null }, config)).toBe(true);
    expect(puedeEditarAvisos({ role: "member", impersonado_por: null }, config)).toBe(false);
    expect(puedeEditarAvisos({ role: "owner", impersonado_por: "soporte@x" }, config)).toBe(false);
    expect(
      puedeEditarAvisos({ role: "owner", impersonado_por: null }, { ...config, calendario_activo: false }),
    ).toBe(false);
  });
  it("sin número emisor no se activa, pero sí se desactiva", () => {
    const sin = { ...config, numero_emisor_ok: false };
    expect(puedeActivarAviso(sin, { ...funcion, activa: false })).toBe(false);
    expect(puedeActivarAviso(sin, { ...funcion, activa: true })).toBe(true);
    expect(puedeActivarAviso(config, funcion)).toBe(true);
  });
});

describe("avisoDecisionPendiente (RF-13)", () => {
  const pendiente: ConfigAvisos = { ...config, oferta: "pendiente" };
  const rechazada: ConfigAvisos = { ...config, oferta: "rechazada" };

  it("quien edita ve el texto accionable según la oferta", () => {
    expect(avisoDecisionPendiente(pendiente, true)).toBe("accionable_pendiente");
    expect(avisoDecisionPendiente(rechazada, true)).toBe("accionable_rechazada");
  });
  it("quien no edita ve solo lectura con la oferta pendiente o rechazada", () => {
    expect(avisoDecisionPendiente(pendiente, false)).toBe("solo_lectura");
    expect(avisoDecisionPendiente(rechazada, false)).toBe("solo_lectura");
  });
  it("calendario inactivo o oferta aceptada: nada", () => {
    expect(avisoDecisionPendiente({ ...pendiente, calendario_activo: false }, false)).toBeNull();
    expect(avisoDecisionPendiente({ ...rechazada, calendario_activo: false }, true)).toBeNull();
    expect(avisoDecisionPendiente(config, true)).toBeNull();
    expect(avisoDecisionPendiente(config, false)).toBeNull();
  });
});

describe("cuerpoPatchAviso", () => {
  it("arma el cuerpo por tipo", () => {
    expect(cuerpoPatchAviso("recordatorio", true)).toEqual({ recordatorio_activo: true });
    expect(cuerpoPatchAviso("cancelacion", false)).toEqual({ cancelacion_activo: false });
  });
});
