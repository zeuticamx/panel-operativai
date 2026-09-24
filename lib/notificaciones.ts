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
  reserva_creada: "#10b981", // emerald-500, igual que "cierre": buena noticia
  reserva_cancelada: "#f59e0b", // amber-500: aviso, no error
};

const DURACION_MS = 5000;

/**
 * "Ding" sutil de dos tonos vía Web Audio API — nada de asset de audio que
 * empaquetar, ni de <audio> escondido en el DOM. Solo para "reserva_creada"
 * (historia de notificaciones en tiempo real, escenario 2): un sonido en
 * cada alerta del portal (nuevo_lead, cuota_excedida, etc.) sería ruido, no
 * señal. Los navegadores bloquean audio sin gesto previo del usuario — de
 * ahí el try/catch silencioso, ya cualquier click en el portal desbloquea
 * el AudioContext para el resto de la sesión.
 */
function reproducirSonidoSutil(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const ahora = ctx.currentTime;

    [880, 1320].forEach((frecuencia, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frecuencia;
      const inicio = ahora + i * 0.09;
      gain.gain.setValueAtTime(0, inicio);
      gain.gain.linearRampToValueAtTime(0.12, inicio + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.2);
    });

    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch {
    // Autoplay bloqueado o AudioContext no disponible: el toast visual
    // sigue siendo la notificación principal, el sonido es un extra.
  }
}

/**
 * Toast en la esquina superior derecha para una alerta que acaba de llegar
 * por WebSocket (ver lib/use-websocket-alertas.ts). Requiere `<Toaster />`
 * montado una sola vez en el árbol — vive en app/(privado)/layout.tsx junto
 * al resto del chrome de sesión.
 *
 * `accion` es el botón "Ver detalle" (escenario 2): opcional porque no toda
 * alerta tiene a dónde llevar al usuario (p.ej. cuota_excedida no navega a
 * ningún lado en particular).
 */
export function showToast(
  titulo: string,
  mensaje: string,
  tipo: string,
  accion?: { label: string; onClick: () => void },
): void {
  const color = COLOR_POR_TIPO[tipo as TipoAlerta] ?? "#334155"; // bg-700 del portal, si el tipo no se reconoce

  if (tipo === "reserva_creada") reproducirSonidoSutil();

  toast(titulo, {
    description: mensaje,
    duration: DURACION_MS,
    action: accion,
    style: {
      background: color,
      color: "#ffffff",
      border: "none",
    },
    // El hoja de estilos de sonner le pone su propio gris apagado al
    // texto de `description` (y su botón de acción) sin importar el
    // `color` del toast: hace falta pisarlo con `!important`.
    classNames: { description: "!text-white", actionButton: "!bg-white/20 !text-white" },
  });
}
