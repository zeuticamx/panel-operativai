"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Casilla "Acepto los Términos y Condiciones" con enlaces a las páginas
 * legales del portal. Compartida por /registro y por el paso de aceptación
 * de /login.
 *
 * Los enlaces abren en otra pestaña a propósito: leer los términos no puede
 * costar lo que ya se escribió en el formulario. La validación real es la
 * del backend (`acepta_terminos`); esto solo evita mandar de más.
 */
export function AceptarTerminos({
  checked,
  onChange,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor="acepta-terminos"
      className={cn(
        "flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-text-400",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        id="acepta-terminos"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        required
        className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer accent-text-100"
      />
      <span>
        Acepto los{" "}
        <Link
          href="/condiciones"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-100 underline underline-offset-2"
        >
          Términos y Condiciones
        </Link>{" "}
        y el{" "}
        <Link
          href="/privacidad"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-100 underline underline-offset-2"
        >
          Aviso de privacidad
        </Link>
      </span>
    </label>
  );
}
