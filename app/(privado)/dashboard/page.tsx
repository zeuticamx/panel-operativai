"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { ConversacionOut, MetricasOut } from "@/lib/types";
import { CANALES, etiquetaCanal, fmtInt } from "@/lib/formato";
import { StatCard } from "@/app/components/stat-card";
import { ConversationRow } from "@/app/components/conversation-row";
import { CanalIcon } from "@/app/components/status";
import { Aviso, Boton, PageHeader } from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

const RECIENTES = 10;

export default function DashboardPage() {
  const { usuario } = useUsuario();
  const metricas = useApi<MetricasOut>("/api/conversaciones/metricas");
  const recientes = useApi<ConversacionOut[]>(`/api/conversaciones?limite=${RECIENTES}`);
  const [now, setNow] = useState(() => Date.now());

  // Refresco suave cada 60 s: métricas + lista, sin poner la página en "cargando".
  const recargarMetricas = metricas.recargar;
  const recargarRecientes = recientes.recargar;
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      void recargarMetricas(true);
      void recargarRecientes(true);
    }, 60_000);
    return () => clearInterval(id);
  }, [recargarMetricas, recargarRecientes]);

  const m = metricas.data;
  const cargando = metricas.loading && !m;

  const porCanal = m?.por_canal ?? {};
  const totalCanal = Object.values(porCanal).reduce((a, b) => a + b, 0);
  // Orden fijo (wa, ig, fb) y después cualquier canal desconocido que venga.
  const canalesOrdenados = [
    ...CANALES.filter((c) => c in porCanal),
    ...Object.keys(porCanal).filter((c) => !(CANALES as readonly string[]).includes(c)),
  ];

  const refrescar = () => {
    setNow(Date.now());
    metricas.recargar();
    recientes.recargar();
  };

  return (
    <>
      <PageHeader
        titulo="Dashboard"
        sub={usuario?.nombre_negocio ?? undefined}
        acciones={
          <Boton
            variante="fantasma"
            onClick={refrescar}
            loading={metricas.loading || recientes.loading}
            aria-label="Actualizar"
            title="Actualizar"
          >
            <RefreshCw size={13} aria-hidden />
            Actualizar
          </Boton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          {metricas.error && <Aviso tipo="error">{metricas.error}</Aviso>}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Conversaciones activas"
              value={m ? fmtInt.format(m.conversaciones_activas) : "—"}
              tone={m && m.conversaciones_activas > 0 ? "success" : "neutral"}
              hint="ahora mismo"
              loading={cargando}
            />
            <StatCard
              label="Mensajes hoy"
              value={m ? fmtInt.format(m.mensajes_hoy) : "—"}
              hint="desde las 00:00"
              loading={cargando}
            />
            <StatCard
              label="Mensajes 7 días"
              value={m ? fmtInt.format(m.mensajes_7d) : "—"}
              hint={
                m && m.conversaciones_7d > 0
                  ? `${(m.mensajes_7d / m.conversaciones_7d).toFixed(1)} por conversación`
                  : "última semana"
              }
              loading={cargando}
            />
            <StatCard
              label="Conversaciones 7 días"
              value={m ? fmtInt.format(m.conversaciones_7d) : "—"}
              hint="iniciadas en la semana"
              loading={cargando}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Por canal: en mobile/tablet va después de las conversaciones
                recientes (order-2) — es un indicador secundario, no debe
                competir por el primer scroll con la lista de chats. */}
            <section className="order-2 flex flex-col rounded-md border border-bg-700 bg-bg-800 p-4 lg:order-1">
              <header className="mb-3">
                <h2 className="text-sm font-medium text-text-100">Conversaciones por canal</h2>
                <p className="font-mono text-[11px] text-text-600">
                  {totalCanal > 0 ? `${fmtInt.format(totalCanal)} en total` : "histórico completo"}
                </p>
              </header>

              {canalesOrdenados.length === 0 ? (
                <p className="py-6 text-center font-mono text-xs text-text-600">
                  {cargando ? "cargando…" : "todavía no hay conversaciones"}
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {canalesOrdenados.map((c) => {
                    const n = porCanal[c] ?? 0;
                    const pct = totalCanal ? (n / totalCanal) * 100 : 0;
                    return (
                      <li key={c} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-1.5 text-text-100">
                            <CanalIcon tipo={c} size={13} className="text-text-400" />
                            {etiquetaCanal(c)}
                          </span>
                          <span className="font-mono tabular-nums text-text-400">
                            {fmtInt.format(n)}
                            <span className="ml-1.5 text-text-600">{Math.round(pct)}%</span>
                          </span>
                        </div>
                        <div
                          className="h-1.5 w-full overflow-hidden rounded-sm bg-bg-700"
                          role="progressbar"
                          aria-label={`${etiquetaCanal(c)}: ${n} conversaciones`}
                          aria-valuenow={Math.round(pct)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-sm bg-series-1 transition-[width] duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Recientes: prioridad sobre el indicador "Por canal" en
                mobile/tablet (order-1), vuelve al orden visual original
                desde lg. */}
            <section className="order-1 flex flex-col overflow-hidden rounded-md border border-bg-700 bg-bg-900 lg:order-2 lg:col-span-2">
              <header className="flex items-center justify-between border-b border-bg-700 px-4 py-3">
                <div>
                  <h2 className="text-sm font-medium text-text-100">Conversaciones recientes</h2>
                  <p className="font-mono text-[11px] text-text-600">
                    últimas {RECIENTES} por actividad
                  </p>
                </div>
                <Link
                  href="/conversaciones"
                  className="inline-flex items-center gap-1 rounded border border-bg-700 px-2 py-1 text-[11px] font-medium text-text-100 hover:bg-bg-800"
                >
                  Ver todas
                  <ArrowRight size={12} aria-hidden />
                </Link>
              </header>

              {recientes.error ? (
                <Aviso tipo="error" className="m-3">
                  {recientes.error}
                </Aviso>
              ) : recientes.data && recientes.data.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <p className="text-sm text-text-100">Todavía no hay conversaciones</p>
                  <p className="max-w-xs text-xs text-text-400">
                    Cuando un cliente escriba por uno de tus canales conectados, aparecerá aquí.
                  </p>
                  <Link
                    href="/canales"
                    className="mt-2 inline-flex items-center gap-1 rounded-md border border-bg-700 px-3 py-1.5 text-xs font-medium text-text-100 hover:bg-bg-800"
                  >
                    Conectar un canal
                    <ArrowRight size={12} aria-hidden />
                  </Link>
                </div>
              ) : recientes.data ? (
                <div>
                  {recientes.data.map((c) => (
                    <ConversationRow key={c.id} conversacion={c} now={now} compact />
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center font-mono text-xs text-text-600">cargando…</div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
