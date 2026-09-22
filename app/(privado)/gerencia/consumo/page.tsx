"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/use-api";
import type { ConsumoOut, PuntoConsumoOut, TenantsGerenciaOut } from "@/lib/types";
import { fmtInt } from "@/lib/formato";
import { StatCard } from "@/app/components/stat-card";
import {
  GerenciaTabs,
  SelectorDias,
  fmtCostoUsd,
  fmtTokens,
} from "@/app/components/gerencia";
import { Aviso, Cargando, PageHeader } from "@/app/components/ui";

export default function ConsumoPage() {
  const [dias, setDias] = useState(30);

  const consumo = useApi<ConsumoOut>(`/api/gerencia/consumo?dias=${dias}`);
  const tenants = useApi<TenantsGerenciaOut>(
    `/api/gerencia/tenants?dias=${dias}&orden=consumo&limite=15`,
  );

  const d = consumo.data;

  return (
    <>
      <PageHeader
        titulo="Consumo de IA"
        sub="tokens y costo del proveedor"
        acciones={
          <>
            <GerenciaTabs />
            <SelectorDias dias={dias} onChange={setDias} />
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {consumo.error && <Aviso tipo="error">{consumo.error}</Aviso>}
        {!d && consumo.loading && <Cargando />}

        {d && (
          <div className="flex max-w-5xl flex-col gap-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="tokens totales"
                value={fmtTokens(d.total.tokens_total)}
                hint={`${fmtInt.format(d.total.tokens_total)} exactos`}
              />
              <StatCard
                label="entrada / salida"
                value={`${fmtTokens(d.total.tokens_entrada)} / ${fmtTokens(d.total.tokens_salida)}`}
                hint="prompt / respuesta"
              />
              <StatCard
                label="costo"
                value={fmtCostoUsd(d.total.costo_usd)}
                tone="warning"
                hint="lo que cobra el proveedor del modelo"
              />
              <StatCard
                label="llamadas"
                value={fmtInt.format(d.total.llamadas)}
                hint={
                  d.total.llamadas > 0
                    ? `${fmtInt.format(Math.round(d.total.tokens_total / d.total.llamadas))} tokens por llamada`
                    : "sin actividad"
                }
              />
            </div>

            <section className="flex flex-col gap-3">
              <h2 className="font-mono text-[11px] text-text-600">POR DÍA</h2>
              {d.por_dia.length > 0 ? (
                <BarrasConsumo puntos={d.por_dia} />
              ) : (
                <p className="rounded-md border border-dashed border-bg-700 px-3 py-8 text-center font-mono text-[11px] text-text-600">
                  todavía no hay consumo registrado.{" "}
                  <span className="text-text-400">
                    n8n lo reporta en POST /api/eventos/uso-tokens
                  </span>
                </p>
              )}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="flex flex-col gap-3">
                <h2 className="font-mono text-[11px] text-text-600">POR MODELO</h2>
                <div className="overflow-hidden rounded-md border border-bg-700">
                  <table className="w-full text-sm">
                    <tbody>
                      {d.por_modelo.map((m) => (
                        <tr key={m.modelo} className="border-b border-bg-700 last:border-0">
                          <td className="max-w-0 truncate px-3 py-2 text-text-100">
                            {m.modelo}
                          </td>
                          <td
                            className="px-3 py-2 text-right tabular-nums text-text-400"
                            title={`${fmtInt.format(m.tokens_total)} tokens`}
                          >
                            {fmtTokens(m.tokens_total)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-text-400">
                            {fmtCostoUsd(m.costo_usd)}
                          </td>
                        </tr>
                      ))}
                      {d.por_modelo.length === 0 && (
                        <tr>
                          <td className="px-3 py-6 text-center font-mono text-[11px] text-text-600">
                            sin datos
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="font-mono text-[11px] text-text-600">POR NEGOCIO</h2>
                <div className="overflow-hidden rounded-md border border-bg-700">
                  <table className="w-full text-sm">
                    <tbody>
                      {(tenants.data?.items ?? [])
                        .filter((t) => t.consumo.tokens_total > 0)
                        .map((t) => (
                          <tr key={t.tenant_id} className="border-b border-bg-700 last:border-0">
                            <td className="max-w-0 px-3 py-2">
                              <Link
                                href={`/gerencia/tenants/${t.tenant_id}`}
                                className="block truncate text-text-100 hover:underline"
                              >
                                {t.nombre}
                              </Link>
                            </td>
                            <td
                              className="px-3 py-2 text-right tabular-nums text-text-400"
                              title={`${fmtInt.format(t.consumo.tokens_total)} tokens`}
                            >
                              {fmtTokens(t.consumo.tokens_total)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-400">
                              {fmtCostoUsd(t.consumo.costo_usd)}
                            </td>
                          </tr>
                        ))}
                      {(tenants.data?.items ?? []).every(
                        (t) => t.consumo.tokens_total === 0,
                      ) && (
                        <tr>
                          <td className="px-3 py-6 text-center font-mono text-[11px] text-text-600">
                            sin datos
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------
// Barras por día
// ------------------------------------------------------------
/**
 * Una serie sola, así que barras en divs y no SVG: el resto del portal
 * dibuja a mano por la misma razón (ver ChartTendencia) y acá ni siquiera
 * hace falta un eje.
 *
 * Los días sin consumo no vienen del backend; se rellenan acá con cero
 * para que la barra faltante se vea como un hueco real y no como un día
 * que no existió.
 */
function BarrasConsumo({ puntos }: { puntos: PuntoConsumoOut[] }) {
  const porDia = new Map(puntos.map((p) => [p.dia, p]));

  const primero = puntos[0].dia;
  const ultimo = puntos[puntos.length - 1].dia;
  const dias: string[] = [];
  for (
    let d = new Date(`${primero}T00:00:00Z`);
    d <= new Date(`${ultimo}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    dias.push(d.toISOString().slice(0, 10));
  }

  const maximo = Math.max(...puntos.map((p) => p.tokens_total), 1);

  return (
    <div className="rounded-md border border-bg-700 p-4">
      <div className="flex h-40 items-end gap-px" role="img" aria-label="Tokens por día">
        {dias.map((dia) => {
          const p = porDia.get(dia);
          const total = p?.tokens_total ?? 0;
          return (
            <div
              key={dia}
              className="group relative flex-1 bg-series-1/70 transition-colors hover:bg-series-1"
              style={{ height: `${Math.max((total / maximo) * 100, total > 0 ? 2 : 0.5)}%` }}
              title={`${dia}: ${fmtInt.format(total)} tokens${p ? ` · ${fmtCostoUsd(p.costo_usd)} · ${fmtInt.format(p.llamadas)} llamadas` : ""}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-text-600">
        <span>{primero}</span>
        <span>pico {fmtTokens(maximo)} tokens/día</span>
        <span>{ultimo}</span>
      </div>
    </div>
  );
}
