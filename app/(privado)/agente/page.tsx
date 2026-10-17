"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { nombreNumero } from "@/lib/numeros";
import type { ListaNumeros } from "@/lib/types";
import { EditorAgente, type DestinoAgente } from "@/app/components/editor-agente";
import { useUsuario } from "@/app/components/usuario-context";
import { Campo, Cargando, PageHeader, selectClass } from "@/app/components/ui";

/** Valor del selector para Instagram, Facebook y el widget web (una sola configuración compartida). */
const SOCIAL = "social";

export default function AgentePage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader titulo="Agente" />
          <Cargando texto="cargando configuración…" />
        </>
      }
    >
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const router = useRouter();
  const params = useSearchParams();
  const { usuario } = useUsuario();
  const numeros = useApi<ListaNumeros>("/api/canales/whatsapp/numeros");

  const lista = numeros.data?.numeros ?? [];
  const pedido = params.get("numero");

  // Qué configuración se edita: la del query (?numero=<id> o ?numero=social),
  // si no, la del número principal, si no, el primero, si no, la social.
  let seleccion: string = SOCIAL;
  if (pedido === SOCIAL) seleccion = SOCIAL;
  else if (pedido && lista.some((n) => n.id === pedido)) seleccion = pedido;
  else if (lista.length > 0) seleccion = (lista.find((n) => n.es_principal) ?? lista[0]).id;

  if (!numeros.data && numeros.loading) {
    return (
      <>
        <PageHeader titulo="Agente" />
        <Cargando texto="cargando configuración…" />
      </>
    );
  }

  const destino: DestinoAgente = seleccion === SOCIAL ? { tipo: "social" } : { tipo: "numero", id: seleccion };

  const selector = (
    <Campo
      id="selector-agente"
      label="¿Qué agente configuras?"
      hint="Cada número de WhatsApp tiene su propio agente. Instagram, Facebook y el chat web comparten uno."
      className="max-w-md"
    >
      <select
        id="selector-agente"
        value={seleccion}
        onChange={(e) => router.replace(`/agente?numero=${encodeURIComponent(e.target.value)}`, { scroll: false })}
        className={selectClass}
      >
        {lista.map((n) => (
          <option key={n.id} value={n.id}>
            WhatsApp {nombreNumero(n)}
            {n.es_principal ? " · principal" : ""}
            {n.es_linea_avisos ? " · línea de avisos" : ""}
            {n.estado === "pausado" ? " · pausado" : ""}
          </option>
        ))}
        <option value={SOCIAL}>Instagram, Facebook y chat web</option>
      </select>
    </Campo>
  );

  return (
    <>
      {/* Si la lista de números no carga, el selector solo ofrece la configuración social. */}
      <EditorAgente
        // La clave reinicia el estado del formulario al cambiar de agente.
        key={seleccion}
        destino={destino}
        soloLectura={usuario?.role === "member"}
        selector={selector}
      />
    </>
  );
}
