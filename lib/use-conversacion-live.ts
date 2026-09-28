"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, getAccessToken } from "./auth";

/**
 * Refresco en vivo de una conversación (handoff humano): mensaje manual
 * entrante/saliente o cambio de estado (transferred <-> active).
 *
 * Mismo patrón de conexión que use-websocket-alertas.ts (token en `auth`,
 * reconexión automática de socket.io-client), pero sin mantener un feed en
 * memoria acá: en vez de mergear el evento a mano, simplemente dispara
 * `onEvento` (típicamente `recargar(true)` de useApi) y deja que el GET de
 * siempre traiga el estado consistente — volumen bajo por naturaleza (un
 * handoff humano no genera decenas de mensajes por segundo), así que el
 * viaje de más no pesa.
 *
 * `tenantIdPlataforma` solo aplica a gerencia de plataforma viendo la
 * conversación de un negocio que no es el suyo: sin esto, el socket nunca
 * está en la room de ese tenant y no vería nada (ver realtime.ver_tenant).
 */
export function useConversacionLive(
  conversacionId: string | null,
  onEvento: () => void,
  tenantIdPlataforma?: string | null,
) {
  const socketRef = useRef<Socket | null>(null);
  const onEventoRef = useRef(onEvento);
  useEffect(() => {
    onEventoRef.current = onEvento;
  }, [onEvento]);

  useEffect(() => {
    const token = getAccessToken();
    if (!conversacionId || !token) return;

    const socket = io(API_URL, {
      auth: (cb) => cb({ token }),
      transports: ["websocket"],
    });
    socketRef.current = socket;

    if (tenantIdPlataforma) {
      socket.on("connect", () => {
        socket.emit("ver_tenant", { tenant_id: tenantIdPlataforma });
      });
    }

    const alEvento = (data: { conversation_id: string }) => {
      if (data.conversation_id === conversacionId) onEventoRef.current();
    };
    socket.on("mensaje_nuevo", alEvento);
    socket.on("conversacion_actualizada", alEvento);

    return () => {
      if (tenantIdPlataforma) socket.emit("dejar_tenant", { tenant_id: tenantIdPlataforma });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversacionId, tenantIdPlataforma]);
}
