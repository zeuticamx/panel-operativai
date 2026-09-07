"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi, type UseApiState } from "@/lib/use-api";
import type { ServiciosOut, UsuarioOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Aviso, Boton } from "./ui";
import { useUsuario } from "./usuario-context";

/** Quién puede cambiar la configuración del negocio (espejo de deps.ROLES_GERENCIA). */
export function esGerencia(usuario: UsuarioOut | null): boolean {
  return usuario?.role === "owner" || usuario?.role === "superadmin";
}

/**
 * Flags de servicio del negocio actual. `tenantId` viene del usuario en
 * sesión; hasta que carga, `path` es null y no se pide nada.
 */
export function useServicios(): UseApiState<ServiciosOut> & { tenantId: string | null } {
  const { usuario } = useUsuario();
  const tenantId = usuario?.tenant_id ?? null;
  const api = useApi<ServiciosOut>(tenantId ? `/api/tenants/${tenantId}/servicios` : null);
  return { ...api, tenantId };
}

// ------------------------------------------------------------
// Pestañas de la sección
// ------------------------------------------------------------
const TABS = [
  { href: "/vendedores", label: "Embudo", exacto: true },
  { href: "/vendedores/equipo", label: "Equipo y reparto", exacto: false },
];

export function VendedoresTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1" aria-label="Secciones de vendedores">
      {TABS.map((t) => {
        const activo = t.exacto ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium",
              activo
                ? "bg-bg-800 text-text-100"
                : "text-text-400 hover:bg-bg-800 hover:text-text-100",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ------------------------------------------------------------
// Estado vacío cuando el módulo está apagado
// ------------------------------------------------------------
export function ModuloApagado({
  tenantId,
  onActivado,
}: {
  tenantId: string;
  onActivado: () => void;
}) {
  const { usuario } = useUsuario();
  const gerencia = esGerencia(usuario);
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activar = async () => {
    setActivando(true);
    setError(null);
    try {
      await apiFetch<ServiciosOut>(`/api/tenants/${tenantId}/servicios`, {
        method: "PATCH",
        json: { gestion_vendedores_activo: true },
      });
      onActivado();
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo activar el módulo."));
    } finally {
      setActivando(false);
    }
  };

  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-md border border-dashed border-bg-700 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-md border border-bg-700 bg-bg-800 text-text-400">
        <Users size={20} aria-hidden />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-text-100">
          Gestión de vendedores desactivada
        </p>
        <p className="text-xs leading-relaxed text-text-400">
          Con este módulo cada cliente que escribe entra a un embudo de venta y se reparte
          entre tu equipo. Aquí ves el embudo completo, cuánto tarda cada etapa y quién
          cierra más. Funciona con o sin el agente de IA.
        </p>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {gerencia ? (
        <Boton variante="primario" onClick={activar} loading={activando}>
          Activar módulo
        </Boton>
      ) : (
        <p className="font-mono text-[11px] text-text-600">
          solo el dueño del negocio puede activarlo
        </p>
      )}
    </section>
  );
}
