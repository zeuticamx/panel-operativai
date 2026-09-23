"use client";

import { useEffect, useState } from "react";
import { Eye, LogOut } from "lucide-react";
import { terminarVerComo } from "@/lib/auth";
import { useUsuario } from "./usuario-context";

/**
 * Aviso permanente mientras alguien de plataforma ve el portal como un
 * negocio. No se puede cerrar: es lo único que distingue esta sesión de la
 * del dueño, y olvidarse de en qué portal está uno es exactamente el
 * error que tiene que evitar.
 *
 * Al salir se recarga la página entera en vez de navegar: todo lo que se
 * cargó con la identidad del negocio (usuario, alertas, socket) tiene que
 * volver a pedirse con la del gerente.
 */
export function BannerVerComo() {
  const { usuario } = useUsuario();
  const expira = usuario?.impersonacion_expira ?? null;
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!expira) return;
    const id = setInterval(() => setAhora(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [expira]);

  const minutos = expira
    ? Math.max(0, Math.ceil((new Date(expira).getTime() - ahora) / 60_000))
    : 0;

  // Vencido: se sale solo. Esperar al próximo 401 dejaría la pantalla
  // mostrando datos viejos como si la sesión siguiera viva.
  useEffect(() => {
    if (expira && minutos === 0) window.location.replace(terminarVerComo());
  }, [expira, minutos]);

  if (!usuario?.impersonado_por) return null;

  const salir = () => window.location.replace(terminarVerComo());

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning/40 bg-warning/15 px-4 py-2 text-xs text-text-100"
    >
      <Eye size={14} className="shrink-0 text-warning" aria-hidden />
      <span className="min-w-0 flex-1">
        Viendo como <strong>{usuario.nombre_negocio ?? "este negocio"}</strong>{" "}
        <span className="font-mono text-text-400">({usuario.email})</span> · solo lectura ·{" "}
        <span className="font-mono text-text-400">
          {minutos} min restantes · abierto por {usuario.impersonado_por}
        </span>
      </span>
      <button
        type="button"
        onClick={salir}
        className="flex cursor-pointer items-center gap-1.5 rounded border border-warning/50 px-2 py-1 font-medium hover:bg-warning/20"
      >
        <LogOut size={12} aria-hidden />
        Volver a plataforma
      </button>
    </div>
  );
}
