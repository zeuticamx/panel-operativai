"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RefreshCw, UserSearch } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { ContactoOut, ConversacionDetalleOut } from "@/lib/types";
import { estadoVentanaMeta, etiquetaIdentificador, formatoFechaHora, iniciales } from "@/lib/formato";
import { ThreadViewer } from "@/app/components/thread-viewer";
import { Badge } from "@/app/components/badge";
import { CanalBadge, StatusBadge } from "@/app/components/status";
import { CopyButton } from "@/app/components/copy-button";
import { Aviso, Boton, Cargando } from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

export default function ConversacionDetallePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { usuario } = useUsuario();
  const { data, loading, error, recargar } = useApi<ConversacionDetalleOut>(
    id ? `/api/conversaciones/${encodeURIComponent(id)}` : null,
  );
  const finRef = useRef<HTMLDivElement>(null);
  const [buscandoPerfil, setBuscandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);

  // Al abrir (y cuando llegan mensajes nuevos), saltar al último.
  const idCargado = data?.id ?? null;
  const totalMensajes = data?.mensajes.length ?? 0;
  useEffect(() => {
    if (idCargado) finRef.current?.scrollIntoView({ block: "end" });
  }, [idCargado, totalMensajes]);

  // Refresco silencioso cada minuto: la ventana de 24h se va acercando a
  // cerrarse aunque nadie toque nada en la pantalla, y el operador puede
  // dejar esta vista abierta un buen rato decidiendo si responder.
  useEffect(() => {
    const t = setInterval(() => recargar(true), 60_000);
    return () => clearInterval(t);
  }, [recargar]);

  const nombre = data?.usuario_nombre?.trim() || data?.usuario_handle || "Sin nombre";
  const ventana = data ? estadoVentanaMeta(data.minutos_restantes_ventana) : null;

  // WhatsApp queda fuera: no tiene API de perfil, el nombre llega en el
  // propio mensaje. Solo tiene sentido ofrecerlo si aún no hay nombre.
  const puedePedirPerfil =
    data !== null &&
    data.channel_type !== "whatsapp" &&
    !data.usuario_nombre?.trim();

  const pedirPerfil = async () => {
    if (!id || buscandoPerfil) return;
    setBuscandoPerfil(true);
    setErrorPerfil(null);
    try {
      const res = await apiFetch<ContactoOut>(
        `/api/conversaciones/${encodeURIComponent(id)}/contacto`,
        { method: "POST" },
      );
      if (!res.actualizado) {
        setErrorPerfil("Meta no devolvió datos de perfil para este contacto.");
      }
      await recargar(true);
    } catch (e) {
      setErrorPerfil(mensajeDeError(e, "No se pudo obtener el perfil."));
    } finally {
      setBuscandoPerfil(false);
    }
  };

  return (
    <>
      <header className="flex min-h-12 items-center gap-3 border-b border-bg-700 px-4 py-2.5">
        <Link
          href="/conversaciones"
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
                {data.usuario_username && (
                  <span className="truncate text-text-400">@{data.usuario_username}</span>
                )}
                <span className="hidden sm:inline">· inició {formatoFechaHora(data.started_at)}</span>
                <span className="hidden sm:inline">· {data.mensajes.length} mensajes</span>
              </div>
            </div>
          </>
        ) : (
          <h1 className="text-sm font-medium text-text-100">Conversación</h1>
        )}

        {puedePedirPerfil && (
          <Boton
            variante="secundario"
            onClick={pedirPerfil}
            loading={buscandoPerfil}
            title="Consultarle a Meta el nombre de este contacto"
            className="min-h-8 shrink-0"
          >
            <UserSearch size={13} aria-hidden />
            <span className="hidden sm:inline">Obtener nombre</span>
          </Boton>
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

      {errorPerfil && (
        <div className="px-4 pt-3">
          <Aviso tipo="error">{errorPerfil}</Aviso>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl p-6">
          {error ? (
            <Aviso tipo="error">{error}</Aviso>
          ) : !data ? (
            <Cargando texto="cargando conversación…" />
          ) : (
            <ThreadViewer
              mensajes={data.mensajes}
              nombreAgente={usuario?.nombre_negocio ? `Agente · ${usuario.nombre_negocio}` : "Agente"}
              nombreCliente={data.usuario_nombre?.trim() || "Cliente"}
            />
          )}
          <div ref={finRef} />
        </div>
      </div>
    </>
  );
}
