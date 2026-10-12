/**
 * Spec 001 (regla de cancelación): campo de antelación del servicio (R10),
 * sin botón "Cancelar" en citas no confirmadas (R44), 409
 * reserva_no_confirmada (R45) y etiqueta/filtro "Cancelación tardía" (R25).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ServicioEditarModal } from "@/app/components/servicio-editar-modal";
import { ReservaDetalle } from "@/app/components/reserva-detalle";
import { CalendarioGrid } from "@/app/components/calendario-grid";
import { ApiError, apiFetch } from "@/lib/auth";
import type { ReservaOut, ServicioOut } from "@/lib/types";

jest.mock("@/lib/auth", () => {
  const real = jest.requireActual("@/lib/auth");
  return { ...real, apiFetch: jest.fn() };
});
const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

const servicio: ServicioOut = {
  id: "s1",
  tenant_id: "t1",
  nombre: "Corte",
  duracion_minutos: 30,
  precio: null,
  activo: true,
  creado_en: "2026-10-01T00:00:00Z",
  antelacion_cancelacion_horas: 24,
};

function reserva(extra: Partial<ReservaOut> = {}): ReservaOut {
  return {
    id: "r1",
    tenant_id: "t1",
    proveedor_id: "p1",
    proveedor_nombre: "Ana",
    proveedor_color: "#336699",
    servicio_id: "s1",
    servicio_nombre: "Corte",
    hora_inicio: "2026-10-09T15:00:00Z",
    hora_fin: "2026-10-09T15:30:00Z",
    estado: "confirmada",
    user_id: null,
    cliente_nombre: "Luis",
    cliente_telefono: null,
    notas: null,
    precio_cobrado: null,
    metodo_pago: null,
    creado_en: "2026-10-01T00:00:00Z",
    cancelacion_tardia: false,
    cancelada_por: null,
    antelacion_aplicada_horas: null,
    ...extra,
  };
}

beforeEach(() => apiFetchMock.mockReset());

describe("ServicioEditarModal — antelación (R10)", () => {
  const montar = (s: ServicioOut) =>
    render(
      <ServicioEditarModal
        open
        onOpenChange={() => {}}
        servicio={s}
        tenantId="t1"
        onGuardado={() => {}}
      />,
    );

  it("muestra etiqueta y ayuda exactas", () => {
    montar(servicio);
    expect(screen.getByLabelText("Antelación mínima para cancelar (horas)")).toHaveValue(24);
    expect(
      screen.getByText(
        "Si el cliente cancela con menos anticipación, la cancelación se permite y se marca como tardía. Vacío = sin regla.",
      ),
    ).toBeInTheDocument();
  });

  it("envía null explícito si queda vacío", async () => {
    apiFetchMock.mockResolvedValue(servicio);
    montar(servicio);
    fireEvent.change(screen.getByLabelText("Antelación mínima para cancelar (horas)"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Guardar cambios"));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    const opts = apiFetchMock.mock.calls[0][1] as { json: Record<string, unknown> };
    expect(opts.json).toHaveProperty("antelacion_cancelacion_horas", null);
  });

  it("acepta 0 y 720", async () => {
    apiFetchMock.mockResolvedValue(servicio);
    montar(servicio);
    const campo = screen.getByLabelText("Antelación mínima para cancelar (horas)");
    fireEvent.change(campo, { target: { value: "0" } });
    fireEvent.click(screen.getByText("Guardar cambios"));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect((apiFetchMock.mock.calls[0][1] as { json: Record<string, unknown> }).json)
      .toHaveProperty("antelacion_cancelacion_horas", 0);
    fireEvent.change(campo, { target: { value: "720" } });
    fireEvent.click(screen.getByText("Guardar cambios"));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
    expect((apiFetchMock.mock.calls[1][1] as { json: Record<string, unknown> }).json)
      .toHaveProperty("antelacion_cancelacion_horas", 720);
  });

  it.each(["-1", "721", "1.5"])("rechaza %s sin llamar a la API", async (valor) => {
    montar(servicio);
    fireEvent.change(screen.getByLabelText("Antelación mínima para cancelar (horas)"), {
      target: { value: valor },
    });
    fireEvent.click(screen.getByText("Guardar cambios"));
    expect(await screen.findByRole("alert")).toHaveTextContent("entre 0 y 720");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});

describe("ReservaDetalle — cancelar (R44, R45)", () => {
  const montar = (r: ReservaOut, onRecargar = jest.fn()) => {
    render(
      <ReservaDetalle
        open
        onOpenChange={() => {}}
        reserva={r}
        tenantId="t1"
        proveedores={[]}
        servicios={[]}
        onReprogramar={() => {}}
        onCambiado={() => {}}
        onRecargar={onRecargar}
      />,
    );
    return onRecargar;
  };

  it.each(["cancelada", "completada", "no_asistio"] as const)(
    "no ofrece 'Cancelar cita' si la cita está %s",
    (estado) => {
      montar(reserva({ estado }));
      expect(screen.queryByText("Cancelar cita")).not.toBeInTheDocument();
    },
  );

  it("ofrece 'Cancelar cita' si está confirmada", () => {
    montar(reserva());
    expect(screen.getByText("Cancelar cita")).toBeInTheDocument();
  });

  it("muestra la etiqueta si la cancelación fue tardía", () => {
    montar(reserva({ estado: "cancelada", cancelacion_tardia: true }));
    expect(screen.getByText("Cancelación tardía")).toBeInTheDocument();
  });

  it("ante 409 reserva_no_confirmada avisa, recarga y no reintenta", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError(409, "ya cancelada", null, { codigo: "reserva_no_confirmada", estado: "cancelada" }),
    );
    const onRecargar = montar(reserva());
    fireEvent.click(screen.getByText("Cancelar cita"));
    const confirmar = (await screen.findAllByText("Cancelar cita")).at(-1)!;
    fireEvent.click(confirmar);
    expect(
      await screen.findByText("Esta cita ya no está confirmada; se actualizó la agenda."),
    ).toBeInTheDocument();
    expect(onRecargar).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("CalendarioGrid — filtro de cancelación tardía (R25)", () => {
  const props = {
    proveedores: [],
    ventanasPorProveedor: {},
    onReservaClick: () => {},
  };

  it("lista solo las canceladas tardías con su etiqueta", () => {
    render(
      <CalendarioGrid
        {...props}
        soloTardias
        reservas={[
          reserva({ id: "a", estado: "cancelada", cancelacion_tardia: true, cliente_nombre: "Tardía" }),
          reserva({ id: "b", estado: "cancelada", cliente_nombre: "A tiempo" }),
          reserva({ id: "c", cliente_nombre: "Viva" }),
        ]}
      />,
    );
    expect(screen.getByText("Tardía")).toBeInTheDocument();
    expect(screen.getByText("Cancelación tardía")).toBeInTheDocument();
    expect(screen.queryByText("A tiempo")).not.toBeInTheDocument();
    expect(screen.queryByText("Viva")).not.toBeInTheDocument();
  });

  it("avisa cuando no hay ninguna", () => {
    render(<CalendarioGrid {...props} soloTardias reservas={[reserva()]} />);
    expect(screen.getByText("No hay cancelaciones tardías este día.")).toBeInTheDocument();
  });
});
