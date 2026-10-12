/**
 * ApiError ante los tres formatos de `detail` de FastAPI: string, objeto
 * estructurado ({codigo, mensaje, estado?}) y lista de validación (422).
 * El 402 del plan sigue exponiendo `bloqueo` además de `codigo`.
 */
import { ApiError, apiFetch, mensajeDeError } from "@/lib/auth";

function responder(status: number, cuerpo: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(cuerpo),
  }) as unknown as typeof fetch;
}

async function fallar(): Promise<ApiError> {
  return (await apiFetch("/api/x", { method: "POST" }).catch((e: unknown) => e)) as ApiError;
}

describe("ApiError y el formato de detail", () => {
  it("detail string: mensaje igual, sin codigo ni estado", async () => {
    responder(404, { detail: "Reserva no encontrada" });
    const error = await fallar();

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.detail).toBe("Reserva no encontrada");
    expect(error.codigo).toBeNull();
    expect(error.estado).toBeNull();
    expect(error.bloqueo).toBeNull();
  });

  it("detail objeto: expone codigo, estado y usa mensaje como texto", async () => {
    responder(409, {
      detail: { codigo: "reserva_no_confirmada", mensaje: "La cita ya no está confirmada.", estado: "completada" },
    });
    const error = await fallar();

    expect(error.status).toBe(409);
    expect(error.codigo).toBe("reserva_no_confirmada");
    expect(error.estado).toBe("completada");
    expect(error.detail).toBe("La cita ya no está confirmada.");
    expect(mensajeDeError(error)).toBe("La cita ya no está confirmada.");
    expect(error.bloqueo).toBeNull();
  });

  it("detail objeto sin estado: estado es null", async () => {
    responder(409, { detail: { codigo: "otro_codigo", mensaje: "Algo pasó." } });
    const error = await fallar();

    expect(error.codigo).toBe("otro_codigo");
    expect(error.estado).toBeNull();
  });

  it("402 del plan: conserva bloqueo y el mensaje, y expone su codigo", async () => {
    const detalle = {
      codigo: "plan_insuficiente",
      herramienta: "calendario",
      estado: "vigente",
      plan_actual: "starter",
      planes_que_la_incluyen: ["pro"],
      mensaje: "El calendario está incluido en el plan Pro.",
    };
    responder(402, { detail: detalle });
    const error = await fallar();

    expect(error.status).toBe(402);
    expect(error.bloqueo).toEqual(detalle);
    expect(error.detail).toBe(detalle.mensaje);
    expect(error.codigo).toBe("plan_insuficiente");
  });

  it("422 (lista): sigue uniendo los mensajes por campo", async () => {
    responder(422, {
      detail: [
        { loc: ["body", "antelacion_cancelacion_horas"], msg: "Input should be less than or equal to 720" },
        { loc: ["body", "nombre"], msg: "Field required" },
      ],
    });
    const error = await fallar();

    expect(error.status).toBe(422);
    expect(error.detail).toBe(
      "antelacion_cancelacion_horas: Input should be less than or equal to 720 · nombre: Field required",
    );
    expect(error.codigo).toBeNull();
    expect(error.estado).toBeNull();
  });
});
