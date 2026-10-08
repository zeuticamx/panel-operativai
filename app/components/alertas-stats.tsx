"use client";

import type { ComponentType } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarX2,
  Headset,
  Milestone,
  MessageSquareMore,
  ShieldAlert,
  Siren,
  Sparkles,
  Trophy,
  UserCheck,
  UserRound,
  UserX,
} from "lucide-react";
import { fmtInt } from "@/lib/formato";
import { useApi } from "@/lib/use-api";
import type { EstadisticasAlertasOut, TipoAlerta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { esGerencia } from "./modulo-vendedores";
import { useUsuario } from "./usuario-context";

// Mismo color por tipo que centro-notificaciones.tsx (TIPO_CLASES), pero
// como texto de ícono en vez de tinte de fondo. "cierre" tampoco estaba en
// el pedido original acá, pero sin él una alerta de ese tipo sumaría al
// total de arriba sin aparecer en ningún renglón de abajo.
const TIPO_INFO: Record<TipoAlerta, { label: string; icon: ComponentType<{ size?: number; className?: string }>; clase: string }> = {
  nuevo_lead: { label: "Nuevo lead", icon: Sparkles, clase: "text-blue-500" },
  cambio_etapa: { label: "Cambio de etapa", icon: Milestone, clase: "text-amber-500" },
  sin_actividad: { label: "Sin actividad", icon: AlertTriangle, clase: "text-orange-500" },
  cuota_excedida: { label: "Cuota excedida", icon: Siren, clase: "text-danger" },
  cierre: { label: "Cierre", icon: Trophy, clase: "text-emerald-500" },
  reserva_creada: { label: "Nueva reserva", icon: CalendarCheck, clase: "text-emerald-500" },
  reserva_cancelada: { label: "Reserva cancelada", icon: CalendarX2, clase: "text-amber-500" },
  conversacion_transferida: { label: "Transferida a humano", icon: Headset, clase: "text-danger" },
  perfil_incompleto: { label: "Completa tu perfil", icon: UserRound, clase: "text-blue-500" },
  agenda_reprogramada: { label: "Agenda reprogramada", icon: CalendarClock, clase: "text-blue-500" },
  solicitud_escritura: { label: "Permiso de soporte", icon: ShieldAlert, clase: "text-amber-500" },
  conversacion_asignada: { label: "Conversación asignada", icon: UserCheck, clase: "text-blue-500" },
  asignacion_fallida: { label: "Sin responsable", icon: UserX, clase: "text-danger" },
  mensaje_conversacion_asignada: { label: "Mensaje en tu chat", icon: MessageSquareMore, clase: "text-blue-500" },
};

const ORDEN: TipoAlerta[] = [
  "nuevo_lead",
  "cambio_etapa",
  "sin_actividad",
  "cuota_excedida",
  "cierre",
  "reserva_creada",
  "reserva_cancelada",
  "conversacion_transferida",
  "perfil_incompleto",
];

/**
 * Resumen de alertas sin leer, en /preferencias (antes vivía en el embudo de
 * /vendedores, pero cuenta alertas de todo el negocio — reservas, perfil,
 * conversaciones — y no solo de ventas). Sin props: el tenant sale de la
 * sesión, igual que CentroNotificaciones.
 *
 * El endpoint (GET /tenants/{id}/alertas/estadisticas) requiere gerencia
 * (owner/superadmin) — para un vendedor la llamada daría 403, así que acá
 * ni se pide.
 */
export function AlertasStats() {
  const { usuario } = useUsuario();
  const gerencia = esGerencia(usuario);
  const tenantId = usuario?.tenant_id ?? null;

  const estadisticas = useApi<EstadisticasAlertasOut>(
    gerencia && tenantId ? `/api/tenants/${tenantId}/alertas/estadisticas` : null,
  );

  if (!gerencia) return null;

  const e = estadisticas.data;
  // El resto de la página no depende de esto; si falla, mejor omitirla
  // que mostrar un error entre las preferencias.
  if (estadisticas.error) return null;

  return (
    <section
      data-tour="preferencias.alertas"
      className="flex flex-col overflow-hidden rounded-md border border-bg-700 bg-bg-900"
    >
      <header className={cn("flex items-center gap-3 px-4 py-3", e && e.total > 0 && "border-b border-bg-700")}>
        <div className="mr-auto">
          <h2 className="text-sm font-medium text-text-100">Alertas sin leer</h2>
          <p className="font-mono text-[11px] text-text-600">
            {e && e.total === 0
              ? "todo al día: no queda nada por revisar"
              : "lo que todavía no marcaste como visto en la campana"}
          </p>
        </div>
        <span
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums transition-opacity",
            e && e.total === 0 ? "text-text-600" : "text-danger",
            !e && "opacity-40",
          )}
        >
          {e ? fmtInt.format(e.total) : "—"}
        </span>
      </header>

      {e && e.total > 0 && (
        <div className="grid grid-cols-2 gap-px bg-bg-700 sm:grid-cols-4">
          {ORDEN.filter((tipo) => (e.por_tipo[tipo] ?? 0) > 0).map((tipo) => {
            const info = TIPO_INFO[tipo];
            const Icon = info.icon;
            return (
              <div
                key={tipo}
                className="flex items-center gap-2 bg-bg-900 px-4 py-3"
              >
                <Icon size={14} className={info.clase} />
                <span className="text-xs text-text-400">{info.label}</span>
                <span className="ml-auto font-mono text-xs tabular-nums text-text-100">
                  {fmtInt.format(e.por_tipo[tipo] ?? 0)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
