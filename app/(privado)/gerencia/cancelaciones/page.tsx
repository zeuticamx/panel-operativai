"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/lib/use-api";
import type { CancelacionTardiaFilaOut, TenantsGerenciaOut } from "@/lib/types";
import { fmtInt } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { GerenciaTabs } from "@/app/components/gerencia";
import { Aviso, Cargando, PageHeader, inputClass, selectClass } from "@/app/components/ui";

type Granularidad = "dia" | "mes";

/**
 * Cancelaciones tardías de citas, por negocio y servicio (spec 001-regla-cancelacion-citas).
 *
 * Solo lectura y sin datos del cliente final: el backend ya cuenta únicamente
 * las cancelaciones que hizo el cliente (no el equipo) y cuántas llegaron
 * dentro de la ventana de antelación del servicio. Sin fechas, el backend
 * toma los últimos 30 días; el rango máximo es de 366.
 *
 * El filtro de servicio se resuelve acá, sobre las filas ya cargadas: los
 * servicios existentes dependen del negocio y las filas traen su nombre, así
 * que no hace falta otra petición ni pedir un UUID a mano.
 */
export default function CancelacionesPage() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [granularidad, setGranularidad] = useState<Granularidad>("dia");
  const [tenantId, setTenantId] = useState("");
  const [servicioId, setServicioId] = useState("");

  const params = new URLSearchParams({ granularidad });
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  if (tenantId) params.set("tenant_id", tenantId);

  const reporte = useApi<CancelacionTardiaFilaOut[]>(
    `/api/gerencia/cancelaciones-tardias?${params}`,
  );
  const tenants = useApi<TenantsGerenciaOut>("/api/gerencia/tenants?limite=100");

  const filas = useMemo(() => reporte.data ?? [], [reporte.data]);

  const servicios = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const f of filas) {
      const clave = f.servicio_id ?? "";
      if (!vistos.has(clave)) vistos.set(clave, f.servicio_nombre);
    }
    return Array.from(vistos, ([id, nombre]) => ({ id, nombre }));
  }, [filas]);

  const visibles = servicioId
    ? filas.filter((f) => (f.servicio_id ?? "") === servicioId)
    : filas;

  const totalTardias = visibles.reduce((s, f) => s + f.tardias, 0);
  const totalCliente = visibles.reduce((s, f) => s + f.total_cliente, 0);

  return (
    <>
      <PageHeader
        titulo="Cancelaciones tardías"
        sub="citas canceladas por el cliente"
        acciones={<GerenciaTabs />}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex max-w-5xl flex-col gap-4">
          <p className="text-xs leading-relaxed text-text-400">
            Cancelaciones que hizo el <strong className="text-text-100">cliente</strong> (por
            el agente o desde su enlace), y cuántas fueron{" "}
            <strong className="text-text-100">tardías</strong>: llegaron dentro de la
            antelación mínima que define cada servicio. Las del equipo no cuentan. Solo
            lectura, sin datos del cliente.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex flex-col gap-1 text-xs text-text-400">
              Desde
              <input
                type="date"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
                className={cn(inputClass, "py-1 text-xs")}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-400">
              Hasta
              <input
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
                className={cn(inputClass, "py-1 text-xs")}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-400">
              Agrupar por
              <select
                value={granularidad}
                onChange={(e) => setGranularidad(e.target.value as Granularidad)}
                className={cn(selectClass, "py-1 text-xs")}
              >
                <option value="dia">día</option>
                <option value="mes">mes</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-400">
              Negocio
              <select
                value={tenantId}
                onChange={(e) => {
                  setTenantId(e.target.value);
                  setServicioId("");
                }}
                className={cn(selectClass, "py-1 text-xs")}
              >
                <option value="">todos los negocios</option>
                {(tenants.data?.items ?? []).map((t) => (
                  <option key={t.tenant_id} value={t.tenant_id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-400">
              Servicio
              <select
                value={servicioId}
                onChange={(e) => setServicioId(e.target.value)}
                className={cn(selectClass, "py-1 text-xs")}
              >
                <option value="">todos los servicios</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {reporte.error && <Aviso tipo="error">{reporte.error}</Aviso>}
          {!reporte.data && reporte.loading && <Cargando />}

          {reporte.data && (
            <div className={cn("flex flex-col gap-3", reporte.loading && "opacity-60")}>
              {visibles.length === 0 ? (
                <p className="rounded-md border border-dashed border-bg-700 px-3 py-10 text-center font-mono text-[11px] text-text-600">
                  no hubo cancelaciones de clientes en el período
                </p>
              ) : (
                <>
                  <p className="font-mono text-[11px] text-text-600">
                    {fmtInt.format(totalTardias)} tardías de {fmtInt.format(totalCliente)}{" "}
                    cancelaciones del cliente
                  </p>
                  <div className="overflow-x-auto rounded-md border border-bg-700">
                    <table className="w-full min-w-[32rem] text-xs">
                      <thead className="font-mono text-[11px] text-text-600">
                        <tr className="border-b border-bg-700">
                          <th className="px-3 py-2 text-left font-normal">negocio</th>
                          <th className="px-3 py-2 text-left font-normal">servicio</th>
                          <th className="px-3 py-2 text-left font-normal">período</th>
                          <th className="px-3 py-2 text-right font-normal">tardías</th>
                          <th className="px-3 py-2 text-right font-normal">
                            total del cliente
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibles.map((f) => (
                          <tr
                            key={`${f.tenant_id}|${f.servicio_id ?? ""}|${f.periodo}`}
                            className="border-b border-bg-700 last:border-0"
                          >
                            <td className="px-3 py-2 text-text-100">{f.tenant_nombre}</td>
                            <td className="px-3 py-2 text-text-400">{f.servicio_nombre}</td>
                            <td className="px-3 py-2 whitespace-nowrap tabular-nums text-text-400">
                              {f.periodo}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-100">
                              {fmtInt.format(f.tardias)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-400">
                              {fmtInt.format(f.total_cliente)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
