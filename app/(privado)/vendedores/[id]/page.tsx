"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Edit, Inbox, Phone, RefreshCw, Trophy } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type {
  HistorialVendedorOut,
  MetricasPipelineOut,
  PipelineOut,
  VendedorOut,
} from "@/lib/types";
import {
  ESTADOS_CERRADOS,
  fmtInt,
  formatoFechaHora,
  formatoMonto,
  formatoPorcentaje,
  iniciales,
  tiempoRelativo,
} from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "@/app/components/badge";
import { EditarVendedor } from "@/app/components/editar-vendedor";
import { EstadoLead } from "@/app/components/estado-lead";
import { HistorialTimeline } from "@/app/components/historial-timeline";
import { LeadDrawer } from "@/app/components/lead-drawer";
import { ModuloApagado, esGerencia, useServicios } from "@/app/components/modulo-vendedores";
import { StatCard } from "@/app/components/stat-card";
import { Aviso, Boton, Cargando, PageHeader } from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

const TABS = [
  { id: "cartera", label: "Cartera" },
  { id: "historial", label: "Historial" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const MAX_CIERRES = 5;

export default function PerfilVendedorPage() {
  const params = useParams<{ id: string }>();
  const vendedorId = params.id;

  const { usuario } = useUsuario();
  const servicios = useServicios();
  const gerencia = esGerencia(usuario);

  const activo = servicios.data?.gestion_vendedores_activo ?? false;
  const base = activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}` : null;

  const vendedores = useApi<VendedorOut[]>(base ? `${base}/vendedores` : null);
  const metricas = useApi<MetricasPipelineOut>(base ? `${base}/metricas` : null);
  const pipeline = useApi<PipelineOut[]>(
    activo ? `/api/vendedores/${vendedorId}/pipeline?incluir_cerrados=true` : null,
  );
  const historialVendedor = useApi<HistorialVendedorOut[]>(
    activo ? `/api/vendedores/${vendedorId}/historial?limite=100` : null,
  );

  const [tab, setTab] = useState<TabId>("cartera");
  const [seleccionado, setSeleccionado] = useState<PipelineOut | null>(null);
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const vendedor = useMemo(
    () => (vendedores.data ?? []).find((v) => v.id === vendedorId) ?? null,
    [vendedores.data, vendedorId],
  );
  const activos = useMemo(
    () => (vendedores.data ?? []).filter((v) => v.activo),
    [vendedores.data],
  );
  const ranking = useMemo(
    () => metricas.data?.ranking.find((r) => r.vendedor_id === vendedorId) ?? null,
    [metricas.data, vendedorId],
  );

  const todos = useMemo(() => pipeline.data ?? [], [pipeline.data]);
  const cartera = useMemo(
    () => todos.filter((p) => !ESTADOS_CERRADOS.has(p.estado)),
    [todos],
  );
  const cierres = useMemo(
    () => todos.filter((p) => ESTADOS_CERRADOS.has(p.estado)).slice(0, MAX_CIERRES),
    [todos],
  );

  const refrescar = () => {
    setAviso(null);
    vendedores.recargar();
    metricas.recargar();
    pipeline.recargar();
    historialVendedor.recargar();
  };

  const alCambio = (mensaje: string) => {
    setSeleccionado(null);
    setAviso(mensaje);
    pipeline.recargar(true);
    metricas.recargar(true);
    historialVendedor.recargar(true);
  };

  const cargandoInicial = servicios.loading && !servicios.data;
  const cierres_ganados = ranking ? ranking.ganados + ranking.perdidos : null;

  return (
    <>
      <PageHeader
        titulo="Vendedores"
        sub={
          <Link
            href="/vendedores/equipo"
            className="inline-flex items-center gap-1 text-text-600 hover:text-text-100"
          >
            <ArrowLeft size={12} aria-hidden />
            Equipo
          </Link>
        }
        acciones={
          activo &&
          vendedor && (
            <Boton
              variante="fantasma"
              onClick={refrescar}
              loading={vendedores.loading || metricas.loading || pipeline.loading}
              title="Actualizar"
            >
              <RefreshCw size={13} aria-hidden />
              Actualizar
            </Boton>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {servicios.error && <Aviso tipo="error">{servicios.error}</Aviso>}

          {cargandoInicial ? (
            <Cargando />
          ) : !activo ? (
            servicios.tenantId && (
              <ModuloApagado tenantId={servicios.tenantId} onActivado={() => servicios.recargar()} />
            )
          ) : vendedores.error ? (
            <Aviso tipo="error">{vendedores.error}</Aviso>
          ) : !vendedores.data ? (
            <Cargando />
          ) : !vendedor ? (
            <section className="flex flex-col items-center gap-3 rounded-md border border-dashed border-bg-700 px-6 py-10 text-center">
              <p className="text-sm text-text-100">Vendedor no encontrado</p>
              <p className="max-w-sm text-xs leading-relaxed text-text-400">
                Puede que lo hayan quitado del equipo, o que el enlace sea de otro negocio.
              </p>
              <Link href="/vendedores/equipo">
                <Boton variante="secundario">
                  <ArrowLeft size={13} aria-hidden />
                  Volver al equipo
                </Boton>
              </Link>
            </section>
          ) : (
            <>
              {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
              {metricas.error && <Aviso tipo="error">{metricas.error}</Aviso>}
              {pipeline.error && <Aviso tipo="error">{pipeline.error}</Aviso>}

              {/* Header de perfil */}
              <header className="flex flex-wrap items-start gap-3 border-b border-bg-700 pb-4 sm:items-center">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border text-base font-semibold",
                    vendedor.activo
                      ? "border-success/40 bg-success-bg text-success"
                      : "border-bg-700 bg-bg-800 text-text-400",
                  )}
                >
                  {iniciales(vendedor.nombre, null)}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-semibold text-text-100">
                      {vendedor.nombre}
                    </h1>
                    {vendedor.activo ? (
                      <Badge tone="success">activo</Badge>
                    ) : (
                      <Badge tone="warning">inactivo</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-text-600">
                    {vendedor.telefono && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} aria-hidden />
                        {vendedor.telefono}
                      </span>
                    )}
                    <span>desde {formatoFechaHora(vendedor.creado_en)}</span>
                    <span>{fmtInt.format(vendedor.clientes_activos)} leads abiertos</span>
                  </div>
                </div>

                {gerencia && (
                  <Boton variante="secundario" onClick={() => setEditando(true)}>
                    <Edit size={13} aria-hidden />
                    Editar
                  </Boton>
                )}
              </header>

              {/* Stats 2x2 */}
              <section className="grid grid-cols-2 gap-3" aria-label="Métricas del vendedor">
                <StatCard
                  label="Leads activos"
                  value={ranking ? fmtInt.format(ranking.abiertos) : "—"}
                  tone={ranking && ranking.abiertos > 0 ? "success" : "neutral"}
                  hint="en el embudo"
                  loading={metricas.loading && !ranking}
                />
                <StatCard
                  label="Leads cerrados"
                  value={cierres_ganados !== null ? fmtInt.format(cierres_ganados) : "—"}
                  hint={
                    ranking
                      ? `${fmtInt.format(ranking.ganados)} ganados · ${fmtInt.format(ranking.perdidos)} perdidos`
                      : "ganados + perdidos"
                  }
                  loading={metricas.loading && !ranking}
                />
                <StatCard
                  label="Tasa de cierre"
                  value={ranking ? formatoPorcentaje(ranking.tasa_cierre) : "—"}
                  tone="success"
                  hint="sobre cerrados"
                  loading={metricas.loading && !ranking}
                />
                <StatCard
                  label="Monto ganado"
                  value={
                    <span className="font-mono">
                      {ranking ? formatoMonto(ranking.monto_ganado) : "—"}
                    </span>
                  }
                  tone="success"
                  hint="acumulado"
                  loading={metricas.loading && !ranking}
                />
              </section>

              {/* Tabs */}
              <div>
                <nav className="flex gap-1 border-b border-bg-700" aria-label="Secciones del vendedor">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.id}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "-mb-px rounded-t px-3 py-2 font-mono text-xs",
                        tab === t.id
                          ? "border-b-2 border-series-1 text-text-100"
                          : "text-text-600 hover:text-text-400",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>

                {tab === "cartera" ? (
                  <section className="mt-3 overflow-hidden rounded-md border border-bg-700 bg-bg-900">
                    <header className="flex items-center justify-between border-b border-bg-700 px-4 py-3">
                      <div>
                        <h2 className="text-sm font-medium text-text-100">Cartera activa</h2>
                        <p className="font-mono text-[11px] text-text-600">
                          {pipeline.data
                            ? `${fmtInt.format(cartera.length)} en el embudo`
                            : "cargando…"}
                        </p>
                      </div>
                    </header>

                    {!pipeline.data ? (
                      <p className="p-6 text-center font-mono text-xs text-text-600">cargando…</p>
                    ) : cartera.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                        <Inbox size={18} className="text-text-600" aria-hidden />
                        <p className="text-sm text-text-100">Sin cartera activa</p>
                        <p className="max-w-sm text-xs leading-relaxed text-text-400">
                          {vendedor.nombre} no tiene clientes abiertos en el embudo ahora mismo.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                              <th className="px-4 py-2 text-left font-normal">Cliente</th>
                              <th className="px-3 py-2 text-left font-normal">Etapa</th>
                              <th className="px-3 py-2 text-right font-normal">Monto</th>
                              <th className="px-4 py-2 text-right font-normal">Última actividad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cartera.map((p) => (
                              <tr
                                key={p.id}
                                onClick={() => setSeleccionado(p)}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSeleccionado(p);
                                  }
                                }}
                                className="cursor-pointer border-b border-bg-700 last:border-b-0 hover:bg-bg-800 focus:bg-bg-800 focus:outline-none"
                              >
                                <td className="px-4 py-2">
                                  <div className="flex flex-col">
                                    <span className="text-text-100">
                                      {p.cliente_nombre ?? p.cliente_handle ?? "Sin nombre"}
                                    </span>
                                    {p.cliente_nombre && p.cliente_handle && (
                                      <span className="font-mono text-[11px] text-text-600">
                                        {p.cliente_handle}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <EstadoLead estado={p.estado} />
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums text-text-400">
                                  {formatoMonto(p.monto_estimado)}
                                </td>
                                <td
                                  className="px-4 py-2 text-right font-mono text-[11px] text-text-600"
                                  title={formatoFechaHora(p.actualizado_en)}
                                >
                                  {tiempoRelativo(p.actualizado_en)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                ) : (
                  <section className="mt-3 overflow-hidden rounded-md border border-bg-700 bg-bg-900">
                    <header className="flex items-center gap-2 border-b border-bg-700 px-4 py-3">
                      <Trophy size={14} className="text-text-400" aria-hidden />
                      <div>
                        <h2 className="text-sm font-medium text-text-100">Últimos cierres</h2>
                        <p className="font-mono text-[11px] text-text-600">
                          máx. {MAX_CIERRES} recientes
                        </p>
                      </div>
                    </header>

                    {!pipeline.data ? (
                      <p className="p-6 text-center font-mono text-xs text-text-600">cargando…</p>
                    ) : cierres.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                        <Inbox size={18} className="text-text-600" aria-hidden />
                        <p className="text-sm text-text-100">Sin cierres todavía</p>
                        <p className="max-w-sm text-xs leading-relaxed text-text-400">
                          Cuando {vendedor.nombre} gane o pierda un cliente, aparece aquí.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                              <th className="px-4 py-2 text-left font-normal">Cliente</th>
                              <th className="px-3 py-2 text-left font-normal">Resultado</th>
                              <th className="px-3 py-2 text-right font-normal">Monto</th>
                              <th className="px-4 py-2 text-right font-normal">Fecha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cierres.map((p) => (
                              <tr
                                key={p.id}
                                onClick={() => setSeleccionado(p)}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSeleccionado(p);
                                  }
                                }}
                                className="cursor-pointer border-b border-bg-700 last:border-b-0 hover:bg-bg-800 focus:bg-bg-800 focus:outline-none"
                              >
                                <td className="px-4 py-2">
                                  <div className="flex flex-col">
                                    <span className="text-text-100">
                                      {p.cliente_nombre ?? p.cliente_handle ?? "Sin nombre"}
                                    </span>
                                    {p.estado === "perdido" && p.motivo_perdida && (
                                      <span className="font-mono text-[11px] text-text-600">
                                        {p.motivo_perdida}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <EstadoLead estado={p.estado} />
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums text-text-400">
                                  {formatoMonto(p.monto_estimado)}
                                </td>
                                <td
                                  className="px-4 py-2 text-right font-mono text-[11px] text-text-600"
                                  title={formatoFechaHora(p.actualizado_en)}
                                >
                                  {tiempoRelativo(p.actualizado_en)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                {tab === "historial" && (
                  <section className="mt-3 rounded-md border border-bg-700 bg-bg-900 p-4">
                    <HistorialTimeline
                      titulo="Bitácora completa"
                      historial={historialVendedor.data ?? []}
                      cargando={historialVendedor.loading}
                      error={historialVendedor.error}
                      vacio={`${vendedor.nombre} todavía no tiene movimientos registrados.`}
                      vistaInicial="tabla"
                      mostrarCliente
                    />
                  </section>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {seleccionado && (
        <LeadDrawer
          key={seleccionado.id}
          lead={seleccionado}
          vendedores={activos}
          puedeAsignar={gerencia}
          onClose={() => setSeleccionado(null)}
          onCambio={alCambio}
        />
      )}

      {vendedor && editando && (
        <EditarVendedor
          vendedor={vendedor}
          open={editando}
          onOpenChange={setEditando}
          onGuardado={(v) => {
            setEditando(false);
            setAviso(`${v.nombre} se actualizó.`);
            vendedores.recargar(true);
          }}
        />
      )}
    </>
  );
}
