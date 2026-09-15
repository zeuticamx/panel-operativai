"use client";

import { toast } from "sonner";
import type { TipoAlerta } from "./types";

/**
 * Un color sólido por tipo de alerta, en hex y no en clase de Tailwind:
 * sonner aplica sus propios estilos con suficiente especificidad como para
 * ganarle a una clase, así que `style` (que sonner mezcla directo en el
 * nodo) es lo único que gana de forma confiable. Texto blanco fijo: los
 * cinco tonos son lo bastante saturados para tener contraste en claro y
 * oscuro, así que no hace falta variar nada por tema.
 *
 * "cambio_etapa" pedía amarillo, pero yellow-500 (#eab308) con texto blanco
 * queda con bajo contraste (falla WCAG AA); amber-500 es el mismo tono de
 * la familia que ya usa el portal como `--warning` y sí es legible.
 */
const COLOR_POR_TIPO: Record<TipoAlerta, string> = {
  nuevo_lead: "#3b82f6", // blue-500
  cambio_etapa: "#f59e0b", // amber-500 (== --warning del portal)
  sin_actividad: "#f97316", // orange-500
  cuota_excedida: "#ef4444", // red-500 (== --danger del portal)
  cierre: "#10b981", // emerald-500
};

const DURACION_MS = 5000;

/**
 * Toast en la esquina superior derecha para una alerta que acaba de llegar
 * por WebSocket (ver lib/use-websocket-alertas.ts). Requiere `<Toaster />`
 * montado una sola vez en el árbol — vive en app/(privado)/layout.tsx junto
 * al resto del chrome de sesión.
 */
export function showToast(titulo: string, mensaje: string, tipo: string): void {
  const color = COLOR_POR_TIPO[tipo as TipoAlerta] ?? "#334155"; // bg-700 del portal, si el tipo no se reconoce

  toast(titulo, {
    description: mensaje,
    duration: DURACION_MS,
    style: {
      background: color,
      color: "#ffffff",
      border: "none",
    },
    // El hoja de estilos de sonner le pone su propio gris apagado al
    // texto de `description` sin importar el `color` del toast: hace
    // falta pisarlo con `!important` para que también quede blanco.
    classNames: { description: "!text-white" },
  });
}
