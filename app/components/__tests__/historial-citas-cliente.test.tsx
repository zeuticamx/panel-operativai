/**
 * Panel "Historial de citas" de la conversación (spec 002, R15-R21).
 * Se mockea la red (apiFetch). El backend decide plan, calendario y
 * visibilidad; el panel solo se oculta ante 402/409/403/404.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HistorialCitasCliente } from "@/app/components/historial-citas-cliente";
import { ReservaDetalle } from "@/app/components/reserva-detalle";
import { ApiError, apiFetch } from "@/lib/auth";
import {
  TEXTO_HAY_MAS_CITAS,
  TEXTO_VACIO_EQUIPO,
  TEXTO_VACIO_PROVEEDOR,
} from "@/lib/historial-citas";
import type { CitaHistorialOut, HistorialCitasOut, ReservaOut } from "@/lib/types";

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.Mock;

function cita(n: number, extra: Partial<CitaHistorialOut> = {}): CitaHistorialOut {
  return {
    fecha_hora_inicio: `2026-03-${String(10 + n).padStart(2, "0")}T10:00:00-06:00`,
    hora_fin: `2026-03-${String(10 + n).padStart(2, "0")}T10:30:00-06:00`,
    servicio_nombre: `Servicio ${n}`,
    proveedor_nombre: `Proveedor ${n}`,
    estado: "completada",
    notas: null,
    cancelada_por: null,
    cancelacion_tardia: false,
    ...extra,
  };
}

function respuesta(citas: CitaHistorialOut[], hay_mas = false): HistorialCitasOut {
  return { citas, hay_mas };
}

function panel(rol: string | null = "owner", canal: string | null = "whatsapp") {
  return render(<HistorialCitasCliente conversacionId="c1" canal={canal} rol={rol} />);
}

beforeEach(() => mockApiFetch.mockReset());

describe("HistorialCitasCliente", () => {
  it("consulta al montar el endpoint de la conversación y lista las citas", async () => {
    mockApiFetch.mockResolvedValue(respuesta([cita(1), cita(2, { estado: "cancelada" })]));
    panel();

    expect(screen.getByText("Historial de citas")).toBeInTheDocument();
    expect(await screen.findByText("Servicio 1")).toBeInTheDocument();
    expect(screen.getByText("Proveedor 1")).toBeInTheDocument();
    expect(screen.getByText("Completada")).toBeInTheDocument();
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/conversaciones/c1/historial-citas");
  });

  it("muestra un indicador de carga mientras espera", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    panel();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it.each([
    ["vendedor", "whatsapp"],
    [null, "whatsapp"],
    ["owner", "web"],
    ["owner", null],
  ])("sin acción ni consulta para rol=%s canal=%s", (rol, canal) => {
    panel(rol, canal);
    expect(screen.queryByText("Historial de citas")).toBeNull();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it.each([402, 409, 403, 404])(
    "se oculta ante %i (plan, calendario apagado, rol o no visible)",
    async (status) => {
      mockApiFetch.mockRejectedValue(new ApiError(status, "no"));
      const { container } = panel();
      await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
      await waitFor(() => expect(container).toBeEmptyDOMElement());
      expect(screen.queryByText("Historial de citas")).toBeNull();
      expect(screen.queryByText("Reintentar")).toBeNull();
    },
  );

  it("el texto de hay_mas es el mismo para owner y proveedor", async () => {
    const tres = [cita(1), cita(2), cita(3)];
    mockApiFetch.mockResolvedValue(respuesta(tres, true));
    const { unmount } = panel("owner");
    expect(await screen.findByText(TEXTO_HAY_MAS_CITAS)).toBeInTheDocument();
    unmount();

    mockApiFetch.mockResolvedValue(respuesta(tres, true));
    panel("proveedor");
    expect(await screen.findByText(TEXTO_HAY_MAS_CITAS)).toBeInTheDocument();
  });

  it("no muestra el texto de hay_mas cuando no hay más", async () => {
    mockApiFetch.mockResolvedValue(respuesta([cita(1)], false));
    panel();
    await screen.findByText("Servicio 1");
    expect(screen.queryByText(TEXTO_HAY_MAS_CITAS)).toBeNull();
  });

  it("vacío distinto por rol; el del proveedor no habla de otros", async () => {
    mockApiFetch.mockResolvedValue(respuesta([]));
    const { unmount } = panel("owner");
    expect(await screen.findByText(TEXTO_VACIO_EQUIPO)).toBeInTheDocument();
    unmount();

    mockApiFetch.mockResolvedValue(respuesta([]));
    panel("proveedor");
    expect(await screen.findByText(TEXTO_VACIO_PROVEEDOR)).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_VACIO_EQUIPO)).toBeNull();
  });

  it("proveedor con 3 citas ve 3 filas y ningún total ni conteo", async () => {
    mockApiFetch.mockResolvedValue(respuesta([cita(1), cita(2), cita(3)]));
    panel("proveedor");
    await screen.findByText("Servicio 1");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText(/total/i)).toBeNull();
    expect(screen.queryByText(/\b3\b.*cita|cita.*\b3\b/i)).toBeNull();
  });

  it("marca la cancelación tardía solo en la cita que lo es", async () => {
    mockApiFetch.mockResolvedValue(
      respuesta([
        cita(1, { estado: "cancelada", cancelada_por: "cliente", cancelacion_tardia: true }),
        cita(2, { estado: "cancelada", cancelada_por: "equipo", cancelacion_tardia: false }),
      ]),
    );
    panel();
    await screen.findByText("Servicio 1");
    expect(screen.getAllByText("Cancelación tardía")).toHaveLength(1);
  });

  it("ante un error muestra Reintentar y al pulsarlo vuelve a consultar", async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(500, "boom"));
    mockApiFetch.mockResolvedValueOnce(respuesta([cita(1)]));
    panel();

    const boton = await screen.findByRole("button", { name: "Reintentar" });
    await userEvent.click(boton);

    expect(await screen.findByText("Servicio 1")).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });

  it("un error de red (no ApiError) también es reintentable", async () => {
    mockApiFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    panel();
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});

describe("criterio 20: sin entrada desde el detalle de una cita", () => {
  it("ReservaDetalle no muestra el historial de citas del cliente", () => {
    const reserva: ReservaOut = {
      id: "r1",
      tenant_id: "t1",
      proveedor_id: "p1",
      proveedor_nombre: "Proveedor 1",
      proveedor_color: "#112233",
      servicio_id: "s1",
      servicio_nombre: "Servicio 1",
      hora_inicio: "2026-03-10T16:00:00Z",
      hora_fin: "2026-03-10T16:30:00Z",
      estado: "confirmada",
      user_id: "u1",
      cliente_nombre: "Cliente",
      cliente_telefono: null,
      notas: null,
      precio_cobrado: null,
      metodo_pago: null,
      creado_en: "2026-03-01T00:00:00Z",
      cancelacion_tardia: false,
      cancelada_por: null,
      antelacion_aplicada_horas: null,
    };
    render(
      <ReservaDetalle
        open
        onOpenChange={() => {}}
        reserva={reserva}
        tenantId="t1"
        proveedores={[]}
        servicios={[]}
        onReprogramar={() => {}}
        onCambiado={() => {}}
      />,
    );
    expect(screen.getAllByText(/Servicio 1/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Historial de citas/i)).toBeNull();
  });
});
