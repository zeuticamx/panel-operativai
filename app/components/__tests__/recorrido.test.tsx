/**
 * Botón de ayuda y recorrido guiado:
 *  - presencia del botón en vistas de usuario y ausencia total en /gerencia;
 *  - flujo de pasos: avanzar, retroceder, teclado, pausar, cerrar, saltar
 *    pasos sin ancla, cerrar al cambiar de ruta;
 *  - arranque automático solo en la primera visita del cliente.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { RecorridoProvider } from "@/app/components/recorrido";
import { PageHeader } from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";
import { marcarRecorridoVisto } from "@/lib/recorridos";

let mockPathname = "/conversaciones";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
jest.mock("@/app/components/usuario-context", () => ({ useUsuario: jest.fn() }));
jest.mock("@/app/components/centro-notificaciones", () => ({ CentroNotificaciones: () => null }));

const mockUseUsuario = useUsuario as jest.Mock;

function conUsuario(extra: Record<string, unknown> = {}) {
  mockUseUsuario.mockReturnValue({
    usuario: { id: "u1", email: "a@b.com", role: "owner", tenant_id: "t", es_gerencia_plataforma: false, ...extra },
    loading: false,
    error: null,
  });
}

/** Página de conversaciones mínima, con las anclas de su recorrido. */
function PaginaConversaciones() {
  return (
    <>
      <PageHeader titulo="Conversaciones" />
      <div data-tour="conversaciones.filtros">
        <input aria-label="Buscar" defaultValue="" />
      </div>
      <div data-tour="conversaciones.lista">lista</div>
      <div data-tour="conversaciones.paginacion">paginación</div>
    </>
  );
}

function montar(pagina = <PaginaConversaciones />) {
  return render(<RecorridoProvider>{pagina}</RecorridoProvider>);
}

const boton = () => screen.queryByRole("button", { name: "Ver tutorial de esta página" });
const tarjeta = () => screen.getByRole("dialog");
const tituloPaso = () => within(tarjeta()).getByRole("heading").textContent;

beforeAll(() => {
  // jsdom no hace layout: sin un rectángulo con tamaño, toda ancla parece invisible.
  jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 100, y: 100, top: 100, left: 100, bottom: 140, right: 300, width: 200, height: 40, toJSON: () => ({}),
  } as DOMRect);
});

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  mockPathname = "/conversaciones";
  conUsuario();
  // Por defecto ya lo vio: así el arranque automático no interfiere.
  marcarRecorridoVisto("u1", "/conversaciones");
  marcarRecorridoVisto("u1", "/dashboard");
  marcarRecorridoVisto("publico", "/registro");
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// ------------------------------------------------------------
// Presencia del botón
// ------------------------------------------------------------
test.each(["/dashboard", "/conversaciones", "/agente", "/calendario/servicios", "/vendedores/v-1"])(
  "el header muestra el botón de ayuda en %s",
  (ruta) => {
    mockPathname = ruta;
    montar(<PageHeader titulo="X" />);
    expect(boton()).toBeInTheDocument();
  },
);

test.each(["/gerencia", "/gerencia/tenants", "/gerencia/tenants/t-1", "/gerencia/conversaciones"])(
  "en %s no hay botón ni recorrido, aunque mire gerencia de plataforma",
  (ruta) => {
    mockPathname = ruta;
    conUsuario({ es_gerencia_plataforma: true });
    localStorage.clear(); // ni siquiera la "primera visita" lo abre
    montar(<PageHeader titulo="Plataforma" />);
    act(() => jest.advanceTimersByTime(5000));
    expect(boton()).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
);

test("registro y recuperar tienen el botón flotante; login y las legales no", () => {
  mockPathname = "/registro";
  const { unmount } = montar(<form data-tour="auth.form" />);
  expect(boton()).toBeInTheDocument();
  unmount();

  for (const ruta of ["/login", "/privacidad", "/condiciones"]) {
    mockPathname = ruta;
    const { unmount: u } = montar(<main />);
    expect(boton()).not.toBeInTheDocument();
    u();
  }
});

// ------------------------------------------------------------
// Flujo de pasos
// ------------------------------------------------------------
test("avanza, retrocede y apunta a cada elemento", () => {
  montar();
  fireEvent.click(boton()!);

  expect(tituloPaso()).toBe("Conversaciones");
  expect(screen.getByText("1 de 6")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Anterior/ })).toBeDisabled();
  expect(screen.queryByTestId("recorrido-spotlight")).not.toBeInTheDocument(); // intro centrada

  fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
  expect(tituloPaso()).toBe("Buscar y filtrar");
  expect(screen.getByTestId("recorrido-spotlight")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
  expect(tituloPaso()).toBe("Lista de chats");

  fireEvent.click(screen.getByRole("button", { name: /Anterior/ }));
  expect(tituloPaso()).toBe("Buscar y filtrar");
});

test("con el teclado: flechas para moverse y Escape para cerrar", () => {
  montar();
  fireEvent.click(boton()!);

  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(tituloPaso()).toBe("Buscar y filtrar");
  fireEvent.keyDown(window, { key: "ArrowLeft" });
  expect(tituloPaso()).toBe("Conversaciones");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("un paso cuyo elemento no está en pantalla se salta, y el último cierra", () => {
  montar();
  fireEvent.click(boton()!);
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
  expect(tituloPaso()).toBe("Más resultados");

  // "Notificaciones": la campana está mockeada, su ancla no existe.
  fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
  act(() => jest.advanceTimersByTime(2000));
  expect(tituloPaso()).toBe("¿Quieres repasarlo?");
  expect(screen.getByRole("button", { name: "Terminar" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("pausar libera la página y reanudar vuelve al mismo paso", () => {
  montar();
  fireEvent.click(boton()!);
  fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
  fireEvent.click(screen.getByRole("button", { name: /Pausar/ }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByTestId("recorrido-bloqueo")).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Recorrido en pausa" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Reanudar/ }));
  expect(tituloPaso()).toBe("Buscar y filtrar");
});

test("cerrar no altera el estado de la página y devuelve el foco al botón", () => {
  montar();
  const buscar = screen.getByLabelText("Buscar");
  fireEvent.change(buscar, { target: { value: "ana" } });

  boton()!.focus();
  fireEvent.click(boton()!);
  fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
  fireEvent.click(screen.getByRole("button", { name: "Cerrar recorrido" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByTestId("recorrido-bloqueo")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Buscar")).toHaveValue("ana");
  expect(boton()).toHaveFocus();
});

test("cambiar de página cierra el recorrido", () => {
  const { rerender } = montar();
  fireEvent.click(boton()!);
  expect(screen.getByRole("dialog")).toBeInTheDocument();

  mockPathname = "/dashboard";
  rerender(
    <RecorridoProvider>
      <PageHeader titulo="Dashboard" />
    </RecorridoProvider>,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

// ------------------------------------------------------------
// Primera visita
// ------------------------------------------------------------
test("la primera vez que el cliente entra a la vista arranca solo, y después ya no", () => {
  localStorage.clear();
  const { unmount } = montar();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(tituloPaso()).toBe("Conversaciones");
  fireEvent.click(screen.getByRole("button", { name: "Cerrar recorrido" }));
  unmount();

  montar();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  // Sigue disponible a mano.
  fireEvent.click(boton()!);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("en una sesión «ver como» no arranca solo, pero el botón sí está", () => {
  localStorage.clear();
  conUsuario({ impersonado_por: "gerente@operativai.com" });
  montar();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(boton()).toBeInTheDocument();
});
