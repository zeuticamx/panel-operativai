"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/use-api";
import type { EntradaAuditoriaOut } from "@/lib/types";
import { formatoFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/app/components/badge";
import { GerenciaTabs } from "@/app/components/gerencia";
import { Aviso, Cargando, PageHeader, selectClass } from "@/app/components/ui";

const ACCIONES: Record<string, { label: string; tone: BadgeTone }> = {
  estado_tenant: { label: "estado", tone: "danger" },
  servicios_tenant: { label: "servicios", tone: "warning" },
  ajuste_creditos: { label: "créditos", tone: "info" },
  impersonacion: { label: "ver como", tone: "warning" },
  alerta_revisada: { label: "alerta revisada", tone: "neutral" },
  gerencia_alta: { label: "alta gerencia", tone: "info" },
  gerencia_baja: { label: "baja gerencia", tone: "danger" },
};

export default function AuditoriaPage() {
  const [accion, setAccion] = useState("");

  const params = new URLSearchParams({ limite: "100" });
  if (accion) params.set("accion", accion);

  const bitacora = useApi<EntradaAuditoriaOut[]>(`/api/gerencia/auditoria?${params}`);
  const entradas = bitacora.data ?? [];

  return (
    <>
      <PageHeader
        titulo="Bitácora"
        sub="acciones del equipo de plataforma"
        acciones={
          <>
            <GerenciaTabs />
            <select
              value={accion}
              onChange={(e) => setAccion(e.target.value)}
              aria-label="Filtrar por acción"
              className={cn(selectClass, "w-auto py-1 text-xs")}
            >
              <option value="">todas las acciones</option>
              {Object.entries(ACCIONES).map(([valor, info]) => (
                <option key={valor} value={valor}>
                  {info.label}
                </option>
              ))}
            </select>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {bitacora.error && <Aviso tipo="error">{bitacora.error}</Aviso>}
        {!bitacora.data && bitacora.loading && <Cargando />}

        {bitacora.data && (
          <div className="flex max-w-4xl flex-col gap-3">
            <p className="font-mono text-[11px] text-text-600">
              solo lectura · no hay forma de editar ni borrar una entrada
            </p>

            <ul className="flex flex-col gap-2">
              {entradas.map((e) => {
                const info = ACCIONES[e.accion];
                return (
                  <li
                    key={e.id}
                    className="flex flex-col gap-1.5 rounded-md border border-bg-700 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={info?.tone ?? "neutral"}>{info?.label ?? e.accion}</Badge>

                      {e.tenant_id ? (
                        <Link
                          href={`/gerencia/tenants/${e.tenant_id}`}
                          className="truncate text-sm text-text-100 hover:underline"
                        >
                          {/* El nombre se resuelve al vuelo: si el negocio ya
                              no existe, la entrada igual queda con su UUID. */}
                          {e.tenant_nombre ?? e.tenant_id}
                        </Link>
                      ) : (
                        <span className="text-sm text-text-400">plataforma</span>
                      )}

                      <span className="ml-auto font-mono text-[11px] text-text-600">
                        {e.actor_email} · {formatoFechaHora(e.creado_en)}
                      </span>
                    </div>

                    <Cambio detalle={e.detalle} />
                  </li>
                );
              })}

              {entradas.length === 0 && (
                <li className="rounded-md border border-dashed border-bg-700 px-3 py-10 text-center font-mono text-[11px] text-text-600">
                  {accion
                    ? "ninguna acción de ese tipo todavía"
                    : "nadie de plataforma cambió nada todavía"}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * El detalle es JSONB libre: cada acción guarda lo que le sirve. Se pinta
 * clave por clave en vez de inventar una vista por tipo — una bitácora que
 * solo sabe mostrar las tres acciones de hoy deja de servir con la cuarta.
 */
function Cambio({ detalle }: { detalle: Record<string, unknown> }) {
  const entradas = Object.entries(detalle).filter(([, v]) => v !== null && v !== undefined);
  if (entradas.length === 0) return null;

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-text-600">
      {entradas.map(([clave, valor]) => (
        <div key={clave} className="flex gap-1">
          <dt>{clave}:</dt>
          <dd className="text-text-400">
            {typeof valor === "object" ? JSON.stringify(valor) : String(valor)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
