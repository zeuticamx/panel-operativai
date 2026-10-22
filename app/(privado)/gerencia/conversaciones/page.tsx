"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApi, useDebounce } from "@/lib/use-api";
import type { ConversacionOut, NumeroGerenciaOut, TenantGerenciaOut } from "@/lib/types";
import { CANALES, etiquetaCanal } from "@/lib/formato";
import { FiltrosConversaciones } from "@/app/components/filtros-conversaciones";
import { ConversationRow } from "@/app/components/conversation-row";
import { GerenciaTabs } from "@/app/components/gerencia";
import { Aviso, PageHeader } from "@/app/components/ui";

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
 *
 * Sin tenant_id abre el atajo: las conversaciones del número de WhatsApp
 * configurado en el backend (GERENCIA_NUMERO_PHONE_NUMBER_ID). Si el dueño
 * revocó la vista, el backend contesta 403 y se explica aquí.
 */
export default function ConversacionesGerenciaPage() {
  const params = useSearchParams();
  const tenantParam = params.get("tenant_id");

  // Atajo: sin tenant_id en la URL se resuelve el número configurado.
  const numero = useApi<NumeroGerenciaOut>(tenantParam ? null : "/api/gerencia/numero-conversaciones");
  const tenantId = tenantParam ?? numero.data?.tenant_id ?? null;
  const numeroId = tenantParam ? null : (numero.data?.agente_canal_id ?? null);

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
    if (numeroId) qs.set("numero_id", numeroId);
    qs.set("limite", String(LIMITE));
    return `/api/gerencia/tenants/${tenantId}/conversaciones?${qs.toString()}`;
  }, [tenantId, numeroId, canal, estado, buscarDebounced]);

  const { data, loading, error } = useApi<ConversacionOut[]>(path);

  if (!tenantParam && numero.loading && !numero.data) {
    return (
      <>
        <PageHeader titulo="Conversaciones" acciones={<GerenciaTabs />} />
        <div className="p-6 text-center font-mono text-xs text-text-600">cargando…</div>
      </>
    );
  }

  if (!tenantParam && numero.error && numero.data === null && /revoc/i.test(numero.error)) {
    return (
      <>
        <PageHeader titulo="Conversaciones" acciones={<GerenciaTabs />} />
        <Aviso tipo="error" className="m-4">
          {numero.error}
        </Aviso>
      </>
    );
  }

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

      <FiltrosConversaciones
        buscar={buscar}
        onBuscar={setBuscar}
        onLimpiar={limpiar}
        campos={[
          {
            id: "canal",
            label: "Canal",
            todas: "Todos los canales",
            value: canal,
            onChange: setCanal,
            opciones: CANALES.map((c) => ({ value: c, label: etiquetaCanal(c) })),
          },
          { id: "estado", label: "Estado", todas: "Cualquier estado", value: estado, onChange: setEstado, opciones: ESTADOS },
        ]}
      />

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
