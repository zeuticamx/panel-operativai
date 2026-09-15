"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getAccessToken } from "@/lib/auth";
import {
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
  return <Ctx.Provider value={estado}>{children}</Ctx.Provider>;
}

export function useAlertas(): UseWebsocketAlertasResult {
  return useContext(Ctx);
}
