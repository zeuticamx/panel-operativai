/**
 * Fechas de conversaciones/mensajes: las columnas TIMESTAMP (sin zona) de n8n
 * llegan sin "Z" y son UTC. `aUtc` debe hacer que se conviertan a la hora
 * local del navegador en vez de leerse como si ya fueran locales.
 */
import { aUtc, estadoVentanaHumana, formatoCorto, formatoFechaHora, formatoHora } from "@/lib/formato";

describe("aUtc", () => {
  it("agrega Z a un datetime sin zona", () => {
    expect(aUtc("2026-10-09T18:30:00")).toBe("2026-10-09T18:30:00Z");
    expect(aUtc("2026-10-09T18:30:00.123456")).toBe("2026-10-09T18:30:00.123456Z");
  });

  it("acepta el separador con espacio", () => {
    expect(aUtc("2026-10-09 18:30:00")).toBe("2026-10-09T18:30:00Z");
  });

  it("no toca fechas que ya traen zona", () => {
    expect(aUtc("2026-10-09T18:30:00Z")).toBe("2026-10-09T18:30:00Z");
    expect(aUtc("2026-10-09T18:30:00+00:00")).toBe("2026-10-09T18:30:00+00:00");
    expect(aUtc("2026-10-09T12:30:00-06:00")).toBe("2026-10-09T12:30:00-06:00");
    expect(aUtc("2026-10-09T12:30:00-0600")).toBe("2026-10-09T12:30:00-0600");
  });

  it("no toca fechas sin hora ni texto inválido", () => {
    expect(aUtc("2026-10-09")).toBe("2026-10-09");
    expect(aUtc("basura")).toBe("basura");
    expect(aUtc("")).toBe("");
  });

  it("interpreta el valor sin zona como el mismo instante UTC", () => {
    expect(new Date(aUtc("2026-10-09T18:30:00")).toISOString()).toBe("2026-10-09T18:30:00.000Z");
  });

  it("sin aUtc el valor naive se leería como hora local (el bug original)", () => {
    const naive = new Date("2026-10-09T18:30:00");
    const utc = new Date(aUtc("2026-10-09T18:30:00"));
    // Mismo instante solo si la zona del entorno es UTC; en cualquier otra, difieren
    // exactamente por el offset local.
    expect(naive.getTime() - utc.getTime()).toBe(utc.getTimezoneOffset() * 60_000);
  });
});

describe("formatos con aUtc", () => {
  const naive = "2026-10-09T18:30:00";
  const conZ = "2026-10-09T18:30:00Z";

  it("formatoHora / formatoFechaHora de un naive coinciden con los de su equivalente con Z", () => {
    expect(formatoHora(aUtc(naive))).toBe(formatoHora(conZ));
    expect(formatoFechaHora(aUtc(naive))).toBe(formatoFechaHora(conZ));
  });

  it("formatoCorto muestra la hora del instante UTC cuando es hoy", () => {
    const ahora = new Date(conZ).getTime() + 60_000;
    expect(formatoCorto(aUtc(naive), ahora)).toBe(formatoHora(conZ));
  });
});

describe("estadoVentanaHumana (Instagram por NeuroAPI, 7 días)", () => {
  it("no se muestra en otros canales ni mientras la ventana de 24 h siga abierta", () => {
    expect(estadoVentanaHumana(null, -30)).toBeNull();
    expect(estadoVentanaHumana(undefined, -30)).toBeNull();
    expect(estadoVentanaHumana(8000, 600)).toBeNull();
  });

  it("con las 24 h cerradas dice cuánto le queda al equipo", () => {
    const e = estadoVentanaHumana(5 * 1440 + 120, -1500);
    expect(e?.tono).toBe("success");
    expect(e?.textoCorto).toBe("Equipo · 5 d 2 h");
  });

  it("avisa cuando queda menos de un día y cuando ya pasaron los 7", () => {
    expect(estadoVentanaHumana(300, -9000)?.tono).toBe("warning");
    expect(estadoVentanaHumana(-10, -9000)?.tono).toBe("danger");
  });
});
