"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatoMonto } from "@/lib/formato";
import type { ServicioActualizarIn, ServicioCrearIn, ServicioOut } from "@/lib/types";
import { CalendarioTabs, ModuloCalendarioApagado } from "@/app/components/modulo-calendario";
import { esGerencia, useServicios } from "@/app/components/modulo-vendedores";
import { ServicioEditarModal } from "@/app/components/servicio-editar-modal";
import { Aviso, Boton, Cargando, Interruptor, PageHeader, inputClass } from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

export default function CalendarioServiciosPage() {
  const { usuario } = useUsuario();
  const servicios = useServicios();
  const gerencia = esGerencia(usuario);

  const activo = servicios.data?.calendario_activo ?? false;
  const base =
    activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}/calendario` : null;

  const catalogo = useApi<ServicioOut[]>(base ? `${base}/servicios` : null);

  const [nombreNuevo, setNombreNuevo] = useState("");
  const [duracionNueva, setDuracionNueva] = useState("30");
  const [precioNuevo, setPrecioNuevo] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<ServicioOut | null>(null);

  const crear = async () => {
    const duracion = Number(duracionNueva);
    if (!base || !nombreNuevo.trim() || !Number.isFinite(duracion) || duracion < 5) return;
    setCreando(true);
    setError(null);
    try {
      await apiFetch<ServicioOut>(`${base}/servicios`, {
        method: "POST",
        json: {
          nombre: nombreNuevo.trim(),
          duracion_minutos: duracion,
          precio: precioNuevo.trim() || undefined,
        } satisfies ServicioCrearIn,
      });
      setNombreNuevo("");
      setDuracionNueva("30");
      setPrecioNuevo("");
      catalogo.recargar(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo crear el servicio."));
    } finally {
      setCreando(false);
    }
  };

  const actualizar = async (id: string, cambios: ServicioActualizarIn) => {
    if (!base) return;
    setError(null);
    try {
      await apiFetch<ServicioOut>(`${base}/servicios/${id}`, { method: "PATCH", json: cambios });
      catalogo.recargar(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo actualizar el servicio."));
    }
  };

  const cargandoInicial = servicios.loading && !servicios.data;

  return (
    <>
      <PageHeader titulo="Calendario" sub={<CalendarioTabs />} />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
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
              {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
              {error && <Aviso tipo="error">{error}</Aviso>}
              {catalogo.error && <Aviso tipo="error">{catalogo.error}</Aviso>}

              {gerencia && (
                <section className="flex flex-wrap items-end gap-2 rounded-md border border-bg-700 bg-bg-900 p-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="serv-nombre" className="text-xs text-text-400">
                      Nombre
                    </label>
                    <input
                      id="serv-nombre"
                      className={`${inputClass} w-48`}
                      value={nombreNuevo}
                      onChange={(e) => setNombreNuevo(e.target.value)}
                      placeholder="Corte de cabello"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="serv-duracion" className="text-xs text-text-400">
                      Duración (min)
                    </label>
                    <input
                      id="serv-duracion"
                      type="number"
                      min={5}
                      max={480}
                      className={`${inputClass} w-28`}
                      value={duracionNueva}
                      onChange={(e) => setDuracionNueva(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="serv-precio" className="text-xs text-text-400">
                      Precio (opcional)
                    </label>
                    <input
                      id="serv-precio"
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${inputClass} w-28`}
                      value={precioNuevo}
                      onChange={(e) => setPrecioNuevo(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <Boton
                    variante="primario"
                    onClick={crear}
                    loading={creando}
                    disabled={!nombreNuevo.trim()}
                  >
                    <Plus size={13} aria-hidden />
                    Agregar
                  </Boton>
                </section>
              )}

              <section className="rounded-md border border-bg-700 bg-bg-900">
                {catalogo.loading && !catalogo.data ? (
                  <Cargando />
                ) : (catalogo.data ?? []).length === 0 ? (
                  <p className="px-4 py-8 text-center font-mono text-xs text-text-600">
                    Todavía no hay servicios.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                        <th className="px-3 py-2 text-left font-normal">Servicio</th>
                        <th className="px-3 py-2 text-right font-normal">Duración</th>
                        <th className="px-3 py-2 text-right font-normal">Precio</th>
                        <th className="px-3 py-2 text-left font-normal">Activo</th>
                        {gerencia && <th className="px-3 py-2 text-right font-normal">Editar</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(catalogo.data ?? []).map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-bg-700 last:border-b-0 hover:bg-bg-800"
                        >
                          <td className="px-3 py-2 text-text-100">{s.nombre}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-text-400">
                            {s.duracion_minutos} min
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-text-400">
                            {formatoMonto(s.precio)}
                          </td>
                          <td className="px-3 py-2">
                            <Interruptor
                              checked={s.activo}
                              onChange={(v) => actualizar(s.id, { activo: v })}
                              disabled={!gerencia}
                              label={`Activar o desactivar ${s.nombre}`}
                            />
                          </td>
                          {gerencia && (
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => setEditando(s)}
                                aria-label={`Editar ${s.nombre}`}
                                title="Editar"
                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-text-400 hover:bg-bg-700 hover:text-text-100"
                              >
                                <Pencil size={13} aria-hidden />
                              </button>
                            </td>
                          )}
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

      {editando && servicios.tenantId && (
        <ServicioEditarModal
          open={editando !== null}
          onOpenChange={(o) => !o && setEditando(null)}
          servicio={editando}
          tenantId={servicios.tenantId}
          onGuardado={(mensaje) => {
            setAviso(mensaje);
            catalogo.recargar(true);
          }}
        />
      )}
    </>
  );
}
