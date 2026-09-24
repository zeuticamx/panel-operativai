"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import type { ServiciosOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Aviso, Boton } from "./ui";
import { esGerencia } from "./modulo-vendedores";
import { useUsuario } from "./usuario-context";

// ------------------------------------------------------------
// Pestañas de la sección
// ------------------------------------------------------------
const TABS = [
  { href: "/calendario", label: "Agenda", exacto: true },
  { href: "/calendario/proveedores", label: "Proveedores", exacto: false },
  { href: "/calendario/servicios", label: "Servicios", exacto: false },
  { href: "/calendario/corte-diario", label: "Corte diario", exacto: false },
  { href: "/calendario/auditoria", label: "Bitácora", exacto: false },
];

export function CalendarioTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1" aria-label="Secciones de calendario">
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
export function ModuloCalendarioApagado({
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
        json: { calendario_activo: true },
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
        <CalendarDays size={20} aria-hidden />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-text-100">Calendario desactivado</p>
        <p className="text-xs leading-relaxed text-text-400">
          Con este módulo tus clientes pueden reservar citas por WhatsApp/Instagram/Facebook
          y tú ves aquí la agenda completa de tus proveedores: horarios, servicios y reservas
          en un solo lugar.
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
