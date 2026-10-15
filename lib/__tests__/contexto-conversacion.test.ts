import {
  TEXTO_ABRIR_LIMPIAR_CONTEXTO,
  TEXTO_BOTON_CANCELAR,
  TEXTO_BOTON_LIMPIAR,
  TEXTO_CARGANDO_LIMPIEZA,
  TEXTO_CUERPO_LIMPIAR_CONTEXTO,
  TEXTO_ERROR_LIMPIAR_CONTEXTO,
  TITULO_LIMPIAR_CONTEXTO,
  formatearCorte,
} from "@/lib/contexto-conversacion";
import { formatoFechaHora } from "@/lib/formato";

describe("textos de limpiar contexto (RF13, RF14)", () => {
  it("coinciden con el texto literal de la spec", () => {
    expect(TITULO_LIMPIAR_CONTEXTO).toBe("¿Limpiar el contexto del agente?");
    expect(TEXTO_CUERPO_LIMPIAR_CONTEXTO).toBe(
      "El agente dejará de usar los mensajes anteriores a este momento al responder. El historial no se borra: seguirás viendo todos los mensajes. Si el agente ya estaba respondiendo, esa respuesta saldrá con el contexto anterior.",
    );
    expect(TEXTO_BOTON_CANCELAR).toBe("Cancelar");
    expect(TEXTO_BOTON_LIMPIAR).toBe("Limpiar contexto");
    expect(TEXTO_CARGANDO_LIMPIEZA).toBe("Limpiando…");
    expect(TEXTO_ABRIR_LIMPIAR_CONTEXTO).toBe("Limpiar contexto del agente");
    expect(TEXTO_ERROR_LIMPIAR_CONTEXTO).toBe("No se pudo limpiar el contexto.");
  });
});

describe("formatearCorte", () => {
  it("usa el formato de fecha y hora del portal", () => {
    const iso = "2026-10-14T18:30:00-06:00";
    expect(formatearCorte(iso)).toBe(formatoFechaHora(iso));
    expect(formatearCorte(iso)).toContain("2026");
  });

  it("es el mismo instante con cualquier desfase, en la hora local", () => {
    // 18:30 en UTC-6 es 00:30 UTC del día siguiente: no depende de la zona de la máquina.
    expect(formatearCorte("2026-10-14T18:30:00-06:00")).toBe(
      formatearCorte("2026-10-15T00:30:00Z"),
    );
  });

  it("devuelve un guion si la fecha no es válida", () => {
    expect(formatearCorte("no-es-fecha")).toBe("—");
  });
});
