"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { ResumenGerenciaOut, TenantsGerenciaOut } from "@/lib/types";
import { fmtInt, formatoMonto, tiempoRelativo } from "@/lib/formato";
import { Badge } from "@/app/components/badge";
import { StatCard } from "@/app/components/stat-card";
import {
  EstadoTenantBadge,
  FUENTE_TIPO_CAMBIO_INFO,
  GerenciaTabs,
  SelectorDias,
  fmtCostoUsd,
  fmtMargen,
  fmtTokens,
} from "@/app/components/gerencia";
import { Aviso, Cargando, PageHeader } from "@/app/components/ui";

/**
 * Portada del panel de plataforma.
 *
 * El orden de las tarjetas no es decorativo: arriba lo que se cobra
 * (negocios y MRR), abajo lo que cuesta (tokens). Entre medio,
 * `tenants_en_riesgo`, que es el único número accionable de la pantalla —
 * negocios que pagan y no usaron el servicio en todo el período.
 */
export default function GerenciaPage() {
  const [dias, setDias] = useState(30);

  const resumen = useApi<ResumenGerenciaOut>(`/api/gerencia/resumen?dias=${dias}`);
  // Los cinco que más consumieron, para no tener que saltar a la otra
  // pestaña solo para ver quién se está comiendo el gasto.
  const top = useApi<TenantsGerenciaOut>(
    `/api/gerencia/tenants?dias=${dias}&orden=consumo&limite=5`,
  );

  const d = resumen.data;

  return (
    <>
      <PageHeader
        titulo="Plataforma"
        sub="todos los negocios"
        acciones={
          <>
            <GerenciaTabs />
            <SelectorDias dias={dias} onChange={setDias} />
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {resumen.error && <Aviso tipo="error">{resumen.error}</Aviso>}
        {!d && resumen.loading && <Cargando />}

        {d && (
          <div className="flex flex-col gap-6">
            {/* ---- Negocios ---- */}
            <section className="flex flex-col gap-3">
              <h2 className="font-mono text-[11px] text-text-600">NEGOCIOS</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="total"
                  value={fmtInt.format(d.tenants_total)}
                  hint={`${fmtInt.format(d.tenants_nuevos)} de alta en el período`}
                  loading={resumen.loading}
                />
                <StatCard
                  label="con actividad"
                  value={fmtInt.format(d.tenants_con_actividad)}
                  tone={d.tenants_con_actividad > 0 ? "success" : "neutral"}
                  hint={`de ${fmtInt.format(d.tenants_total)} · ${fmtInt.format(d.mensajes)} mensajes`}
                  loading={resumen.loading}
                />
                <StatCard
                  label="suspendidos"
                  value={fmtInt.format(d.tenants_suspendidos)}
                  tone={d.tenants_suspendidos > 0 ? "danger" : "neutral"}
                  hint={`${fmtInt.format(d.tenants_prueba)} en prueba · ${fmtInt.format(d.tenants_baja)} de baja`}
                  loading={resumen.loading}
                />
                <StatCard
                  label="pagan y no usan"
                  value={fmtInt.format(d.tenants_en_riesgo)}
                  tone={d.tenants_en_riesgo > 0 ? "warning" : "success"}
                  hint="suscripción activa, cero mensajes"
                  loading={resumen.loading}
                />
              </div>

              {d.tenants_en_riesgo > 0 && (
                <Aviso tipo="info">
                  <AlertTriangle size={12} className="mr-1 inline" aria-hidden />
                  {d.tenants_en_riesgo === 1
                    ? "Hay 1 negocio que paga y no mandó un solo mensaje"
                    : `Hay ${d.tenants_en_riesgo} negocios que pagan y no mandaron un solo mensaje`}{" "}
                  en los últimos {d.dias} días. Son los candidatos a irse el próximo ciclo.
                </Aviso>
              )}
            </section>

            {/* ---- Dinero ---- */}
            <section className="flex flex-col gap-3">
              <h2 className="font-mono text-[11px] text-text-600">DINERO</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard
                  label="MRR"
                  value={formatoMonto(d.mrr)}
                  tone="success"
                  hint={`${fmtInt.format(d.suscripciones_activas)} suscripciones activas`}
                  loading={resumen.loading}
                />
                <StatCard
                  label="margen estimado"
                  value={fmtMargen(d.margen, formatoMonto)}
                  tone={d.margen === null ? "neutral" : Number(d.margen) < 0 ? "danger" : "success"}
                  hint={
                    d.margen === null
                      ? FUENTE_TIPO_CAMBIO_INFO[d.tipo_cambio_fuente].detalle
                      : `${formatoMonto(d.ingreso_estimado)} − ${formatoMonto(d.costo_moneda)} de modelos (${FUENTE_TIPO_CAMBIO_INFO[d.tipo_cambio_fuente].label})`
                  }
                  loading={resumen.loading}
                />
                <StatCard
                  label="cobrado en el período"
                  value={formatoMonto(d.ingresos_periodo)}
                  hint="transacciones aprobadas"
                  loading={resumen.loading}
                />
                <StatCard
                  label="costo de modelos"
                  value={fmtCostoUsd(d.consumo.costo_usd)}
                  tone="warning"
                  hint={`${fmtInt.format(d.consumo.llamadas)} llamadas al modelo`}
                  loading={resumen.loading}
                />
                <StatCard
                  label="tokens consumidos"
                  value={fmtTokens(d.consumo.tokens_total)}
                  hint={`${fmtTokens(d.consumo.tokens_entrada)} in · ${fmtTokens(d.consumo.tokens_salida)} out`}
                  loading={resumen.loading}
                />
              </div>
            </section>

            {/* ---- Top consumo ---- */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-[11px] text-text-600">QUIÉN CONSUME MÁS</h2>
                <Link
                  href="/gerencia/tenants"
                  className="flex items-center gap-1 text-xs text-text-400 hover:text-text-100"
                >
                  ver todos <ArrowRight size={12} aria-hidden />
                </Link>
              </div>

              <div className="overflow-hidden rounded-md border border-bg-700">
                <table className="w-full text-sm">
                  <thead className="bg-bg-800 text-left font-mono text-[11px] text-text-600">
                    <tr>
                      <th className="px-3 py-2 font-normal">negocio</th>
                      <th className="px-3 py-2 font-normal">estado</th>
                      <th className="px-3 py-2 text-right font-normal">tokens</th>
                      <th className="px-3 py-2 text-right font-normal">costo</th>
                      <th className="hidden px-3 py-2 text-right font-normal sm:table-cell">
                        último mensaje
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(top.data?.items ?? []).map((t) => (
                      <tr key={t.tenant_id} className="border-t border-bg-700">
                        <td className="max-w-0 px-3 py-2">
                          <Link
                            href={`/gerencia/tenants/${t.tenant_id}`}
                            className="block truncate text-text-100 hover:underline"
                          >
                            {t.nombre}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <EstadoTenantBadge estado={t.estado} motivo={t.estado_motivo} />
                            {!t.agente_operando && (
                              <Badge tone="warning" title="El agente no está respondiendo">
                                agente off
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-3 py-2 text-right tabular-nums text-text-100"
                          title={`${fmtInt.format(t.consumo.tokens_total)} tokens`}
                        >
                          {fmtTokens(t.consumo.tokens_total)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-400">
                          {fmtCostoUsd(t.consumo.costo_usd)}
                        </td>
                        <td className="hidden px-3 py-2 text-right font-mono text-[11px] text-text-600 sm:table-cell">
                          {t.ultimo_mensaje ? tiempoRelativo(t.ultimo_mensaje) : "nunca"}
                        </td>
                      </tr>
                    ))}

                    {top.data?.items.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center font-mono text-[11px] text-text-600">
                          nadie consumió tokens en el período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
