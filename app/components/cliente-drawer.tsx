"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, MapPin, Phone, UserRound, X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { ClienteOut, TareaOut, VendedorOut, VisitaOut } from "@/lib/types";
import {
  formatoFechaHora,
  infoEstadoCliente,
  infoEstadoTarea,
  infoPrioridad,
  tiempoRelativo,
  urlMapa,
} from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { GeocercaBadge, GeocercaBarra } from "./geocerca";
import { Aviso, Boton, Campo, selectClass } from "./ui";

const SIN_VENDEDOR = "__sin__";
const VISITAS_VISIBLES = 20;

/**
 * Ficha de un cliente de campo: datos, últimas visitas y tareas.
 *
 * Los check-ins NO se hacen desde aquí — eso pasa en la app del vendedor,
 * con el GPS del teléfono. Esta pantalla es de lectura para gerencia, con
 * la única escritura de reasignar el cliente a otro vendedor.
 */
export function ClienteDrawer({
  cliente,
  vendedores,
  puedeEditar,
  onClose,
  onCambio,
}: {
  cliente: ClienteOut;
  vendedores: VendedorOut[];
  puedeEditar: boolean;
  onClose: () => void;
  onCambio: (mensaje: string) => void;
}) {
  const visitas = useApi<VisitaOut[]>(
    `/api/visitas?cliente_id=${cliente.id}&limite=${VISITAS_VISIBLES}`,
  );
  const tareas = useApi<TareaOut[]>(`/api/tareas?cliente_id=${cliente.id}&limite=50`);

  const [destino, setDestino] = useState(cliente.vendedor_id ?? SIN_VENDEDOR);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estado = infoEstadoCliente(cliente.estado);
  const prioridad = infoPrioridad(cliente.prioridad);
  const cambio = destino !== (cliente.vendedor_id ?? SIN_VENDEDOR);

  const reasignar = async () => {
    if (!cambio || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      if (destino === SIN_VENDEDOR) {
        // El PUT usa COALESCE, así que mandar null no quita la asignación:
        // para eso existe el endpoint aparte.
        await apiFetch(`/api/clientes/${cliente.id}/desasignar`, { method: "POST" });
        onCambio(`${cliente.nombre_negocio} quedó sin vendedor.`);
      } else {
        const r = await apiFetch<ClienteOut>(`/api/clientes/${cliente.id}`, {
          method: "PUT",
          json: { vendedor_id: destino },
        });
        onCambio(`${cliente.nombre_negocio} ahora es de ${r.vendedor_nombre}.`);
      }
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo reasignar el cliente."));
    } finally {
      setGuardando(false);
    }
  };

  const listaVisitas = visitas.data ?? [];
  const fueraGeocerca = listaVisitas.filter((v) => !v.dentro_de_geocerca).length;

  return (
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o && !guardando) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-bg-700 bg-bg-900 shadow-xl">
          <header className="flex items-start gap-3 border-b border-bg-700 px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Dialog.Title className="truncate text-sm font-medium text-text-100">
                {cliente.nombre_negocio}
              </Dialog.Title>
              <Dialog.Description asChild>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={estado.tone}>{estado.label}</Badge>
                  <Badge tone={prioridad.tone}>Prioridad {prioridad.label.toLowerCase()}</Badge>
                  {cliente.vendedor_nombre ? (
                    <span className="font-mono text-[11px] text-text-600">
                      {cliente.vendedor_nombre}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-warning">sin vendedor</span>
                  )}
                </div>
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Boton
                variante="fantasma"
                disabled={guardando}
                aria-label="Cerrar"
                className="min-h-8 shrink-0 px-2"
              >
                <X size={14} aria-hidden />
              </Boton>
            </Dialog.Close>
          </header>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            {/* Datos */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <Dato label="Contacto">
                {cliente.contacto_nombre ?? <Vacio />}
              </Dato>
              <Dato label="Teléfono">
                {cliente.telefono ? (
                  <a
                    href={`tel:${cliente.telefono}`}
                    className="inline-flex items-center gap-1 text-text-100 underline-offset-2 hover:underline"
                  >
                    <Phone size={11} aria-hidden />
                    {cliente.telefono}
                  </a>
                ) : (
                  <Vacio />
                )}
              </Dato>
              <Dato label="Dirección" ancho>
                {cliente.direccion ?? <Vacio />}
              </Dato>
              <Dato label="Ubicación" ancho>
                <a
                  href={urlMapa(cliente.latitud, cliente.longitud)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-text-100 underline-offset-2 hover:underline"
                >
                  <MapPin size={11} aria-hidden />
                  {cliente.latitud.toFixed(6)}, {cliente.longitud.toFixed(6)}
                  <ExternalLink size={10} aria-hidden />
                </a>
                <span className="mt-0.5 block font-mono text-[11px] text-text-600">
                  geocerca de {cliente.radio_tolerancia_metros} m
                </span>
              </Dato>
              {cliente.notas && (
                <Dato label="Notas" ancho>
                  <span className="leading-relaxed">{cliente.notas}</span>
                </Dato>
              )}
            </dl>

            {/* Reasignación */}
            {puedeEditar && (
              <section className="flex flex-col gap-3 rounded-md border border-bg-700 bg-bg-950 p-3">
                {error && <Aviso tipo="error">{error}</Aviso>}
                <Campo
                  id="cliente-vendedor"
                  label="Vendedor asignado"
                  hint="el nuevo vendedor ve el cliente y su historial de visitas"
                >
                  <select
                    id="cliente-vendedor"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    disabled={guardando}
                    className={selectClass}
                  >
                    <option value={SIN_VENDEDOR}>Sin vendedor</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nombre}
                        {v.activo ? "" : " (inactivo)"}
                      </option>
                    ))}
                  </select>
                </Campo>
                <div className="flex justify-end">
                  <Boton
                    variante="primario"
                    onClick={reasignar}
                    loading={guardando}
                    disabled={!cambio}
                  >
                    <UserRound size={13} aria-hidden />
                    Guardar
                  </Boton>
                </div>
              </section>
            )}

            {/* Visitas */}
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h3 className="font-mono text-[11px] text-text-600">
                  Visitas ({listaVisitas.length})
                </h3>
                {fueraGeocerca > 0 && (
                  <span className="font-mono text-[11px] text-danger">
                    {fueraGeocerca} fuera de la geocerca
                  </span>
                )}
              </div>

              {visitas.error ? (
                <Aviso tipo="error">{visitas.error}</Aviso>
              ) : !visitas.data ? (
                <p className="font-mono text-xs text-text-600">cargando…</p>
              ) : listaVisitas.length === 0 ? (
                <p className="rounded-md border border-dashed border-bg-700 px-3 py-6 text-center font-mono text-[11px] text-text-600">
                  todavía no hay visitas a este cliente
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-bg-700 overflow-hidden rounded-md border border-bg-700">
                  {listaVisitas.map((v) => (
                    <li key={v.id} className="flex flex-col gap-2 bg-bg-950 px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-text-100">{v.vendedor_nombre}</span>
                        <GeocercaBadge dentro={v.dentro_de_geocerca} />
                      </div>
                      <GeocercaBarra
                        distancia={v.distancia_calculada_metros}
                        radio={cliente.radio_tolerancia_metros}
                      />
                      <div className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-text-600">
                        <span title={formatoFechaHora(v.timestamp_servidor)}>
                          {tiempoRelativo(v.timestamp_servidor)}
                        </span>
                        {v.accuracy_metros !== null && (
                          <span title="Precisión que reportó el GPS">
                            · GPS ±{Math.round(v.accuracy_metros)} m
                          </span>
                        )}
                        {v.cliente_uuid_offline && (
                          <span title="Llegó por la cola offline, no en tiempo real">
                            · sincronizada
                          </span>
                        )}
                      </div>
                      {v.comentario && (
                        <p className="text-xs leading-relaxed text-text-400">{v.comentario}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Tareas */}
            <section className="flex flex-col gap-2">
              <h3 className="font-mono text-[11px] text-text-600">
                Tareas ({tareas.data?.length ?? 0})
              </h3>
              {tareas.error ? (
                <Aviso tipo="error">{tareas.error}</Aviso>
              ) : !tareas.data ? (
                <p className="font-mono text-xs text-text-600">cargando…</p>
              ) : tareas.data.length === 0 ? (
                <p className="rounded-md border border-dashed border-bg-700 px-3 py-6 text-center font-mono text-[11px] text-text-600">
                  sin tareas programadas
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-bg-700 overflow-hidden rounded-md border border-bg-700">
                  {tareas.data.map((t) => {
                    const info = infoEstadoTarea(t.estado);
                    return (
                      <li
                        key={t.id}
                        className={cn(
                          "flex flex-col gap-1 bg-bg-950 px-3 py-2.5",
                          t.estado === "completada" && "opacity-60",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-text-100">{t.titulo}</span>
                          <Badge tone={info.tone}>{info.label}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-text-600">
                          <span>{formatoFechaHora(t.fecha_programada)}</span>
                          {t.vendedor_nombre && <span>· {t.vendedor_nombre}</span>}
                        </div>
                        {t.descripcion && (
                          <p className="text-xs leading-relaxed text-text-400">{t.descripcion}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Dato({
  label,
  children,
  ancho = false,
}: {
  label: string;
  children: React.ReactNode;
  ancho?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", ancho && "col-span-2")}>
      <dt className="font-mono text-[11px] text-text-600">{label}</dt>
      <dd className="text-text-100">{children}</dd>
    </div>
  );
}

function Vacio() {
  return <span className="text-text-600">—</span>;
}
