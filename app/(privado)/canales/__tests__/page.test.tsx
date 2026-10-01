/**
 * Tests de integración de app/(privado)/canales/page.tsx, enfocados en el
 * flujo nuevo de vinculación automática (NeuroAPI Connect Sessions): que el
 * botón llame al endpoint de inicio con la URL correcta, que un error se
 * muestre en vez de intentar redirigir, y que el retorno
 * (`?whatsapp_neuroapi=retorno`) muestre un aviso y recargue el estado real
 * en vez de darlo por conectado a ciegas.
 *
 * El `window.location.assign(connect_url)` en sí no se puede espiar acá:
 * desde jsdom 22+ `location.assign` es una propiedad propia no configurable
 * y no writable (Object.getOwnPropertyDescriptor lo confirma), así que ni
 * reasignarla ni redefinirla es posible sin reemplazar el entorno de test
 * completo. Llamarla de verdad no rompe el test (jsdom la resuelve como
 * "Not implemented: navigation" sin lanzar), así que lo que se prueba es
 * todo lo que sí es observable: qué se le pide al backend y qué se muestra
 * en pantalla según la respuesta.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CanalesPage from "@/app/(privado)/canales/page";
import type { CanalOut } from "@/lib/types";

let searchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  ...jest.requireActual("next/navigation"),
  useSearchParams: () => searchParams,
}));

// PageHeader (app/components/ui.tsx) monta el centro de notificaciones, que
// abre un socket y usa useRouter: fuera del objeto de esta prueba, igual que
// lo mockea vendedores/__tests__/page.test.tsx.
jest.mock("@/app/components/centro-notificaciones", () => ({
  CentroNotificaciones: () => null,
}));

const SIN_CANALES: CanalOut[] = [
  { channel_type: "whatsapp", page_id: null, ig_user_id: null, phone_number_id: null, is_active: false, updated_at: null },
  { channel_type: "instagram", page_id: null, ig_user_id: null, phone_number_id: null, is_active: false, updated_at: null },
  { channel_type: "facebook", page_id: null, ig_user_id: null, phone_number_id: null, is_active: false, updated_at: null },
];

function mockFetch(respuestaIniciar: unknown, statusIniciar = 200) {
  (global.fetch as jest.Mock).mockImplementation((url: string, opciones?: RequestInit) => {
    const responder = (data: unknown, status = 200) =>
      Promise.resolve({ ok: status < 400, status, text: async () => JSON.stringify(data) });

    if (url.includes("/api/canales/whatsapp/neuroapi/iniciar") && opciones?.method === "POST") {
      return responder(respuestaIniciar, statusIniciar);
    }
    if (url.endsWith("/api/canales")) {
      return responder(SIN_CANALES);
    }
    return responder(null);
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
  searchParams = new URLSearchParams();
  jest.clearAllMocks();
});

test("el botón Conectar WhatsApp pide la sesión al endpoint de NeuroAPI Connect", async () => {
  mockFetch({ connect_url: "https://connect.neurochat.com.ec/sess_abc" });

  render(<CanalesPage />);

  const boton = await screen.findByRole("button", { name: /conectar whatsapp/i });
  await userEvent.click(boton);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/canales/whatsapp/neuroapi/iniciar"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  // El happy path no debe mostrar ningún error: si el redirect real fallara
  // (no aplica en jsdom), el handler lo mostraría como Aviso de error.
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("si el backend rechaza la vinculación automática, se muestra el error", async () => {
  mockFetch({ detail: "La vinculación automática de WhatsApp no está configurada" }, 503);

  render(<CanalesPage />);

  const boton = await screen.findByRole("button", { name: /conectar whatsapp/i });
  await userEvent.click(boton);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    /la vinculación automática de whatsapp no está configurada/i,
  );
});

test("al volver con ?whatsapp_neuroapi=retorno se avisa y se recarga el estado real", async () => {
  searchParams = new URLSearchParams("whatsapp_neuroapi=retorno");
  mockFetch({});

  render(<CanalesPage />);

  expect(await screen.findByText(/terminando de vincular tu whatsapp/i)).toBeInTheDocument();

  await waitFor(() => {
    const llamadasACanales = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      String(url).endsWith("/api/canales"),
    );
    // Una al montar useApi + una del recargar(true) del efecto de retorno.
    expect(llamadasACanales.length).toBeGreaterThanOrEqual(2);
  });
});

async function desconectarWhatsApp(proveedor: string | null) {
  (global.fetch as jest.Mock).mockImplementation((url: string, opciones?: RequestInit) => {
    const responder = (data: unknown) =>
      Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(data) });
    if (url.includes("/api/canales/whatsapp") && opciones?.method === "DELETE") {
      return responder({ desconectado: "whatsapp", proveedor });
    }
    if (url.endsWith("/api/canales")) {
      return responder(
        SIN_CANALES.map((c) =>
          c.channel_type === "whatsapp" ? { ...c, is_active: true, phone_number_id: "1414669871722989" } : c,
        ),
      );
    }
    return responder(null);
  });

  render(<CanalesPage />);

  await userEvent.click(await screen.findByRole("button", { name: /^desconectar$/i }));
  const dialogo = await screen.findByRole("dialog");
  await userEvent.click(within(dialogo).getByRole("button", { name: /^desconectar$/i }));
}

test("al desconectar una línea de NeuroAPI se pide retirar el acceso en Meta", async () => {
  await desconectarWhatsApp("neuroapi");

  expect(await screen.findByText(/meta business manager/i)).toBeInTheDocument();
});

test("al desconectar una línea que no es de NeuroAPI no se menciona Meta Business Manager", async () => {
  await desconectarWhatsApp("meta");

  expect(await screen.findByText(/desconectado\.$/i)).toBeInTheDocument();
  expect(screen.queryByText(/meta business manager/i)).not.toBeInTheDocument();
});

test("si el webhook llega después del retorno, el portal lo detecta sin recargar a mano", async () => {
  searchParams = new URLSearchParams("whatsapp_neuroapi=retorno");
  let consultas = 0;
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    const responder = (data: unknown) =>
      Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(data) });
    if (!url.endsWith("/api/canales")) return responder(null);
    consultas += 1;
    // Las dos primeras consultas (montaje + retorno) todavía sin webhook.
    const activo = consultas > 2;
    return responder(
      SIN_CANALES.map((c) => (c.channel_type === "whatsapp" ? { ...c, is_active: activo } : c)),
    );
  });

  render(<CanalesPage />);

  expect(await screen.findByText(/terminando de vincular tu whatsapp/i)).toBeInTheDocument();
  expect(await screen.findByText("conectado", {}, { timeout: 5_000 })).toBeInTheDocument();
  expect(screen.queryByText(/terminando de vincular tu whatsapp/i)).not.toBeInTheDocument();
});
