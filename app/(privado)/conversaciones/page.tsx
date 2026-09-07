"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useApi, useDebounce } from "@/lib/use-api";
import type { ConversacionOut } from "@/lib/types";
import { CANALES, etiquetaCanal } from "@/lib/formato";
import { ConversationRow } from "@/app/components/conversation-row";
import { Aviso, Boton, PageHeader, selectClass } from "@/app/components/ui";

const LIMITE = 25;

/**
 * Estados que ofrece el filtro. El backend solo garantiza "active" hoy;
 * el select acepta el valor tal cual, sin lógica del lado del cliente.
 */
const ESTADOS = [{ value: "active", label: "Activas" }];

export default function ConversacionesPage() {
  const [canal, setCanal] = useState("");
  const [estado, setEstado] = useState("");
  const [buscar, setBuscar] = useState("");
  const [pagina, setPagina] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const buscarDebounced = useDebounce(buscar.trim(), 300);

  // Cualquier cambio de filtro vuelve a la primera página.
  const cambiarCanal = (v: string) => {
    setCanal(v);
    setPagina(0);
  };
  const cambiarEstado = (v: string) => {
    setEstado(v);
    setPagina(0);
  };
  const cambiarBuscar = (v: string) => {
    setBuscar(v);
    setPagina(0);
  };

  const path = useMemo(() => {
    const qs = new URLSearchParams();
    if (canal) qs.set("canal", canal);
    if (estado) qs.set("estado", estado);
    if (buscarDebounced) qs.set("buscar", buscarDebounced.slice(0, 100));
    qs.set("limite", String(LIMITE));
    qs.set("offset", String(pagina * LIMITE));
    return `/api/conversaciones?${qs.toString()}`;
  }, [canal, estado, buscarDebounced, pagina]);

  const { data, loading, error, recargar } = useApi<ConversacionOut[]>(path);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      recargar(true);
    }, 60_000);
    return () => clearInterval(id);
  }, [recargar]);

  const hayFiltros = Boolean(canal || estado || buscar);
  const limpiar = () => {
    setCanal("");
    setEstado("");
    setBuscar("");
    setPagina(0);
  };

  // El endpoint no devuelve total: hay "siguiente" si vino una página llena.
  const haySiguiente = (data?.length ?? 0) === LIMITE;
  const desde = pagina * LIMITE + 1;
  const hasta = pagina * LIMITE + (data?.length ?? 0);

  return (
    <>
      <PageHeader
        titulo="Conversaciones"
        sub={
          data && data.length > 0
            ? `${desde}–${hasta}${haySiguiente ? "+" : ""}`
            : undefined
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 border-b border-bg-700 bg-bg-900 px-4 py-2">
        <div className="relative min-w-0 flex-1 basis-56">
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
            onChange={(e) => cambiarBuscar(e.target.value)}
            placeholder="Buscar por nombre o número…"
            maxLength={100}
            className="w-full rounded-md border border-bg-700 bg-bg-950 py-1.5 pr-3 pl-8 text-xs text-text-100 placeholder:text-text-600 focus:border-bg-600 focus:outline-none"
          />
        </div>

        <label htmlFor="canal" className="sr-only">
          Canal
        </label>
        <select
          id="canal"
          value={canal}
          onChange={(e) => cambiarCanal(e.target.value)}
          className={`${selectClass} w-auto py-1.5 text-xs`}
        >
          <option value="">Todos los canales</option>
          {CANALES.map((c) => (
            <option key={c} value={c}>
              {etiquetaCanal(c)}
            </option>
          ))}
        </select>

        <label htmlFor="estado" className="sr-only">
          Estado
        </label>
        <select
          id="estado"
          value={estado}
          onChange={(e) => cambiarEstado(e.target.value)}
          className={`${selectClass} w-auto py-1.5 text-xs`}
        >
          <option value="">Cualquier estado</option>
          {ESTADOS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {hayFiltros && (
          <Boton variante="fantasma" onClick={limpiar} className="min-h-8 px-2">
            <X size={13} aria-hidden />
            Limpiar
          </Boton>
        )}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <Aviso tipo="error" className="m-4">
            {error}
          </Aviso>
        )}

        {!error && data && data.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <p className="text-sm text-text-100">
              {hayFiltros ? "Sin resultados con esos filtros" : "Todavía no hay conversaciones"}
            </p>
            <p className="max-w-xs text-xs text-text-400">
              {hayFiltros
                ? "Prueba con otro nombre, número o canal."
                : "Cuando un cliente escriba por un canal conectado, aparecerá aquí."}
            </p>
            {hayFiltros && (
              <Boton variante="secundario" onClick={limpiar} className="mt-2">
                Quitar filtros
              </Boton>
            )}
          </div>
        )}

        {!error && !data && loading && (
          <div className="p-6 text-center font-mono text-xs text-text-600">cargando…</div>
        )}

        {data && data.length > 0 && (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            {data.map((c) => (
              <ConversationRow key={c.id} conversacion={c} now={now} />
            ))}
          </div>
        )}
      </div>

      {/* Paginación */}
      {(pagina > 0 || haySiguiente) && (
        <div className="flex items-center justify-between border-t border-bg-700 bg-bg-900 px-4 py-2">
          <Boton
            variante="secundario"
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={pagina === 0 || loading}
            className="min-h-8"
          >
            <ChevronLeft size={13} aria-hidden />
            Anterior
          </Boton>
          <span className="font-mono text-[11px] text-text-600">página {pagina + 1}</span>
          <Boton
            variante="secundario"
            onClick={() => setPagina((p) => p + 1)}
            disabled={!haySiguiente || loading}
            className="min-h-8"
          >
            Siguiente
            <ChevronRight size={13} aria-hidden />
          </Boton>
        </div>
      )}
    </>
  );
}
