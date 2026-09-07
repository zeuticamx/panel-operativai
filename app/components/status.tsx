import type { SVGProps } from "react";
import { etiquetaCanal } from "@/lib/formato";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------
// Estado de conversación. El backend solo garantiza "active" hoy;
// cualquier otro valor se muestra tal cual en tono neutro.
// ------------------------------------------------------------
const ESTADOS: Record<string, { color: string; label: string }> = {
  active: { color: "var(--success)", label: "Activa" },
};

function infoEstado(status: string) {
  return ESTADOS[status] ?? { color: "var(--text-600)", label: status };
}

export function StatusDot({ status }: { status: string }) {
  return (
    <span
      aria-hidden
      className="h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: infoEstado(status).color }}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const info = infoEstado(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-xs"
      style={{ color: info.color }}
    >
      <StatusDot status={status} />
      {info.label}
    </span>
  );
}

// ------------------------------------------------------------
// Iconos de canal. lucide-react v1 ya no trae iconos de marca, así
// que van inline: trazo 2px sobre viewBox 24, misma familia visual.
// ------------------------------------------------------------
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 14, className, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
    ...rest,
  };
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function GenericChannelIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

const CANAL_ICON: Record<string, (p: IconProps) => React.JSX.Element> = {
  whatsapp: WhatsAppIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
};

export function CanalIcon({
  tipo,
  size = 14,
  className,
}: {
  tipo: string;
  size?: number;
  className?: string;
}) {
  const Icon = CANAL_ICON[tipo] ?? GenericChannelIcon;
  return <Icon size={size} className={className} />;
}

export function CanalBadge({ tipo, className }: { tipo: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[11px] text-text-400",
        className,
      )}
    >
      <CanalIcon tipo={tipo} size={12} />
      {etiquetaCanal(tipo)}
    </span>
  );
}
