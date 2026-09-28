"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PLAN_BLOQUEADO_EVENT } from "@/lib/auth";
import { bloqueoDePantalla, bloqueoLocal, herramientaDeRuta } from "@/lib/herramientas-plan";
import type { AccesoPlanOut, BloqueoPlanDetalle, Herramienta } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { BloqueoPlanModal, BloqueoPlanVista, FranjaPlanInactivo } from "./bloqueo-plan";
import { Cargando } from "./ui";

interface PlanCtx {
  /** null mientras carga (o si /pagos/acceso falló: ver `puedeUsar`). */
  acceso: AccesoPlanOut | null;
  cargando: boolean;
  /**
   * Sin datos todavía se responde true: el candado es una ayuda visual, y
   * el backend decide de todas formas. Mejor no tapar nada durante un
   * instante que tapar de más si la consulta falla.
   */
  puedeUsar: (herramienta: Herramienta) => boolean;
  /** Abre el modal de mejora de plan para esa herramienta. */
  abrirBloqueo: (herramienta: Herramienta) => void;
  recargar: () => Promise<void>;
}

const Ctx = createContext<PlanCtx>({
  acceso: null,
  cargando: false,
  puedeUsar: () => true,
  abrirBloqueo: () => {},
  recargar: async () => {},
});

export function usePlan() {
  return useContext(Ctx);
}

/**
 * Carga GET /api/pagos/acceso una vez por layout y lo comparte (el sidebar
 * lo usa para el candado, GuardaPlan para tapar pantallas). Además abre
 * BloqueoPlanModal cuando una acción recibe un 402 del plan en mitad de la
 * sesión (el plan venció con la pantalla abierta, etc.): apiFetch emite
 * PLAN_BLOQUEADO_EVENT y acá se escucha.
 *
 * Nada de esto es la seguridad: el backend rechaza igual cada petición.
 */
export function PlanProvider({ children }: { children: ReactNode }) {
  const api = useApi<AccesoPlanOut>("/api/pagos/acceso");
  const acceso = api.data;
  const { recargar: recargarApi } = api;
  const [modal, setModal] = useState<BloqueoPlanDetalle | null>(null);

  useEffect(() => {
    const alBloquear = (e: Event) => {
      setModal((e as CustomEvent<BloqueoPlanDetalle>).detail);
      // El 402 dice que lo que había cargado ya no vale (p. ej. venció).
      void recargarApi(true);
    };
    window.addEventListener(PLAN_BLOQUEADO_EVENT, alBloquear);
    return () => window.removeEventListener(PLAN_BLOQUEADO_EVENT, alBloquear);
  }, [recargarApi]);

  const puedeUsar = useCallback(
    (h: Herramienta) => acceso === null || acceso.herramientas.includes(h),
    [acceso],
  );

  const abrirBloqueo = useCallback(
    (h: Herramienta) => {
      if (acceso) setModal(bloqueoLocal(acceso, h));
    },
    [acceso],
  );

  const recargar = useCallback(() => recargarApi(true), [recargarApi]);
  const cargando = acceso === null && api.loading;

  return (
    <Ctx.Provider value={{ acceso, cargando, puedeUsar, abrirBloqueo, recargar }}>
      {children}
      <BloqueoPlanModal bloqueo={modal} onCerrar={() => setModal(null)} />
    </Ctx.Provider>
  );
}

/**
 * Va dentro de <main>: la franja de "tu plan no está activo" arriba, y la
 * pantalla — o, si su herramienta está fuera del plan, BloqueoPlanVista en
 * su lugar (lib/herramientas-plan.ts dice qué ruta es qué). La página no se
 * monta, así que no dispara peticiones que solo darían 402.
 */
export function GuardaPlan({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { acceso, cargando } = usePlan();

  // Sin esperar, una pantalla fuera del plan llegaría a montarse (y a pedir
  // sus datos) un instante antes de que la tape la vista de bloqueo.
  if (cargando && herramientaDeRuta(pathname)) return <Cargando />;

  const bloqueo = acceso ? bloqueoDePantalla(acceso, pathname) : null;
  return (
    <>
      {acceso && <FranjaPlanInactivo acceso={acceso} />}
      {bloqueo ? <BloqueoPlanVista bloqueo={bloqueo} /> : children}
    </>
  );
}
