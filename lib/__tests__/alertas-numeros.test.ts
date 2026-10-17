/**
 * Avisos de varios números de WhatsApp (spec 005a, RF-20): a dónde lleva cada
 * tipo de alerta nueva al hacerle clic.
 */
import type { AlertaOut } from "@/lib/types";
import { rutaParaAlerta } from "@/lib/use-websocket-alertas";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/notificaciones", () => ({ showToast: jest.fn() }));
jest.mock("@/lib/auth", () => ({
  API_URL: "http://api.test",
  apiFetch: jest.fn(),
  mensajeDeError: (_e: unknown, fallback: string) => fallback,
}));
jest.mock("socket.io-client", () => ({ io: () => ({ on: jest.fn(), disconnect: jest.fn() }) }));

function alerta(tipo: AlertaOut["tipo"], datos: Record<string, unknown>): AlertaOut {
  return {
    id: "a1",
    tenant_id: "t1",
    tipo,
    titulo: "t",
    mensaje: "m",
    datos,
    leido: false,
    creado_en: "2026-01-10T15:30:00Z",
  };
}

test("números pausados lleva a la lista de números, donde se reactivan", () => {
  expect(rutaParaAlerta(alerta("numeros_pausados", { numeros: [{ id: "n1" }, { id: "n2" }] }))).toBe("/canales");
});

test("recorte por plan con un solo número lleva a su configuración", () => {
  expect(rutaParaAlerta(alerta("numeros_recortados", { numeros: [{ id: "n1" }] }))).toBe("/agente?numero=n1");
});

test("recorte con varios números lleva a la lista de números", () => {
  expect(rutaParaAlerta(alerta("numeros_recortados", { numeros: [{ id: "n1" }, { id: "n2" }] }))).toBe("/canales");
});

test("configuración incompleta de un número lleva a su configuración", () => {
  expect(rutaParaAlerta(alerta("numero_configuracion_incompleta", { numeros: [{ id: "n9" }] }))).toBe(
    "/agente?numero=n9",
  );
});

test("configuración incompleta de Instagram y Facebook (sin id de número) lleva a /agente", () => {
  expect(rutaParaAlerta(alerta("numero_configuracion_incompleta", { numeros: [{ id: null }] }))).toBe("/agente");
  expect(rutaParaAlerta(alerta("numero_configuracion_incompleta", {}))).toBe("/agente");
});
