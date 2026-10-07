"use client";

import { Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { fechaDeParametro } from "@/lib/agenda";
import { VendedoresTabs } from "@/app/components/modulo-vendedores";
import { Cargando, PageHeader } from "@/app/components/ui";

// FullCalendar solo en el cliente y solo en las pantallas que lo usan: no
// tiene sentido renderizarlo en el servidor (mide el DOM) ni cargarlo en el
// resto del portal.
const AgendaVentas = dynamic(
  () => import("@/app/components/agenda-ventas").then((m) => m.AgendaVentas),
  { ssr: false, loading: () => <Cargando texto="cargando agenda…" /> },
);

export default function AgendaPage() {
  // useSearchParams necesita un límite de Suspense en una página estática.
  return (
    <Suspense fallback={<Cargando />}>
      <Agenda />
    </Suspense>
  );
}

function Agenda() {
  const params = useSearchParams();
  const fechaParam = params.get("fecha");
  // Memo por el texto: una Date nueva en cada render movería el calendario.
  const fecha = useMemo(() => fechaDeParametro(fechaParam), [fechaParam]);

  return (
    <>
      <PageHeader titulo="Vendedores" sub={<VendedoresTabs />} />
      <div className="flex-1 overflow-y-auto p-4">
        <AgendaVentas modo="negocio" fechaInicial={fecha} />
      </div>
    </>
  );
}
