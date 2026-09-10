"use client";

import { useMemo, useState } from "react";
import { MapPin, RefreshCw, Route } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { ReporteActividadOut, VisitaOut } from "@/lib/types";
import {
  fmtInt,
  formatoDistancia,
  formatoFechaHora,
  formatoPorcentaje,
  tiempoRelativo,
  urlMapa,
} from "@/lib/formato";
import { cn } from "@/lib/utils";
import { GeocercaBadge } from "@/app/components/geocerca";
import { VendedoresTabs, esGerencia } from "@/app/components/modulo-vendedores";
import { StatCard } from "@/app/components/stat-card";
import { Aviso, Boton, PageHeader, selectClass } from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

const RANGOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
] as const;

const VISITAS_RECIENTES = 30;

function desdeISO(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

export default function ActividadPage() {
  const { usuario } = useUsuario();
  const gerencia = esGerencia(usuario);

  const [dias, setDias] = useState<number>(30);
  const [soloFuera, setSoloFuera] = useState(false);

  const desde = useMemo(() => desdeISO(dias), [dias]);

  // El reporte por vendedor es solo de gerencia (403 para 'member'), así
  // que ni se pide si el rol no lo permite.
  const reporte = useApi<ReporteActividadOut>(
    gerencia ? `/api/reportes/actividad?desde=${encodeURIComponent(desde)}` : null,
  );
  const visitas = useApi<VisitaOut[]>(
    `/api/visitas?limite=${VISITAS_RECIENTES}&desde=${encodeURIComponent(desde)}` +
      (soloFuera ? "&solo_fuera_geocerca=true" : ""),
  );

  const r = reporte.data;

  // Escala del gráfico: el vendedor con más visitas marca el 100%. Así se
  // comparan entre sí, que es lo que interesa, y no contra un tope fijo.
  const maxVisitas = Math.max(1, ...(r?.vendedores.map((v) => v.visitas) ?? [0]));

  return (
    <>
      <PageHeader
        titulo="Vendedores"
        sub={<VendedoresTabs />}
        acciones={
          <>
            <label className="sr-only" htmlFor="rango-actividad">
              Rango de fechas
            </label>
            <select
              id="rango-actividad"
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className={cn(selectClass, "w-auto py-1.5 text-xs")}
            >
              {RANGOS.map((x) => (
                <option key={x.dias} value={x.dias}>
                  Últimos {x.label}
                </option>
              ))}
            </select>
            <Boton
              variante="fantasma"
              onClick={() => {
                reporte.recargar();
                visitas.recargar();
              }}
              loading={reporte.loading || visitas.loading}
              title="Actualizar"
            >
              <RefreshCw size={13} aria-hidden />
              Actualizar
            </Boton>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
              {!gerencia && (
                <Aviso tipo="info">
                  El reporte por vendedor es solo para el dueño del negocio. Abajo puedes ver
                  las visitas recientes.
                </Aviso>
              )}
              {reporte.error && gerencia && <Aviso tipo="error">{reporte.error}</Aviso>}
              {visitas.error && <Aviso tipo="error">{visitas.error}</Aviso>}

              {gerencia && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard
                      label="Visitas"
                      value={r ? fmtInt.format(r.total_visitas) : "—"}
                      hint={`últimos ${dias} días`}
                      loading={reporte.loading && !r}
                    />
                    <StatCard
                      label="Validadas"
                      value={
                        r
                          ? fmtInt.format(
                              r.vendedores.reduce((a, v) => a + v.visitas_validadas, 0),
                            )
                          : "—"
                      }
                      tone="success"
                      hint="dentro de la geocerca"
                      loading={reporte.loading && !r}
                    />
                    <StatCard
                      label="Fuera de geocerca"
                      value={
                        r
                          ? fmtInt.format(
                              r.vendedores.reduce((a, v) => a + v.visitas_fuera_geocerca, 0),
                            )
                          : "—"
                      }
                      tone={
                        r && r.vendedores.some((v) => v.visitas_fuera_geocerca > 0)
                          ? "warning"
                          : "neutral"
                      }
                      hint="revisar"
                      loading={reporte.loading && !r}
                    />
                    <StatCard
                      label="Tareas completadas"
                      value={r ? fmtInt.format(r.total_tareas_completadas) : "—"}
                      hint={`últimos ${dias} días`}
                      loading={reporte.loading && !r}
                    />
                  </div>

                  <section className="flex flex-col overflow-hidden rounded-md border border-bg-700 bg-bg-900">
                    <header className="flex items-center gap-2 border-b border-bg-700 px-4 py-3">
                      <Route size={14} className="text-text-400" aria-hidden />
                      <div>
                        <h2 className="text-sm font-medium text-text-100">
                          Actividad por vendedor
                        </h2>
                        <p className="font-mono text-[11px] text-text-600">
                          visitas y tareas en el rango
                        </p>
                      </div>
                    </header>

                    {!r ? (
                      <p className="p-6 text-center font-mono text-xs text-text-600">
                        {reporte.loading ? "cargando…" : "sin datos"}
                      </p>
                    ) : r.vendedores.length === 0 ? (
                      <p className="p-6 text-center font-mono text-xs text-text-600">
                        todavía no hay vendedores en el equipo
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                              <th className="px-4 py-2 text-left font-normal">Vendedor</th>
                              <th className="px-3 py-2 text-left font-normal">Visitas</th>
                              <th className="px-3 py-2 text-right font-normal">Validadas</th>
                              <th className="px-3 py-2 text-right font-normal">Fuera</th>
                              <th className="px-3 py-2 text-right font-normal">Clientes</th>
                              <th className="px-3 py-2 text-right font-normal">Tareas</th>
                              <th className="px-4 py-2 text-right font-normal">Precisión</th>
                            </tr>
                          </thead>
                          <tbody
                            className={cn(
                              "transition-opacity",
                              reporte.loading && "opacity-60",
                            )}
                          >
                            {r.vendedores.map((v) => (
                              <tr
                                key={v.vendedor_id}
                                className={cn(
                                  "border-b border-bg-700 last:border-b-0",
                                  !v.activo && "opacity-50",
                                )}
                              >
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-text-100">{v.nombre}</span>
                                    {!v.activo && (
                                      <span className="font-mono text-[11px] text-text-600">
                                        inactivo
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  {/* Barra comparativa: el más activo marca el 100%. */}
                                  <div className="flex items-center gap-2">
                                    <span className="w-8 shrink-0 text-right font-mono tabular-nums text-text-100">
                                      {fmtInt.format(v.visitas)}
                                    </span>
                                    <div
                                      className="h-1.5 w-24 overflow-hidden rounded-sm bg-bg-700"
                                      role="img"
                                      aria-label={`${v.visitas} visitas`}
                                    >
                                      <div
                                        className="h-full rounded-sm bg-series-1"
                                        style={{
                                          width: `${(v.visitas / maxVisitas) * 100}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums text-success">
                                  {fmtInt.format(v.visitas_validadas)}
                                </td>
                                <td
                                  className={cn(
                                    "px-3 py-2 text-right font-mono tabular-nums",
                                    v.visitas_fuera_geocerca > 0
                                      ? "text-danger"
                                      : "text-text-600",
                                  )}
                                >
                                  {fmtInt.format(v.visitas_fuera_geocerca)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums text-text-400">
                                  {fmtInt.format(v.clientes_visitados)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums text-text-400">
                                  {fmtInt.format(v.tareas_completadas)}
                                  <span className="text-text-600">
                                    /{fmtInt.format(v.tareas_completadas + v.tareas_pendientes)}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-mono tabular-nums text-text-100">
                                  {formatoPorcentaje(v.porcentaje_validadas)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* Visitas recientes */}
              <section className="flex flex-col overflow-hidden rounded-md border border-bg-700 bg-bg-900">
                <header className="flex flex-wrap items-center gap-2 border-b border-bg-700 px-4 py-3">
                  <div className="mr-auto">
                    <h2 className="text-sm font-medium text-text-100">Visitas recientes</h2>
                    <p className="font-mono text-[11px] text-text-600">
                      {visitas.data
                        ? `${fmtInt.format(visitas.data.length)} en los últimos ${dias} días`
                        : "cargando…"}
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-text-400">
                    <input
                      type="checkbox"
                      checked={soloFuera}
                      onChange={(e) => setSoloFuera(e.target.checked)}
                      className="h-3.5 w-3.5 cursor-pointer accent-[var(--danger)]"
                    />
                    Solo fuera de la geocerca
                  </label>
                </header>

                {!visitas.data ? (
                  <p className="p-6 text-center font-mono text-xs text-text-600">cargando…</p>
                ) : visitas.data.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <MapPin size={18} className="text-text-600" aria-hidden />
                    <p className="text-sm text-text-100">
                      {soloFuera
                        ? "Ninguna visita quedó fuera de la geocerca"
                        : "Todavía no hay visitas registradas"}
                    </p>
                    <p className="max-w-sm text-xs leading-relaxed text-text-400">
                      {soloFuera
                        ? "Todos los check-ins del rango cayeron dentro del radio de su cliente."
                        : "Los check-ins aparecen aquí en cuanto el vendedor los hace desde su app, o cuando sube la cola que guardó sin señal."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                          <th className="px-4 py-2 text-left font-normal">Cliente</th>
                          <th className="px-3 py-2 text-left font-normal">Vendedor</th>
                          <th className="px-3 py-2 text-left font-normal">Resultado</th>
                          <th className="px-3 py-2 text-right font-normal">Distancia</th>
                          <th className="px-3 py-2 text-right font-normal">GPS</th>
                          <th className="px-4 py-2 text-right font-normal">Cuándo</th>
                        </tr>
                      </thead>
                      <tbody className={cn("transition-opacity", visitas.loading && "opacity-60")}>
                        {visitas.data.map((v) => (
                          <tr key={v.id} className="border-b border-bg-700 last:border-b-0">
                            <td className="px-4 py-2">
                              <div className="flex flex-col">
                                <span className="text-text-100">
                                  {v.cliente_nombre_negocio}
                                </span>
                                {v.comentario && (
                                  <span className="max-w-xs truncate text-[11px] text-text-600">
                                    {v.comentario}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-text-400">{v.vendedor_nombre}</td>
                            <td className="px-3 py-2">
                              <GeocercaBadge dentro={v.dentro_de_geocerca} />
                            </td>
                            <td
                              className={cn(
                                "px-3 py-2 text-right font-mono tabular-nums",
                                v.dentro_de_geocerca ? "text-text-400" : "text-danger",
                              )}
                            >
                              <a
                                href={urlMapa(v.latitud, v.longitud)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver dónde se hizo el check-in"
                                className="underline-offset-2 hover:underline"
                              >
                                {formatoDistancia(v.distancia_calculada_metros)}
                              </a>
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-text-600">
                              {v.accuracy_metros !== null
                                ? `±${Math.round(v.accuracy_metros)} m`
                                : "—"}
                            </td>
                            <td
                              className="px-4 py-2 text-right font-mono text-[11px] text-text-600"
                              title={formatoFechaHora(v.timestamp_servidor)}
                            >
                              {tiempoRelativo(v.timestamp_servidor)}
                              {v.cliente_uuid_offline && (
                                <span
                                  className="ml-1 text-text-400"
                                  title="Llegó por la cola offline"
                                >
                                  ↑
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
        </div>
      </div>
    </>
  );
}
