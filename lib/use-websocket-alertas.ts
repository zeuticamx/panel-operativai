"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, apiFetch, mensajeDeError } from "./auth";
import { showToast } from "./notificaciones";
import type { AlertaOut } from "./types";

// Cuántas alertas se conservan en memoria durante la sesión. Es un feed en
// vivo, no el historial completo (para eso está GET /tenants/{id}/alertas):
// sin este tope, dejar el panel abierto varias horas iría acumulando la
// lista sin límite.
const MAX_ALERTAS = 50;

export interface UseWebsocketAlertasResult {
  conectado: boolean;
  alertas: AlertaOut[];
  noLeidosCount: number;
  marcarComoLeida: (alertaId: string) => Promise<void>;
}

/**
 * Conecta al WebSocket de alertas (backend/realtime.py) y mantiene un feed
 * en memoria mientras el componente está montado.
 *
 * El servidor decide a qué tenant pertenece la conexión a partir del JWT
 * (ver realtime.connect), no de lo que mande el cliente — `tenantId` acá
 * solo se usa para no conectar hasta que el usuario ya cargó y sepa a qué
 * negocio pertenece, no para "suscribirse": eso sería confiar en el
 * cliente para algo que ya lo valida el servidor.
 */
export function useWebsocketAlertas(
  tenantId: string | null,
  token: string | null,
): UseWebsocketAlertasResult {
  const [conectado, setConectado] = useState(false);
  const [alertas, setAlertas] = useState<AlertaOut[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // El token vive en un ref y no en las dependencias del efecto de conexión:
  // el access token se renueva cada ~60 minutos (ver lib/auth.ts) y no hace
  // falta cerrar una conexión que sigue viva solo porque cambió. La función
  // `auth` de socket.io-client se vuelve a llamar en cada intento de
  // reconexión, así que el siguiente intento ya usa el token nuevo.
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!tenantId || !tokenRef.current) {
      setConectado(false);
      return;
    }

    const socket = io(API_URL, {
      auth: (cb) => cb({ token: tokenRef.current }),
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConectado(true));
    socket.on("disconnect", () => setConectado(false));
    // Conexión rechazada (token inválido/expirado sin refresh posible): no
    // tiene sentido que socket.io siga reintentando solo, así que se apaga.
    socket.on("connect_error", () => {
      setConectado(false);
      socket.disconnect();
    });

    // Las últimas no leídas que el servidor manda al conectar, para no
    // arrancar con el feed vacío si ya había alertas pendientes.
    socket.on("alertas_pendientes", (pendientes: AlertaOut[]) => {
      setAlertas((actual) => {
        const ids = new Set(actual.map((a) => a.id));
        const nuevas = pendientes.filter((a) => !ids.has(a.id));
        return [...nuevas, ...actual].slice(0, MAX_ALERTAS);
      });
    });

    socket.on("nueva_alerta", (alerta: AlertaOut) => {
      setAlertas((actual) => [alerta, ...actual].slice(0, MAX_ALERTAS));
      showToast(alerta.titulo, alerta.mensaje, alerta.tipo);
    });

    // Alguien marcó una alerta leída desde otra pestaña/sesión del mismo
    // negocio: se refleja acá sin esperar a que este cliente haga el PATCH.
    socket.on("alerta_leida", ({ alerta_id }: { alerta_id: string }) => {
      setAlertas((actual) =>
        actual.map((a) => (a.id === alerta_id ? { ...a, leido: true } : a)),
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConectado(false);
    };
  }, [tenantId]);

  const marcarComoLeida = useCallback(async (alertaId: string) => {
    // Optimista: la UI no espera la respuesta para dejar de mostrarla como
    // no leída. Si el PATCH falla se revierte.
    setAlertas((actual) =>
      actual.map((a) => (a.id === alertaId ? { ...a, leido: true } : a)),
    );
    try {
      await apiFetch(`/api/alertas/${alertaId}/marcar-leida`, { method: "PATCH" });
    } catch (e) {
      setAlertas((actual) =>
        actual.map((a) => (a.id === alertaId ? { ...a, leido: false } : a)),
      );
      throw new Error(mensajeDeError(e, "No se pudo marcar la alerta como leída."));
    }
  }, []);

  const noLeidosCount = useMemo(() => alertas.filter((a) => !a.leido).length, [alertas]);

  return { conectado, alertas, noLeidosCount, marcarComoLeida };
}
