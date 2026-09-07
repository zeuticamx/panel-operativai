"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useUsuarioActual, type UsuarioActualState } from "@/lib/auth";

const Ctx = createContext<UsuarioActualState>({
  usuario: null,
  loading: true,
  error: null,
});

/** Carga GET /api/auth/yo una sola vez por sesión de layout y lo comparte. */
export function UsuarioProvider({ children }: { children: ReactNode }) {
  const state = useUsuarioActual();
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useUsuario() {
  return useContext(Ctx);
}
