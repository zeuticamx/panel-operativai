"use client";

import { useMemo, useState } from "react";
import { useApi, useDebounce } from "@/lib/use-api";
import { formatoFechaHora, infoEventoAuditoria } from "@/lib/formato";
import type { EstadoReserva, ProveedorOut, ReservaAuditoriaOut } from "@/lib/types";
import { CalendarioTabs, ModuloCalendarioApagado } from "@/app/components/modulo-calendario";
import { useServicios } from "@/app/components/modulo-vendedores";
import { ReservaHistorialModal } from "@/app/components/reserva-historial-modal";
import { Aviso, Cargando, PageHeader, inputClass } from "@/app/components/ui";
import { Badge } from "@/app/components/badge";

const ID_VALIDO = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const OPCIONES_ESTADO: { valor: EstadoReserva; etiqueta: string }[] = [
  { valor: "confirmada", etiqueta: "Confirmada" },
  { valor: "cancelada", etiqueta: "Cancelada" },
  { valor: "completada", etiqueta: "Completada" },
  { valor: "no_asistio", etiqueta: "No asistió" },
];

export default function CalendarioAuditoriaPage() {
  const servicios = useServicios();
  const activo = servicios.data?.calendario_activo ?? false;
  const base = activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}/calendario` : null;

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [cliente, setCliente] = useState("");
  const [reservaIdTexto, setReservaIdTexto] = useState("");
  const [estado, setEstado] = useState("");
  const clienteDebounced = useDebounce(cliente, 400);
  const reservaIdDebounced = useDebounce(reservaIdTexto, 400);

  const [historialDe, setHistorialDe] = useState<ReservaAuditoriaOut | null>(null);

  const proveedores = useApi<ProveedorOut[]>(base ? `${base}/proveedores` : null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (desde) params.set("desde", `${desde}T00:00:00`);
    if (hasta) params.set("hasta", `${hasta}T23:59:59`);
    if (proveedorId) params.set("proveedor_id", proveedorId);
    if (clienteDebounced.trim()) params.set("cliente", clienteDebounced.trim());
    if (ID_VALIDO.test(reservaIdDebounced.trim())) params.set("reserva_id", reservaIdDebounced.trim());
    if (estado) params.set("estado", estado);
    return params.toString();
  }, [desde, hasta, proveedorId, clienteDebounced, reservaIdDebounced, estado]);

  const ruta = base ? `${base}/auditoria${query ? `?${query}` : ""}` : null;
  const auditoria = useApi<ReservaAuditoriaOut[]>(ruta);
  const eventos = auditoria.data ?? [];

  const idEscritoInvalido = reservaIdTexto.trim().length > 0 && !ID_VALIDO.test(reservaIdTexto.trim());
  const cargandoInicial = servicios.loading && !servicios.data;

  const limpiarFiltros = () => {
    setDesde("");
    setHasta("");
    setProveedorId("");
    setCliente("");
    setReservaIdTexto("");
    setEstado("");
  };

  const hayFiltros = !!(desde || hasta || proveedorId || cliente || reservaIdTexto || estado);

  return (
    <>
      <PageHeader titulo="Calendario" sub={<CalendarioTabs />} />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
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
                <h2 className="text-sm font-medium text-text-100">Bitácora de reservas</h2>
                <p className="text-xs text-text-400">
                  Registro auditable e inmutable de cada movimiento: alta, reprogramación, cambio
                  de barbero, cancelación y finalización. Solo lectura.
                </p>
              </div>

              <section className="flex flex-wrap items-end gap-3 rounded-md border border-bg-700 bg-bg-900 p-3">
                <label className="flex flex-col gap-1 text-xs text-text-400">
                  Desde
                  <input
                    type="date"
                    className={`${inputClass} w-[9.5rem] py-1.5`}
                    value={desde}
                    max={hasta || undefined}
                    onChange={(e) => setDesde(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-text-400">
                  Hasta
                  <input
                    type="date"
                    className={`${inputClass} w-[9.5rem] py-1.5`}
                    value={hasta}
                    min={desde || undefined}
                    onChange={(e) => setHasta(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-text-400">
                  Barbero
                  <select
                    className={`${inputClass} w-40 py-1.5`}
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
                <label className="flex flex-col gap-1 text-xs text-text-400">
                  Cliente
                  <input
                    type="text"
                    className={`${inputClass} w-40 py-1.5`}
                    placeholder="Nombre del cliente"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-text-400">
                  ID de cita
                  <input
                    type="text"
                    className={`${inputClass} w-48 py-1.5 font-mono`}
                    placeholder="uuid de la reserva"
                    value={reservaIdTexto}
                    onChange={(e) => setReservaIdTexto(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-text-400">
                  Estatus
                  <select
                    className={`${inputClass} w-36 py-1.5`}
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {OPCIONES_ESTADO.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
                {hayFiltros && (
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="cursor-pointer text-xs text-text-400 hover:text-text-100"
                  >
                    Limpiar filtros
                  </button>
                )}
              </section>

              {idEscritoInvalido && (
                <Aviso tipo="error">El ID de cita debe ser un UUID válido.</Aviso>
              )}
              {auditoria.error && <Aviso tipo="error">{auditoria.error}</Aviso>}

              <section className="overflow-x-auto rounded-md border border-bg-700 bg-bg-900">
                {auditoria.loading && !auditoria.data ? (
                  <Cargando />
                ) : eventos.length === 0 ? (
                  <p className="px-4 py-10 text-center font-mono text-xs text-text-600">
                    {hayFiltros
                      ? "Ningún movimiento coincide con esos filtros."
                      : "Todavía no hay movimientos registrados."}
                  </p>
                ) : (
                  <table className="w-full min-w-[900px] text-xs">
                    <thead>
                      <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                        <th className="px-3 py-2 text-left font-normal">Fecha y hora</th>
                        <th className="px-3 py-2 text-left font-normal">Evento</th>
                        <th className="px-3 py-2 text-left font-normal">Cliente</th>
                        <th className="px-3 py-2 text-left font-normal">Barbero</th>
                        <th className="px-3 py-2 text-left font-normal">Estado</th>
                        <th className="px-3 py-2 text-left font-normal">Actor</th>
                        <th className="px-3 py-2 text-left font-normal">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventos.map((e) => {
                        const info = infoEventoAuditoria(e.evento);
                        return (
                          <tr
                            key={e.id}
                            onClick={() => setHistorialDe(e)}
                            className="cursor-pointer border-b border-bg-700 last:border-b-0 hover:bg-bg-800"
                            title="Ver historial completo de esta cita"
                          >
                            <td className="px-3 py-2 tabular-nums text-text-400">
                              {formatoFechaHora(e.creado_en)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge tone={info.tone}>{info.label}</Badge>
                            </td>
                            <td className="px-3 py-2 text-text-100">
                              {e.cliente_nombre ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-text-100">{e.proveedor_nombre}</td>
                            <td className="px-3 py-2 text-text-400">
                              {e.estado_anterior && e.estado_anterior !== e.estado_nuevo
                                ? `${e.estado_anterior} → ${e.estado_nuevo}`
                                : e.estado_nuevo}
                            </td>
                            <td className="px-3 py-2 text-text-400">
                              {e.origen === "n8n" ? "Chat: " : ""}
                              {e.actor}
                            </td>
                            <td className="max-w-[16rem] truncate px-3 py-2 text-text-600">
                              {e.motivo ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {servicios.tenantId && (
        <ReservaHistorialModal
          open={historialDe !== null}
          onOpenChange={(o) => !o && setHistorialDe(null)}
          tenantId={servicios.tenantId}
          reservaId={historialDe?.reserva_id ?? null}
          titulo={historialDe?.cliente_nombre ?? undefined}
        />
      )}
    </>
  );
}
