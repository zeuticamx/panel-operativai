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
 *
 * Desde la spec 005a WhatsApp ya no es una fila de canal: sus números se
 * listan y gestionan uno a uno (GET /api/canales/whatsapp/numeros), y el
 * retorno de NeuroAPI se confirma al aparecer un número nuevo en esa lista.
 * Aquí quedan Instagram y Facebook como canales de Meta.
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

const NUMERO = {
  id: "n1",
  phone_number_id: "1001",
  telefono_visible: "+52 55 1111 1111",
  bsp_provider: "neuroapi",
  estado: "activo",
  es_principal: true,
  es_linea_avisos: false,
  vinculado_en: "2026-01-01T00:00:00Z",
  pausado_en: null,
  motivo_pausa: null,
  agent_name: "Ana",
  system_prompt: "Eres Ana.",
  model: null,
  temperature: 0.7,
  history_window: 30,
  agente_activo: true,
  configuracion_incompleta: false,
  herramientas: [],
};

function listaNumeros(cuantos: number) {
  return {
    numeros: Array.from({ length: cuantos }, (_, i) => ({ ...NUMERO, id: `n${i + 1}`, telefono_visible: `+52 ${i + 1}` })),
    tope: null,
    plazas_usadas: cuantos,
    plazas_libres: null,
  };
}

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
    if (url.endsWith("/api/canales/whatsapp/numeros")) {
      return responder(listaNumeros(1));
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

test("al volver con ?whatsapp_neuroapi=retorno se avisa y se vuelve a pedir la lista de números", async () => {
  searchParams = new URLSearchParams("whatsapp_neuroapi=retorno");
  mockFetch({});

  render(<CanalesPage />);

  expect(await screen.findByText(/terminando de vincular tu whatsapp/i)).toBeInTheDocument();
  // El aviso no se da por conectado a ciegas: sigue hasta que aparece un número nuevo.
  expect(screen.queryByText(/no recibimos la confirmación/i)).not.toBeInTheDocument();
});

test("Instagram y Facebook muestran Próximamente en vez del botón de conectar", async () => {
  mockFetch({});

  render(<CanalesPage />);

  const botones = await screen.findAllByRole("button", { name: /próximamente/i });
  expect(botones).toHaveLength(2); // uno por fila: instagram y facebook
  for (const boton of botones) {
    expect(boton).toBeDisabled();
  }
  // El botón real de conexión por Meta no debe existir en ningún lado.
  expect(screen.queryByRole("button", { name: /conectar con facebook/i })).not.toBeInTheDocument();
});

test("un canal de Meta ya conectado conserva su botón de Desconectar", async () => {
  // Próximamente no debe tocar una línea de Instagram/Facebook que ya
  // estaba activa antes del cambio: solo se bloquea dar de alta una nueva.
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    const responder = (data: unknown) =>
      Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(data) });
    if (!url.endsWith("/api/canales")) return responder(null);
    return responder(
      SIN_CANALES.map((c) =>
        c.channel_type === "instagram" ? { ...c, is_active: true, ig_user_id: "ig_1" } : c,
      ),
    );
  });

  render(<CanalesPage />);

  expect(await screen.findByRole("button", { name: /^desconectar$/i })).toBeInTheDocument();
  // Facebook sigue sin conectar: a esa fila sí le toca Próximamente.
  expect(await screen.findByRole("button", { name: /próximamente/i })).toBeInTheDocument();
});

async function desconectarInstagram(proveedor: string | null) {
  (global.fetch as jest.Mock).mockImplementation((url: string, opciones?: RequestInit) => {
    const responder = (data: unknown) =>
      Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(data) });
    if (url.includes("/api/canales/instagram") && opciones?.method === "DELETE") {
      return responder({ desconectado: "instagram", proveedor });
    }
    if (url.endsWith("/api/canales")) {
      return responder(
        SIN_CANALES.map((c) => (c.channel_type === "instagram" ? { ...c, is_active: true, ig_user_id: "ig_1" } : c)),
      );
    }
    return responder(url.endsWith("/api/canales/whatsapp/numeros") ? listaNumeros(1) : null);
  });

  render(<CanalesPage />);

  await userEvent.click(await screen.findByRole("button", { name: /^desconectar$/i }));
  const dialogo = await screen.findByRole("dialog");
  await userEvent.click(within(dialogo).getByRole("button", { name: /^desconectar$/i }));
}

test("al desconectar una línea de NeuroAPI se pide retirar el acceso en Meta", async () => {
  await desconectarInstagram("neuroapi");

  expect(await screen.findByText(/meta business manager/i)).toBeInTheDocument();
});

test("al desconectar una línea que no es de NeuroAPI no se menciona Meta Business Manager", async () => {
  await desconectarInstagram("meta");

  expect(await screen.findByText(/desconectado\.$/i)).toBeInTheDocument();
  expect(screen.queryByText(/meta business manager/i)).not.toBeInTheDocument();
});

test("WhatsApp se gestiona por números: la lista aparece en Canales y ya no hay fila de WhatsApp", async () => {
  mockFetch({});

  render(<CanalesPage />);

  expect(await screen.findByText("+52 1")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Números de WhatsApp" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
});

test(
  "si el webhook llega después del retorno, el portal ve el número nuevo sin recargar a mano",
  async () => {
    searchParams = new URLSearchParams("whatsapp_neuroapi=retorno");
    let consultas = 0;
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const responder = (data: unknown) =>
        Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(data) });
      if (url.endsWith("/api/canales")) return responder(SIN_CANALES);
      if (!url.endsWith("/api/canales/whatsapp/numeros")) return responder(null);
      consultas += 1;
      // La primera consulta (montaje) fija la base; después llega el webhook y aparece un número más.
      return responder(listaNumeros(consultas > 1 ? 2 : 1));
    });

    render(<CanalesPage />);

    expect(await screen.findByText(/terminando de vincular tu whatsapp/i)).toBeInTheDocument();
    expect(await screen.findByText("+52 2", {}, { timeout: 8_000 })).toBeInTheDocument();
    expect(screen.queryByText(/terminando de vincular tu whatsapp/i)).not.toBeInTheDocument();
  },
  15_000,
);
