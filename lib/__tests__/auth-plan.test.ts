/**
 * Cómo trata apiFetch los 402 del gate por plan: el detalle estructurado
 * llega entero en ApiError.bloqueo, el mensaje es legible, y el evento que
 * abre el modal solo se emite cuando la persona intentó una acción (no por
 * una carga de fondo).
 */
import { ApiError, apiFetch, PLAN_BLOQUEADO_EVENT } from "@/lib/auth";
import type { BloqueoPlanDetalle } from "@/lib/types";

const DETALLE: BloqueoPlanDetalle = {
  codigo: "plan_insuficiente",
  herramienta: "calendario",
  estado: "vigente",
  plan_actual: "starter",
  planes_que_la_incluyen: ["pro", "enterprise"],
  mensaje: "El calendario está incluido en los planes Pro y Enterprise.",
};

function responder(status: number, cuerpo: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(cuerpo),
  }) as unknown as typeof fetch;
}

describe("apiFetch ante un 402 del plan", () => {
  let recibidos: BloqueoPlanDetalle[];
  const escuchar = (e: Event) => recibidos.push((e as CustomEvent<BloqueoPlanDetalle>).detail);

  beforeEach(() => {
    recibidos = [];
    window.addEventListener(PLAN_BLOQUEADO_EVENT, escuchar);
  });
  afterEach(() => window.removeEventListener(PLAN_BLOQUEADO_EVENT, escuchar));

  it("una acción (POST) trae el detalle y avisa para abrir el modal", async () => {
    responder(402, { detail: DETALLE });

    const error = await apiFetch("/api/tenants/t/calendario/reservas", {
      method: "POST",
      json: {},
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(402);
    expect(apiError.bloqueo).toEqual(DETALLE);
    // El texto es el mensaje amigable, no "Error 402" ni "[object Object]".
    expect(apiError.detail).toBe(DETALLE.mensaje);
    expect(recibidos).toEqual([DETALLE]);
  });

  it("una carga de fondo (GET) no abre el modal", async () => {
    responder(402, { detail: DETALLE });

    const error = (await apiFetch("/api/clientes").catch((e: unknown) => e)) as ApiError;

    expect(error.bloqueo).toEqual(DETALLE);
    expect(recibidos).toEqual([]);
  });

  it("un 402 sin detalle estructurado no se toma como bloqueo de plan", async () => {
    responder(402, { detail: "La suscripción venció y no quedan créditos disponibles." });

    const error = (await apiFetch("/api/x", { method: "POST" }).catch((e: unknown) => e)) as ApiError;

    expect(error.bloqueo).toBeNull();
    expect(error.detail).toBe("La suscripción venció y no quedan créditos disponibles.");
    expect(recibidos).toEqual([]);
  });

  it("otros errores con detail en objeto usan su `mensaje`", async () => {
    responder(409, { detail: { mensaje: "No se puede pasar de 'ganado' a 'contactado'" } });

    const error = (await apiFetch("/api/x", { method: "PATCH" }).catch((e: unknown) => e)) as ApiError;

    expect(error.detail).toBe("No se puede pasar de 'ganado' a 'contactado'");
    expect(error.bloqueo).toBeNull();
  });
});
