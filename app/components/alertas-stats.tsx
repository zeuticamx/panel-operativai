"use client";

import type { ComponentType } from "react";
import { AlertTriangle, Milestone, Siren, Sparkles, Trophy } from "lucide-react";
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
};

const ORDEN: TipoAlerta[] = [
  "nuevo_lead",
  "cambio_etapa",
  "sin_actividad",
  "cuota_excedida",
  "cierre",
];

/**
 * Tarjeta de alertas sin leer para el dashboard de /vendedores. Sin props:
 * el tenant sale de la sesión, igual que CentroNotificaciones.
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
  // Nada sin leer: no ocupar espacio en el dashboard con una tarjeta vacía.
  if (!estadisticas.loading && !estadisticas.error && e && e.total === 0) {
    return null;
  }
  // El resto del dashboard no depende de esto; si falla, mejor omitirla
  // que mostrar un error encima del embudo.
  if (estadisticas.error) return null;

  return (
    <section className="flex flex-col overflow-hidden rounded-md border border-bg-700 bg-bg-900">
      <header className="flex items-center gap-3 border-b border-bg-700 px-4 py-3">
        <div className="mr-auto">
          <h2 className="text-sm font-medium text-text-100">Alertas sin leer</h2>
          <p className="font-mono text-[11px] text-text-600">
            lo que gerencia todavía no marcó como visto
          </p>
        </div>
        <span
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums text-danger transition-opacity",
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
