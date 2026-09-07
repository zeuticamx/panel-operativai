"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Trophy } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { MetricasPipelineOut, PipelineOut, VendedorOut } from "@/lib/types";
import {
  ESTADOS_CERRADOS,
  ESTADOS_PIPELINE,
  fmtInt,
  formatoMonto,
  formatoPorcentaje,
  infoEstadoPipeline,
  tiempoRelativo,
} from "@/lib/formato";
import { cn } from "@/lib/utils";
import { EmbudoEtapas } from "@/app/components/embudo-etapas";
import { EstadoLead } from "@/app/components/estado-lead";
import { LeadDrawer } from "@/app/components/lead-drawer";
import {
  ModuloApagado,
  VendedoresTabs,
  esGerencia,
  useServicios,
} from "@/app/components/modulo-vendedores";
import { StatCard } from "@/app/components/stat-card";
import {
  Aviso,
  Boton,
  Cargando,
  PageHeader,
  inputClass,
  selectClass,
} from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

/** Tope del backend por petición. Para gerencia es más útil ver todo que paginar. */
const LIMITE = 500;
const SIN_VENDEDOR = "__sin__";

export default function VendedoresPage() {
  const { usuario } = useUsuario();
  const servicios = useServicios();
  const gerencia = esGerencia(usuario);

  const activo = servicios.data?.gestion_vendedores_activo ?? false;
  const base = activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}` : null;

  const metricas = useApi<MetricasPipelineOut>(base ? `${base}/metricas` : null);
  const leads = useApi<PipelineOut[]>(base ? `${base}/pipeline?limite=${LIMITE}` : null);
  const vendedores = useApi<VendedorOut[]>(base ? `${base}/vendedores?activo=true` : null);

  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const [buscar, setBuscar] = useState("");
  const [seleccionado, setSeleccionado] = useState<PipelineOut | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Refresco suave cada 60 s, igual que el dashboard.
  const recargarMetricas = metricas.recargar;
  const recargarLeads = leads.recargar;
  useEffect(() => {
    if (!base) return;
    const id = setInterval(() => {
      setNow(Date.now());
      void recargarMetricas(true);
      void recargarLeads(true);
    }, 60_000);
    return () => clearInterval(id);
  }, [base, recargarMetricas, recargarLeads]);

  const refrescar = () => {
    setNow(Date.now());
    setAviso(null);
    metricas.recargar();
    leads.recargar();
    vendedores.recargar(true);
  };

  const m = metricas.data;
  const todos = useMemo(() => leads.data ?? [], [leads.data]);

  // KPIs derivados de la lista, no de otra petición: para gerencia la lista
  // completa ya está cargada y sale gratis.
  const abiertos = todos.filter((l) => !ESTADOS_CERRADOS.has(l.estado)).length;
  const sinVendedor = todos.filter(
    (l) => l.vendedor_id === null && !ESTADOS_CERRADOS.has(l.estado),
  ).length;
  const ganados = todos.filter((l) => l.estado === "ganado").length;

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return todos.filter((l) => {
      if (filtroEstado && l.estado !== filtroEstado) return false;
      if (filtroVendedor === SIN_VENDEDOR && l.vendedor_id !== null) return false;
      if (filtroVendedor && filtroVendedor !== SIN_VENDEDOR && l.vendedor_id !== filtroVendedor)
        return false;
      if (q) {
        const texto = `${l.cliente_nombre ?? ""} ${l.cliente_handle ?? ""} ${l.vendedor_nombre ?? ""}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [todos, filtroEstado, filtroVendedor, buscar]);

  const alReasignar = (mensaje: string) => {
    setSeleccionado(null);
    setAviso(mensaje);
    leads.recargar(true);
    metricas.recargar(true);
    vendedores.recargar(true);
  };

  const cargandoInicial = servicios.loading && !servicios.data;

  return (
    <>
      <PageHeader
        titulo="Vendedores"
        sub={<VendedoresTabs />}
        acciones={
          activo && (
            <Boton
              variante="fantasma"
              onClick={refrescar}
              loading={metricas.loading || leads.loading}
              title="Actualizar"
            >
              <RefreshCw size={13} aria-hidden />
              Actualizar
            </Boton>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          {servicios.error && <Aviso tipo="error">{servicios.error}</Aviso>}

          {cargandoInicial ? (
            <Cargando />
          ) : !activo ? (
            servicios.tenantId && (
              <ModuloApagado
                tenantId={servicios.tenantId}
                onActivado={() => servicios.recargar()}
              />
            )
          ) : (
            <>
              {metricas.error && <Aviso tipo="error">{metricas.error}</Aviso>}
              {leads.error && <Aviso tipo="error">{leads.error}</Aviso>}
              {aviso && <Aviso tipo="exito">{aviso}</Aviso>}

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard
                  label="Leads abiertos"
                  value={leads.data ? fmtInt.format(abiertos) : "—"}
                  tone={abiertos > 0 ? "success" : "neutral"}
                  hint={m ? `${fmtInt.format(m.total_clientes)} en total` : "en el embudo"}
                  loading={leads.loading && !leads.data}
                />
                <StatCard
                  label="Sin vendedor"
                  value={leads.data ? fmtInt.format(sinVendedor) : "—"}
                  tone={sinVendedor > 0 ? "warning" : "neutral"}
                  hint={sinVendedor > 0 ? "esperan asignación" : "todos atendidos"}
                  loading={leads.loading && !leads.data}
                />
                <StatCard
                  label="Ganados"
                  value={leads.data ? fmtInt.format(ganados) : "—"}
                  tone={ganados > 0 ? "success" : "neutral"}
                  hint="histórico"
                  loading={leads.loading && !leads.data}
                />
                <StatCard
                  label="Conversión"
                  value={m ? formatoPorcentaje(m.tasa_conversion_global) : "—"}
                  hint="ganados sobre cerrados"
                  loading={metricas.loading && !m}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                {/* Embudo por etapa */}
                <section className="flex flex-col rounded-md border border-bg-700 bg-bg-800 p-4 lg:col-span-2">
                  <header className="mb-3">
                    <h2 className="text-sm font-medium text-text-100">Embudo por etapa</h2>
                    <p className="font-mono text-[11px] text-text-600">
                      cuántos hay y ~cuánto tardan en salir
                    </p>
                  </header>
                  {m ? (
                    <EmbudoEtapas etapas={m.etapas} loading={metricas.loading} />
                  ) : (
                    <p className="py-6 text-center font-mono text-xs text-text-600">
                      {metricas.loading ? "cargando…" : "sin datos"}
                    </p>
                  )}
                </section>

                {/* Ranking */}
                <section className="flex flex-col overflow-hidden rounded-md border border-bg-700 bg-bg-900 lg:col-span-3">
                  <header className="flex items-center gap-2 border-b border-bg-700 px-4 py-3">
                    <Trophy size={14} className="text-text-400" aria-hidden />
                    <div>
                      <h2 className="text-sm font-medium text-text-100">Ranking del equipo</h2>
                      <p className="font-mono text-[11px] text-text-600">por ventas cerradas</p>
                    </div>
                  </header>
                  {!m ? (
                    <p className="p-6 text-center font-mono text-xs text-text-600">
                      {metricas.loading ? "cargando…" : "sin datos"}
                    </p>
                  ) : m.ranking.length === 0 ? (
                    <p className="p-6 text-center font-mono text-xs text-text-600">
                      todavía no hay vendedores
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                            <th className="px-4 py-2 text-left font-normal">Vendedor</th>
                            <th className="px-3 py-2 text-right font-normal">Abiertos</th>
                            <th className="px-3 py-2 text-right font-normal">Ganados</th>
                            <th className="px-3 py-2 text-right font-normal">Perdidos</th>
                            <th className="px-3 py-2 text-right font-normal">Cierre</th>
                            <th className="px-4 py-2 text-right font-normal">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.ranking.map((r, i) => (
                            <tr
                              key={r.vendedor_id}
                              className={cn(
                                "border-b border-bg-700 last:border-b-0",
                                !r.activo && "opacity-50",
                              )}
                            >
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-4 font-mono text-[11px] tabular-nums text-text-600">
                                    {i + 1}
                                  </span>
                                  <span className="text-text-100">{r.nombre}</span>
                                  {!r.activo && (
                                    <span className="font-mono text-[11px] text-text-600">
                                      inactivo
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-text-400">
                                {fmtInt.format(r.abiertos)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-success">
                                {fmtInt.format(r.ganados)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-text-400">
                                {fmtInt.format(r.perdidos)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-text-400">
                                {formatoPorcentaje(r.tasa_cierre)}
                              </td>
                              <td className="px-4 py-2 text-right font-mono tabular-nums text-text-100">
                                {formatoMonto(r.monto_ganado)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              {/* Leads */}
              <section className="flex flex-col overflow-hidden rounded-md border border-bg-700 bg-bg-900">
                <header className="flex flex-wrap items-center gap-2 border-b border-bg-700 px-4 py-3">
                  <div className="mr-auto">
                    <h2 className="text-sm font-medium text-text-100">Clientes en el embudo</h2>
                    <p className="font-mono text-[11px] text-text-600">
                      {leads.data
                        ? `${fmtInt.format(filtrados.length)} de ${fmtInt.format(todos.length)}`
                        : "cargando…"}
                      {todos.length >= LIMITE && " · se muestran los últimos " + LIMITE}
                    </p>
                  </div>

                  <label className="relative">
                    <Search
                      size={13}
                      className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-600"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={buscar}
                      onChange={(e) => setBuscar(e.target.value)}
                      placeholder="Buscar cliente o vendedor"
                      aria-label="Buscar"
                      className={cn(inputClass, "w-56 py-1.5 pl-8 text-xs")}
                    />
                  </label>

                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    aria-label="Filtrar por etapa"
                    className={cn(selectClass, "w-auto py-1.5 text-xs")}
                  >
                    <option value="">Todas las etapas</option>
                    {ESTADOS_PIPELINE.map((e) => (
                      <option key={e} value={e}>
                        {infoEstadoPipeline(e).label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filtroVendedor}
                    onChange={(e) => setFiltroVendedor(e.target.value)}
                    aria-label="Filtrar por vendedor"
                    className={cn(selectClass, "w-auto py-1.5 text-xs")}
                  >
                    <option value="">Todos los vendedores</option>
                    <option value={SIN_VENDEDOR}>Sin vendedor</option>
                    {(vendedores.data ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nombre}
                      </option>
                    ))}
                  </select>
                </header>

                {!leads.data ? (
                  <p className="p-6 text-center font-mono text-xs text-text-600">cargando…</p>
                ) : todos.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <p className="text-sm text-text-100">Todavía no hay clientes en el embudo</p>
                    <p className="max-w-sm text-xs leading-relaxed text-text-400">
                      Cada cliente que escriba por tus canales entra automáticamente como{" "}
                      <span className="text-text-100">nuevo</span> y se reparte entre tu equipo.
                    </p>
                  </div>
                ) : filtrados.length === 0 ? (
                  <p className="p-6 text-center font-mono text-xs text-text-600">
                    ningún cliente coincide con el filtro
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                          <th className="px-4 py-2 text-left font-normal">Cliente</th>
                          <th className="px-3 py-2 text-left font-normal">Etapa</th>
                          <th className="px-3 py-2 text-left font-normal">Vendedor</th>
                          <th className="px-3 py-2 text-right font-normal">Monto</th>
                          <th className="px-4 py-2 text-right font-normal">Actividad</th>
                        </tr>
                      </thead>
                      <tbody className={cn("transition-opacity", leads.loading && "opacity-60")}>
                        {filtrados.map((l) => (
                          <tr
                            key={l.id}
                            onClick={() => setSeleccionado(l)}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSeleccionado(l);
                              }
                            }}
                            className="cursor-pointer border-b border-bg-700 last:border-b-0 hover:bg-bg-800 focus:bg-bg-800 focus:outline-none"
                          >
                            <td className="px-4 py-2">
                              <div className="flex flex-col">
                                <span className="text-text-100">
                                  {l.cliente_nombre ?? l.cliente_handle ?? "Sin nombre"}
                                </span>
                                {l.cliente_nombre && l.cliente_handle && (
                                  <span className="font-mono text-[11px] text-text-600">
                                    {l.cliente_handle}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <EstadoLead estado={l.estado} />
                            </td>
                            <td className="px-3 py-2">
                              {l.vendedor_nombre ? (
                                <span className="text-text-400">{l.vendedor_nombre}</span>
                              ) : ESTADOS_CERRADOS.has(l.estado) ? (
                                <span className="text-text-600">—</span>
                              ) : (
                                <span className="text-warning">sin asignar</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-text-400">
                              {formatoMonto(l.monto_estimado)}
                            </td>
                            <td
                              className="px-4 py-2 text-right font-mono text-[11px] text-text-600"
                              title={l.actualizado_en}
                            >
                              {tiempoRelativo(l.actualizado_en, now)}
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
        </div>
      </div>

      {seleccionado && (
        <LeadDrawer
          key={seleccionado.id}
          lead={seleccionado}
          vendedores={vendedores.data ?? []}
          puedeAsignar={gerencia}
          onClose={() => setSeleccionado(null)}
          onCambio={alReasignar}
        />
      )}
    </>
  );
}
