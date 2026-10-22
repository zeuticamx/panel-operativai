"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { selectClass } from "@/app/components/ui";

export type CampoFiltro = {
  id: string;
  label: string;
  /** Texto de la opción vacía ("Todos los canales"). */
  todas: string;
  value: string;
  onChange: (v: string) => void;
  opciones: { value: string; label: string }[];
};

/**
 * Barra de filtros compacta: una fila con búsqueda + botón "Filtros" (con
 * contador) y un panel plegable con los selects en cuadrícula. Cerrado, los
 * filtros activos se ven como chips que se quitan de uno en uno, así la lista
 * conserva casi todo el alto de la pantalla, sobre todo en móvil.
 */
export function FiltrosConversaciones({
  buscar,
  onBuscar,
  campos,
  onLimpiar,
}: {
  buscar: string;
  onBuscar: (v: string) => void;
  campos: CampoFiltro[];
  onLimpiar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);

  const activos = campos.filter((c) => c.value);
  const hayFiltros = activos.length > 0 || Boolean(buscar);

  return (
    <div className="border-b border-bg-700 bg-bg-900 px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={13}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-600"
            aria-hidden
          />
          <label htmlFor="buscar" className="sr-only">
            Buscar por nombre o número
          </label>
          <input
            id="buscar"
            type="search"
            value={buscar}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar por nombre o número…"
            maxLength={100}
            className="w-full rounded-md border border-bg-700 bg-bg-950 py-1.5 pr-3 pl-8 text-xs text-text-100 placeholder:text-text-600 focus:border-bg-600 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          aria-controls="panel-filtros"
          className={`relative flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs text-text-100 transition-colors ${
            abierto || activos.length > 0
              ? "border-bg-600 bg-bg-800"
              : "border-bg-700 bg-bg-950 hover:bg-bg-800"
          }`}
        >
          <SlidersHorizontal size={13} aria-hidden />
          <span className="max-[380px]:sr-only">Filtros</span>
          {activos.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-text-100 px-1 font-mono text-[10px] leading-none text-bg-950">
              {activos.length}
            </span>
          )}
        </button>
      </div>

      {abierto && (
        <div id="panel-filtros" className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {campos.map((c) => (
            <div key={c.id} className="min-w-0">
              <label htmlFor={`filtro-${c.id}`} className="mb-1 block text-[11px] text-text-400">
                {c.label}
              </label>
              <select
                id={`filtro-${c.id}`}
                value={c.value}
                onChange={(e) => c.onChange(e.target.value)}
                className={`${selectClass} py-1.5 text-xs`}
              >
                <option value="">{c.todas}</option>
                {c.opciones.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {!abierto && hayFiltros && activos.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {activos.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => c.onChange("")}
              aria-label={`Quitar filtro ${c.label}`}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-bg-600 bg-bg-800 py-0.5 pr-1.5 pl-2.5 text-[11px] text-text-100 hover:bg-bg-700"
            >
              {c.opciones.find((o) => o.value === c.value)?.label ?? c.value}
              <X size={11} aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={onLimpiar}
            className="shrink-0 cursor-pointer px-1.5 text-[11px] text-text-400 underline hover:text-text-100"
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
