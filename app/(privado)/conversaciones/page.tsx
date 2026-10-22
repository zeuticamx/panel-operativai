"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, EyeOff } from "lucide-react";
import { useApi, useDebounce } from "@/lib/use-api";
import type { ConversacionOut, ListaNumeros } from "@/lib/types";
import { CANALES, etiquetaCanal } from "@/lib/formato";
import { nombreNumero } from "@/lib/numeros";
import { FiltrosConversaciones } from "@/app/components/filtros-conversaciones";
import { ConversationRow } from "@/app/components/conversation-row";
import { esGerencia } from "@/app/components/modulo-vendedores";
import { useUsuario } from "@/app/components/usuario-context";
import { Aviso, Boton, PageHeader, claseBoton } from "@/app/components/ui";

const LIMITE = 25;

/**
 * Estados que ofrece el filtro. El select acepta el valor tal cual, sin
 * lógica del lado del cliente. "transferred" es lo que deja
 * entrada-canal-universal cuando el agente usa `escalar_humano`: la
 * conversación sigue recibiendo mensajes del cliente (se registran acá
 * mismo, ver ese workflow) pero el agente ya no contesta.
 */
const ESTADOS = [
  { value: "active", label: "Activas" },
  { value: "transferred", label: "Transferidas a humano" },
];

/** Filtro de quién la tiene; el backend acepta estos dos o el id de una persona. */
const ASIGNACIONES = [
  { value: "mias", label: "Mías" },
  { value: "sin_asignar", label: "Sin asignar" },
];

export default function ConversacionesPage() {
  const [canal, setCanal] = useState("");
  const [estado, setEstado] = useState("");
  const [asignada, setAsignada] = useState("");
  const [numeroId, setNumeroId] = useState("");
  const [buscar, setBuscar] = useState("");
  const [pagina, setPagina] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const buscarDebounced = useDebounce(buscar.trim(), 300);

  // Spec 005a (RF-18): la vista por número es de owner, superadmin y member;
  // vendedor y proveedor no la tienen (el backend les respondería 403).
  const { usuario } = useUsuario();
  const veNumeros = usuario?.role === "owner" || usuario?.role === "superadmin" || usuario?.role === "member";
  const numeros = useApi<ListaNumeros>(veNumeros ? "/api/canales/whatsapp/numeros" : null);
  const listaNumeros = numeros.data?.numeros ?? [];

  // Cualquier cambio de filtro vuelve a la primera página.
  const cambiarCanal = (v: string) => {
    setCanal(v);
    setPagina(0);
  };
  const cambiarEstado = (v: string) => {
    setEstado(v);
    setPagina(0);
  };
  const cambiarAsignada = (v: string) => {
    setAsignada(v);
    setPagina(0);
  };
  const cambiarNumero = (v: string) => {
    setNumeroId(v);
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
    if (asignada) qs.set("asignada", asignada);
    if (numeroId) qs.set("numero_id", numeroId);
    if (buscarDebounced) qs.set("buscar", buscarDebounced.slice(0, 100));
    qs.set("limite", String(LIMITE));
    qs.set("offset", String(pagina * LIMITE));
    return `/api/conversaciones?${qs.toString()}`;
  }, [canal, estado, asignada, numeroId, buscarDebounced, pagina]);

  const { data, loading, error, recargar } = useApi<ConversacionOut[]>(path);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      recargar(true);
    }, 60_000);
    return () => clearInterval(id);
  }, [recargar]);

  const hayFiltros = Boolean(canal || estado || asignada || numeroId || buscar);
  const limpiar = () => {
    setCanal("");
    setEstado("");
    setAsignada("");
    setNumeroId("");
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
        acciones={
          // Conversaciones de números desvinculados: solo owner y superadmin (RF-14).
          esGerencia(usuario) ? (
            <Link href="/conversaciones/ocultas" className={claseBoton("fantasma")}>
              <EyeOff size={13} aria-hidden />
              Ocultas
            </Link>
          ) : undefined
        }
      />

      <div data-tour="conversaciones.filtros">
      <FiltrosConversaciones
        buscar={buscar}
        onBuscar={cambiarBuscar}
        onLimpiar={limpiar}
        campos={[
          {
            id: "canal",
            label: "Canal",
            todas: "Todos los canales",
            value: canal,
            onChange: cambiarCanal,
            opciones: CANALES.map((c) => ({ value: c, label: etiquetaCanal(c) })),
          },
          { id: "estado", label: "Estado", todas: "Cualquier estado", value: estado, onChange: cambiarEstado, opciones: ESTADOS },
          {
            id: "asignada",
            label: "Asignación",
            todas: "Todas las asignaciones",
            value: asignada,
            onChange: cambiarAsignada,
            opciones: ASIGNACIONES,
          },
          ...(veNumeros && listaNumeros.length > 1
            ? [
                {
                  id: "numero",
                  label: "Número de WhatsApp",
                  todas: "Todos los números",
                  value: numeroId,
                  onChange: cambiarNumero,
                  opciones: listaNumeros.map((n) => ({
                    value: n.id,
                    label: `${nombreNumero(n)}${n.es_linea_avisos ? " (línea de avisos)" : ""}${n.estado === "pausado" ? " (pausado)" : ""}`,
                  })),
                },
              ]
            : []),
        ]}
      />
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
          <div data-tour="conversaciones.lista" className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            {data.map((c) => (
              <ConversationRow key={c.id} conversacion={c} now={now} />
            ))}
          </div>
        )}
      </div>

      {/* Paginación */}
      {(pagina > 0 || haySiguiente) && (
        <div data-tour="conversaciones.paginacion" className="flex items-center justify-between border-t border-bg-700 bg-bg-900 px-4 py-2">
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
