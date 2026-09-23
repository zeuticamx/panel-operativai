"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { EstadoTenantPlataforma, FuenteTipoCambio, UsuarioOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "./badge";
import { selectClass } from "./ui";

/**
 * Nivel gerencia de plataforma (tabla gerencia_users del backend).
 *
 * No confundir con `esGerencia` de modulo-vendedores.tsx: aquella pregunta
 * si el usuario manda dentro de SU negocio (role owner/superadmin); esta,
 * si es del equipo de OperativAI y ve todos los negocios. Son dos niveles
 * distintos y un owner cualquiera no pasa esta.
 */
export function esGerenciaPlataforma(usuario: UsuarioOut | null): boolean {
  return usuario?.es_gerencia_plataforma === true;
}

// ------------------------------------------------------------
// Pestañas
// ------------------------------------------------------------
const TABS = [
  { href: "/gerencia", label: "Resumen", exacto: true },
  { href: "/gerencia/salud", label: "Salud", exacto: false },
  { href: "/gerencia/tenants", label: "Negocios", exacto: false },
  { href: "/gerencia/planes", label: "Planes", exacto: false },
  { href: "/gerencia/consumo", label: "Consumo", exacto: false },
  { href: "/gerencia/cohortes", label: "Retención", exacto: false },
  { href: "/gerencia/auditoria", label: "Bitácora", exacto: false },
  { href: "/gerencia/equipo", label: "Equipo", exacto: false },
];

export function GerenciaTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Secciones de plataforma">
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
// Estado del negocio
// ------------------------------------------------------------
export const ESTADO_TENANT_INFO: Record<
  EstadoTenantPlataforma,
  { label: string; tone: BadgeTone }
> = {
  activo: { label: "activo", tone: "success" },
  prueba: { label: "prueba", tone: "info" },
  suspendido: { label: "suspendido", tone: "danger" },
  baja: { label: "baja", tone: "neutral" },
};

export const ESTADOS_TENANT: EstadoTenantPlataforma[] = [
  "activo",
  "prueba",
  "suspendido",
  "baja",
];

export function EstadoTenantBadge({
  estado,
  motivo,
}: {
  estado: EstadoTenantPlataforma;
  motivo?: string | null;
}) {
  const info = ESTADO_TENANT_INFO[estado];
  return (
    <Badge tone={info.tone} title={motivo ?? undefined}>
      {info.label}
    </Badge>
  );
}

// ------------------------------------------------------------
// Formato
// ------------------------------------------------------------
const fmtCompacto = new Intl.NumberFormat("es-MX", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Tokens en forma corta (1.2M, 340k). Una tabla de treinta negocios con
 * siete dígitos por celda no se lee; el valor exacto va en el `title`.
 */
export function fmtTokens(n: number): string {
  return n < 1000 ? String(n) : fmtCompacto.format(n);
}

/**
 * Costo del proveedor del modelo. Cuatro decimales y no dos: los importes
 * de un solo negocio en un día son de centésimas de dólar, y redondear a
 * centavos los dejaría todos en 0.00.
 */
export function fmtCostoUsd(valor: string | number): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(n >= 100 ? 2 : 4)}`;
}

// ------------------------------------------------------------
// Ventana de tiempo
// ------------------------------------------------------------
export const OPCIONES_DIAS = [7, 30, 90, 365];

export function SelectorDias({
  dias,
  onChange,
  disabled = false,
}: {
  dias: number;
  onChange: (dias: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-text-400">
      <span className="sr-only">Ventana de tiempo</span>
      <select
        value={dias}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(selectClass, "w-auto py-1 text-xs")}
      >
        {OPCIONES_DIAS.map((d) => (
          <option key={d} value={d}>
            {d === 365 ? "último año" : `últimos ${d} días`}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Margen en la moneda de cobro. null = no hay tipo de cambio con el que
 * convertir el costo (ver FUENTE_TIPO_CAMBIO_INFO); se muestra como raya.
 */
export function fmtMargen(valor: string | null, formato: (v: string) => string): string {
  return valor === null ? "—" : formato(valor);
}

/**
 * De dónde salió el tipo de cambio, para mostrar en el panel de dónde sale
 * el número y no solo si hay uno. Espejo de
 * backend/services/banxico.FuenteTipoCambio.
 */
export const FUENTE_TIPO_CAMBIO_INFO: Record<
  FuenteTipoCambio,
  { label: string; detalle: string }
> = {
  banxico: {
    label: "Banxico (FIX)",
    detalle: "Tipo de cambio FIX oficial del día, del SIE API de Banxico.",
  },
  manual: {
    label: "manual",
    detalle: "TIPO_CAMBIO_USD configurado a mano en el backend.",
  },
  moneda_usd: {
    label: "sin conversión",
    detalle: "La moneda de cobro ya es USD, no hace falta convertir.",
  },
  ninguno: {
    label: "sin configurar",
    detalle:
      "Sin BANXICO_TOKEN ni TIPO_CAMBIO_USD en el backend: el costo de modelos está en USD " +
      "y no se puede restar del ingreso.",
  },
};
