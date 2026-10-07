"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { API_URL, apiFetch, mensajeDeError } from "./auth";
import { showToast } from "./notificaciones";
import type { AlertaOut } from "./types";

/**
 * A dónde manda una alerta al hacerle clic (centro de notificaciones o
 * botón "Ver detalle" del toast) — historia de notificaciones en tiempo
 * real, escenario 3. "reserva_creada" trae `hora_inicio` en `datos` (ver
 * routers/eventos.py::calendario_crear_reserva); "conversacion_transferida"
 * trae `conversation_id` (ver routers/eventos.py::conversacion_transferida).
 * El resto de los tipos de alerta no navega a ningún lado en particular.
 */
export function rutaParaAlerta(alerta: AlertaOut): string | null {
  if (alerta.tipo === "perfil_incompleto") return "/preferencias";

  // Solo le llega al vendedor dueño del pendiente (services/agenda.py): su
  // agenda vive en /mi-cartera, abierta en la semana de la fecha nueva.
  if (alerta.tipo === "agenda_reprogramada") {
    const fecha = alerta.datos?.fecha_nueva;
    if (typeof fecha !== "string") return "/mi-cartera";
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return "/mi-cartera";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `/mi-cartera?fecha=${y}-${m}-${dia}`;
  }

  if (alerta.tipo === "conversacion_transferida") {
    const conversationId = alerta.datos?.conversation_id;
    if (typeof conversationId !== "string") return null;
    return `/conversaciones/${conversationId}`;
  }

  if (alerta.tipo !== "reserva_creada") return null;
  const reservaId = alerta.datos?.reserva_id;
  const horaInicio = alerta.datos?.hora_inicio;
  if (typeof reservaId !== "string" || typeof horaInicio !== "string") return null;

  const d = new Date(horaInicio);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `/calendario?fecha=${y}-${m}-${dia}&reserva=${reservaId}`;
}

/** "14:32" en la hora del navegador; vacío si la fecha no es válida. */
export function horaDeAlerta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

/** Alertas de conversaciones transferidas que nadie ha atendido todavía. */
export function transferenciasPendientes(alertas: AlertaOut[]): AlertaOut[] {
  return alertas.filter((a) => a.tipo === "conversacion_transferida" && !a.leido);
}

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
  const router = useRouter();

  // El handler de "nueva_alerta" vive dentro de un efecto que no depende de
  // `router` (más abajo no puede: reabriría el socket en cada navegación),
  // así que la referencia de router viaja por ref, igual que el token.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

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
      // El recordatorio de perfil reemplaza al del día anterior (el backend
      // borra el viejo): acá también, para que no queden los dos en el feed.
      setAlertas((actual) =>
        [
          alerta,
          ...(alerta.tipo === "perfil_incompleto"
            ? actual.filter((a) => a.tipo !== "perfil_incompleto")
            : actual),
        ].slice(0, MAX_ALERTAS),
      );
      const ruta = rutaParaAlerta(alerta);
      const transferida = alerta.tipo === "conversacion_transferida";
      showToast(
        alerta.titulo,
        transferida ? `${alerta.mensaje} · ${horaDeAlerta(alerta.creado_en)}` : alerta.mensaje,
        alerta.tipo,
        ruta
          ? {
              label: transferida ? "Atender" : "Ver detalle",
              onClick: () => routerRef.current.push(ruta),
            }
          : undefined,
      );
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
