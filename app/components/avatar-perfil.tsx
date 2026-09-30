"use client";

import { cn } from "@/lib/utils";

/**
 * Foto de perfil redonda, o las iniciales si no hay foto. `src` es la URL
 * blob: que arma useFotoPerfil (lib/foto-perfil.ts).
 */
export function AvatarPerfil({
  src,
  iniciales,
  tamano = 32,
  className,
}: {
  src: string | null;
  iniciales: string;
  tamano?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-bg-700 bg-bg-800 font-medium text-text-400",
        className,
      )}
      style={{ width: tamano, height: tamano, fontSize: Math.max(10, Math.round(tamano * 0.38)) }}
      aria-hidden
    >
      {src ? (
        // blob: local, no una URL remota: next/image no aporta nada acá.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        iniciales
      )}
    </span>
  );
}
