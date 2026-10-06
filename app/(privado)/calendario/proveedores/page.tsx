"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Plus, Send } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { fmtInt } from "@/lib/formato";
import type {
  CupoOut,
  InvitacionCreadaOut,
  ProveedorActualizarIn,
  ProveedorCrearIn,
  ProveedorOut,
} from "@/lib/types";
import { Badge } from "@/app/components/badge";
import {
  DialogoEnlace,
  DialogoInvitar,
  reenviarInvitacion,
  useInvitaciones,
} from "@/app/components/invitaciones";
import { CalendarioTabs, ModuloCalendarioApagado } from "@/app/components/modulo-calendario";
import { esGerencia, useServicios } from "@/app/components/modulo-vendedores";
import { ProveedorHorarioModal } from "@/app/components/proveedor-horario-modal";
import { Aviso, Boton, Cargando, Interruptor, PageHeader, inputClass } from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

export default function CalendarioProveedoresPage() {
  const { usuario } = useUsuario();
  const servicios = useServicios();
  const gerencia = esGerencia(usuario);

  const activo = servicios.data?.calendario_activo ?? false;
  const base =
    activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}/calendario` : null;

  const proveedores = useApi<ProveedorOut[]>(base ? `${base}/proveedores` : null);
  // El cupo y las invitaciones son de gerencia: el backend se los niega al resto.
  const cupo = useApi<CupoOut>(base && gerencia ? `${base}/proveedores/cupo` : null);
  const invitaciones = useInvitaciones(gerencia && activo);
  const [darAcceso, setDarAcceso] = useState<ProveedorOut | null>(null);
  const [enlace, setEnlace] = useState<InvitacionCreadaOut | null>(null);
  const [reenviando, setReenviando] = useState<string | null>(null);

  const c = cupo.data;
  // Con el tope del plan alcanzado no se ofrece sumar otro activo: el backend
  // respondería 402 (services/acceso_plan.exigir_cupo_proveedor).
  const cupoLleno = c !== undefined && c !== null && c.maximo !== null && c.activos >= c.maximo;
  const invitacionDe = (p: ProveedorOut) => invitaciones.data?.find((i) => i.proveedor_id === p.id);

  const reenviar = async (invitacionId: string) => {
    setError(null);
    setReenviando(invitacionId);
    try {
      setEnlace(await reenviarInvitacion(invitacionId));
      await invitaciones.recargar(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo reenviar la invitación."));
    } finally {
      setReenviando(null);
    }
  };

  const [nombreNuevo, setNombreNuevo] = useState("");
  const [colorNuevo, setColorNuevo] = useState("#6366f1");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horarioDe, setHorarioDe] = useState<ProveedorOut | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");

  const crear = async () => {
    if (!base || !nombreNuevo.trim()) return;
    setCreando(true);
    setError(null);
    try {
      await apiFetch<ProveedorOut>(`${base}/proveedores`, {
        method: "POST",
        json: { nombre: nombreNuevo.trim(), color: colorNuevo } satisfies ProveedorCrearIn,
      });
      setNombreNuevo("");
      proveedores.recargar(true);
      cupo.recargar(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo crear el proveedor."));
    } finally {
      setCreando(false);
    }
  };

  const actualizar = async (id: string, cambios: ProveedorActualizarIn) => {
    if (!base) return;
    setError(null);
    try {
      await apiFetch<ProveedorOut>(`${base}/proveedores/${id}`, { method: "PATCH", json: cambios });
      proveedores.recargar(true);
      cupo.recargar(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo actualizar el proveedor."));
    }
  };

  const guardarNombre = async (p: ProveedorOut) => {
    const nuevo = nombreEditado.trim();
    setEditandoId(null);
    if (!nuevo || nuevo === p.nombre) return;
    await actualizar(p.id, { nombre: nuevo });
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
              {error && <Aviso tipo="error">{error}</Aviso>}
              {proveedores.error && <Aviso tipo="error">{proveedores.error}</Aviso>}

              {gerencia && (
                <section data-tour="proveedores.form" className="flex flex-wrap items-end gap-2 rounded-md border border-bg-700 bg-bg-900 p-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="prov-nombre" className="text-xs text-text-400">
                      Nombre
                    </label>
                    <input
                      id="prov-nombre"
                      className={`${inputClass} w-56`}
                      value={nombreNuevo}
                      onChange={(e) => setNombreNuevo(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && crear()}
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="prov-color" className="text-xs text-text-400">
                      Color
                    </label>
                    <input
                      id="prov-color"
                      type="color"
                      value={colorNuevo}
                      onChange={(e) => setColorNuevo(e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded-md border border-bg-700 bg-bg-900"
                    />
                  </div>
                  <Boton
                    variante="primario"
                    onClick={crear}
                    loading={creando}
                    disabled={!nombreNuevo.trim() || cupoLleno}
                    title={cupoLleno ? "Llegaste al tope de proveedores activos de tu plan" : undefined}
                  >
                    <Plus size={13} aria-hidden />
                    Agregar
                  </Boton>
                  {c && c.maximo !== null && (
                    <span className="ml-auto self-center font-mono text-[11px] text-text-600">
                      {fmtInt.format(c.activos)} de {fmtInt.format(c.maximo)} activos en tu plan
                    </span>
                  )}
                </section>
              )}

              {gerencia && cupoLleno && (
                <Aviso tipo="info">
                  Llegaste al tope de proveedores activos de tu plan. Desactiva a alguien o{" "}
                  <Link href="/suscripcion" className="underline underline-offset-2">
                    mejora tu plan
                  </Link>{" "}
                  para sumar más.
                </Aviso>
              )}

              <section data-tour="proveedores.lista" className="rounded-md border border-bg-700 bg-bg-900">
                {proveedores.loading && !proveedores.data ? (
                  <Cargando />
                ) : (proveedores.data ?? []).length === 0 ? (
                  <p className="px-4 py-8 text-center font-mono text-xs text-text-600">
                    Todavía no hay proveedores.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                        <th className="px-3 py-2 text-left font-normal">Proveedor</th>
                        <th className="px-3 py-2 text-left font-normal">Activo</th>
                        {gerencia && <th className="px-3 py-2 text-left font-normal">Acceso</th>}
                        <th className="px-3 py-2 text-right font-normal">Horario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(proveedores.data ?? []).map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-bg-700 last:border-b-0 hover:bg-hover"
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={p.color}
                                disabled={!gerencia}
                                onChange={(e) => actualizar(p.id, { color: e.target.value })}
                                className="h-6 w-6 shrink-0 cursor-pointer rounded border border-bg-700 bg-bg-900 disabled:cursor-not-allowed"
                                aria-label={`Color de ${p.nombre}`}
                              />
                              {editandoId === p.id ? (
                                <input
                                  autoFocus
                                  className={`${inputClass} w-44 py-1`}
                                  value={nombreEditado}
                                  onChange={(e) => setNombreEditado(e.target.value)}
                                  onBlur={() => guardarNombre(p)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") guardarNombre(p);
                                    if (e.key === "Escape") setEditandoId(null);
                                  }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  disabled={!gerencia}
                                  onClick={() => {
                                    setEditandoId(p.id);
                                    setNombreEditado(p.nombre);
                                  }}
                                  className="cursor-pointer text-left text-text-100 disabled:cursor-default"
                                  title={gerencia ? "Click para renombrar" : undefined}
                                >
                                  {p.nombre}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Interruptor
                              checked={p.activo}
                              onChange={(v) => actualizar(p.id, { activo: v })}
                              disabled={!gerencia || (!p.activo && cupoLleno)}
                              label={`Activar o desactivar a ${p.nombre}`}
                            />
                          </td>
                          {gerencia && (
                            <td className="px-3 py-2">
                              <AccesoProveedor
                                proveedor={p}
                                invitacion={invitacionDe(p)}
                                reenviando={reenviando}
                                onDarAcceso={() => setDarAcceso(p)}
                                onReenviar={reenviar}
                              />
                            </td>
                          )}
                          <td className="px-3 py-2 text-right">
                            <Boton variante="fantasma" onClick={() => setHorarioDe(p)}>
                              Horario
                            </Boton>
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

      {servicios.tenantId && (
        <ProveedorHorarioModal
          open={horarioDe !== null}
          onOpenChange={(o) => !o && setHorarioDe(null)}
          tenantId={servicios.tenantId}
          proveedor={horarioDe}
        />
      )}

      <DialogoInvitar
        open={darAcceso !== null}
        onOpenChange={(o) => {
          if (!o) setDarAcceso(null);
        }}
        role="proveedor"
        ficha={darAcceso ? { id: darAcceso.id, nombre: darAcceso.nombre } : undefined}
        onCreada={(inv) => {
          setDarAcceso(null);
          setEnlace(inv);
          void invitaciones.recargar(true);
        }}
      />
      <DialogoEnlace invitacion={enlace} onCerrar={() => setEnlace(null)} />
    </>
  );
}

/**
 * Acceso del proveedor al portal: ya entra con su cuenta, tiene una
 * invitación esperando (reenviable), o se le puede dar. Quitarlo se hace en
 * Preferencias › Usuarios del negocio, igual que con los vendedores.
 */
function AccesoProveedor({
  proveedor,
  invitacion,
  reenviando,
  onDarAcceso,
  onReenviar,
}: {
  proveedor: ProveedorOut;
  invitacion: { id: string; email: string; vencida: boolean } | undefined;
  reenviando: string | null;
  onDarAcceso: () => void;
  onReenviar: (invitacionId: string) => void;
}) {
  if (proveedor.portal_user_id) {
    return <Badge title="Entra al portal con su propia cuenta">con acceso</Badge>;
  }
  if (invitacion) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge tone={invitacion.vencida ? "warning" : "info"} title={`Invitación enviada a ${invitacion.email}`}>
          {invitacion.vencida ? "invitación vencida" : "invitación enviada"}
        </Badge>
        <Boton
          variante="fantasma"
          onClick={() => onReenviar(invitacion.id)}
          loading={reenviando === invitacion.id}
          title="Enlace nuevo; el anterior deja de servir"
          aria-label={`Reenviar la invitación de ${proveedor.nombre}`}
        >
          <Send size={13} aria-hidden />
        </Boton>
      </div>
    );
  }
  if (!proveedor.activo) return <span className="font-mono text-[11px] text-text-600">—</span>;
  return (
    <Boton variante="fantasma" onClick={onDarAcceso} title="Invitarlo al portal con su propio usuario">
      <KeyRound size={13} aria-hidden />
      Dar acceso
    </Boton>
  );
}
