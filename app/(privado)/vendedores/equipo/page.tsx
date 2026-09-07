"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bot, Plus, RefreshCw, Shuffle, UserRound, Users, X } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type {
  ConfigAsignacionOut,
  EstrategiaAsignacion,
  ReasignacionOut,
  ServiciosOut,
  VendedorOut,
} from "@/lib/types";
import { ESTRATEGIA_INFO, fmtInt, formatoFechaHora } from "@/lib/formato";
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

const ESTRATEGIAS: EstrategiaAsignacion[] = ["carga", "round_robin", "manual"];

export default function EquipoPage() {
  const { usuario } = useUsuario();
  const servicios = useServicios();
  const gerencia = esGerencia(usuario);

  const activo = servicios.data?.gestion_vendedores_activo ?? false;
  const base = activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}` : null;

  const config = useApi<ConfigAsignacionOut>(base ? `${base}/config-vendedores` : null);
  const vendedores = useApi<VendedorOut[]>(base ? `${base}/vendedores` : null);

  const [aviso, setAviso] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [apagarModulo, setApagarModulo] = useState(false);
  const [aReasignar, setReasignar] = useState<VendedorOut | null>(null);

  const lista = vendedores.data ?? [];
  const activos = lista.filter((v) => v.activo);

  // ---- Servicios --------------------------------------------------------
  const patchServicios = async (cambio: Partial<ServiciosOut>) => {
    if (!servicios.tenantId) return;
    setErrorAccion(null);
    setAviso(null);
    setOcupado("servicios");
    try {
      await apiFetch<ServiciosOut>(`/api/tenants/${servicios.tenantId}/servicios`, {
        method: "PATCH",
        json: cambio,
      });
      await servicios.recargar(true);
    } catch (e) {
      setErrorAccion(mensajeDeError(e, "No se pudo cambiar el servicio."));
    } finally {
      setOcupado(null);
    }
  };

  // ---- Estrategia -------------------------------------------------------
  const cambiarEstrategia = async (estrategia: EstrategiaAsignacion) => {
    if (!base || config.data?.estrategia_asignacion === estrategia) return;
    setErrorAccion(null);
    setAviso(null);
    setOcupado("estrategia");
    try {
      await apiFetch<ConfigAsignacionOut>(`${base}/config-vendedores`, {
        method: "PATCH",
        json: { estrategia_asignacion: estrategia },
      });
      await config.recargar(true);
      setAviso(`Reparto cambiado a "${ESTRATEGIA_INFO[estrategia].label}".`);
    } catch (e) {
      setErrorAccion(mensajeDeError(e, "No se pudo cambiar la estrategia."));
    } finally {
      setOcupado(null);
    }
  };

  // ---- Vendedores -------------------------------------------------------
  const alternarActivo = async (v: VendedorOut) => {
    setErrorAccion(null);
    setAviso(null);
    setOcupado(v.id);
    try {
      await apiFetch<VendedorOut>(`/api/vendedores/${v.id}`, {
        method: "PATCH",
        json: { activo: !v.activo },
      });
      await vendedores.recargar(true);
      if (v.activo && v.clientes_activos > 0) {
        setAviso(
          `${v.nombre} ya no recibe leads nuevos. Sigue teniendo ${v.clientes_activos} abiertos: usa "Repartir sus leads" si quieres moverlos.`,
        );
      }
    } catch (e) {
      setErrorAccion(mensajeDeError(e, "No se pudo cambiar el estado del vendedor."));
    } finally {
      setOcupado(null);
    }
  };

  const confirmarReasignar = async () => {
    if (!aReasignar) return;
    const v = aReasignar;
    setErrorAccion(null);
    setAviso(null);
    setOcupado(v.id);
    try {
      const r = await apiFetch<ReasignacionOut>(`/api/vendedores/${v.id}/reasignar-pendientes`, {
        method: "POST",
      });
      setReasignar(null);
      await vendedores.recargar(true);
      const partes = [`${fmtInt.format(r.reasignados)} leads de ${v.nombre} repartidos`];
      if (r.sin_destino > 0) {
        partes.push(
          `${fmtInt.format(r.sin_destino)} se quedaron con ${v.nombre} porque no había otro vendedor activo`,
        );
      }
      setAviso(partes.join(". ") + ".");
    } catch (e) {
      setErrorAccion(mensajeDeError(e, "No se pudieron repartir los leads."));
    } finally {
      setOcupado(null);
    }
  };

  const cargandoInicial = servicios.loading && !servicios.data;
  const s = servicios.data;
  const estrategiaActual = config.data?.estrategia_asignacion;

  return (
    <>
      <PageHeader
        titulo="Vendedores"
        sub={<VendedoresTabs />}
        acciones={
          activo && (
            <>
              <Boton
                variante="fantasma"
                onClick={() => {
                  vendedores.recargar();
                  config.recargar(true);
                }}
                loading={vendedores.loading}
                title="Actualizar"
              >
                <RefreshCw size={13} aria-hidden />
                Actualizar
              </Boton>
              {gerencia && (
                <Boton variante="primario" onClick={() => setNuevo(true)}>
                  <Plus size={13} aria-hidden />
                  Nuevo vendedor
                </Boton>
              )}
            </>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {servicios.error && <Aviso tipo="error">{servicios.error}</Aviso>}
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
              {/* Servicios */}
              <section className="rounded-md border border-bg-700 bg-bg-900 p-4">
                <header className="mb-3">
                  <h2 className="text-sm font-medium text-text-100">Servicios del negocio</h2>
                  <p className="font-mono text-[11px] text-text-600">
                    funcionan por separado: puedes tener uno, el otro o los dos
                  </p>
                </header>
                <div className="flex flex-col divide-y divide-bg-700">
                  <FilaServicio
                    icono={Bot}
                    titulo="Agente de IA"
                    descripcion="Contesta a los clientes en automático. Si lo apagas, cada lead nuevo dispara un aviso directo al vendedor asignado."
                    checked={s?.agente_ia_activo ?? true}
                    disabled={!gerencia || ocupado === "servicios"}
                    onChange={(v) => patchServicios({ agente_ia_activo: v })}
                  />
                  <FilaServicio
                    icono={Users}
                    titulo="Gestión de vendedores"
                    descripcion="Embudo de venta y reparto de leads. Al apagarlo, los datos se conservan pero el equipo deja de recibir clientes."
                    checked={s?.gestion_vendedores_activo ?? false}
                    disabled={!gerencia || ocupado === "servicios"}
                    onChange={(v) => (v ? patchServicios({ gestion_vendedores_activo: true }) : setApagarModulo(true))}
                  />
                </div>
                {!gerencia && (
                  <p className="mt-3 font-mono text-[11px] text-text-600">
                    solo el dueño del negocio puede cambiar esto
                  </p>
                )}
              </section>

              {/* Estrategia */}
              <section className="rounded-md border border-bg-700 bg-bg-900 p-4">
                <header className="mb-3 flex items-center gap-2">
                  <Shuffle size={14} className="text-text-400" aria-hidden />
                  <div>
                    <h2 className="text-sm font-medium text-text-100">Reparto de leads</h2>
                    <p className="font-mono text-[11px] text-text-600">
                      cómo se decide a quién le toca cada cliente nuevo
                    </p>
                  </div>
                </header>

                {config.error ? (
                  <Aviso tipo="error">{config.error}</Aviso>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label="Estrategia de reparto"
                    className="grid gap-2 sm:grid-cols-3"
                  >
                    {ESTRATEGIAS.map((e) => {
                      const info = ESTRATEGIA_INFO[e];
                      const elegida = estrategiaActual === e;
                      return (
                        <button
                          key={e}
                          type="button"
                          role="radio"
                          aria-checked={elegida}
                          disabled={!gerencia || ocupado === "estrategia" || !config.data}
                          onClick={() => cambiarEstrategia(e)}
                          className={cn(
                            "flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed",
                            elegida
                              ? "border-success/50 bg-success-bg"
                              : "border-bg-700 bg-bg-950 hover:border-bg-600",
                            !gerencia && !elegida && "opacity-60",
                          )}
                        >
                          <span
                            className={cn(
                              "text-xs font-medium",
                              elegida ? "text-success" : "text-text-100",
                            )}
                          >
                            {info.label}
                          </span>
                          <span className="text-[11px] leading-relaxed text-text-400">
                            {info.descripcion}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Equipo */}
              {vendedores.loading && !vendedores.data ? (
                <p className="px-1 font-mono text-xs text-text-600">cargando…</p>
              ) : vendedores.error ? (
                <Aviso tipo="error">{vendedores.error}</Aviso>
              ) : lista.length === 0 ? (
                <section className="flex flex-col items-center gap-3 rounded-md border border-dashed border-bg-700 px-6 py-10 text-center">
                  <UserRound size={20} className="text-text-600" aria-hidden />
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-text-100">Todavía no hay vendedores</p>
                    <p className="max-w-md text-xs leading-relaxed text-text-400">
                      Mientras no haya ninguno activo, los clientes entran al embudo pero quedan
                      sin asignar. Agrega a tu equipo para que empiecen a recibir leads.
                    </p>
                  </div>
                  {gerencia && (
                    <Boton variante="primario" onClick={() => setNuevo(true)}>
                      <Plus size={13} aria-hidden />
                      Agregar vendedor
                    </Boton>
                  )}
                </section>
              ) : (
                <section className="overflow-hidden rounded-md border border-bg-700 bg-bg-900">
                  <header className="flex items-center justify-between border-b border-bg-700 px-4 py-3">
                    <div>
                      <h2 className="text-sm font-medium text-text-100">Equipo</h2>
                      <p className="font-mono text-[11px] text-text-600">
                        {fmtInt.format(activos.length)} activos de {fmtInt.format(lista.length)}
                      </p>
                    </div>
                  </header>
                  {lista.map((v, i) => {
                    const trabajando = ocupado === v.id;
                    return (
                      <article
                        key={v.id}
                        className={cn(
                          "flex flex-wrap items-center gap-3 px-4 py-3",
                          i > 0 && "border-t border-bg-700",
                          !v.activo && "opacity-60",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                            v.activo
                              ? "border-success/40 bg-success-bg text-success"
                              : "border-bg-700 bg-bg-800 text-text-400",
                          )}
                        >
                          <UserRound size={16} aria-hidden />
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-text-100">{v.nombre}</span>
                            {v.activo ? (
                              <Badge tone="success">activo</Badge>
                            ) : (
                              <Badge tone="warning">inactivo</Badge>
                            )}
                            {v.portal_user_id && (
                              <Badge title="Tiene cuenta en el portal">con acceso</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-text-600">
                            {v.telefono && <span>{v.telefono}</span>}
                            <span
                              className={cn(v.clientes_activos > 0 && "text-text-400")}
                            >
                              {fmtInt.format(v.clientes_activos)} leads abiertos
                            </span>
                            <span>desde {formatoFechaHora(v.creado_en)}</span>
                          </div>
                        </div>

                        {gerencia && (
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {v.clientes_activos > 0 && (
                              <Boton
                                variante="fantasma"
                                onClick={() => setReasignar(v)}
                                disabled={trabajando}
                                title="Mover sus leads abiertos a otros vendedores activos"
                              >
                                <Shuffle size={13} aria-hidden />
                                Repartir sus leads
                              </Boton>
                            )}
                            <Boton
                              variante="secundario"
                              onClick={() => alternarActivo(v)}
                              loading={trabajando}
                            >
                              {v.activo ? "Desactivar" : "Activar"}
                            </Boton>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {nuevo && (
        <FormularioVendedor
          onCerrar={() => setNuevo(false)}
          onGuardado={(v) => {
            setNuevo(false);
            setErrorAccion(null);
            setAviso(`${v.nombre} ya forma parte del equipo.`);
            vendedores.recargar(true);
          }}
        />
      )}

      <ConfirmDialog
        open={apagarModulo}
        onOpenChange={(o) => {
          if (!o && ocupado !== "servicios") setApagarModulo(false);
        }}
        titulo="¿Apagar la gestión de vendedores?"
        descripcion="El equipo deja de recibir clientes nuevos y esta sección se oculta. El embudo y el historial se conservan; al volver a activarlo todo sigue donde estaba."
        confirmar="Apagar"
        peligro
        loading={ocupado === "servicios"}
        onConfirm={async () => {
          await patchServicios({ gestion_vendedores_activo: false });
          setApagarModulo(false);
        }}
      />

      <ConfirmDialog
        open={aReasignar !== null}
        onOpenChange={(o) => {
          if (!o && ocupado !== aReasignar?.id) setReasignar(null);
        }}
        titulo={`¿Repartir los leads de ${aReasignar?.nombre ?? ""}?`}
        descripcion={
          aReasignar && (
            <>
              Sus {fmtInt.format(aReasignar.clientes_activos)} leads abiertos se mueven a los
              demás vendedores activos según la estrategia actual
              {estrategiaActual && (
                <>
                  {" "}
                  (<span className="text-text-100">{ESTRATEGIA_INFO[estrategiaActual].label}</span>)
                </>
              )}
              . Los ganados y perdidos se quedan a su nombre.
              {activos.filter((v) => v.id !== aReasignar.id).length === 0 && (
                <span className="mt-2 block text-warning">
                  No hay otro vendedor activo: no se va a mover ninguno.
                </span>
              )}
            </>
          )
        }
        confirmar="Repartir"
        loading={ocupado === aReasignar?.id}
        onConfirm={confirmarReasignar}
      />
    </>
  );
}

// ------------------------------------------------------------
function FilaServicio({
  icono: Icono,
  titulo,
  descripcion,
  checked,
  disabled,
  onChange,
}: {
  icono: typeof Bot;
  titulo: string;
  descripcion: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
          checked
            ? "border-success/40 bg-success-bg text-success"
            : "border-bg-700 bg-bg-800 text-text-400",
        )}
      >
        <Icono size={16} aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-text-100">{titulo}</span>
        <p className="text-xs leading-relaxed text-text-400">{descripcion}</p>
      </div>
      <Interruptor
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        label={titulo}
        className="mt-1"
      />
    </div>
  );
}

// ------------------------------------------------------------
// Alta de vendedor
// ------------------------------------------------------------
function FormularioVendedor({
  onCerrar,
  onGuardado,
}: {
  onCerrar: () => void;
  onGuardado: (v: VendedorOut) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mínimo del backend (schemas.py): 2 caracteres.
  const completo = nombre.trim().length >= 2;

  const guardar = async () => {
    if (!completo || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const creado = await apiFetch<VendedorOut>("/api/vendedores", {
        method: "POST",
        json: { nombre: nombre.trim(), telefono: telefono.trim() || null },
      });
      onGuardado(creado);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo agregar el vendedor."));
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
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-bg-700 bg-bg-900 shadow-xl">
          <header className="flex items-start justify-between gap-3 border-b border-bg-700 px-5 py-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Dialog.Title className="text-sm font-medium text-text-100">
                Nuevo vendedor
              </Dialog.Title>
              <Dialog.Description className="font-mono text-[11px] text-text-600">
                empieza a recibir leads en cuanto lo guardes
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

            <Campo id="vendedor-nombre" label="Nombre">
              <input
                id="vendedor-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={guardando}
                maxLength={255}
                placeholder="Ana López"
                className={inputClass}
                autoFocus
              />
            </Campo>

            <Campo
              id="vendedor-telefono"
              label="WhatsApp"
              hint="a este número le llegan los avisos de leads nuevos cuando el agente está apagado"
            >
              <input
                id="vendedor-telefono"
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                disabled={guardando}
                maxLength={50}
                placeholder="52 1 55 0000 0000"
                className={inputClass}
              />
            </Campo>

            <footer className="flex justify-end gap-2 border-t border-bg-700 pt-4">
              <Dialog.Close asChild>
                <Boton variante="secundario" disabled={guardando}>
                  Cancelar
                </Boton>
              </Dialog.Close>
              <Boton type="submit" variante="primario" loading={guardando} disabled={!completo}>
                Agregar
              </Boton>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
