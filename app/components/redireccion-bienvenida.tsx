"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CLAVE_BIENVENIDA_MOSTRADA, debeIrABienvenida } from "@/lib/onboarding";
import { useUsuario } from "./usuario-context";

function leerMostrada(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_BIENVENIDA_MOSTRADA) === "1";
  } catch {
    return false;
  }
}

function marcarMostrada(): void {
  try {
    sessionStorage.setItem(CLAVE_BIENVENIDA_MOSTRADA, "1");
  } catch {
    // Sin storage (modo privado estricto): a lo sumo se vuelve a mostrar.
  }
}

/**
 * Lleva a una cuenta nueva al cuestionario de bienvenida la primera vez que
 * aterriza en el dashboard. No dibuja nada.
 */
export function RedireccionBienvenida() {
  const { usuario } = useUsuario();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!debeIrABienvenida(usuario, pathname, leerMostrada())) return;
    marcarMostrada();
    router.replace("/bienvenida");
  }, [usuario, pathname, router]);

  return null;
}
