"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Cargando } from "@/app/components/ui";
import { esGerenciaPlataforma } from "@/app/components/gerencia";
import { useUsuario } from "@/app/components/usuario-context";

/**
 * Guarda de la sección de plataforma.
 *
 * Es cosmética, igual que la del layout privado: la de verdad la hace el
 * backend, que exige nivel gerencia en cada endpoint de /api/gerencia. Acá
 * solo se evita que alguien que escribió la URL a mano vea una pantalla de
 * errores 403 en vez de un mensaje claro.
 *
 * No redirige de inmediato: `usuario` llega null mientras carga /auth/yo, y
 * mandar a /dashboard en ese hueco echaría al propio equipo cada vez que
 * recarga la página.
 */
export default function GerenciaLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { usuario, loading } = useUsuario();
  const permitido = esGerenciaPlataforma(usuario);

  useEffect(() => {
    if (!loading && usuario && !permitido) router.replace("/dashboard");
  }, [loading, usuario, permitido, router]);

  if (loading || !usuario) return <Cargando texto="verificando nivel de acceso…" />;

  if (!permitido) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldAlert size={22} className="text-text-600" aria-hidden />
        <p className="text-sm text-text-100">Esta sección es del equipo de OperativAI</p>
        <p className="max-w-sm text-xs leading-relaxed text-text-400">
          Tu cuenta administra tu negocio, no la plataforma. Te llevamos de vuelta al
          panel.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
