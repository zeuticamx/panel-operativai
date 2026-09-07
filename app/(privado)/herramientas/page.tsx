"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type {
  HerramientaInfoOut,
  HerramientaOut,
  HerramientaTipo,
} from "@/lib/types";
import { formatoFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "@/app/components/badge";
import { CopyButton } from "@/app/components/copy-button";
import {
  Aviso,
  Boton,
  Campo,
  ConfirmDialog,
  PageHeader,
  inputClass,
} from "@/app/components/ui";

const TIPO = {
  google_sheets: {
    icono: FileSpreadsheet,
    etiqueta: "Google Sheet",
    recurso: "hoja de cálculo",
    endpoint: "/api/herramientas/google-sheets",
    ejemplo: "https://docs.google.com/spreadsheets/d/…",
  },
  google_docs: {
    icono: FileText,
    etiqueta: "Google Doc",
    recurso: "documento",
    endpoint: "/api/herramientas/google-docs",
    ejemplo: "https://docs.google.com/document/d/…",
  },
} as const;

function metaTipo(tool_type: string) {
  return TIPO[tool_type as HerramientaTipo] ?? TIPO.google_docs;
}

/** Mínimos del backend (schemas.py): si no se cumplen, la API responde 422. */
const MIN = { url: 10, nombre: 2, descripcion: 5 };

type Formulario =
  | { modo: "crear"; tipo: HerramientaTipo }
  | { modo: "editar"; herramienta: HerramientaOut };

export default function HerramientasPage() {
  const herramientas = useApi<HerramientaOut[]>("/api/herramientas");
  const info = useApi<HerramientaInfoOut>("/api/herramientas/info");

  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [aEliminar, setEliminar] = useState<HerramientaOut | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const lista = herramientas.data ?? [];
  const correo = info.data?.correo_servicio ?? null;

  // ---- Acciones sobre una herramienta ya guardada ---------------------
  const verificar = async (h: HerramientaOut) => {
    setErrorAccion(null);
    setAviso(null);
    setOcupada(h.tool_key);
    try {
      await apiFetch<HerramientaOut>(`/api/herramientas/${h.tool_key}/verificar`, {
        method: "POST",
      });
      setAviso(`"${h.display_name}" sigue accesible.`);
      herramientas.recargar(true);
    } catch (e) {
      setErrorAccion(mensajeDeError(e, "No se pudo verificar la herramienta."));
    } finally {
      setOcupada(null);
    }
  };

  const alternarActiva = async (h: HerramientaOut) => {
    setErrorAccion(null);
    setAviso(null);
    setOcupada(h.tool_key);
    try {
      await apiFetch<HerramientaOut>(`/api/herramientas/${h.tool_key}`, {
        method: "PATCH",
        json: { is_enabled: !h.is_enabled },
      });
      herramientas.recargar(true);
    } catch (e) {
      setErrorAccion(mensajeDeError(e, "No se pudo cambiar el estado."));
    } finally {
      setOcupada(null);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    setEliminando(true);
    setErrorAccion(null);
    try {
      await apiFetch(`/api/herramientas/${aEliminar.tool_key}`, { method: "DELETE" });
      setAviso(`"${aEliminar.display_name}" se quitó de las herramientas del agente.`);
      setEliminar(null);
      herramientas.recargar(true);
    } catch (e) {
      setErrorAccion(mensajeDeError(e, "No se pudo eliminar la herramienta."));
    } finally {
      setEliminando(false);
    }
  };

  const alGuardar = (mensaje: string) => {
    setFormulario(null);
    setErrorAccion(null);
    setAviso(mensaje);
    herramientas.recargar(true);
  };

  const sinCredencial = info.error !== null;

  return (
    <>
      <PageHeader
        titulo="Herramientas"
        sub="lo que tu agente puede consultar"
        acciones={
          <>
            <Boton
              variante="fantasma"
              onClick={() => herramientas.recargar()}
              loading={herramientas.loading}
              title="Actualizar"
            >
              <RefreshCw size={13} aria-hidden />
              Actualizar
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => setFormulario({ modo: "crear", tipo: "google_docs" })}
              disabled={sinCredencial}
            >
              <FileText size={13} aria-hidden />
              Conectar Doc
            </Boton>
            <Boton
              variante="primario"
              onClick={() => setFormulario({ modo: "crear", tipo: "google_sheets" })}
              disabled={sinCredencial}
            >
              <Plus size={13} aria-hidden />
              Conectar Sheet
            </Boton>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {herramientas.error && <Aviso tipo="error">{herramientas.error}</Aviso>}
          {errorAccion && <Aviso tipo="error">{errorAccion}</Aviso>}
          {aviso && <Aviso tipo="exito">{aviso}</Aviso>}

          {/* Cómo dar acceso: sin esto, conectar siempre va a fallar */}
          <section className="rounded-md border border-bg-700 bg-bg-900 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-bg-700 bg-bg-800 text-text-400">
                <ShieldCheck size={16} aria-hidden />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h2 className="text-sm font-medium text-text-100">
                  Antes de conectar: comparte el documento
                </h2>
                <p className="text-xs leading-relaxed text-text-400">
                  Abre tu Sheet o Doc en Google, pulsa <strong>Compartir</strong> y agrega
                  este correo con permiso de <strong>Lector</strong>. Es el mismo paso que
                  harías con cualquier colaborador; no hace falta que inicies sesión aquí.
                </p>

                {info.loading && !info.data ? (
                  <span className="font-mono text-[11px] text-text-600">cargando…</span>
                ) : correo ? (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-bg-700 bg-bg-950 px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-100">
                      {correo}
                    </span>
                    <CopyButton text={correo} label="Copiar correo" />
                  </div>
                ) : (
                  <Aviso tipo="error">
                    {info.error ??
                      "El portal todavía no tiene configurada la cuenta de servicio de Google."}{" "}
                    Sin ella no se pueden conectar documentos.
                  </Aviso>
                )}
              </div>
            </div>
          </section>

          {/* Lista */}
          {herramientas.loading && !herramientas.data ? (
            <p className="px-1 font-mono text-xs text-text-600">cargando…</p>
          ) : lista.length === 0 ? (
            <section className="flex flex-col items-center gap-3 rounded-md border border-dashed border-bg-700 px-6 py-10 text-center">
              <Wrench size={20} className="text-text-600" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="text-sm text-text-100">Tu agente todavía no tiene herramientas</p>
                <p className="max-w-md text-xs leading-relaxed text-text-400">
                  Conecta una hoja de cálculo con tus precios, tu stock o tus horarios, o un
                  documento con las preguntas frecuentes. El agente la consulta cuando la
                  conversación lo pide.
                </p>
              </div>
              <Boton
                variante="primario"
                onClick={() => setFormulario({ modo: "crear", tipo: "google_sheets" })}
                disabled={sinCredencial}
              >
                <Plus size={13} aria-hidden />
                Conectar un Sheet
              </Boton>
            </section>
          ) : (
            <section className="overflow-hidden rounded-md border border-bg-700 bg-bg-900">
              {lista.map((h, i) => {
                const { icono: Icono, etiqueta } = metaTipo(h.tool_type);
                const trabajando = ocupada === h.tool_key;
                return (
                  <article
                    key={h.tool_key}
                    className={cn(
                      "flex flex-wrap items-start gap-3 px-4 py-3",
                      i > 0 && "border-t border-bg-700",
                      !h.is_enabled && "opacity-60",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                        h.is_enabled
                          ? "border-success/40 bg-success-bg text-success"
                          : "border-bg-700 bg-bg-800 text-text-400",
                      )}
                    >
                      <Icono size={16} aria-hidden />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-text-100">
                          {h.display_name}
                        </span>
                        <Badge>{etiqueta}</Badge>
                        {h.is_enabled ? (
                          <Badge tone="success">activa</Badge>
                        ) : (
                          <Badge tone="warning">pausada</Badge>
                        )}
                      </div>

                      <p className="text-xs leading-relaxed text-text-400">{h.description}</p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-text-600">
                        {h.url_original ? (
                          <a
                            href={h.url_original}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-text-400 underline-offset-2 hover:text-text-100 hover:underline"
                          >
                            {h.nombre_documento ?? "abrir documento"}
                            <ExternalLink size={11} aria-hidden />
                          </a>
                        ) : (
                          h.nombre_documento && <span>{h.nombre_documento}</span>
                        )}
                        <span>clave {h.tool_key}</span>
                        {h.last_verified_at && (
                          <span>verificada {formatoFechaHora(h.last_verified_at)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Boton
                        variante="fantasma"
                        onClick={() => verificar(h)}
                        loading={trabajando}
                        title="Comprobar que el documento sigue compartido"
                      >
                        <RefreshCw size={13} aria-hidden />
                        Verificar
                      </Boton>
                      <Boton
                        variante="fantasma"
                        onClick={() => setFormulario({ modo: "editar", herramienta: h })}
                        disabled={trabajando}
                        aria-label={`Editar ${h.display_name}`}
                        className="min-h-8 px-2"
                      >
                        <Pencil size={13} aria-hidden />
                      </Boton>
                      <Boton
                        variante="secundario"
                        onClick={() => alternarActiva(h)}
                        disabled={trabajando}
                      >
                        {h.is_enabled ? "Pausar" : "Activar"}
                      </Boton>
                      <Boton
                        variante="fantasma"
                        onClick={() => setEliminar(h)}
                        disabled={trabajando}
                        aria-label={`Eliminar ${h.display_name}`}
                        className="min-h-8 px-2 hover:text-danger"
                      >
                        <Trash2 size={13} aria-hidden />
                      </Boton>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </div>

      {formulario && (
        <FormularioHerramienta
          formulario={formulario}
          correoServicio={correo}
          onCerrar={() => setFormulario(null)}
          onGuardado={alGuardar}
        />
      )}

      <ConfirmDialog
        open={aEliminar !== null}
        onOpenChange={(o) => {
          if (!o && !eliminando) setEliminar(null);
        }}
        titulo={`¿Eliminar "${aEliminar?.display_name ?? ""}"?`}
        descripcion="Tu agente dejará de consultar este documento. El documento en Google no se toca; puedes volver a conectarlo cuando quieras."
        confirmar="Eliminar"
        peligro
        loading={eliminando}
        onConfirm={confirmarEliminar}
      />
    </>
  );
}

// ------------------------------------------------------------
// Diálogo de alta / edición
// ------------------------------------------------------------
function FormularioHerramienta({
  formulario,
  correoServicio,
  onCerrar,
  onGuardado,
}: {
  formulario: Formulario;
  correoServicio: string | null;
  onCerrar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const editando = formulario.modo === "editar";
  const tipo: HerramientaTipo = editando
    ? ((formulario.herramienta.tool_type as HerramientaTipo) ?? "google_docs")
    : formulario.tipo;
  const meta = metaTipo(tipo);
  const esSheet = tipo === "google_sheets";

  const [url, setUrl] = useState(
    editando ? (formulario.herramienta.url_original ?? "") : "",
  );
  const [nombre, setNombre] = useState(
    editando ? formulario.herramienta.display_name : "",
  );
  const [descripcion, setDescripcion] = useState(
    editando ? formulario.herramienta.description : "",
  );
  const [rango, setRango] = useState("A:Z");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completo =
    nombre.trim().length >= MIN.nombre &&
    descripcion.trim().length >= MIN.descripcion &&
    (editando || url.trim().length >= MIN.url);

  const guardar = async () => {
    if (!completo || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        await apiFetch<HerramientaOut>(
          `/api/herramientas/${formulario.herramienta.tool_key}`,
          {
            method: "PATCH",
            json: { display_name: nombre.trim(), description: descripcion.trim() },
          },
        );
        onGuardado(`"${nombre.trim()}" actualizada.`);
        return;
      }

      const creada = await apiFetch<HerramientaOut>(meta.endpoint, {
        method: "POST",
        json: {
          url: url.trim(),
          display_name: nombre.trim(),
          description: descripcion.trim(),
          ...(esSheet ? { rango: rango.trim() || "A:Z" } : {}),
        },
      });
      onGuardado(
        `"${creada.display_name}" conectada${
          creada.nombre_documento ? ` a ${creada.nombre_documento}` : ""
        }.`,
      );
    } catch (e) {
      // El 403 del backend ya trae el correo y qué hacer: se muestra tal cual.
      setError(mensajeDeError(e, "No se pudo guardar la herramienta."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o && !guardando) onCerrar();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-bg-700 bg-bg-900 shadow-xl">
          <header className="flex items-start justify-between gap-3 border-b border-bg-700 px-5 py-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Dialog.Title className="text-sm font-medium text-text-100">
                {editando ? "Editar herramienta" : `Conectar un ${meta.etiqueta}`}
              </Dialog.Title>
              <Dialog.Description className="font-mono text-[11px] text-text-600">
                {editando
                  ? "el documento y su enlace no cambian"
                  : "se comprueba el acceso antes de guardar"}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Boton
                variante="fantasma"
                disabled={guardando}
                aria-label="Cerrar"
                className="min-h-8 shrink-0 px-2"
              >
                <X size={14} aria-hidden />
              </Boton>
            </Dialog.Close>
          </header>

          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
            {error && <Aviso tipo="error">{error}</Aviso>}

            {!editando && (
              <Campo
                id="herramienta-url"
                label={`Enlace del ${meta.recurso}`}
                hint={meta.ejemplo}
              >
                <input
                  id="herramienta-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={guardando}
                  placeholder={meta.ejemplo}
                  className={inputClass}
                  autoFocus
                />
              </Campo>
            )}

            <Campo
              id="herramienta-nombre"
              label="Nombre"
              hint="cómo lo vas a reconocer tú en esta lista"
            >
              <input
                id="herramienta-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={guardando}
                maxLength={255}
                placeholder={esSheet ? "Lista de precios" : "Preguntas frecuentes"}
                className={inputClass}
              />
            </Campo>

            <Campo
              id="herramienta-descripcion"
              label="Cuándo debe consultarlo el agente"
              hint="esto lo lee la IA para decidir si usar la herramienta: sé concreto"
            >
              <textarea
                id="herramienta-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                disabled={guardando}
                maxLength={1000}
                rows={3}
                placeholder={
                  esSheet
                    ? "Cuando el cliente pregunte por el precio o la disponibilidad de un producto."
                    : "Cuando el cliente pregunte por horarios, garantías o formas de pago."
                }
                className={cn(inputClass, "resize-y")}
              />
            </Campo>

            {!editando && esSheet && (
              <Campo
                id="herramienta-rango"
                label="Rango"
                hint="notación A1. Déjalo así para leer toda la hoja"
              >
                <input
                  id="herramienta-rango"
                  type="text"
                  value={rango}
                  onChange={(e) => setRango(e.target.value)}
                  disabled={guardando}
                  maxLength={100}
                  placeholder="A:Z"
                  className={inputClass}
                />
              </Campo>
            )}

            {!editando && correoServicio && (
              <p className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] leading-relaxed text-text-600">
                <span>Debe estar compartido con</span>
                <span className="text-text-400">{correoServicio}</span>
                <CopyButton text={correoServicio} label="Copiar correo" />
              </p>
            )}
          </div>

          <footer className="flex justify-end gap-2 border-t border-bg-700 px-5 py-3.5">
            <Dialog.Close asChild>
              <Boton variante="secundario" disabled={guardando}>
                Cancelar
              </Boton>
            </Dialog.Close>
            <Boton
              variante="primario"
              onClick={guardar}
              loading={guardando}
              disabled={!completo}
            >
              {editando ? "Guardar cambios" : "Comprobar y conectar"}
            </Boton>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
