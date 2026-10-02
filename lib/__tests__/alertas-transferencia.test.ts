/**
 * Delegación a humano en el portal: el hook recibe `nueva_alerta` del
 * WebSocket, dispara el toast con "Atender" y la ruta a la conversación, y
 * `transferenciasPendientes` alimenta el badge del sidebar.
 */
import { act, renderHook } from "@testing-library/react";

import { showToast } from "@/lib/notificaciones";
import type { AlertaOut } from "@/lib/types";
import {
  rutaParaAlerta,
  transferenciasPendientes,
  useWebsocketAlertas,
} from "@/lib/use-websocket-alertas";

const push = jest.fn();
const manejadores: Record<string, (arg: unknown) => void> = {};

jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/lib/notificaciones", () => ({ showToast: jest.fn() }));
jest.mock("@/lib/auth", () => ({
  API_URL: "http://api.test",
  apiFetch: jest.fn().mockResolvedValue({}),
  mensajeDeError: (_e: unknown, fallback: string) => fallback,
}));
jest.mock("socket.io-client", () => ({
  io: () => ({
    on: (evento: string, fn: (arg: unknown) => void) => {
      manejadores[evento] = fn;
    },
    disconnect: jest.fn(),
  }),
}));

function alertaTransferida(extra: Partial<AlertaOut> = {}): AlertaOut {
  return {
    id: "a1",
    tenant_id: "t1",
    tipo: "conversacion_transferida",
    titulo: "Cliente esperando atención humana",
    mensaje: "Ana pidió hablar con alguien del equipo por whatsapp",
    datos: { conversation_id: "c-123", canal: "whatsapp" },
    leido: false,
    creado_en: "2026-01-10T15:30:00Z",
    ...extra,
  };
}

beforeEach(() => {
  push.mockReset();
  (showToast as jest.Mock).mockReset();
});

test("rutaParaAlerta lleva a la conversación delegada", () => {
  expect(rutaParaAlerta(alertaTransferida())).toBe("/conversaciones/c-123");
  expect(rutaParaAlerta(alertaTransferida({ datos: {} }))).toBeNull();
});

test("al llegar la alerta muestra el toast con «Atender» y navega al chat", () => {
  const { result } = renderHook(() => useWebsocketAlertas("t1", "token"));

  act(() => manejadores["nueva_alerta"](alertaTransferida()));

  expect(result.current.alertas).toHaveLength(1);
  expect(result.current.noLeidosCount).toBe(1);

  const [titulo, mensaje, tipo, accion] = (showToast as jest.Mock).mock.calls[0];
  expect(titulo).toBe("Cliente esperando atención humana");
  expect(mensaje).toContain("Ana pidió hablar");
  expect(mensaje).toMatch(/\d{1,2}:\d{2}/); // hora de la solicitud
  expect(tipo).toBe("conversacion_transferida");
  expect(accion.label).toBe("Atender");

  accion.onClick();
  expect(push).toHaveBeenCalledWith("/conversaciones/c-123");
});

test("transferenciasPendientes cuenta solo las no leídas de ese tipo", () => {
  const alertas = [
    alertaTransferida({ id: "1" }),
    alertaTransferida({ id: "2", leido: true }),
    alertaTransferida({ id: "3", tipo: "nuevo_lead" }),
  ];
  expect(transferenciasPendientes(alertas).map((a) => a.id)).toEqual(["1"]);
});
