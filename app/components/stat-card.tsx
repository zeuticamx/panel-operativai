import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE_TEXT = {
  neutral: "text-text-100",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

export function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  tone?: keyof typeof TONE_TEXT;
  /** Contexto corto bajo el valor (ej. "en 7 días"). */
  hint?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-bg-700 bg-bg-800 px-4 py-3">
      <span className="font-mono text-[11px] text-text-600">{label}</span>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums transition-opacity",
          TONE_TEXT[tone],
          loading && "opacity-40",
        )}
      >
        {value}
      </span>
      {hint !== undefined && (
        <span className="font-mono text-[11px] text-text-600">{hint}</span>
      )}
    </div>
  );
}
