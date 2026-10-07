/**
 * Lógica pura del control por plan en el portal (lib/herramientas-plan.ts):
 * qué pantalla es qué herramienta, cuándo se tapa, y qué se le dice a quien
 * choca con el plan.
 */
import {
  bloqueoDePantalla,
  bloqueoLocal,
  herramientaDeRuta,
  planSugerido,
  textosBloqueo,
} from "@/lib/herramientas-plan";
import type { AccesoPlanOut, Herramienta } from "@/lib/types";

const TODAS: Herramienta[] = ["agente", "vendedores", "herramientas", "crm_campo", "calendario"];

const PLANES: AccesoPlanOut["planes"] = [
  { nombre: "starter", herramientas: ["agente", "vendedores"] },
  { nombre: "pro", herramientas: TODAS },
  { nombre: "enterprise", herramientas: TODAS },
];

function acceso(overrides: Partial<AccesoPlanOut> = {}): AccesoPlanOut {
  return { estado: "vigente", plan: "starter", herramientas: ["agente", "vendedores"], planes: PLANES, ...overrides };
}

describe("herramientaDeRuta", () => {
  it.each([
    ["/agente", "agente"],
    ["/conversaciones/123", "agente"],
    ["/canales", "agente"],
    ["/herramientas", "herramientas"],
    ["/vendedores", "vendedores"],
    ["/vendedores/equipo", "vendedores"],
    ["/vendedores/cartera", "crm_campo"],
    ["/vendedores/actividad", "crm_campo"],
    ["/calendario/servicios", "calendario"],
  ])("%s → %s", (ruta, herramienta) => {
    expect(herramientaDeRuta(ruta)?.herramienta).toBe(herramienta);
  });

  it.each(["/dashboard", "/suscripcion", "/gerencia/planes", "/vendedoresx"])(
    "%s no es de ninguna herramienta",
    (ruta) => {
      expect(herramientaDeRuta(ruta)).toBeNull();
    },
  );
});

describe("bloqueoDePantalla", () => {
  it("starter no entra a calendario, CRM de campo ni herramientas", () => {
    for (const ruta of ["/calendario", "/vendedores/cartera", "/herramientas"]) {
      expect(bloqueoDePantalla(acceso(), ruta)?.codigo).toBe("plan_insuficiente");
    }
  });

  it("starter sí entra a lo que su plan incluye", () => {
    for (const ruta of ["/agente", "/conversaciones", "/vendedores", "/dashboard", "/suscripcion"]) {
      expect(bloqueoDePantalla(acceso(), ruta)).toBeNull();
    }
  });

  it("la agenda se abre con cualquiera de sus dos módulos", () => {
    // starter: embudo sí, CRM de campo no.
    expect(bloqueoDePantalla(acceso(), "/vendedores/agenda")).toBeNull();
    // Solo CRM de campo: tampoco se tapa (el backend sirve las tareas).
    const soloCampo = acceso({ herramientas: ["agente", "crm_campo"] });
    expect(bloqueoDePantalla(soloCampo, "/vendedores/agenda")).toBeNull();
    // Ninguno de los dos: se tapa.
    const ninguno = acceso({ herramientas: ["agente"] });
    expect(bloqueoDePantalla(ninguno, "/vendedores/agenda")?.codigo).toBe("plan_insuficiente");
    // Suspendida gana sobre las alternativas.
    const suspendida = acceso({ estado: "suspendido", herramientas: [] });
    expect(bloqueoDePantalla(suspendida, "/vendedores/agenda")?.codigo).toBe("cuenta_suspendida");
  });

  it("pro entra a todo", () => {
    const pro = acceso({ plan: "pro", herramientas: TODAS });
    expect(bloqueoDePantalla(pro, "/calendario")).toBeNull();
    expect(bloqueoDePantalla(pro, "/vendedores/cartera")).toBeNull();
  });

  it("plan vencido: tapa las herramientas pero deja leer conversaciones", () => {
    const vencido = acceso({ estado: "vencido", herramientas: [] });
    expect(bloqueoDePantalla(vencido, "/agente")?.codigo).toBe("plan_requerido");
    expect(bloqueoDePantalla(vencido, "/conversaciones")).toBeNull();
    expect(bloqueoDePantalla(vencido, "/dashboard")).toBeNull();
  });

  it("cuenta suspendida: tapa todo salvo suscripción y pagos", () => {
    const suspendida = acceso({ estado: "suspendido", herramientas: [] });
    expect(bloqueoDePantalla(suspendida, "/dashboard")?.codigo).toBe("cuenta_suspendida");
    expect(bloqueoDePantalla(suspendida, "/conversaciones")?.codigo).toBe("cuenta_suspendida");
    expect(bloqueoDePantalla(suspendida, "/suscripcion")).toBeNull();
    expect(bloqueoDePantalla(suspendida, "/pagos/exito")).toBeNull();
  });

  it("piloto entra a todo aunque no tenga plan", () => {
    const piloto = acceso({ estado: "prueba", plan: null, herramientas: TODAS });
    expect(bloqueoDePantalla(piloto, "/calendario")).toBeNull();
  });
});

describe("bloqueoLocal", () => {
  it("arma el mismo detalle que mandaría el backend en el 402", () => {
    expect(bloqueoLocal(acceso(), "calendario")).toEqual({
      codigo: "plan_insuficiente",
      herramienta: "calendario",
      estado: "vigente",
      plan_actual: "starter",
      planes_que_la_incluyen: ["pro", "enterprise"],
      mensaje: "",
    });
  });

  it("null si la herramienta está incluida", () => {
    expect(bloqueoLocal(acceso(), "agente")).toBeNull();
  });
});

describe("planSugerido y textos", () => {
  it("plan insuficiente: manda al plan más barato que la incluye", () => {
    const bloqueo = bloqueoLocal(acceso(), "calendario")!;
    expect(planSugerido(bloqueo)).toBe("pro");

    const t = textosBloqueo(bloqueo);
    expect(t.titulo).toBe("Calendario está en el plan Pro");
    expect(t.cta).toEqual({ etiqueta: "Ver plan Pro", href: "/suscripcion?plan=pro" });
  });

  it("plan vencido que incluía la herramienta: sugiere renovar el mismo", () => {
    const bloqueo = bloqueoLocal(acceso({ estado: "vencido", plan: "enterprise", herramientas: [] }), "calendario")!;
    expect(planSugerido(bloqueo)).toBe("enterprise");
    expect(textosBloqueo(bloqueo).cta?.etiqueta).toBe("Renovar plan");
  });

  it("plan vencido que no la incluía: sugiere uno que sí", () => {
    const bloqueo = bloqueoLocal(acceso({ estado: "vencido", herramientas: [] }), "calendario")!;
    expect(planSugerido(bloqueo)).toBe("pro");
  });

  it("sin plan: invita a elegir uno", () => {
    const bloqueo = bloqueoLocal(acceso({ estado: "sin_plan", plan: null, herramientas: [] }), "agente")!;
    const t = textosBloqueo(bloqueo);
    expect(t.titulo).toBe("Elige un plan para empezar");
    expect(t.cta?.etiqueta).toBe("Ver planes");
    expect(t.cta?.href).toBe("/suscripcion?plan=starter");
  });

  it("cuenta suspendida: sin CTA de pago", () => {
    const bloqueo = bloqueoLocal(acceso({ estado: "suspendido", herramientas: [] }), "agente")!;
    const t = textosBloqueo(bloqueo);
    expect(t.titulo).toBe("Tu cuenta está en pausa");
    expect(t.cta).toBeNull();
  });

  it("ningún plan la incluye: no inventa un CTA", () => {
    const soloStarter = acceso({ planes: [PLANES[0]] });
    const t = textosBloqueo(bloqueoLocal(soloStarter, "calendario")!);
    expect(t.cta).toBeNull();
  });
});
