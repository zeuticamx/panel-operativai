"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Coins } from "lucide-react";
import { fmtInt, formatoFechaHoraZona } from "@/lib/formato";
import type { ConsumoPaginaOut, ConsumoResumenOut } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { Aviso, Boton, Campo, inputClass, selectClass } from "@/app/components/ui";

const POR_PAGINA = 25;

/** "2026-03-10" -> "10 mar". UTC para que el día no se corra por la zona del navegador. */
function etiquetaDia(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Auditoría del gasto de créditos por herramienta: resumen, gráficos y
 * tabla paginada (más recientes primero). El tenant lo decide el backend
 * por la sesión; acá solo se piden fechas y herramienta.
 */
export function ConsumoCreditos({ herramientas }: { herramientas: { clave: string; nombre: string }[] }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [herramienta, setHerramienta] = useState("");
  const [pagina, setPagina] = useState(0);

  const filtros = new URLSearchParams();
  if (desde) filtros.set("desde", desde);
  if (hasta) filtros.set("hasta", hasta);
  if (herramienta) filtros.set("herramienta", herramienta);
  const base = filtros.toString();

  const paginaQuery = new URLSearchParams(base);
  paginaQuery.set("limite", String(POR_PAGINA));
  paginaQuery.set("offset", String(pagina * POR_PAGINA));

  const rangoInvalido = desde !== "" && hasta !== "" && desde > hasta;

  // Con el rango invertido no se pregunta: el backend respondería 422.
  const lista = useApi<ConsumoPaginaOut>(rangoInvalido ? null : `/api/herramientas/consumo?${paginaQuery}`);
  const resumen = useApi<ConsumoResumenOut>(
    rangoInvalido ? null : `/api/herramientas/consumo/resumen${base ? `?${base}` : ""}`,
  );
  const cambiarFiltro = (fn: () => void) => {
    fn();
    setPagina(0);
  };

  const datos = lista.data;
  const total = datos?.total ?? 0;
  const ultimaPagina = Math.max(0, Math.ceil(total / POR_PAGINA) - 1);
  const zona = datos?.zona_horaria ?? resumen.data?.zona_horaria ?? "";
  const masUsada = resumen.data?.por_herramienta[0];
  const maxHerramienta = Math.max(1, ...(resumen.data?.por_herramienta ?? []).map((h) => Number(h.creditos)));

  return (
    <section data-tour="herramientas.consumo" className="flex flex-col gap-4 rounded-md border border-bg-700 bg-bg-900 p-4" aria-label="Consumo de créditos">
      <header className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-bg-700 bg-bg-800 text-text-400">
          <Coins size={16} aria-hidden />
        </div>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium text-text-100">Consumo de créditos</h2>
          <p className="text-xs text-text-400">
            Cada vez que tu agente usa una herramienta se descuenta 1 crédito. Aquí queda el detalle.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Campo id="consumo-desde" label="Desde">
          <input
            id="consumo-desde"
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => cambiarFiltro(() => setDesde(e.target.value))}
            className={inputClass}
          />
        </Campo>
        <Campo id="consumo-hasta" label="Hasta">
          <input
            id="consumo-hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => cambiarFiltro(() => setHasta(e.target.value))}
            className={inputClass}
          />
        </Campo>
        <Campo id="consumo-herramienta" label="Herramienta">
          <select
            id="consumo-herramienta"
            value={herramienta}
            onChange={(e) => cambiarFiltro(() => setHerramienta(e.target.value))}
            className={selectClass}
          >
            <option value="">Todas</option>
            {herramientas.map((h) => (
              <option key={h.clave} value={h.clave}>
                {h.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {rangoInvalido && <Aviso tipo="error">La fecha inicial no puede ser posterior a la final.</Aviso>}
      {!rangoInvalido && (lista.error || resumen.error) && (
        <Aviso tipo="error">{lista.error ?? resumen.error}</Aviso>
      )}

      {!rangoInvalido && resumen.data && resumen.data.por_dia.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[11px] text-text-600">
              {fmtInt.format(Number(resumen.data.total_creditos))} créditos en el periodo
              {masUsada ? ` · más usada: ${masUsada.herramienta}` : ""}
            </p>
            <div className="h-48 w-full" role="img" aria-label="Créditos gastados por día">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={resumen.data.por_dia.map((d) => ({ dia: etiquetaDia(d.dia), creditos: Number(d.creditos) }))}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="dia"
                    tick={{ fill: "var(--text-600)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--grid)" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "var(--text-600)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip cursor={{ fill: "var(--bg-800)" }} formatter={(v) => [fmtInt.format(Number(v)), "Créditos"]} />
                  <Bar dataKey="creditos" name="Créditos" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-mono text-[11px] text-text-600">Por herramienta</p>
            <ul className="flex flex-col gap-2">
              {resumen.data.por_herramienta.slice(0, 8).map((h) => (
                <li key={h.herramienta} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="truncate text-text-100">{h.herramienta}</span>
                    <span className="font-mono tabular-nums text-text-400">{fmtInt.format(Number(h.creditos))}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg-800">
                    <div
                      className="h-1.5 rounded-full bg-success"
                      style={{ width: `${(Number(h.creditos) / maxHerramienta) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {lista.loading && !datos ? (
        <p className="font-mono text-xs text-text-600">cargando…</p>
      ) : datos && datos.items.length === 0 ? (
        <p className="rounded-md border border-dashed border-bg-700 px-4 py-6 text-center text-xs text-text-400">
          No hay consumo de créditos en este periodo.
        </p>
      ) : datos ? (
        <div className={lista.loading ? "opacity-60" : undefined}>
          <div className="overflow-x-auto rounded-md border border-bg-700">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-bg-800 text-text-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Herramienta</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Créditos</th>
                  <th scope="col" className="px-3 py-2 font-medium">Fecha y hora{zona ? ` (${zona})` : ""}</th>
                  <th scope="col" className="px-3 py-2 font-medium">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((c) => (
                  <tr key={c.id} className="border-t border-bg-700">
                    <td className="px-3 py-2 text-text-100">{c.herramienta}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-text-100">
                      {fmtInt.format(Number(c.creditos))}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-400">
                      {formatoFechaHoraZona(c.creado_en, datos.zona_horaria)}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-400">{c.whatsapp ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-text-600">
              {datos.offset + 1}–{datos.offset + datos.items.length} de {fmtInt.format(total)}
            </span>
            <div className="flex gap-2">
              <Boton
                variante="secundario"
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={pagina === 0 || lista.loading}
                aria-label="Página anterior"
              >
                <ChevronLeft size={13} aria-hidden />
                Anterior
              </Boton>
              <Boton
                variante="secundario"
                onClick={() => setPagina((p) => Math.min(ultimaPagina, p + 1))}
                disabled={pagina >= ultimaPagina || lista.loading}
                aria-label="Página siguiente"
              >
                Siguiente
                <ChevronRight size={13} aria-hidden />
              </Boton>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
