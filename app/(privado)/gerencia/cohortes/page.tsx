"use client";

import { useState } from "react";
import { useApi } from "@/lib/use-api";
import type { CohortesOut } from "@/lib/types";
import { fmtInt, formatoMes } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { GerenciaTabs } from "@/app/components/gerencia";
import { Aviso, Cargando, PageHeader, selectClass } from "@/app/components/ui";

const OPCIONES_MESES = [6, 12, 24];

/**
 * Retención por cohortes: filas = mes de alta, columnas = meses después.
 *
 * Magnitud en una sola tonalidad (series-1) de claro a oscuro, sin arcoíris:
 * es una escala secuencial, y la intensidad por opacidad sobre la superficie
 * funciona igual en tema claro y oscuro. El número va siempre escrito en
 * color de texto — el color de la celda acompaña, nunca es la única forma
 * de leer el valor — y cada celda tiene su tooltip con el conteo absoluto.
 */
export default function CohortesPage() {
  const [meses, setMeses] = useState(12);
  const datos = useApi<CohortesOut>(`/api/gerencia/cohortes?meses=${meses}`);

  const cohortes = datos.data?.cohortes ?? [];
  const columnas = Math.max(0, ...cohortes.map((c) => c.retencion.length));

  return (
    <>
      <PageHeader
        titulo="Retención"
        sub="por mes de alta"
        acciones={
          <>
            <GerenciaTabs />
            <select
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              aria-label="Cohortes a mostrar"
              className={cn(selectClass, "w-auto py-1 text-xs")}
            >
              {OPCIONES_MESES.map((m) => (
                <option key={m} value={m}>
                  últimos {m} meses
                </option>
              ))}
            </select>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {datos.error && <Aviso tipo="error">{datos.error}</Aviso>}
        {!datos.data && datos.loading && <Cargando />}

        {datos.data && (
          <div className={cn("flex max-w-5xl flex-col gap-4", datos.loading && "opacity-60")}>
            <p className="text-xs leading-relaxed text-text-400">
              Qué porcentaje de los negocios dados de alta cada mes siguió con{" "}
              <strong className="text-text-100">al menos un mensaje</strong> en los meses
              siguientes. Se mide por uso y no por pago: el que paga y no usa ya se fue, aunque
              todavía no haya cancelado. La última columna de cada fila es el mes en curso, todavía
              incompleto.
            </p>

            {cohortes.length === 0 ? (
              <p className="rounded-md border border-dashed border-bg-700 px-3 py-10 text-center font-mono text-[11px] text-text-600">
                no hubo altas en el período
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border border-bg-700">
                  <table className="w-full border-separate border-spacing-0.5 p-1 text-xs">
                    <thead className="font-mono text-[11px] text-text-600">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-normal">alta</th>
                        <th className="px-2 py-1.5 text-right font-normal">negocios</th>
                        {Array.from({ length: columnas }, (_, i) => (
                          <th key={i} className="min-w-12 px-1 py-1.5 text-center font-normal">
                            {i === 0 ? "mes 0" : `+${i}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cohortes.map((c) => (
                        <tr key={c.mes}>
                          <td className="px-2 py-1.5 whitespace-nowrap text-text-100">
                            {formatoMes(c.mes.slice(0, 7))}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-text-400">
                            {fmtInt.format(c.tamano)}
                          </td>
                          {Array.from({ length: columnas }, (_, i) => {
                            const pct = c.retencion[i];
                            if (pct === undefined) return <td key={i} />;
                            const ultima = i === c.retencion.length - 1;
                            return (
                              <td
                                key={i}
                                title={`${formatoMes(c.mes.slice(0, 7))}, ${i === 0 ? "mes de alta" : `${i} mes(es) después`}: ${c.activos[i]} de ${c.tamano} con actividad${ultima ? " (mes en curso)" : ""}`}
                                className="relative rounded px-1 py-1.5 text-center tabular-nums text-text-100"
                              >
                                <span
                                  aria-hidden
                                  className="absolute inset-0 rounded bg-series-1"
                                  // 8 % de piso para que 0 % siga siendo una
                                  // celda visible y no un hueco; 55 % de
                                  // techo para que el número (texto oscuro
                                  // en tema claro) conserve contraste.
                                  style={{ opacity: 0.08 + (pct / 100) * 0.47 }}
                                />
                                <span className={cn("relative", ultima && "italic")}>
                                  {Math.round(pct)}%
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Leyenda de la escala: con una sola tonalidad basta con
                    mostrar los dos extremos. */}
                <div className="flex items-center gap-2 font-mono text-[11px] text-text-600">
                  <span>0%</span>
                  <span
                    aria-hidden
                    className="h-2 w-32 rounded"
                    style={{
                      background:
                        "linear-gradient(to right, color-mix(in srgb, var(--series-1) 8%, transparent), color-mix(in srgb, var(--series-1) 55%, transparent))",
                    }}
                  />
                  <span>100% con actividad</span>
                  <span className="ml-3 italic">cursiva = mes en curso</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
