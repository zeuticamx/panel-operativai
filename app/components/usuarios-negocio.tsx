"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, Trash2, UserPlus, UserRound } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { formatoFechaHora, tiempoRelativo } from "@/lib/formato";
import { etiquetaRol } from "@/lib/roles";
import type {
  InvitacionCreadaOut,
  InvitacionOut,
  UsuarioEquipoActualizarIn,
  UsuarioEquipoOut,
} from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import {
  DialogoEnlace,
  DialogoInvitar,
  reenviarInvitacion,
  revocarInvitacion,
  useInvitaciones,
} from "./invitaciones";
import { Aviso, Boton, ConfirmDialog } from "./ui";

/** Roles cuyo acceso maneja el dueño desde acá (espejo de deps.ROLES_INVITABLES). */
const INVITABLES = new Set(["member", "vendedor", "proveedor"]);

/**
 * Quién entra al portal (y a la app de vendedores) en nombre del negocio.
 * Solo gerencia: Preferencias la monta con esGerencia, y routers/equipo.py
 * responde 403 a cualquier otro.
 *
 * A un colaborador se lo invita desde acá. A un vendedor, desde
 * Vendedores › Equipo, y a un proveedor del calendario, desde Calendario ›
 * Proveedores: su cuenta va atada a su ficha.
 */
export function UsuariosNegocio({ soloLectura = false }: { soloLectura?: boolean }) {
  const usuarios = useApi<UsuarioEquipoOut[]>("/api/equipo/usuarios");
  const invitaciones = useInvitaciones(true);

  const [invitando, setInvitando] = useState(false);
  const [enlace, setEnlace] = useState<InvitacionCreadaOut | null>(null);
  const [aQuitar, setAQuitar] = useState<UsuarioEquipoOut | null>(null);
  const [aRevocar, setARevocar] = useState<InvitacionOut | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cambiarAcceso = async (u: UsuarioEquipoOut, activo: boolean) => {
    setError(null);
    setOcupado(u.id);
    try {
      const body: UsuarioEquipoActualizarIn = { activo };
      await apiFetch<UsuarioEquipoOut>(`/api/equipo/usuarios/${u.id}`, { method: "PATCH", json: body });
      await usuarios.recargar(true);
      setAQuitar(null);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo cambiar el acceso."));
    } finally {
      setOcupado(null);
    }
  };

  const reenviar = async (inv: InvitacionOut) => {
    setError(null);
    setOcupado(inv.id);
    try {
      setEnlace(await reenviarInvitacion(inv.id));
      await invitaciones.recargar(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo reenviar la invitación."));
    } finally {
      setOcupado(null);
    }
  };

  const revocar = async () => {
    if (!aRevocar) return;
    setError(null);
    setOcupado(aRevocar.id);
    try {
      await revocarInvitacion(aRevocar.id);
      await invitaciones.recargar(true);
      setARevocar(null);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo anular la invitación."));
    } finally {
      setOcupado(null);
    }
  };

  const lista = usuarios.data ?? [];
  const pendientes = invitaciones.data ?? [];

  return (
    <section
      data-tour="preferencias.usuarios"
      className="flex flex-col gap-3 rounded-md border border-bg-700 bg-bg-900 p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-text-100">Usuarios del negocio</h2>
          <p className="font-mono text-[11px] text-text-600">
            cada quien entra con su correo y su contraseña
          </p>
        </div>
        <Boton variante="secundario" onClick={() => setInvitando(true)} disabled={soloLectura}>
          <UserPlus size={13} aria-hidden />
          Invitar colaborador
        </Boton>
      </header>

      <p className="text-xs leading-relaxed text-text-400">
        Un <span className="text-text-100">colaborador</span> ve y atiende conversaciones, el embudo y
        la agenda, pero no cambia la configuración ni los pagos. A los{" "}
        <span className="text-text-100">vendedores</span> se les da acceso desde{" "}
        <Link href="/vendedores/equipo" className="underline underline-offset-2">
          Vendedores › Equipo
        </Link>
        , y a los <span className="text-text-100">proveedores</span> de tu agenda desde{" "}
        <Link href="/calendario/proveedores" className="underline underline-offset-2">
          Calendario › Proveedores
        </Link>
        : cada uno ve solo lo suyo.
      </p>

      {(error || usuarios.error) && <Aviso tipo="error">{error ?? usuarios.error}</Aviso>}

      {usuarios.loading && !usuarios.data ? (
        <p className="font-mono text-xs text-text-600">cargando…</p>
      ) : (
        <ul className="flex flex-col divide-y divide-bg-700 rounded-md border border-bg-700">
          {lista.map((u) => {
            const manejable = INVITABLES.has(u.role) && !u.es_tu_cuenta;
            return (
              <li
                key={u.id}
                className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5", !u.activo && "opacity-60")}
              >
                <UserRound size={16} className="shrink-0 text-text-400" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm text-text-100">
                      {u.vendedor_nombre ?? u.proveedor_nombre ?? u.nombre ?? u.email}
                    </span>
                    <Badge>{etiquetaRol(u.role).toLowerCase()}</Badge>
                    {u.es_tu_cuenta && <Badge tone="info">tú</Badge>}
                    {!u.activo && <Badge tone="warning">sin acceso</Badge>}
                  </div>
                  <span className="truncate font-mono text-[11px] text-text-600">
                    {u.email}
                    {u.ultimo_acceso
                      ? ` · último acceso ${formatoFechaHora(u.ultimo_acceso)}`
                      : " · todavía no entra"}
                  </span>
                </div>
                {manejable && (
                  <Boton
                    variante="fantasma"
                    loading={ocupado === u.id}
                    disabled={soloLectura}
                    onClick={() => (u.activo ? setAQuitar(u) : void cambiarAcceso(u, true))}
                  >
                    {u.activo ? "Quitar acceso" : "Devolver acceso"}
                  </Boton>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pendientes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-mono text-[11px] tracking-wider text-text-600 uppercase">
            Invitaciones sin aceptar
          </h3>
          <ul className="flex flex-col divide-y divide-bg-700 rounded-md border border-dashed border-bg-700">
            {pendientes.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm text-text-100">{inv.email}</span>
                    <Badge>{etiquetaRol(inv.role).toLowerCase()}</Badge>
                    {inv.vencida && <Badge tone="warning">vencida</Badge>}
                  </div>
                  <span className="font-mono text-[11px] text-text-600">
                    {(inv.vendedor_nombre ?? inv.proveedor_nombre) &&
                      `ficha de ${inv.vendedor_nombre ?? inv.proveedor_nombre} · `}
                    enviada {tiempoRelativo(inv.creada_en)}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Boton
                    variante="fantasma"
                    onClick={() => reenviar(inv)}
                    loading={ocupado === inv.id}
                    disabled={soloLectura}
                    title="Enlace nuevo; el anterior deja de servir"
                  >
                    <Send size={13} aria-hidden />
                    Reenviar
                  </Boton>
                  <Boton
                    variante="fantasma"
                    onClick={() => setARevocar(inv)}
                    disabled={soloLectura || ocupado === inv.id}
                    aria-label={`Anular la invitación a ${inv.email}`}
                    title="Anular invitación"
                  >
                    <Trash2 size={13} aria-hidden />
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DialogoInvitar
        open={invitando}
        onOpenChange={setInvitando}
        role="member"
        onCreada={(inv) => {
          setInvitando(false);
          setEnlace(inv);
          void invitaciones.recargar(true);
        }}
      />
      <DialogoEnlace invitacion={enlace} onCerrar={() => setEnlace(null)} />

      <ConfirmDialog
        open={aQuitar !== null}
        onOpenChange={(o) => {
          if (!o && ocupado !== aQuitar?.id) setAQuitar(null);
        }}
        titulo={`¿Quitarle el acceso a ${aQuitar?.vendedor_nombre ?? aQuitar?.proveedor_nombre ?? aQuitar?.nombre ?? aQuitar?.email ?? ""}?`}
        descripcion={
          aQuitar?.role === "vendedor"
            ? "Deja de poder entrar desde su siguiente acción. Su ficha sigue activa: conserva sus clientes y sigue recibiendo leads. Para sacarlo del reparto, desactívalo en Vendedores › Equipo."
            : aQuitar?.role === "proveedor"
              ? "Deja de poder entrar desde su siguiente acción. Sigue en tu agenda recibiendo citas; para sacarlo, desactívalo en Calendario › Proveedores."
              : "Deja de poder entrar desde su siguiente acción. Puedes devolverle el acceso cuando quieras."
        }
        confirmar="Quitar acceso"
        peligro
        loading={ocupado === aQuitar?.id}
        onConfirm={() => (aQuitar ? cambiarAcceso(aQuitar, false) : undefined)}
      />

      <ConfirmDialog
        open={aRevocar !== null}
        onOpenChange={(o) => {
          if (!o && ocupado !== aRevocar?.id) setARevocar(null);
        }}
        titulo="¿Anular la invitación?"
        descripcion={`El enlace que le llegó a ${aRevocar?.email ?? ""} deja de servir.`}
        confirmar="Anular"
        peligro
        loading={ocupado === aRevocar?.id}
        onConfirm={revocar}
      />
    </section>
  );
}
