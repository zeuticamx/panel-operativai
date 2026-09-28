"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { useConversacionLive } from "@/lib/use-conversacion-live";
import type { ConversacionDetalleOut } from "@/lib/types";
import { estadoVentanaMeta, etiquetaIdentificador, formatoFechaHora, iniciales } from "@/lib/formato";
import { ThreadViewer } from "@/app/components/thread-viewer";
import { MensajeComposer } from "@/app/components/mensaje-composer";
import { Badge } from "@/app/components/badge";
import { CanalBadge, StatusBadge } from "@/app/components/status";
import { CopyButton } from "@/app/components/copy-button";
import { Aviso, Boton, Cargando } from "@/app/components/ui";

/**
 * Igual que /conversaciones/{id}, pero para gerencia de plataforma: el
 * tenant_id viaja por query string (llegó de la lista, que a su vez lo
 * recibió de la ficha del negocio) en vez de salir del JWT del que llama.
 */
export default function ConversacionDetalleGerenciaPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const tenantId = useSearchParams().get("tenant_id");

  const base = tenantId ? `/api/gerencia/tenants/${tenantId}/conversaciones` : null;
  const { data, loading, error, recargar } = useApi<ConversacionDetalleOut>(
    id && base ? `${base}/${encodeURIComponent(id)}` : null,
  );
  const finRef = useRef<HTMLDivElement>(null);

  const idCargado = data?.id ?? null;
  const totalMensajes = data?.mensajes.length ?? 0;
  useEffect(() => {
    if (idCargado) finRef.current?.scrollIntoView({ block: "end" });
  }, [idCargado, totalMensajes]);

  useEffect(() => {
    const t = setInterval(() => recargar(true), 60_000);
    return () => clearInterval(t);
  }, [recargar]);

  useConversacionLive(id ?? null, () => recargar(true), tenantId);

  if (!tenantId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-text-100">Falta el tenant_id en la URL</p>
        <Link href="/gerencia/tenants" className="text-xs text-text-400 underline">
          Volver a negocios
        </Link>
      </div>
    );
  }

  const nombre = data?.usuario_nombre?.trim() || data?.usuario_handle || "Sin nombre";
  const ventana = data ? estadoVentanaMeta(data.minutos_restantes_ventana) : null;

  return (
    <>
      <header className="flex min-h-12 items-center gap-3 border-b border-bg-700 px-4 py-2.5">
        <Link
          href={`/gerencia/conversaciones?tenant_id=${tenantId}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-400 hover:bg-bg-800 hover:text-text-100"
          aria-label="Volver a conversaciones"
        >
          <ArrowLeft size={16} aria-hidden />
        </Link>

        {data ? (
          <>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-700 font-mono text-xs text-text-400">
              {iniciales(data.usuario_nombre, data.usuario_handle)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-sm font-medium text-text-100">{nombre}</h1>
                <StatusBadge status={data.status} />
                {ventana && (
                  <Badge tone={ventana.tono} title={ventana.texto} className="shrink-0">
                    {ventana.textoCorto}
                  </Badge>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-text-600">
                <CanalBadge tipo={data.channel_type} />
                {data.usuario_handle && (
                  <span className="flex min-w-0 items-center gap-0.5">
                    <span className="truncate">
                      <span className="opacity-70">
                        {etiquetaIdentificador(data.channel_type)}:{" "}
                      </span>
                      {data.usuario_handle}
                    </span>
                    <CopyButton
                      text={data.usuario_handle}
                      label={`Copiar ${etiquetaIdentificador(data.channel_type).toLowerCase()}`}
                    />
                  </span>
                )}
                <span className="hidden sm:inline">· inició {formatoFechaHora(data.started_at)}</span>
                <span className="hidden sm:inline">· {data.mensajes.length} mensajes</span>
              </div>
            </div>
          </>
        ) : (
          <h1 className="text-sm font-medium text-text-100">Conversación</h1>
        )}

        <Boton
          variante="fantasma"
          onClick={() => recargar(true)}
          loading={loading && Boolean(data)}
          aria-label="Actualizar"
          title="Actualizar"
          className="min-h-8 px-2"
        >
          <RefreshCw size={13} aria-hidden />
        </Boton>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl p-6">
          {error ? (
            <Aviso tipo="error">{error}</Aviso>
          ) : !data ? (
            <Cargando texto="cargando conversación…" />
          ) : (
            <ThreadViewer
              mensajes={data.mensajes}
              nombreCliente={data.usuario_nombre?.trim() || "Cliente"}
            />
          )}
          <div ref={finRef} />
        </div>
      </div>

      {data && base && (
        <MensajeComposer
          status={data.status}
          enviarUrl={`${base}/${encodeURIComponent(data.id)}/mensajes`}
          volverIaUrl={`${base}/${encodeURIComponent(data.id)}/volver-a-ia`}
          onCambio={() => recargar(true)}
        />
      )}
    </>
  );
}
