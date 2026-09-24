"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { formatoHora, formatoMonto } from "@/lib/formato";
import type { CorteDiarioOut, MetodoPago, ProveedorOut } from "@/lib/types";
import { CalendarioTabs, ModuloCalendarioApagado } from "@/app/components/modulo-calendario";
import { useServicios } from "@/app/components/modulo-vendedores";
import { StatCard } from "@/app/components/stat-card";
import { Aviso, Boton, Cargando, PageHeader, inputClass } from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

function fechaLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

/** "2026-01-05" -> "lunes 5 de enero de 2026" */
function fechaLegible(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Abre una pestaña nueva con el ticket del corte, listo para el diálogo de
 * impresión nativo del navegador ("Guardar como PDF" cubre el pedido de
 * exportar a PDF sin sumar una librería de generación de PDF solo para
 * esto). No reusa el layout del portal (sidebar, tabs) a propósito: un
 * ticket se imprime solo, sin la navegación alrededor.
 */
function imprimirTicket(corte: CorteDiarioOut, nombreNegocio: string, proveedorNombre?: string) {
  const ventana = window.open("", "_blank", "width=420,height=600");
  if (!ventana) return;

  const filas = corte.servicios
    .map(
      (s) => `
        <tr>
          <td>${formatoHora(s.hora_inicio)}</td>
          <td>${s.cliente_nombre ?? "—"}</td>
          <td>${s.servicio_nombre}</td>
          <td>${s.proveedor_nombre}</td>
          <td>${s.metodo_pago ? METODO_PAGO_LABEL[s.metodo_pago] : "—"}</td>
          <td class="monto">${formatoMonto(s.precio_cobrado)}</td>
        </tr>`,
    )
    .join("");

  ventana.document.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Corte diario ${corte.fecha}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: ui-monospace, "SF Mono", Consolas, monospace; color: #111; padding: 16px; max-width: 420px; margin: 0 auto; }
          h1 { font-size: 14px; margin: 0 0 2px; }
          p { font-size: 11px; margin: 0 0 4px; color: #444; }
          .resumen { display: flex; justify-content: space-between; margin: 12px 0; padding: 8px 0; border-top: 1px dashed #999; border-bottom: 1px dashed #999; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px; }
          th, td { text-align: left; padding: 3px 2px; border-bottom: 1px solid #ddd; }
          .monto { text-align: right; white-space: nowrap; }
          tfoot td { border-top: 1px solid #111; border-bottom: none; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>${nombreNegocio}</h1>
        <p>Corte de caja — ${fechaLegible(corte.fecha)}</p>
        ${proveedorNombre ? `<p>Barbero: ${proveedorNombre}</p>` : ""}
        <div class="resumen">
          <span>${corte.total_servicios} servicio${corte.total_servicios === 1 ? "" : "s"}</span>
          <span>${formatoMonto(corte.total_cobrado)}</span>
        </div>
        <table>
          <thead>
            <tr><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Barbero</th><th>Pago</th><th>Monto</th></tr>
          </thead>
          <tbody>${filas || `<tr><td colspan="6">Sin servicios completados este día.</td></tr>`}</tbody>
          <tfoot>
            <tr><td colspan="5">Total</td><td class="monto">${formatoMonto(corte.total_cobrado)}</td></tr>
          </tfoot>
        </table>
      </body>
    </html>
  `);
  ventana.document.close();
  ventana.onload = () => ventana.print();
}

export default function CalendarioCorteDiarioPage() {
  const { usuario } = useUsuario();
  const servicios = useServicios();
  const activo = servicios.data?.calendario_activo ?? false;
  const base = activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}/calendario` : null;

  const [fecha, setFecha] = useState(() => fechaLocal(new Date()));
  const [proveedorId, setProveedorId] = useState("");

  const proveedores = useApi<ProveedorOut[]>(base ? `${base}/proveedores` : null);
  const query = new URLSearchParams({ fecha });
  if (proveedorId) query.set("proveedor_id", proveedorId);
  const corte = useApi<CorteDiarioOut>(base ? `${base}/corte-diario?${query.toString()}` : null);

  const cargandoInicial = servicios.loading && !servicios.data;
  const proveedorNombre = proveedores.data?.find((p) => p.id === proveedorId)?.nombre;

  return (
    <>
      <PageHeader
        titulo="Calendario"
        sub={<CalendarioTabs />}
        acciones={
          activo &&
          corte.data &&
          corte.data.total_servicios > 0 && (
            <Boton
              variante="secundario"
              onClick={() =>
                imprimirTicket(corte.data!, usuario?.nombre_negocio || "Corte diario", proveedorNombre)
              }
            >
              <Printer size={13} aria-hidden />
              Imprimir / PDF
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
              <ModuloCalendarioApagado
                tenantId={servicios.tenantId}
                onActivado={() => servicios.recargar()}
              />
            )
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-medium text-text-100">Corte de caja diario</h2>
                <p className="text-xs text-text-400">
                  Solo cuenta servicios marcados como completados — canceladas, no asistió y citas
                  todavía agendadas no suman al total.
                </p>
              </div>

              <section className="flex flex-wrap items-end gap-3 rounded-md border border-bg-700 bg-bg-900 p-3">
                <label className="flex flex-col gap-1 text-xs text-text-400">
                  Fecha
                  <input
                    type="date"
                    className={`${inputClass} w-[9.5rem] py-1.5`}
                    value={fecha}
                    max={fechaLocal(new Date())}
                    onChange={(e) => e.target.value && setFecha(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-text-400">
                  Barbero
                  <select
                    className={`${inputClass} w-44 py-1.5`}
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {(proveedores.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <Boton variante="fantasma" onClick={() => setFecha(fechaLocal(new Date()))}>
                  Hoy
                </Boton>
                <span className="ml-1 font-mono text-[11px] text-text-600 capitalize">
                  {fechaLegible(fecha)}
                </span>
              </section>

              {corte.error && <Aviso tipo="error">{corte.error}</Aviso>}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                <StatCard
                  label="Servicios realizados"
                  value={corte.data ? corte.data.total_servicios : "—"}
                  loading={corte.loading && !corte.data}
                />
                <StatCard
                  label="Total recaudado"
                  value={corte.data ? formatoMonto(corte.data.total_cobrado) : "—"}
                  tone="success"
                  loading={corte.loading && !corte.data}
                />
              </div>

              <section className="overflow-x-auto rounded-md border border-bg-700 bg-bg-900">
                {corte.loading && !corte.data ? (
                  <Cargando />
                ) : !corte.data || corte.data.servicios.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
                    <p className="text-sm text-text-100">$0.00 recaudados</p>
                    <p className="font-mono text-[11px] text-text-600">
                      0 servicios realizados este día
                    </p>
                  </div>
                ) : (
                  <table className="w-full min-w-[720px] text-xs">
                    <thead>
                      <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                        <th className="px-3 py-2 text-left font-normal">Hora</th>
                        <th className="px-3 py-2 text-left font-normal">Cliente</th>
                        <th className="px-3 py-2 text-left font-normal">Servicio</th>
                        <th className="px-3 py-2 text-left font-normal">Barbero</th>
                        <th className="px-3 py-2 text-left font-normal">Método de pago</th>
                        <th className="px-3 py-2 text-right font-normal">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corte.data.servicios.map((s) => (
                        <tr key={s.id} className="border-b border-bg-700 last:border-b-0 hover:bg-bg-800">
                          <td className="px-3 py-2 tabular-nums text-text-400">
                            {formatoHora(s.hora_inicio)}
                          </td>
                          <td className="px-3 py-2 text-text-100">{s.cliente_nombre ?? "—"}</td>
                          <td className="px-3 py-2 text-text-100">{s.servicio_nombre}</td>
                          <td className="px-3 py-2 text-text-100">{s.proveedor_nombre}</td>
                          <td className="px-3 py-2 text-text-400">
                            {s.metodo_pago ? METODO_PAGO_LABEL[s.metodo_pago] : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-text-100">
                            {formatoMonto(s.precio_cobrado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
