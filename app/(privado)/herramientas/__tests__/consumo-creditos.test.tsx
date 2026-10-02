/**
 * Tests del panel de consumo de créditos:
 *  - cada fila muestra herramienta, créditos, fecha y hora en la zona del
 *    negocio (con su abreviatura) y el número enmascarado, o "N/A";
 *  - la paginación pide la página siguiente con el offset correcto;
 *  - estado vacío.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";

import { ConsumoCreditos } from "@/app/(privado)/herramientas/consumo-creditos";
import type { ConsumoPaginaOut, ConsumoResumenOut } from "@/lib/types";
import { useApi } from "@/lib/use-api";

jest.mock("@/lib/use-api", () => ({ useApi: jest.fn() }));
jest.mock("recharts", () => {
  const Nulo = () => null;
  return {
    ResponsiveContainer: Nulo,
    BarChart: Nulo,
    Bar: Nulo,
    CartesianGrid: Nulo,
    Tooltip: Nulo,
    XAxis: Nulo,
    YAxis: Nulo,
  };
});

const mockUseApi = useApi as jest.Mock;

const PAGINA: ConsumoPaginaOut = {
  items: [
    {
      id: "1",
      herramienta: "consultar_servicios",
      creditos: "1.00",
      bolsa: "plan",
      // 15:30 UTC = 09:30 en Ciudad de México (UTC-6 sin horario de verano)
      creado_en: "2026-01-10T09:30:15-06:00",
      whatsapp: "+521 •••• 4567",
      canal: "whatsapp",
    },
    {
      id: "2",
      herramienta: "crear_reserva",
      creditos: "1.00",
      bolsa: "comprados",
      creado_en: "2026-01-09T18:00:00-06:00",
      whatsapp: null,
      canal: "instagram",
    },
  ],
  total: 60,
  limite: 25,
  offset: 0,
  zona_horaria: "America/Mexico_City",
};

const RESUMEN: ConsumoResumenOut = {
  total_creditos: "60.00",
  por_herramienta: [{ herramienta: "consultar_servicios", creditos: "40.00" }],
  por_dia: [{ dia: "2026-01-10", creditos: "30.00" }],
  zona_horaria: "America/Mexico_City",
};

function mockApi(pagina: ConsumoPaginaOut | null = PAGINA) {
  mockUseApi.mockImplementation((path: string | null) => ({
    data: path === null ? null : path.includes("/resumen") ? RESUMEN : pagina,
    loading: false,
    error: null,
    recargar: jest.fn(),
  }));
}

const HERRAMIENTAS = [{ clave: "consultar_servicios", nombre: "Consultar servicios" }];

beforeEach(() => mockUseApi.mockReset());

test("muestra herramienta, créditos, fecha/hora con zona y número o N/A", () => {
  mockApi();
  render(<ConsumoCreditos herramientas={HERRAMIENTAS} />);

  const filas = screen.getAllByRole("row");
  const primera = within(filas[1]);
  expect(primera.getByText("consultar_servicios")).toBeInTheDocument();
  expect(primera.getByText("+521 •••• 4567")).toBeInTheDocument();
  // Hora exacta con segundos, en la zona del negocio y no en la del navegador.
  expect(primera.getByText(/09:30:15/)).toBeInTheDocument();
  expect(primera.getByText(/GMT-6|CST/)).toBeInTheDocument();

  const segunda = within(filas[2]);
  expect(segunda.getByText("crear_reserva")).toBeInTheDocument();
  expect(segunda.getByText("N/A")).toBeInTheDocument();

  expect(screen.getByText(/Fecha y hora \(America\/Mexico_City\)/)).toBeInTheDocument();
  expect(screen.getByText("1–2 de 60")).toBeInTheDocument();
});

test("«Siguiente» pide la página con el offset siguiente", () => {
  mockApi();
  render(<ConsumoCreditos herramientas={HERRAMIENTAS} />);

  expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

  const rutas = mockUseApi.mock.calls.map((c) => c[0] as string | null);
  expect(rutas.some((r) => r?.includes("/consumo?") && r.includes("offset=25") && r.includes("limite=25"))).toBe(true);
});

test("sin consumo muestra el estado vacío", () => {
  mockApi({ ...PAGINA, items: [], total: 0 });
  render(<ConsumoCreditos herramientas={HERRAMIENTAS} />);
  expect(screen.getByText(/No hay consumo de créditos/)).toBeInTheDocument();
});

test("con el rango invertido no consulta al backend", () => {
  mockApi();
  render(<ConsumoCreditos herramientas={HERRAMIENTAS} />);
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-02-10" } });
  fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-02-01" } });

  expect(screen.getByText(/no puede ser posterior/)).toBeInTheDocument();
  expect(mockUseApi.mock.calls.at(-1)?.[0]).toBeNull();
});
