import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Burbuja de chat. `role` viene directo del backend:
 *   user      → cliente final (izquierda, gris)
 *   assistant → el agente de IA (derecha, verde)
 * Cualquier otro rol se trata como saliente pero en tono neutro.
 */
interface MessageBubbleProps {
  role: string;
  timestamp: string;
  meta?: string;
  children: ReactNode;
}

export function MessageBubble({ role, timestamp, meta, children }: MessageBubbleProps) {
  const entrante = role === "user";
  const asistente = role === "assistant";

  return (
    <div className={cn("flex flex-col gap-1", entrante ? "items-start" : "items-end")}>
      <div
        className={cn(
          "max-w-[75%] rounded-md border px-3 py-2 text-sm leading-relaxed text-text-100 whitespace-pre-wrap break-words",
          entrante && "border-bg-700 bg-bg-800",
          asistente && "border-success/30 bg-success-bg",
          !entrante && !asistente && "border-bg-600 bg-bg-900",
        )}
      >
        {children}
      </div>
      <div className="flex items-center gap-2 px-1 font-mono text-[11px] text-text-600">
        {meta && <span>{meta}</span>}
        <span>{timestamp}</span>
      </div>
    </div>
  );
}
