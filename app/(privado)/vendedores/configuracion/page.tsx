"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Edit, GitBranch, Layers, Plus, Trash2, X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type {
  PipelineConfigOut,
  PipelineEtapaOut,
  PipelineTransicionOut,
} from "@/lib/types";
import { fmtInt } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "@/app/components/badge";
import {
  ModuloApagado,
  VendedoresTabs,
  esGerencia,
  useServicios,
} from "@/app/components/modulo-vendedores";
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  ConfirmDialog,
  Interruptor,
  PageHeader,
  inputClass,
} from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

export default function ConfiguracionEmbudoPage() {
  const { usuario } = useUsuario();
  const servicios = useServicios();
  const gerencia = esGerencia(usuario);

  const activo = servicios.data?.gestion_vendedores_activo ?? false;
  const config = useApi<PipelineConfigOut>(
    activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}/pipeline-config` : null,
  );

  const [aviso, setAviso] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  // id de la etapa (o "origen-destino" de una transición) que tiene una
  // petición en curso, para deshabilitar solo ese control.
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [formEtapa, setFormEtapa] = useState<"nueva" | PipelineEtapaOut | null>(null);
  const [aEliminar, setAEliminar] = useState<PipelineEtapaOut | null>(null);

  const etapas = config.data?.etapas ?? [];
  const transiciones = config.data?.transiciones ?? [];

  const eliminarEtapa = async () => {
    if (!aEliminar) return;
    const etapa = aEliminar;
    setErrorAccion(null);
    setOcupado(etapa.id);
    try {
      await apiFetch(`/api/pipeline-etapas/${etapa.id}`, { method: "DELETE" });
      setAEliminar(null);
      setAviso(`Etapa "${etapa.nombre}" eliminada.`);
      await config.recargar(true);
    } catch (e) {
      setErrorAccion(mensajeDeError(e, "No se pudo eliminar la etapa."));
    } finally {
      setOcupado(null);
    }
  };

  const alternarTransicion = async (t: PipelineTransicionOut) => {
    if (!servicios.tenantId) return;
    const clave = `${t.etapa_origen_id}-${t.etapa_destino_id}`;
    setErrorAccion(null);
    setOcupado(clave);
    try {
      await apiFetch<PipelineTransicionOut>("/api/pipeline-transiciones", {
        method: "POST",
        json: {
          tenant_id: servicios.tenantId,
          etapa_origen_id: t.etapa_origen_id,
          etapa_destino_id: t.etapa_destino_id,
          permitida: !t.permitida,
        },
      });
      await config.recargar(true);
    } catch (e) {
      setErrorAccion(mensajeDeError(e, "No se pudo cambiar la transición."));
    } finally {
      setOcupado(null);
    }
  };

  const cargandoInicial = servicios.loading && !servicios.data;

  return (
    <>
      <PageHeader
        titulo="Vendedores"
        sub={<VendedoresTabs />}
        acciones={
          activo &&
          gerencia && (
            <Boton variante="primario" onClick={() => setFormEtapa("nueva")}>
              <Plus size={13} aria-hidden />
              Nueva etapa
            </Boton>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {servicios.error && <Aviso tipo="error">{servicios.error}</Aviso>}
          {config.error && <Aviso tipo="error">{config.error}</Aviso>}
          {errorAccion && <Aviso tipo="error">{errorAccion}</Aviso>}
          {aviso && <Aviso tipo="exito">{aviso}</Aviso>}

          {cargandoInicial ? (
            <Cargando />
          ) : !activo ? (
            servicios.tenantId && (
              <ModuloApagado
                tenantId={servicios.tenantId}
                onActivado={() => servicios.recargar()}
              />
            )
          ) : (
            <>
              <Aviso tipo="info">
                Esto define cómo te gustaría organizar tu embudo. Todavía no reemplaza las
                etapas del embudo real (arriba en &quot;Embudo&quot;): esas se muestran acá con
                sus colores y leads activos de hoy como punto de partida.
              </Aviso>

              {/* Etapas */}
              <section className="rounded-md border border-bg-700 bg-bg-900 p-4">
                <header className="mb-3 flex items-center gap-2">
                  <Layers size={14} className="text-text-400" aria-hidden />
                  <div>
                    <h2 className="text-sm font-medium text-text-100">Etapas</h2>
                    <p className="font-mono text-[11px] text-text-600">
                      {fmtInt.format(etapas.length)} configuradas
                    </p>
                  </div>
                </header>

                {config.loading && !config.data ? (
                  <p className="px-1 font-mono text-xs text-text-600">cargando…</p>
                ) : etapas.length === 0 ? (
                  <p className="px-1 text-xs text-text-400">Todavía no hay etapas configuradas.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {etapas.map((e) => (
                      <TarjetaEtapa
                        key={e.id}
                        etapa={e}
                        gerencia={gerencia}
                        ocupado={ocupado === e.id}
                        onEditar={() => setFormEtapa(e)}
                        onEliminar={() => setAEliminar(e)}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Transiciones */}
              <section className="overflow-hidden rounded-md border border-bg-700 bg-bg-900">
                <header className="flex items-center gap-2 border-b border-bg-700 px-4 py-3">
                  <GitBranch size={14} className="text-text-400" aria-hidden />
                  <div>
                    <h2 className="text-sm font-medium text-text-100">Transiciones permitidas</h2>
                    <p className="font-mono text-[11px] text-text-600">
                      por defecto, todos los movimientos entre etapas son válidos
                    </p>
                  </div>
                </header>

                {transiciones.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-text-400">
                    Agrega al menos dos etapas para configurar transiciones entre ellas.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-bg-700 text-text-600">
                          <th className="px-4 py-2 font-normal">De</th>
                          <th className="px-4 py-2 font-normal">Hacia</th>
                          <th className="px-4 py-2 font-normal">Permitida</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transiciones.map((t) => {
                          const clave = `${t.etapa_origen_id}-${t.etapa_destino_id}`;
                          return (
                            <tr key={t.id} className="border-b border-bg-700 last:border-0">
                              <td className="px-4 py-2 text-text-100">{t.etapa_origen_nombre}</td>
                              <td className="px-4 py-2 text-text-100">{t.etapa_destino_nombre}</td>
                              <td className="px-4 py-2">
                                <Interruptor
                                  checked={t.permitida}
                                  onChange={() => alternarTransicion(t)}
                                  disabled={!gerencia || ocupado === clave}
                                  label={`${t.etapa_origen_nombre} a ${t.etapa_destino_nombre}`}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {formEtapa && servicios.tenantId && (
        <FormularioEtapa
          tenantId={servicios.tenantId}
          etapa={formEtapa === "nueva" ? null : formEtapa}
          onCerrar={() => setFormEtapa(null)}
          onGuardado={(mensaje) => {
            setFormEtapa(null);
            setErrorAccion(null);
            setAviso(mensaje);
            config.recargar(true);
          }}
        />
      )}

      <ConfirmDialog
        open={aEliminar !== null}
        onOpenChange={(o) => {
          if (!o && ocupado !== aEliminar?.id) setAEliminar(null);
        }}
        titulo={`¿Eliminar "${aEliminar?.nombre ?? ""}"?`}
        descripcion={
          aEliminar && aEliminar.leads_activos > 0 ? (
            <span className="text-warning">
              Tiene {fmtInt.format(aEliminar.leads_activos)} lead(s) activos en el embudo real.
              No se puede eliminar hasta que se muevan a otra etapa.
            </span>
          ) : (
            "Esta acción no se puede deshacer."
          )
        }
        confirmar="Eliminar"
        peligro
        loading={ocupado === aEliminar?.id}
        onConfirm={eliminarEtapa}
      />
    </>
  );
}

// ------------------------------------------------------------
function TarjetaEtapa({
  etapa,
  gerencia,
  ocupado,
  onEditar,
  onEliminar,
}: {
  etapa: PipelineEtapaOut;
  gerencia: boolean;
  ocupado: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  return (
    <article className="flex flex-col gap-2 rounded-md border border-bg-700 bg-bg-950 p-3">
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-white/10"
          style={{ backgroundColor: etapa.color }}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-text-100">{etapa.nombre}</h3>
            <Badge title="orden dentro del embudo">orden {etapa.orden}</Badge>
            {etapa.leads_activos > 0 && (
              <Badge tone="info" title="leads del embudo real en esta etapa hoy">
                {fmtInt.format(etapa.leads_activos)} activos
              </Badge>
            )}
          </div>
          {etapa.descripcion && (
            <p className="text-xs leading-relaxed text-text-400">{etapa.descripcion}</p>
          )}
        </div>
      </div>

      {gerencia && (
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={onEditar} disabled={ocupado} title="Editar etapa">
            <Edit size={13} aria-hidden />
            Editar
          </Boton>
          <Boton
            variante="fantasma"
            onClick={onEliminar}
            loading={ocupado}
            disabled={etapa.leads_activos > 0}
            title={
              etapa.leads_activos > 0
                ? "Tiene leads activos en el embudo real"
                : "Eliminar etapa"
            }
            className="text-danger hover:bg-danger/10"
          >
            <Trash2 size={13} aria-hidden />
            Eliminar
          </Boton>
        </div>
      )}
    </article>
  );
}

// ------------------------------------------------------------
// Crear / editar etapa
// ------------------------------------------------------------
function FormularioEtapa({
  tenantId,
  etapa,
  onCerrar,
  onGuardado,
}: {
  tenantId: string;
  /** null = crear */
  etapa: PipelineEtapaOut | null;
  onCerrar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState(etapa?.nombre ?? "");
  const [color, setColor] = useState(etapa?.color ?? "#3987E5");
  const [descripcion, setDescripcion] = useState(etapa?.descripcion ?? "");
  const [orden, setOrden] = useState(String(etapa?.orden ?? 0));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nombreValido = nombre.trim().length > 0;
  const colorValido = /^#[0-9A-Fa-f]{6}$/.test(color);
  const ordenValido = orden.trim() === "" || !Number.isNaN(Number(orden));
  const puedeGuardar = nombreValido && colorValido && ordenValido && !guardando;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      if (etapa) {
        await apiFetch(`/api/pipeline-etapas/${etapa.id}`, {
          method: "PATCH",
          json: {
            nombre: nombre.trim(),
            color,
            descripcion: descripcion.trim() || null,
            orden: orden.trim() ? Number(orden) : 0,
          },
        });
        onGuardado(`Etapa "${nombre.trim()}" actualizada.`);
      } else {
        await apiFetch("/api/pipeline-etapas", {
          method: "POST",
          json: {
            tenant_id: tenantId,
            nombre: nombre.trim(),
            color,
            descripcion: descripcion.trim() || null,
            orden: orden.trim() ? Number(orden) : 0,
          },
        });
        onGuardado(`Etapa "${nombre.trim()}" creada.`);
      }
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo guardar la etapa."));
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
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-700 bg-bg-900 shadow-xl">
          <header className="flex items-start gap-3 border-b border-bg-700 px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="text-sm font-medium text-text-100">
                {etapa ? "Editar etapa" : "Nueva etapa"}
              </Dialog.Title>
              <Dialog.Description className="text-[11px] text-text-600">
                Configuración del embudo, no cambia las etapas reales todavía.
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

          <form
            className="flex flex-col gap-4 px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
          >
            {error && <Aviso tipo="error">{error}</Aviso>}

            <Campo id="etapa-nombre" label="Nombre" hint="Obligatorio, único en tu negocio">
              <input
                id="etapa-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={guardando}
                maxLength={50}
                placeholder="Ej: Interesado"
                className={inputClass}
                autoFocus
              />
            </Campo>

            <Campo
              id="etapa-color"
              label="Color"
              error={color && !colorValido ? "Debe ser un color hexadecimal" : undefined}
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorValido ? color : "#3987E5"}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={guardando}
                  className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-bg-700 bg-bg-900 p-1"
                  aria-label="Elegir color"
                />
                <input
                  id="etapa-color"
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={guardando}
                  maxLength={7}
                  placeholder="#3987E5"
                  className={cn(inputClass, "font-mono")}
                />
              </div>
            </Campo>

            <Campo id="etapa-orden" label="Orden" hint="Posición dentro del embudo">
              <input
                id="etapa-orden"
                type="number"
                step={1}
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                disabled={guardando}
                className={inputClass}
              />
            </Campo>

            <Campo id="etapa-descripcion" label="Descripción" hint="Opcional">
              <textarea
                id="etapa-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                disabled={guardando}
                rows={3}
                maxLength={500}
                placeholder="Qué significa esta etapa para tu equipo…"
                className={cn(inputClass, "resize-y")}
              />
            </Campo>

            <footer className="flex justify-end gap-2 border-t border-bg-700 pt-4">
              <Dialog.Close asChild>
                <Boton variante="secundario" disabled={guardando}>
                  Cancelar
                </Boton>
              </Dialog.Close>
              <Boton type="submit" variante="primario" loading={guardando} disabled={!puedeGuardar}>
                {etapa ? "Guardar" : "Crear"}
              </Boton>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
