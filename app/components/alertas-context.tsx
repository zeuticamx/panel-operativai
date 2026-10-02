"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import {
  transferenciasPendientes,
  useWebsocketAlertas,
  type UseWebsocketAlertasResult,
} from "@/lib/use-websocket-alertas";
import { useUsuario } from "./usuario-context";

const VACIO: UseWebsocketAlertasResult = {
  conectado: false,
  alertas: [],
  noLeidosCount: 0,
  marcarComoLeida: async () => {},
};

const Ctx = createContext<UseWebsocketAlertasResult>(VACIO);

/**
 * Abre una sola conexión de WebSocket por sesión y la comparte, igual que
 * `UsuarioProvider` con GET /auth/yo.
 *
 * La campana (`CentroNotificaciones`) se dibuja dentro del header de cada
 * página, así que se monta y desmonta en cada navegación. Si el hook viviera
 * ahí, cada cambio de pantalla cerraría el socket y abriría otro; y si la
 * campana llegara a dibujarse en dos lugares a la vez, serían dos sockets
 * del mismo negocio y cada alerta saldría dos veces en un toast. Con el
 * estado acá arriba, la campana es solo la parte visual.
 */
export function AlertasProvider({ children }: { children: ReactNode }) {
  const { usuario } = useUsuario();
  const estado = useWebsocketAlertas(usuario?.tenant_id ?? null, getAccessToken());
  const pathname = usePathname();
  const { alertas, marcarComoLeida } = estado;

  // Abrir la conversación transferida es "atenderla": se marca leída para que
  // el badge del sidebar baje solo, sin que haya que ir a la campana.
  useEffect(() => {
    const m = pathname.match(/^\/conversaciones\/([^/]+)$/);
    if (!m) return;
    const id = decodeURIComponent(m[1]);
    for (const a of transferenciasPendientes(alertas)) {
      if (a.datos?.conversation_id === id) marcarComoLeida(a.id).catch(() => {});
    }
  }, [pathname, alertas, marcarComoLeida]);

  return <Ctx.Provider value={estado}>{children}</Ctx.Provider>;
}

export function useAlertas(): UseWebsocketAlertasResult {
  return useContext(Ctx);
}
