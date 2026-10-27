import type { CSSProperties } from "react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface BadgeAgenteProps {
  texto: string;
  title: string;
  color: string;
  className?: string;
}

/** Pastilla del agente que atiende la conversación, con el color de su número o canal. */
export function BadgeAgente({ texto, title, color, className }: BadgeAgenteProps) {
  return (
    <span
      title={title}
      style={{ "--agente": color } as CSSProperties}
      className={cn(
        "inline-flex min-w-0 max-w-[45vw] shrink items-center gap-1 rounded-full border border-[var(--agente)] bg-[color-mix(in_srgb,var(--agente)_14%,transparent)] px-2 py-0.5 text-[11px] font-medium leading-none text-text-100 sm:max-w-48",
        className,
      )}
    >
      <Bot className="h-3 w-3 shrink-0 text-[var(--agente)]" aria-hidden />
      <span className="truncate">{texto}</span>
    </span>
  );
}
