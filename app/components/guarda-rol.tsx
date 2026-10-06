"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { inicioDeRol, puedeVerRuta } from "@/lib/roles";
import { Cargando } from "./ui";
import { useUsuario } from "./usuario-context";

/**
 * Manda a cada rol a su inicio si abre una pantalla que no le toca (un
 * vendedor que escribe /conversaciones, o que entra por /dashboard después
 * del login). Cosmética, como GuardaPlan: el backend responde 403 igual.
 *
 * Mientras carga /auth/yo no decide nada: con `usuario` en null todavía no
 * se sabe el rol, y redirigir en ese hueco sacaría a gerencia de la página
 * en cada recarga.
 */
export function GuardaRol({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { usuario } = useUsuario();
  const permitido = puedeVerRuta(usuario, pathname);

  useEffect(() => {
    if (usuario && !permitido) router.replace(inicioDeRol(usuario));
  }, [usuario, permitido, router]);

  if (!permitido) return <Cargando />;
  return <>{children}</>;
}
