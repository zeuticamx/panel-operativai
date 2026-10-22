"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RefreshCw, UserSearch } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { useConversacionLive } from "@/lib/use-conversacion-live";
import { esProveedor } from "@/lib/roles";
import type { ContactoOut, ConversacionDetalleOut } from "@/lib/types";
import {
  aUtc,
  estadoVentanaHumana,
  estadoVentanaMeta,
  etiquetaIdentificador,
  formatoFechaHora,
  iniciales,
} from "@/lib/formato";
import { etiquetaNumeroConversacion } from "@/lib/numeros";
import { CentroNotificaciones } from "@/app/components/centro-notificaciones";
import { ThreadViewer } from "@/app/components/thread-viewer";
import { MensajeComposer } from "@/app/components/mensaje-composer";
import { esGerencia } from "@/app/components/modulo-vendedores";
import { PanelAsignacion } from "@/app/components/panel-asignacion";
import { LimpiarContextoAgente } from "@/app/components/limpiar-contexto-agente";
import { HistorialCitasCliente } from "@/app/components/historial-citas-cliente";
import { Badge } from "@/app/components/badge";
import { CanalBadge, StatusBadge } from "@/app/components/status";
import { CopyButton } from "@/app/components/copy-button";
import { BotonAyuda } from "@/app/components/recorrido";
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

  // Al abrir (y cuando llegan mensajes nuevos), saltar al Ãºltimo.
  const idCargado = data?.id ?? null;
  const totalMensajes = data?.mensajes.length ?? 0;
  useEffect(() => {
    if (idCargado) finRef.current?.scrollIntoView({ block: "end" });
  }, [idCargado, totalMensajes]);

  // Refresco silencioso cada minuto: la ventana de 24h se va acercando a
  // cerrarse aunque nadie toque nada en la pantalla, y el operador puede
  // dejar esta vista abierta un buen rato decidiendo si responder. Queda
  // como red de seguridad barata ademÃ¡s del refresco en vivo de abajo.
  useEffect(() => {
    const t = setInterval(() => recargar(true), 60_000);
    return () => clearInterval(t);
  }, [recargar]);

  // Refresco inmediato ante un mensaje manual o un cambio de handoff
  // (propio o de otra pestaÃ±a/persona atendiendo el mismo negocio).
  useConversacionLive(id ?? null, () => recargar(true));

  const nombre = data?.usuario_nombre?.trim() || data?.usuario_handle || "Sin nombre";
  const ventana = data ? estadoVentanaMeta(data.minutos_restantes_ventana) : null;
  const ventanaHumana = data
    ? estadoVentanaHumana(data.minutos_restantes_ventana_humana, data.minutos_restantes_ventana)
    : null;
  const numero = data ? etiquetaNumeroConversacion(data) : null;

  // WhatsApp queda fuera: no tiene API de perfil, el nombre llega en el
  // propio mensaje. Solo tiene sentido ofrecerlo si aÃºn no hay nombre. El
  // proveedor atiende el chat pero no edita el contacto (403 en el backend).
  const puedePedirPerfil =
    data !== null &&
    !esProveedor(usuario) &&
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
        setErrorPerfil("Meta no devolviÃ³ datos de perfil para este contacto.");
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-400 hover:bg-hover hover:text-text-100"
          aria-label="Volver a conversaciones"
        >
          <ArrowLeft size={16} aria-hidden />
        </Link>

        {data ? (
          <>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-700 font-mono text-xs text-text-400">
              {iniciales(data.usuario_nombre, data.usuario_handle)}
            </div>
            <div data-tour="conversacion.cabecera" className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-sm font-medium text-text-100">{nombre}</h1>
                <StatusBadge status={data.status} />
                {ventana && (
                  <Badge tone={ventana.tono} title={ventana.texto} className="shrink-0">
                    {ventana.textoCorto}
                  </Badge>
                )}
                {ventanaHumana && (
                  <Badge tone={ventanaHumana.tono} title={ventanaHumana.texto} className="shrink-0">
                    {ventanaHumana.textoCorto}
                  </Badge>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-text-600">
                <CanalBadge tipo={data.channel_type} />
                {numero && (
                  <Badge tone="neutral" title={numero.title} className="max-w-40 truncate">
                    {numero.texto}
                  </Badge>
                )}
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
                <span className="hidden sm:inline">Â· iniciÃ³ {formatoFechaHora(aUtc(data.started_at))}</span>
                <span className="hidden sm:inline">Â· {data.mensajes.length} mensajes</span>
              </div>
            </div>
          </>
        ) : (
          <h1 className="text-sm font-medium text-text-100">ConversaciÃ³n</h1>
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

        {/* Ãšnica pantalla privada con header propio en vez de PageHeader,
            asÃ­ que la campana y la ayuda se agregan a mano. */}
        <BotonAyuda />
        <CentroNotificaciones />
      </header>

      {errorPerfil && (
        <div className="px-4 pt-3">
          <Aviso tipo="error">{errorPerfil}</Aviso>
        </div>
      )}

      {data && (
        <PanelAsignacion
          conversacionId={data.id}
          asignacion={data}
          status={data.status}
          esGerencia={esGerencia(usuario)}
          miId={usuario?.id ?? null}
          onCambio={() => recargar(true)}
        />
      )}

      {data && (
        <LimpiarContextoAgente
          conversacionId={data.id}
          puedeLimpiar={data.puede_limpiar_contexto}
          limpiadoEn={data.contexto_limpiado_en}
          onLimpiado={() => recargar(true)}
        />
      )}

      {data && (
        <HistorialCitasCliente
          conversacionId={data.id}
          canal={data.channel_type}
          rol={usuario?.role ?? null}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        <div data-tour="conversacion.hilo" className="mx-auto w-full max-w-2xl p-6">
          {error ? (
            <Aviso tipo="error">{error}</Aviso>
          ) : !data ? (
            <Cargando texto="cargando conversaciÃ³nâ€¦" />
          ) : (
            <ThreadViewer
              mensajes={data.mensajes}
              nombreAgente={usuario?.nombre_negocio ? `Agente Â· ${usuario.nombre_negocio}` : "Agente"}
              nombreCliente={data.usuario_nombre?.trim() || "Cliente"}
              adjuntoUrl={(a) =>
                `/api/conversaciones/${encodeURIComponent(data.id)}/adjuntos/${encodeURIComponent(a)}`
              }
            />
          )}
          <div ref={finRef} />
        </div>
      </div>

      {data && (
        <div data-tour="conversacion.composer">
          <MensajeComposer
            status={data.status}
            enviarUrl={`/api/conversaciones/${encodeURIComponent(data.id)}/mensajes`}
            tomarUrl={`/api/conversaciones/${encodeURIComponent(data.id)}/tomar`}
            volverIaUrl={`/api/conversaciones/${encodeURIComponent(data.id)}/volver-a-ia`}
            adjuntosUrl={
              data.channel_type === "whatsapp"
                ? `/api/conversaciones/${encodeURIComponent(data.id)}/adjuntos`
                : undefined
            }
            asignacion={{
              asignadoA: data.asignado_a,
              asignadoNombre: data.asignado_nombre,
              miId: usuario?.id ?? null,
              esGerencia: esGerencia(usuario),
            }}
            onCambio={() => recargar(true)}
          />
        </div>
      )}
    </>
  );
}
