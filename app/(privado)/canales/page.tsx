"use client";

import { useState } from "react";
import { Check, ExternalLink, RefreshCw, X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { loginConCode, META_APP_ID, META_REDIRECT_URI } from "@/lib/meta-oauth";
import type {
  ActivarOut,
  ActivarResultado,
  CanalOut,
  ConectarMetaOut,
  PaginaDisponible,
} from "@/lib/types";
import { CANALES, etiquetaCanal, formatoFechaHora, type CanalTipo } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "@/app/components/badge";
import { CanalIcon } from "@/app/components/status";
import { Aviso, Boton, ConfirmDialog, PageHeader } from "@/app/components/ui";

type Paso =
  | { etapa: "inactivo" }
  | { etapa: "conectando" }
  | { etapa: "cargando_paginas" }
  | { etapa: "paginas"; paginas: PaginaDisponible[]; seleccion: Set<string>; activando: boolean }
  | { etapa: "resultado"; resultados: ActivarResultado[] };

const DESCRIPCION: Record<CanalTipo, string> = {
  whatsapp: "Mensajes al número de WhatsApp Business de tu negocio.",
  instagram: "Mensajes directos a tu cuenta de Instagram profesional.",
  facebook: "Mensajes por Messenger a tu página de Facebook.",
};

export default function CanalesPage() {
  const canales = useApi<CanalOut[]>("/api/canales");
  const [paso, setPaso] = useState<Paso>({ etapa: "inactivo" });
  const [errorFlujo, setErrorFlujo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [desconectar, setDesconectar] = useState<CanalTipo | null>(null);
  const [desconectando, setDesconectando] = useState(false);

  const porTipo = new Map<string, CanalOut>();
  for (const c of canales.data ?? []) porTipo.set(c.channel_type, c);

  // ---- Flujo Meta ----------------------------------------------------
  const cargarPaginas = async () => {
    setErrorFlujo(null);
    setPaso({ etapa: "cargando_paginas" });
    try {
      const paginas = await apiFetch<PaginaDisponible[]>("/api/canales/meta/paginas");
      // Preselecciona las que aún no están conectadas.
      const seleccion = new Set(paginas.filter((p) => !p.ya_conectada).map((p) => p.page_id));
      setPaso({ etapa: "paginas", paginas, seleccion, activando: false });
    } catch (e) {
      setErrorFlujo(mensajeDeError(e));
      setPaso({ etapa: "inactivo" });
    }
  };

  const conectarConFacebook = async () => {
    setErrorFlujo(null);
    setAviso(null);
    setPaso({ etapa: "conectando" });
    try {
      const resultado = await loginConCode();
      if (!resultado) {
        setAviso("Conexión cancelada. No se hizo ningún cambio.");
        setPaso({ etapa: "inactivo" });
        return;
      }

      // El redirect_uri viaja junto al code: Meta exige que el del canje sea
      // idéntico al que se usó para abrir el diálogo.
      await apiFetch<ConectarMetaOut>("/api/canales/meta/conectar", {
        method: "POST",
        json: { code: resultado.code, redirect_uri: resultado.redirectUri },
      });
      await cargarPaginas();
    } catch (e) {
      setErrorFlujo(mensajeDeError(e, "No se pudo conectar con Facebook."));
      setPaso({ etapa: "inactivo" });
    }
  };

  const alternarPagina = (page_id: string) => {
    setPaso((p) => {
      if (p.etapa !== "paginas") return p;
      const seleccion = new Set(p.seleccion);
      if (seleccion.has(page_id)) seleccion.delete(page_id);
      else seleccion.add(page_id);
      return { ...p, seleccion };
    });
  };

  const activarSeleccionadas = async () => {
    if (paso.etapa !== "paginas" || paso.seleccion.size === 0) return;
    setErrorFlujo(null);
    setPaso({ ...paso, activando: true });
    try {
      const res = await apiFetch<ActivarOut>("/api/canales/meta/activar", {
        method: "POST",
        json: { page_ids: [...paso.seleccion] },
      });
      setPaso({ etapa: "resultado", resultados: res.resultados });
      canales.recargar(true);
    } catch (e) {
      setErrorFlujo(mensajeDeError(e, "No se pudieron activar las páginas."));
      setPaso({ ...paso, activando: false });
    }
  };

  // ---- Desconectar ---------------------------------------------------
  const confirmarDesconexion = async () => {
    if (!desconectar) return;
    setDesconectando(true);
    setErrorFlujo(null);
    try {
      await apiFetch(`/api/canales/${desconectar}`, { method: "DELETE" });
      setAviso(`${etiquetaCanal(desconectar)} desconectado.`);
      setDesconectar(null);
      canales.recargar(true);
    } catch (e) {
      setErrorFlujo(mensajeDeError(e, "No se pudo desconectar el canal."));
    } finally {
      setDesconectando(false);
    }
  };

  const ocupado = paso.etapa === "conectando" || paso.etapa === "cargando_paginas";

  return (
    <>
      <PageHeader
        titulo="Canales"
        sub="dónde responde tu agente"
        acciones={
          <Boton
            variante="fantasma"
            onClick={() => canales.recargar()}
            loading={canales.loading}
            title="Actualizar"
          >
            <RefreshCw size={13} aria-hidden />
            Actualizar
          </Boton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {canales.error && <Aviso tipo="error">{canales.error}</Aviso>}
          {errorFlujo && <Aviso tipo="error">{errorFlujo}</Aviso>}
          {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
          {(!META_APP_ID || !META_REDIRECT_URI) && (
            <Aviso tipo="info">
              Falta{" "}
              <code>
                {!META_APP_ID ? "NEXT_PUBLIC_META_APP_ID" : "NEXT_PUBLIC_META_REDIRECT_URI"}
              </code>{" "}
              en el entorno del portal; la conexión con Facebook e Instagram no va a funcionar
              hasta definirlo.
            </Aviso>
          )}

          {/* Estado por canal */}
          <section className="overflow-hidden rounded-md border border-bg-700 bg-bg-900">
            {CANALES.map((tipo, i) => {
              const c = porTipo.get(tipo);
              const conectado = Boolean(c?.is_active);
              const esMeta = tipo === "facebook" || tipo === "instagram";
              const identificador =
                tipo === "whatsapp"
                  ? c?.phone_number_id
                  : tipo === "instagram"
                    ? c?.ig_user_id
                    : c?.page_id;

              return (
                <div
                  key={tipo}
                  className={cn(
                    "flex flex-wrap items-center gap-3 px-4 py-3",
                    i > 0 && "border-t border-bg-700",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                      conectado
                        ? "border-success/40 bg-success-bg text-success"
                        : "border-bg-700 bg-bg-800 text-text-400",
                    )}
                  >
                    <CanalIcon tipo={tipo} size={16} />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-100">{etiquetaCanal(tipo)}</span>
                      {canales.loading && !canales.data ? (
                        <Badge>cargando…</Badge>
                      ) : conectado ? (
                        <Badge tone="success">conectado</Badge>
                      ) : c ? (
                        <Badge tone="warning">desconectado</Badge>
                      ) : (
                        <Badge>sin conectar</Badge>
                      )}
                    </div>
                    <span className="text-xs text-text-400">{DESCRIPCION[tipo]}</span>
                    {c && (identificador || c.updated_at) && (
                      <span className="font-mono text-[11px] text-text-600">
                        {identificador && <>id {identificador}</>}
                        {identificador && c.updated_at && " · "}
                        {c.updated_at && <>actualizado {formatoFechaHora(c.updated_at)}</>}
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {conectado ? (
                      <Boton
                        variante="secundario"
                        onClick={() => setDesconectar(tipo)}
                        className="hover:border-danger/40 hover:text-danger"
                      >
                        Desconectar
                      </Boton>
                    ) : esMeta ? (
                      <Boton
                        variante="primario"
                        onClick={conectarConFacebook}
                        loading={paso.etapa === "conectando"}
                        disabled={ocupado || !META_APP_ID}
                      >
                        <CanalIcon tipo="facebook" size={13} />
                        Conectar con Facebook
                      </Boton>
                    ) : (
                      <Boton variante="secundario" disabled title="El alta de WhatsApp todavía no está disponible desde el portal">
                        Próximamente
                      </Boton>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Panel del flujo Meta */}
          {paso.etapa !== "inactivo" && (
            <section className="rounded-md border border-bg-700 bg-bg-800 p-4">
              <header className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-medium text-text-100">
                    {paso.etapa === "conectando" && "Conectando con Facebook"}
                    {paso.etapa === "cargando_paginas" && "Buscando tus páginas"}
                    {paso.etapa === "paginas" && "Elige qué páginas activar"}
                    {paso.etapa === "resultado" && "Resultado de la activación"}
                  </h2>
                  <p className="font-mono text-[11px] text-text-600">
                    {paso.etapa === "conectando" && "espera a que se cierre la ventana de Facebook"}
                    {paso.etapa === "cargando_paginas" && "consultando las páginas que autorizaste"}
                    {paso.etapa === "paginas" &&
                      "cada página activa Messenger; si tiene Instagram vinculado, también Instagram"}
                    {paso.etapa === "resultado" && "el estado de arriba ya está actualizado"}
                  </p>
                </div>
                {(paso.etapa === "paginas" || paso.etapa === "resultado") && (
                  <Boton
                    variante="fantasma"
                    onClick={() => setPaso({ etapa: "inactivo" })}
                    aria-label="Cerrar panel"
                    className="min-h-8 px-2"
                  >
                    <X size={14} aria-hidden />
                  </Boton>
                )}
              </header>

              {(paso.etapa === "conectando" || paso.etapa === "cargando_paginas") && (
                <div className="py-6 text-center font-mono text-xs text-text-600">un momento…</div>
              )}

              {paso.etapa === "paginas" && (
                <>
                  {paso.paginas.length === 0 ? (
                    <Aviso tipo="info">
                      Facebook no devolvió ninguna página. Verifica que tu usuario administre al
                      menos una página y que la hayas autorizado en la ventana de Facebook.
                    </Aviso>
                  ) : (
                    <ul className="flex flex-col divide-y divide-bg-700 rounded-md border border-bg-700 bg-bg-900">
                      {paso.paginas.map((p) => {
                        const marcada = paso.seleccion.has(p.page_id);
                        const inputId = `pagina-${p.page_id}`;
                        return (
                          <li key={p.page_id}>
                            <label
                              htmlFor={inputId}
                              className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-bg-800"
                            >
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={marcada}
                                onChange={() => alternarPagina(p.page_id)}
                                disabled={paso.activando}
                                className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--success)]"
                              />
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="flex items-center gap-2 text-sm text-text-100">
                                  <span className="truncate">{p.nombre}</span>
                                  {p.ya_conectada && <Badge tone="success">ya conectada</Badge>}
                                </span>
                                <span className="flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-text-600">
                                  <span className="inline-flex items-center gap-1">
                                    <CanalIcon tipo="facebook" size={11} />
                                    {p.page_id}
                                  </span>
                                  {p.ig_username ? (
                                    <span className="inline-flex items-center gap-1 text-text-400">
                                      <CanalIcon tipo="instagram" size={11} />@{p.ig_username}
                                    </span>
                                  ) : (
                                    <span>sin Instagram vinculado</span>
                                  )}
                                </span>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-text-600">
                      {paso.seleccion.size} de {paso.paginas.length} seleccionadas
                    </span>
                    <div className="flex gap-2">
                      <Boton variante="secundario" onClick={cargarPaginas} disabled={paso.activando}>
                        <RefreshCw size={13} aria-hidden />
                        Volver a buscar
                      </Boton>
                      <Boton
                        variante="primario"
                        onClick={activarSeleccionadas}
                        loading={paso.activando}
                        disabled={paso.seleccion.size === 0}
                      >
                        Activar seleccionadas
                      </Boton>
                    </div>
                  </div>
                </>
              )}

              {paso.etapa === "resultado" && (
                <ul className="flex flex-col divide-y divide-bg-700 rounded-md border border-bg-700 bg-bg-900">
                  {paso.resultados.map((r) => (
                    <li key={r.page_id} className="flex items-start gap-3 px-3 py-2.5">
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                          r.ok ? "bg-success-bg text-success" : "bg-danger/10 text-danger",
                        )}
                        aria-hidden
                      >
                        {r.ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm text-text-100">{r.nombre ?? r.page_id}</span>
                        <span className="font-mono text-[11px] text-text-600">
                          {r.ok
                            ? `activado: ${(r.canales ?? []).map(etiquetaCanal).join(" + ")}`
                            : (r.detalle ?? "error")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Atajo: ya autorizó Meta antes pero no eligió páginas */}
          {paso.etapa === "inactivo" && META_APP_ID && (
            <p className="font-mono text-[11px] text-text-600">
              ¿Ya conectaste tu cuenta de Meta y solo quieres agregar páginas?{" "}
              <button
                type="button"
                onClick={cargarPaginas}
                className="inline-flex cursor-pointer items-center gap-1 text-text-400 underline-offset-2 hover:text-text-100 hover:underline"
              >
                Elegir páginas
                <ExternalLink size={11} aria-hidden />
              </button>
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={desconectar !== null}
        onOpenChange={(o) => {
          if (!o && !desconectando) setDesconectar(null);
        }}
        titulo={`¿Desconectar ${desconectar ? etiquetaCanal(desconectar) : ""}?`}
        descripcion="Tu agente dejará de recibir y responder mensajes por este canal. Puedes volver a conectarlo cuando quieras."
        confirmar="Desconectar"
        peligro
        loading={desconectando}
        onConfirm={confirmarDesconexion}
      />
    </>
  );
}
