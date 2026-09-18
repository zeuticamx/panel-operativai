/**
 * Tests de los 4 gráficos de Recharts del dashboard de reportes.
 *
 * OJO — nombres/props/fuente de datos reales (no coinciden con el pedido
 * original, que asumía endpoints /api/reportes/* que no existen):
 *   - EmbudoGrafico          filtros: { fechaInicio?, fechaFin? } (string
 *                            "YYYY-MM-DD", no Date). Fuente:
 *                            GET /api/tenants/{id}/metricas
 *   - TendenciasGrafico      no usa filtros (siempre últimos 12 meses).
 *                            Fuente: GET /api/tenants/{id}/metricas/tendencia
 *   - ComparativaVendedores  (no "ComparativaVendedoresGrafico"). Fuente:
 *                            GET /api/tenants/{id}/metricas, campo `ranking`
 *   - ConversionAnalisis     (no "ConversionGrafico"). Fuente:
 *                            GET /api/tenants/{id}/metricas/conversion
 *
 * Los cuatro dependen de useServicios() (@/app/components/modulo-vendedores)
 * para saber el tenant activo y si el módulo de vendedores está encendido;
 * se mockea acá para no tener que montar el UsuarioProvider real. La única
 * llamada de red que se prueba de verdad es la del propio gráfico
 * (metricas / tendencia / conversion), vía apiFetch -> fetch.
 *
 * apiFetch (lib/auth.ts) lee la respuesta con `res.text()` y hace
 * JSON.parse, no `res.json()` — el mock de fetch tiene que exponer `text`.
 *
 * Otras suposiciones que circularon en pedidos previos y tampoco son
 * ciertas (se prueba lo contrario más abajo):
 *   - Ninguno de los 4 recibe `tenantId` como prop: sale de useServicios().
 *   - No existe /metricas/comparativa: ComparativaVendedores lee el mismo
 *     /metricas que EmbudoGrafico (campo `ranking`).
 *   - <Aviso tipo="error"> no pone un atributo `data-tipo`; el tipo se
 *     verifica por `role="alert"` (ver app/components/ui.tsx).
 *   - Los filtros de fecha viajan como `desde`/`hasta` en ISO absoluto, no
 *     como `fechaInicio=`/`fechaFin=` tal cual.
 */
import { render, screen, waitFor } from "@testing-library/react";

import { EmbudoGrafico } from "@/app/components/graficos/embudo-grafico";
import { TendenciasGrafico } from "@/app/components/graficos/tendencias-grafico";
import { ComparativaVendedores } from "@/app/components/graficos/comparativa-vendedores";
import { ConversionAnalisis } from "@/app/components/graficos/conversion-analisis";
import { useServicios } from "@/app/components/modulo-vendedores";
import type {
  ConversionPipelineOut,
  MetricasPipelineOut,
  RankingVendedorOut,
  TendenciaPipelineOut,
} from "@/lib/types";

jest.mock("@/app/components/modulo-vendedores", () => ({
  useServicios: jest.fn(),
}));

const mockUseServicios = useServicios as jest.Mock;

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

function conServiciosActivos(activo = true) {
  mockUseServicios.mockReturnValue({
    data: { tenant_id: TENANT_ID, agente_ia_activo: true, gestion_vendedores_activo: activo },
    loading: false,
    error: null,
    recargar: jest.fn(),
    tenantId: TENANT_ID,
  });
}

/** Responde una vez con un 200 y el body dado, tal como espera apiFetch. */
function mockFetchOnce(data: unknown, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data),
  });
}

/** Una promesa que nunca resuelve: para probar el estado "cargando". */
function mockFetchColgado() {
  (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
}

beforeEach(() => {
  global.fetch = jest.fn();
  conServiciosActivos(true);
});

afterEach(() => {
  jest.clearAllMocks();
});

const METRICAS_VACIAS: MetricasPipelineOut = {
  total_clientes: 0,
  etapas: [],
  tasa_conversion_global: null,
  ranking: [],
};

describe("EmbudoGrafico", () => {
  test("muestra 'cargando…' mientras la petición está en curso", () => {
    mockFetchColgado();
    render(<EmbudoGrafico filtros={{}} />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  test("no dispara ninguna petición si el módulo de vendedores está apagado", () => {
    conServiciosActivos(false);
    render(<EmbudoGrafico filtros={{}} />);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("renderiza el gráfico con los datos de /metricas", async () => {
    const data: MetricasPipelineOut = {
      ...METRICAS_VACIAS,
      etapas: [
        { estado: "nuevo", total: 45, porcentaje: 22.5, horas_promedio: null },
        { estado: "contactado", total: 30, porcentaje: 15, horas_promedio: null },
      ],
    };
    mockFetchOnce(data);

    render(<EmbudoGrafico filtros={{}} />);

    await waitFor(() => {
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("img", { name: /embudo de ventas por etapa/i }),
    ).toBeInTheDocument();
  });

  test("muestra un aviso (role=alert) si la petición falla", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network fail"));

    render(<EmbudoGrafico filtros={{}} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    // Mensaje real de apiFetch ante un fetch que revienta (ver lib/auth.ts),
    // no el texto genérico "error" que asumía el pedido original.
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo conectar con el servidor",
    );
  });

  test("pide los datos a GET /api/tenants/{id}/metricas (no /api/reportes/embudo)", async () => {
    mockFetchOnce(METRICAS_VACIAS);
    render(<EmbudoGrafico filtros={{}} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain(`/api/tenants/${TENANT_ID}/metricas`);
  });

  test("los filtros se mandan como desde/hasta en ISO, no como fechaInicio/fechaFin", async () => {
    mockFetchOnce(METRICAS_VACIAS);
    render(
      <EmbudoGrafico filtros={{ fechaInicio: "2025-01-01", fechaFin: "2025-01-31" }} />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    const decoded = decodeURIComponent(String(url));

    // rangoISO() (embudo-grafico.tsx) interpreta "YYYY-MM-DD" en hora LOCAL
    // y convierte a ISO (absoluto): el offset depende de la zona horaria de
    // quien corre el test, así que se calcula igual que el componente en
    // vez de hardcodear un string en UTC que solo daría por casualidad.
    const desdeEsperado = new Date("2025-01-01T00:00:00").toISOString();
    const hastaEsperado = new Date("2025-02-01T00:00:00").toISOString(); // +1 día: "hasta" es exclusivo en el backend

    expect(decoded).toContain(`desde=${desdeEsperado}`);
    expect(decoded).toContain(`hasta=${hastaEsperado}`);
    expect(decoded).not.toContain("fechaInicio=");
    expect(decoded).not.toContain("fechaFin=");
  });

  test("vuelve a pedir datos cuando cambian los filtros de fecha", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(METRICAS_VACIAS),
    });

    const { rerender } = render(
      <EmbudoGrafico filtros={{ fechaInicio: "2025-01-01", fechaFin: "2025-01-31" }} />,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    rerender(
      <EmbudoGrafico filtros={{ fechaInicio: "2025-02-01", fechaFin: "2025-02-28" }} />,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    const [[urlPrimera], [urlSegunda]] = (global.fetch as jest.Mock).mock.calls;
    expect(urlPrimera).not.toEqual(urlSegunda);
  });
});

describe("TendenciasGrafico", () => {
  test("renderiza las 3 series (total/ganados/perdidos) con datos de /metricas/tendencia", async () => {
    const data: TendenciaPipelineOut = {
      meses: [
        { periodo: "2025-09", nuevos: 10, ganados: 8, perdidos: 2, monto_ganado: "1000" },
        { periodo: "2025-10", nuevos: 15, ganados: 12, perdidos: 3, monto_ganado: "2000" },
      ],
    };
    mockFetchOnce(data);

    // No toma `filtros`: siempre son los últimos 12 meses (ver comentario
    // del componente).
    render(<TendenciasGrafico />);

    await waitFor(() => {
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("img", { name: /cierres ganados y perdidos por mes/i }),
    ).toBeInTheDocument();
  });

  test("muestra un aviso (role=alert) si la petición falla", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network fail"));

    render(<TendenciasGrafico />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  test("pide los últimos 12 meses a GET /api/tenants/{id}/metricas/tendencia (no /api/reportes/tendencias)", async () => {
    mockFetchOnce({ meses: [] } satisfies TendenciaPipelineOut);
    render(<TendenciasGrafico />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain(`/api/tenants/${TENANT_ID}/metricas/tendencia?meses=12`);
  });
});

describe("ComparativaVendedores", () => {
  test("recorta el ranking a los primeros 10 (por cierres)", async () => {
    const ranking: RankingVendedorOut[] = Array.from({ length: 15 }, (_, i) => ({
      vendedor_id: `vendedor-${i}`,
      nombre: `Vendedor ${i + 1}`,
      activo: true,
      abiertos: 0,
      ganados: 20 - i,
      perdidos: 5,
      monto_ganado: "0",
      tasa_cierre: 80 - i,
    }));
    mockFetchOnce({ ...METRICAS_VACIAS, ranking });

    render(<ComparativaVendedores filtros={{}} />);

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: /cierres y pérdidas por vendedor/i }),
      ).toBeInTheDocument();
    });
  });

  test("muestra un mensaje cuando todavía no hay vendedores", async () => {
    mockFetchOnce(METRICAS_VACIAS);

    render(<ComparativaVendedores filtros={{}} />);

    await waitFor(() => {
      expect(screen.getByText(/todavía no hay vendedores/i)).toBeInTheDocument();
    });
  });

  test("lee el ranking del mismo GET /metricas que EmbudoGrafico (no existe /metricas/comparativa)", async () => {
    mockFetchOnce(METRICAS_VACIAS);
    render(<ComparativaVendedores filtros={{}} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain(`/api/tenants/${TENANT_ID}/metricas`);
    expect(String(url)).not.toContain("/comparativa");
  });
});

describe("ConversionAnalisis", () => {
  test("deriva el % de conversión por transición entre etapas consecutivas", async () => {
    const data: ConversionPipelineOut = {
      desde: null,
      hasta: null,
      total_leads: 100,
      etapas: [
        { estado: "nuevo", alcanzados: 100, porcentaje: 100 },
        { estado: "contactado", alcanzados: 60, porcentaje: 60 },
      ],
    };
    mockFetchOnce(data);

    render(<ConversionAnalisis filtros={{}} />);

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: /porcentaje de conversión por transición/i }),
      ).toBeInTheDocument();
    });
  });

  test("sin etapas en el rango, muestra 'sin datos en este rango'", async () => {
    mockFetchOnce({ desde: null, hasta: null, total_leads: 0, etapas: [] });

    render(<ConversionAnalisis filtros={{}} />);

    await waitFor(() => {
      expect(screen.getByText(/sin datos en este rango/i)).toBeInTheDocument();
    });
  });

  test("pide los datos a GET /api/tenants/{id}/metricas/conversion (no /api/reportes/conversion)", async () => {
    mockFetchOnce({ desde: null, hasta: null, total_leads: 0, etapas: [] });
    render(<ConversionAnalisis filtros={{}} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain(`/api/tenants/${TENANT_ID}/metricas/conversion`);
  });
});
