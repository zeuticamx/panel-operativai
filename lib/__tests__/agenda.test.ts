/**
 * Lógica pura de la agenda de ventas (lib/agenda.ts): la fecha que le toca
 * a un pendiente al soltarlo, los filtros y qué va al carril de "por agendar".
 */
import {
  FILTROS_INICIALES,
  aInputLocal,
  atrasadosFueraDeVista,
  claveItem,
  deInputLocal,
  esMovible,
  fechaAlSoltar,
  fechaDeParametro,
  filtrarItems,
  leadsSinSeguimiento,
  rangoQuery,
} from "@/lib/agenda";
import type { AgendaItemOut, PipelineOut } from "@/lib/types";

function item(over: Partial<AgendaItemOut> = {}): AgendaItemOut {
  return {
    tipo: "tarea",
    id: "t1",
    titulo: "Llevar muestras",
    descripcion: null,
    fecha: new Date(2026, 9, 12, 16, 30).toISOString(),
    estado: "pendiente",
    vendedor_id: "v1",
    vendedor_nombre: "Ana",
    cliente_id: "c1",
    cliente_nombre: "Abarrotes La Esquina",
    etapa: null,
    ...over,
  };
}

function lead(over: Partial<PipelineOut> = {}): PipelineOut {
  return {
    id: "p1",
    user_id: "u1",
    cliente_nombre: "Lucía",
    cliente_handle: null,
    vendedor_id: "v1",
    vendedor_nombre: "Ana",
    estado: "contactado",
    monto_estimado: null,
    motivo_perdida: null,
    actualizado_en: new Date().toISOString(),
    transiciones_posibles: [],
    proximo_seguimiento: null,
    seguimiento_nota: null,
    ...over,
  };
}

describe("fechaAlSoltar", () => {
  const jueves = new Date(2026, 9, 15); // 00:00 local, como lo entrega la vista de mes

  it("en la vista de mes conserva la hora que ya tenía", () => {
    const original = new Date(2026, 9, 12, 16, 30);
    const r = fechaAlSoltar(jueves, true, original);
    expect([r.getFullYear(), r.getMonth(), r.getDate(), r.getHours(), r.getMinutes()]).toEqual([
      2026, 9, 15, 16, 30,
    ]);
  });

  it("sin hora previa (lead que se agenda por primera vez) cae a las 10:00", () => {
    const r = fechaAlSoltar(jueves, true, null);
    expect([r.getDate(), r.getHours(), r.getMinutes()]).toEqual([15, 10, 0]);
  });

  it("en semana/día respeta la franja exacta donde se soltó", () => {
    const franja = new Date(2026, 9, 15, 11, 30);
    expect(fechaAlSoltar(franja, false, new Date(2026, 9, 12, 16, 30)).getTime()).toBe(franja.getTime());
  });

  it("no muta la fecha que le pasan", () => {
    const destino = new Date(2026, 9, 15);
    fechaAlSoltar(destino, true, null);
    expect(destino.getHours()).toBe(0);
  });
});

describe("filtrarItems", () => {
  const items = [
    item({ id: "a" }),
    item({ id: "b", tipo: "seguimiento" }),
    item({ id: "c", estado: "completada" }),
    item({ id: "d", estado: "vencida" }),
  ];

  it("por defecto oculta solo las completadas", () => {
    expect(filtrarItems(items, FILTROS_INICIALES).map((i) => i.id)).toEqual(["a", "b", "d"]);
  });

  it("apaga un tipo completo", () => {
    const r = filtrarItems(items, { ...FILTROS_INICIALES, seguimientos: false, completadas: true });
    expect(r.map((i) => i.id)).toEqual(["a", "c", "d"]);
  });
});

describe("atrasadosFueraDeVista", () => {
  const inicio = new Date(2026, 9, 1);

  it("solo lo vencido anterior a la vista, del más viejo al más nuevo", () => {
    const items = [
      item({ id: "visible", estado: "vencida", fecha: new Date(2026, 9, 3).toISOString() }),
      item({ id: "reciente", estado: "vencida", fecha: new Date(2026, 8, 28).toISOString() }),
      item({ id: "viejo", estado: "vencida", fecha: new Date(2026, 8, 2).toISOString() }),
      item({ id: "pendiente", estado: "pendiente", fecha: new Date(2026, 8, 20).toISOString() }),
    ];
    expect(atrasadosFueraDeVista(items, inicio).map((i) => i.id)).toEqual(["viejo", "reciente"]);
  });
});

describe("leadsSinSeguimiento", () => {
  const leads = [
    lead({ user_id: "abierto" }),
    lead({ user_id: "agendado", proximo_seguimiento: new Date().toISOString() }),
    lead({ user_id: "ganado", estado: "ganado" }),
    lead({ user_id: "perdido", estado: "perdido" }),
    lead({ user_id: "de-beto", vendedor_id: "v2" }),
  ];

  it("abiertos y sin fecha", () => {
    expect(leadsSinSeguimiento(leads, null).map((l) => l.user_id)).toEqual(["abierto", "de-beto"]);
  });

  it("del vendedor filtrado", () => {
    expect(leadsSinSeguimiento(leads, "v2").map((l) => l.user_id)).toEqual(["de-beto"]);
  });
});

describe("utilidades", () => {
  it("la clave distingue una tarea de un seguimiento con el mismo id", () => {
    expect(claveItem(item({ id: "x" }))).not.toBe(claveItem(item({ id: "x", tipo: "seguimiento" })));
  });

  it("una completada no se arrastra", () => {
    expect(esMovible(item({ estado: "completada" }))).toBe(false);
    expect(esMovible(item({ estado: "vencida" }))).toBe(true);
  });

  it("datetime-local ida y vuelta conserva el instante (al minuto)", () => {
    const d = new Date(2026, 9, 12, 16, 30);
    expect(aInputLocal(d)).toBe("2026-10-12T16:30");
    expect(deInputLocal(aInputLocal(d))).toBe(d.toISOString());
    expect(deInputLocal("")).toBeNull();
  });

  it("?fecha= solo acepta AAAA-MM-DD", () => {
    expect(fechaDeParametro("2026-10-12")?.getDate()).toBe(12);
    expect(fechaDeParametro("12/10/2026")).toBeNull();
    expect(fechaDeParametro(null)).toBeNull();
  });

  it("el query escapa el + de la zona y solo manda vendedor si hay", () => {
    const desde = new Date(Date.UTC(2026, 9, 1));
    const hasta = new Date(Date.UTC(2026, 10, 1));
    expect(rangoQuery(desde, hasta, null)).toBe(
      "desde=2026-10-01T00%3A00%3A00.000Z&hasta=2026-11-01T00%3A00%3A00.000Z",
    );
    expect(rangoQuery(desde, hasta, "v1")).toContain("vendedor_id=v1");
  });
});
