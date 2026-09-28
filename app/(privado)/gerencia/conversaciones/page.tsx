"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useApi, useDebounce } from "@/lib/use-api";
import type { ConversacionOut, TenantGerenciaOut } from "@/lib/types";
import { CANALES, etiquetaCanal } from "@/lib/formato";
import { ConversationRow } from "@/app/components/conversation-row";
import { GerenciaTabs } from "@/app/components/gerencia";
import { Aviso, Boton, PageHeader, selectClass } from "@/app/components/ui";

const LIMITE = 25;

const ESTADOS = [
  { value: "active", label: "Activas" },
  { value: "transferred", label: "Transferidas a humano" },
];

/**
 * Conversaciones de UN negocio, para gerencia de plataforma (Escenario 1
 * de la historia de handoff: "ingreso un tenant_id específico"). El
 * tenant_id viaja por query string en vez de un buscador propio — ya existe
 * uno completo en /gerencia/tenants, así que se enlaza desde ahí (ver el
 * botón "Ver conversaciones" en /gerencia/tenants/[id]).
 */
export default function ConversacionesGerenciaPage() {
  const params = useSearchParams();
  const tenantId = params.get("tenant_id");

  const [canal, setCanal] = useState("");
  const [estado, setEstado] = useState("");
  const [buscar, setBuscar] = useState("");
  const buscarDebounced = useDebounce(buscar.trim(), 300);

  const tenant = useApi<TenantGerenciaOut>(tenantId ? `/api/gerencia/tenants/${tenantId}` : null);

  const path = useMemo(() => {
    if (!tenantId) return null;
    const qs = new URLSearchParams();
    if (canal) qs.set("canal", canal);
    if (estado) qs.set("estado", estado);
    if (buscarDebounced) qs.set("buscar", buscarDebounced.slice(0, 100));
    qs.set("limite", String(LIMITE));
    return `/api/gerencia/tenants/${tenantId}/conversaciones?${qs.toString()}`;
  }, [tenantId, canal, estado, buscarDebounced]);

  const { data, loading, error } = useApi<ConversacionOut[]>(path);

  if (!tenantId) {
    return (
      <>
        <PageHeader titulo="Conversaciones" acciones={<GerenciaTabs />} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-text-100">Elige un negocio primero</p>
          <p className="max-w-sm text-xs text-text-400">
            Esta vista filtra por tenant_id. Ábrela desde la ficha de un negocio, en{" "}
            <Link href="/gerencia/tenants" className="underline">
              /gerencia/tenants
            </Link>
            .
          </p>
        </div>
      </>
    );
  }

  const hayFiltros = Boolean(canal || estado || buscar);
  const limpiar = () => {
    setCanal("");
    setEstado("");
    setBuscar("");
  };

  return (
    <>
      <PageHeader
        titulo="Conversaciones"
        sub={tenant.data?.nombre}
        acciones={<GerenciaTabs />}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-bg-700 bg-bg-900 px-4 py-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search
            size={13}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-600"
            aria-hidden
          />
          <input
            type="search"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por nombre o número…"
            maxLength={100}
            className="w-full rounded-md border border-bg-700 bg-bg-950 py-1.5 pr-3 pl-8 text-xs text-text-100 placeholder:text-text-600 focus:border-bg-600 focus:outline-none"
          />
        </div>

        <select
          value={canal}
          onChange={(e) => setCanal(e.target.value)}
          aria-label="Canal"
          className={`${selectClass} w-auto py-1.5 text-xs`}
        >
          <option value="">Todos los canales</option>
          {CANALES.map((c) => (
            <option key={c} value={c}>
              {etiquetaCanal(c)}
            </option>
          ))}
        </select>

        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          aria-label="Estado"
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

      <div className="flex-1 overflow-y-auto">
        {error && (
          <Aviso tipo="error" className="m-4">
            {error}
          </Aviso>
        )}

        {!error && !data && loading && (
          <div className="p-6 text-center font-mono text-xs text-text-600">cargando…</div>
        )}

        {!error && data && data.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <p className="text-sm text-text-100">
              {hayFiltros ? "Sin resultados con esos filtros" : "Este negocio no tiene conversaciones"}
            </p>
          </div>
        )}

        {data && data.length > 0 && (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            {data.map((c) => (
              <ConversationRow
                key={c.id}
                conversacion={c}
                hrefBase="/gerencia/conversaciones"
                hrefQuery={`?tenant_id=${tenantId}`}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
