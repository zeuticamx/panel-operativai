"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import type { InvitacionCrearIn, InvitacionCreadaOut, InvitacionOut, RolInvitable } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { Aviso, Boton, Campo, inputClass } from "./ui";

/**
 * Piezas compartidas de las invitaciones al equipo (routers/equipo.py):
 * las usan Vendedores › Equipo (dar acceso a un vendedor) y Preferencias
 * (invitar colaboradores, ver quién tiene acceso).
 */

/** Invitaciones sin aceptar. Solo gerencia: con `habilitado` en false no se pide nada. */
export function useInvitaciones(habilitado: boolean) {
  return useApi<InvitacionOut[]>(habilitado ? "/api/equipo/invitaciones" : null);
}

export async function reenviarInvitacion(id: string): Promise<InvitacionCreadaOut> {
  return apiFetch<InvitacionCreadaOut>(`/api/equipo/invitaciones/${id}/reenviar`, { method: "POST" });
}

export async function revocarInvitacion(id: string): Promise<void> {
  await apiFetch<void>(`/api/equipo/invitaciones/${id}`, { method: "DELETE" });
}

function Marco({
  open,
  onOpenChange,
  titulo,
  sub,
  bloqueado,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titulo: string;
  sub: string;
  bloqueado: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && bloqueado) return;
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-bg-700 bg-bg-900 shadow-xl">
          <header className="flex items-start justify-between gap-3 border-b border-bg-700 px-5 py-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Dialog.Title className="text-sm font-medium text-text-100">{titulo}</Dialog.Title>
              <Dialog.Description className="font-mono text-[11px] text-text-600">{sub}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Boton variante="fantasma" disabled={bloqueado} aria-label="Cerrar" className="min-h-8 shrink-0 px-2">
                <X size={14} aria-hidden />
              </Boton>
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Qué ve cada rol invitado, para el subtítulo del diálogo. */
const ALCANCE_ROL: Record<RolInvitable, string> = {
  member: "ve y atiende el negocio; no cambia la configuración ni los pagos",
  vendedor: "entra a la app de vendedores y ve solo sus clientes",
  proveedor: "ve su agenda y los chats de sus clientes; marca sus descansos y días libres",
};

/**
 * Pide el correo y crea la invitación. Para un vendedor o un proveedor del
 * calendario, la cuenta queda atada a su ficha (`ficha`); para un
 * colaborador, no hay ficha.
 */
export function DialogoInvitar({
  open,
  onOpenChange,
  role,
  ficha,
  onCreada,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  role: RolInvitable;
  ficha?: { id: string; nombre: string };
  onCreada: (invitacion: InvitacionCreadaOut) => void;
}) {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const correo = email.trim().toLowerCase();
  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

  const cerrar = (o: boolean) => {
    if (!o) {
      setEmail("");
      setError(null);
    }
    onOpenChange(o);
  };

  const enviar = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const body: InvitacionCrearIn = {
        email: correo,
        role,
        vendedor_id: role === "vendedor" ? (ficha?.id ?? null) : null,
        proveedor_id: role === "proveedor" ? (ficha?.id ?? null) : null,
      };
      const creada = await apiFetch<InvitacionCreadaOut>("/api/equipo/invitaciones", {
        method: "POST",
        json: body,
      });
      setEmail("");
      onCreada(creada);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo enviar la invitación."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Marco
      open={open}
      onOpenChange={cerrar}
      titulo={ficha ? `Dar acceso a ${ficha.nombre}` : "Invitar colaborador"}
      sub={ALCANCE_ROL[role]}
      bloqueado={enviando}
    >
      <form
        className="flex flex-col gap-4 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo
          id="invitacion-email"
          label="Correo"
          hint="le llega un enlace para que elija su contraseña; tú nunca la ves"
        >
          <input
            id="invitacion-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={enviando}
            maxLength={255}
            placeholder="nombre@correo.com"
            className={inputClass}
            autoFocus
          />
        </Campo>
        <footer className="flex justify-end gap-2 border-t border-bg-700 pt-4">
          <Dialog.Close asChild>
            <Boton variante="secundario" disabled={enviando}>
              Cancelar
            </Boton>
          </Dialog.Close>
          <Boton type="submit" variante="primario" loading={enviando} disabled={!valido}>
            Enviar invitación
          </Boton>
        </footer>
      </form>
    </Marco>
  );
}

/**
 * Resultado de crear o reenviar: el enlace en claro solo viene en esta
 * respuesta, así que se ofrece copiarlo para mandarlo por WhatsApp si el
 * correo no llega.
 */
export function DialogoEnlace({
  invitacion,
  onCerrar,
}: {
  invitacion: InvitacionCreadaOut | null;
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (!invitacion) return;
    try {
      await navigator.clipboard.writeText(invitacion.enlace);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles: el enlace queda seleccionable a mano.
    }
  };

  return (
    <Marco
      open={invitacion !== null}
      onOpenChange={(o) => {
        if (!o) {
          setCopiado(false);
          onCerrar();
        }
      }}
      titulo="Invitación lista"
      sub={invitacion ? `para ${invitacion.email}` : ""}
      bloqueado={false}
    >
      {invitacion && (
        <div className="flex flex-col gap-4 px-5 py-4">
          {invitacion.correo_enviado ? (
            <Aviso tipo="exito">
              Le enviamos el enlace por correo. Si no le llega, mándale este mismo enlace por otro medio.
            </Aviso>
          ) : (
            <Aviso tipo="error">
              No pudimos enviar el correo. Copia el enlace y mándaselo tú (por WhatsApp, por ejemplo).
            </Aviso>
          )}
          <Campo id="invitacion-enlace" label="Enlace de acceso" hint="vence en 7 días y solo sirve una vez">
            <div className="flex gap-2">
              <input
                id="invitacion-enlace"
                readOnly
                value={invitacion.enlace}
                onFocus={(e) => e.currentTarget.select()}
                className={`${inputClass} font-mono text-xs`}
              />
              <Boton variante="secundario" onClick={copiar} className="shrink-0">
                {copiado ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                {copiado ? "Copiado" : "Copiar"}
              </Boton>
            </div>
          </Campo>
          <footer className="flex justify-end border-t border-bg-700 pt-4">
            <Dialog.Close asChild>
              <Boton variante="primario">Listo</Boton>
            </Dialog.Close>
          </footer>
        </div>
      )}
    </Marco>
  );
}
