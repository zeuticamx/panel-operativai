"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, EyeOff } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { etiquetaCanal, formatoFechaHora, type CanalTipo } from "@/lib/formato";
import type { ConversacionOculta } from "@/lib/types";
import { Badge } from "@/app/components/badge";
import { CanalIcon } from "@/app/components/status";
import { Aviso, Boton, PageHeader, claseBoton } from "@/app/components/ui";

const LIMITE = 25;
/** Meses que se conservan las conversaciones de un número desvinculado (RF-14, D16). */
const MESES_RETENCION = 12;

/** Fecha en que se eliminan: 12 meses después de desvincular el número. */
function fechaDeEliminacion(desvinculadoEn: string | null): string | null {
  if (!desvinculadoEn) return null;
  const d = new Date(desvinculadoEn);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + MESES_RETENCION);
  return formatoFechaHora(d.toISOString());
}

/**
 * Conversaciones de números desvinculados (spec 005a, RF-14): quedan ocultas
 * de la lista normal, asignadas al owner que creó el negocio, y aquí se ven en
 * solo lectura. Nadie puede responderlas (409 `numero_desvinculado`) y se
 * eliminan a los 12 meses. Solo owner y superadmin (RF-18, `lib/roles.ts`).
 */
export default function ConversacionesOcultasPage() {
  const [pagina, setPagina] = useState(0);
  const { data, loading, error } = useApi<ConversacionOculta[]>(
    `/api/conversaciones/ocultas?limite=${LIMITE}&offset=${pagina * LIMITE}`,
  );
  const haySiguiente = (data?.length ?? 0) === LIMITE;

  return (
    <>
      <PageHeader
        titulo="Conversaciones ocultas"
        sub="de números desvinculados"
        acciones={
          <Link href="/conversaciones" className={claseBoton("fantasma")}>
            <ChevronLeft size={13} aria-hidden />
            Conversaciones
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
          <Aviso tipo="info">
            Estas conversaciones son de números que desvinculaste. Son de solo lectura: nadie del negocio puede
            responderlas. Se conservan {MESES_RETENCION} meses desde la desvinculación y después se eliminan; si
            vuelves a vincular el número, no reaparecen.
          </Aviso>

          {error && <Aviso tipo="error">{error}</Aviso>}
          {!error && !data && loading && (
            <p className="p-6 text-center font-mono text-xs text-text-600">cargando…</p>
          )}

          {!error && data && data.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <EyeOff size={20} className="text-text-600" aria-hidden />
              <p className="text-sm text-text-100">No hay conversaciones ocultas</p>
              <p className="max-w-xs text-xs text-text-400">
                Cuando desvincules un número, sus conversaciones aparecerán aquí.
              </p>
            </div>
          )}

          {data && data.length > 0 && (
            <ul
              className={`overflow-hidden rounded-md border border-bg-700 bg-bg-900 ${loading ? "opacity-60" : ""}`}
            >
              {data.map((c, i) => {
                const elimina = fechaDeEliminacion(c.desvinculado_en);
                const canal = c.channel_type as CanalTipo;
                return (
                  <li
                    key={c.id}
                    className={`flex flex-wrap items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-bg-700" : ""}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-bg-700 bg-bg-800 text-text-400">
                      <CanalIcon tipo={canal} size={16} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-text-100">
                          {c.usuario_nombre || "Cliente sin nombre"}
                        </span>
                        <Badge>{etiquetaCanal(canal)}</Badge>
                        <Badge tone="warning">solo lectura</Badge>
                      </div>
                      <span className="font-mono text-[11px] break-all text-text-600">
                        número {c.telefono_visible || c.phone_number_id || "desconocido"}
                        {c.last_message_at && <> · último mensaje {formatoFechaHora(c.last_message_at)}</>}
                      </span>
                      <span className="font-mono text-[11px] text-text-600">
                        {c.desvinculado_en && <>desvinculado {formatoFechaHora(c.desvinculado_en)}</>}
                        {elimina && <> · se elimina {elimina}</>}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {(pagina > 0 || haySiguiente) && (
            <div className="flex items-center justify-between">
              <Boton
                variante="secundario"
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={pagina === 0 || loading}
                className="min-h-8"
              >
                <ChevronLeft size={13} aria-hidden />
                Anterior
              </Boton>
              <span className="font-mono text-[11px] text-text-600">página {pagina + 1}</span>
              <Boton
                variante="secundario"
                onClick={() => setPagina((p) => p + 1)}
                disabled={!haySiguiente || loading}
                className="min-h-8"
              >
                Siguiente
                <ChevronRight size={13} aria-hidden />
              </Boton>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
