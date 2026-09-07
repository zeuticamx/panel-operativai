import Link from "next/link";
import type { ConversacionOut } from "@/lib/types";
import { estadoVentanaMeta, etiquetaIdentificador, formatoCorto, iniciales } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { CanalBadge, StatusBadge } from "./status";

interface ConversationRowProps {
  conversacion: ConversacionOut;
  now?: number;
  /** Compacta: sin preview ni estado (para el dashboard). */
  compact?: boolean;
  active?: boolean;
}

export function ConversationRow({
  conversacion: c,
  now,
  compact = false,
  active = false,
}: ConversationRowProps) {
  // El @usuario de Instagram identifica mejor que el id numérico, así que
  // cuando no hay nombre real se prefiere antes de caer al handle.
  const nombre =
    c.usuario_nombre?.trim() ||
    (c.usuario_username ? `@${c.usuario_username}` : null) ||
    c.usuario_handle ||
    "Sin nombre";

  const ventana = !compact ? estadoVentanaMeta(c.minutos_restantes_ventana) : null;

  return (
    <Link
      href={`/conversaciones/${c.id}`}
      className={cn(
        "flex w-full items-center gap-3 border-b border-bg-800 px-3 text-left hover:bg-bg-800 focus:outline-none focus-visible:bg-bg-800",
        compact ? "py-2" : "py-2.5",
        active && "bg-bg-800",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-700 font-mono text-xs text-text-400">
        {iniciales(c.usuario_nombre, c.usuario_handle)}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-text-100">{nombre}</span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-600">
            {formatoCorto(c.last_message_at, now)}
          </span>
        </div>

        {!compact && (
          <span className="truncate text-xs text-text-400">
            {c.ultimo_mensaje ?? "—"}
          </span>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-text-600">
            <CanalBadge tipo={c.channel_type} />
            {c.usuario_handle && !compact && (
              <span className="min-w-0 truncate">
                <span className="opacity-70">{etiquetaIdentificador(c.channel_type)}: </span>
                {c.usuario_handle}
              </span>
            )}
          </span>
          {compact ? (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-600">
              {c.total_mensajes} msjs
            </span>
          ) : (
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {ventana && (
                <Badge tone={ventana.tono} title={ventana.texto}>
                  {ventana.textoCorto}
                </Badge>
              )}
              <StatusBadge status={c.status} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
