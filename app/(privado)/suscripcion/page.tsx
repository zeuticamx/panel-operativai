"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Coins, CreditCard, ExternalLink, Minus } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type {
  CatalogoPagosOut,
  CrearPagoIn,
  CrearPagoOut,
  EstadoPago,
  Herramienta,
  PlanOut,
  SuscripcionOut,
  TransaccionOut,
} from "@/lib/types";
import { fmtInt, formatoFechaHora, formatoMonto } from "@/lib/formato";
import { HERRAMIENTAS_INFO } from "@/lib/herramientas-plan";
import { cn } from "@/lib/utils";
import { esGerencia } from "@/app/components/modulo-vendedores";
import { PortalStripe } from "@/app/components/portal-stripe";
import { StatCard } from "@/app/components/stat-card";
import { Aviso, Boton, Cargando, PageHeader } from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

/** Herramienta del plan → columna de PlanOut que dice si la incluye. */
const COLUMNA_HERRAMIENTA: Record<Herramienta, keyof PlanOut> = {
  agente: "agente_ia_activo",
  vendedores: "gestion_vendedores_activo",
  herramientas: "herramientas_activo",
  crm_campo: "crm_campo_activo",
  calendario: "calendario_activo",
};

const LEYENDA_NETOS = "Los precios son Netos";
const LEYENDA_CREDITOS = "Créditos: se utilizan al ejecutar herramientas y funciones del agente de IA.";
const LEYENDA_LEADS= "Leads: corresponden a las conversaciones recibidas a través de Meta.";

const noop = () => () => {};

/**
 * ?plan=pro llega desde la vista/modal de bloqueo ("Ver plan Pro"). Se lee
 * de window y no con useSearchParams, que en Next 16 exige un <Suspense>
 * alrededor para que la página siga pudiendo prerenderizarse.
 */
function usePlanDestacado(): string | null {
  return useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get("plan"),
    () => null,
  );
}

/** Cómo se pinta cada estado de pago en el historial. */
const ESTADO_INFO: Record<EstadoPago, { label: string; clase: string }> = {
  aprobado: { label: "Aprobado", clase: "text-success" },
  pendiente: { label: "Pendiente", clase: "text-warning" },
  rechazado: { label: "Rechazado", clase: "text-danger" },
  cancelado: { label: "Cancelado", clase: "text-text-600" },
  reembolsado: { label: "Reembolsado", clase: "text-text-400" },
};

export default function SuscripcionPage() {
  const { usuario } = useUsuario();
  const gerencia = esGerencia(usuario);
  const destacado = usePlanDestacado();

  const catalogo = useApi<CatalogoPagosOut>("/api/pagos/catalogo");
  const suscripcion = useApi<SuscripcionOut>("/api/pagos/suscripcion");
  const historial = useApi<TransaccionOut[]>("/api/pagos/historial");

  // Qué botón está esperando a la pasarela. Es el id de lo que se está
  // comprando ("plan:pro" / "creditos:500") y no un booleano, para que solo
  // gire el spinner del botón que se pulsó.
  const [comprando, setComprando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const s = suscripcion.data;

  /**
   * Pide el checkout al backend y manda el navegador ahí.
   *
   * No se marca nada como pagado acá: el estado real lo escribe el webhook
   * cuando Stripe confirma. Esta pantalla solo abre la puerta.
   */
  const comprar = async (clave: string, cuerpo: CrearPagoIn) => {
    setError(null);
    setComprando(clave);
    try {
      const pago = await apiFetch<CrearPagoOut>("/api/pagos/crear-pago", {
        method: "POST",
        json: cuerpo,
      });
      // assign() y no `location.href = ...`: la regla
      // react-hooks/immutability de eslint-config-next 16 prohíbe asignarle
      // a window.location. El efecto es el mismo.
      window.location.assign(pago.checkout_url);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo iniciar el pago."));
      setComprando(null);
    }
  };

  if (suscripcion.loading && !s) {
    return (
      <>
        <PageHeader titulo="Suscripción" />
        <Cargando />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Suscripción"
        sub={
          s?.plan ? (
            <span className="capitalize">
              plan {s.plan} · {s.estado_suscripcion}
            </span>
          ) : (
            <span>sin plan contratado</span>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {suscripcion.error && <Aviso tipo="error">{suscripcion.error}</Aviso>}
          {catalogo.error && <Aviso tipo="error">{catalogo.error}</Aviso>}

          {!gerencia && (
            <Aviso tipo="info">
              Solo el dueño del negocio puede contratar un plan o comprar créditos.
            </Aviso>
          )}

          {/* Estado actual */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Plan"
              value={s?.plan ? <span className="capitalize">{s.plan}</span> : "—"}
              tone={s?.estado_suscripcion === "activa" ? "success" : "neutral"}
              hint={
                s?.precio_monthly
                  ? `${formatoMonto(s.precio_monthly)} / mes`
                  : "sin contratar"
              }
            />
            <StatCard
              label="Estado"
              value={s?.estado_suscripcion ?? "—"}
              tone={
                s?.estado_suscripcion === "activa"
                  ? "success"
                  : s?.estado_suscripcion === "pausada"
                    ? "warning"
                    : "neutral"
              }
              hint={
                !s?.fecha_renovacion
                  ? "—"
                  : s.cancela_al_vencer
                    ? `cancelada · vigente hasta ${formatoFechaHora(s.fecha_renovacion)}`
                    : s.suscripcion_recurrente
                      ? `se cobra sola el ${formatoFechaHora(s.fecha_renovacion)}`
                      : `renueva ${formatoFechaHora(s.fecha_renovacion)}`
              }
            />
            <StatCard
              label="Créditos"
              value={s ? fmtInt.format(Number(s.creditos_disponibles)) : "—"}
              tone={s && Number(s.creditos_disponibles) > 0 ? "success" : "warning"}
              hint="disponibles"
            />
            <StatCard
              label="Consumidos"
              value={s ? fmtInt.format(Number(s.creditos_gastados)) : "—"}
              hint="histórico"
            />
          </div>

          {usuario?.role === "owner" && !usuario.impersonado_por && s?.portal_disponible && (
            <PortalStripe
              fechaRenovacion={s.fecha_renovacion}
              cancelaAlVencer={s.cancela_al_vencer}
            />
          )}

          {/* Planes */}
          <section data-tour="suscripcion.planes" className="flex flex-col rounded-md border border-bg-700 bg-bg-900 p-4">
            <header className="mb-3">
              <h2 className="text-sm font-medium text-text-100">Planes</h2>
              <p className="font-mono text-[11px] text-text-600">
                Elige el plan que mejor se adapte a tu operación. Cada plan define las herramientas disponibles, el número de vendedores y los créditos mensuales incluidos.
              </p>
              <p className="mt-1 font-mono text-[11px] text-text-600">{LEYENDA_CREDITOS}</p>
              <p className="mt-1 font-mono text-[11px] text-text-600">{LEYENDA_LEADS}</p>
            </header>

            {catalogo.loading && !catalogo.data ? (
              <p className="py-6 text-center font-mono text-xs text-text-600">cargando…</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {(catalogo.data?.planes ?? []).map((plan) => (
                  <TarjetaPlan
                    key={plan.nombre}
                    plan={plan}
                    esActual={s?.plan === plan.nombre && s?.estado_suscripcion === "activa"}
                    recurrente={s?.suscripcion_recurrente ?? false}
                    cancelaAlVencer={s?.cancela_al_vencer ?? false}
                    destacado={destacado === plan.nombre}
                    puedeComprar={gerencia}
                    cargando={comprando === `plan:${plan.nombre}`}
                    bloqueado={comprando !== null}
                    onContratar={() =>
                      comprar(`plan:${plan.nombre}`, {
                        tipo: "subscription",
                        plan: plan.nombre,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {/* Créditos */}
          <section data-tour="suscripcion.creditos" className="flex flex-col rounded-md border border-bg-700 bg-bg-900 p-4">
            <header className="mb-3 flex items-center gap-2">
              <Coins size={14} className="text-text-400" aria-hidden />
              <div>
                <h2 className="text-sm font-medium text-text-100">Comprar créditos</h2>
                <p className="font-mono text-[11px] text-text-600">
                  se suman al saldo y no vencen
                </p>
                <p className="mt-1 font-mono text-[11px] text-text-600">{LEYENDA_CREDITOS}</p>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(catalogo.data?.paquetes ?? []).map((paquete) => {
                const cantidad = Number(paquete.creditos);
                const clave = `creditos:${cantidad}`;
                return (
                  <button
                    key={clave}
                    type="button"
                    disabled={!gerencia || comprando !== null}
                    onClick={() =>
                      comprar(clave, { tipo: "credit_purchase", creditos: cantidad })
                    }
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1 rounded-md border border-bg-700 bg-bg-800 px-3 py-4",
                      "hover:border-text-600 disabled:cursor-not-allowed disabled:opacity-50",
                      comprando === clave && "border-text-400",
                    )}
                  >
                    <span className="text-lg font-semibold tabular-nums text-text-100">
                      {fmtInt.format(cantidad)}
                    </span>
                    <span className="font-mono text-[11px] text-text-600">créditos</span>
                    <span className="mt-1 font-mono text-xs tabular-nums text-text-400">
                      {formatoMonto(paquete.precio)}
                    </span>
                    <span className="font-mono text-[11px] text-text-600">{LEYENDA_NETOS}</span>
                    {comprando === clave && (
                      <span className="font-mono text-[11px] text-text-600">abriendo…</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Historial */}
          <section data-tour="suscripcion.historial" className="flex flex-col overflow-hidden rounded-md border border-bg-700 bg-bg-900">
            <header className="flex items-center gap-2 border-b border-bg-700 px-4 py-3">
              <CreditCard size={14} className="text-text-400" aria-hidden />
              <div>
                <h2 className="text-sm font-medium text-text-100">Historial de pagos</h2>
                <p className="font-mono text-[11px] text-text-600">
                  los últimos movimientos del negocio
                </p>
              </div>
            </header>

            {historial.error && (
              <div className="p-4">
                <Aviso tipo="error">{historial.error}</Aviso>
              </div>
            )}

            {!historial.data ? (
              <p className="p-6 text-center font-mono text-xs text-text-600">cargando…</p>
            ) : historial.data.length === 0 ? (
              <p className="p-6 text-center font-mono text-xs text-text-600">
                todavía no hay pagos
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                      <th className="px-4 py-2 text-left font-normal">Concepto</th>
                      <th className="px-3 py-2 text-left font-normal">Método</th>
                      <th className="px-3 py-2 text-right font-normal">Monto</th>
                      <th className="px-3 py-2 text-left font-normal">Estado</th>
                      <th className="px-4 py-2 text-right font-normal">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.data.map((t) => (
                      <tr key={t.id} className="border-b border-bg-700 last:border-b-0">
                        <td className="px-4 py-2 text-text-100">{t.concepto ?? t.tipo}</td>
                        <td className="px-3 py-2 text-text-400">
                          {t.metodo_pago ?? "—"}
                          {t.ultimos_4_digitos && (
                            <span className="ml-1 font-mono text-[11px] text-text-600">
                              ····{t.ultimos_4_digitos}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-text-100">
                          {formatoMonto(t.monto)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("font-mono text-[11px]", ESTADO_INFO[t.estado_pago].clase)}>
                            {ESTADO_INFO[t.estado_pago].label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-[11px] text-text-600">
                          {formatoFechaHora(t.creado_en)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/** Texto y tooltip del botón de una tarjeta de plan. */
function botonPlan({
  esActual,
  recurrente,
  cancelaAlVencer,
  puedeComprar,
}: {
  esActual: boolean;
  recurrente: boolean;
  cancelaAlVencer: boolean;
  puedeComprar: boolean;
}): { texto: string; title: string; habilitado: boolean } {
  // Con una suscripción recurrente viva el backend responde 409 a cualquier
  // contratación (ver services/stripe_suscripciones.py): se deshabilita acá
  // en vez de dejar que el dueño llegue al error.
  if (recurrente) {
    if (esActual) {
      return cancelaAlVencer
        ? {
            texto: "Cancelación programada",
            title: "Sigue vigente hasta la fecha de renovación y después se pausa",
            habilitado: false,
          }
        : {
            texto: "Se renueva automáticamente",
            title: "Stripe cobra este plan cada mes, no hace falta renovarlo a mano",
            habilitado: false,
          };
    }
    return {
      texto: "Contratar ahora",
      title: cancelaAlVencer
        ? "Podrás contratar otro plan cuando termine el período de tu suscripción actual"
        : "Ya tienes una suscripción con renovación automática. Para cambiar de plan, escríbenos",
      habilitado: false,
    };
  }
  return {
    texto: esActual ? "Renovar ahora" : "Contratar ahora",
    title: puedeComprar ? "Ir al checkout de Stripe" : "Solo el dueño del negocio puede contratar",
    habilitado: puedeComprar,
  };
}

function TarjetaPlan({
  plan,
  esActual,
  recurrente,
  cancelaAlVencer,
  destacado,
  puedeComprar,
  cargando,
  bloqueado,
  onContratar,
}: {
  plan: PlanOut;
  esActual: boolean;
  /** El tenant ya tiene una suscripción de Stripe viva (SuscripcionOut). */
  recurrente: boolean;
  cancelaAlVencer: boolean;
  /** Es el plan que recomendó la vista de bloqueo. */
  destacado: boolean;
  puedeComprar: boolean;
  cargando: boolean;
  bloqueado: boolean;
  onContratar: () => void;
}) {
  const boton = botonPlan({ esActual, recurrente, cancelaAlVencer, puedeComprar });

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-md border bg-bg-800 p-4",
        esActual ? "border-success" : destacado ? "border-text-400" : "border-bg-700",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-text-100 capitalize">{plan.nombre}</h3>
        {esActual ? (
          <span className="rounded bg-success/10 px-1.5 py-0.5 font-mono text-[11px] text-success">
            actual
          </span>
        ) : (
          destacado && (
            <span className="rounded bg-bg-700 px-1.5 py-0.5 font-mono text-[11px] text-text-100">
              incluye lo que buscas
            </span>
          )
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums text-text-100">
            {formatoMonto(plan.precio_monthly)}
          </span>
          <span className="font-mono text-[11px] text-text-600">/ mes</span>
        </div>
        <span className="font-mono text-[11px] text-text-600">{LEYENDA_NETOS}</span>
      </div>

      {plan.descripcion && (
        <p className="text-xs leading-relaxed text-text-400">{plan.descripcion}</p>
      )}

      <ul className="flex flex-col gap-1.5">
        <Caracteristica>
          {plan.max_vendedores === null
            ? "Vendedores ilimitados"
            : `Hasta ${fmtInt.format(plan.max_vendedores)} vendedores`}
        </Caracteristica>
        {/* Solo cuando el plan lo limita: mientras gerencia no defina el
            tope, "proveedores ilimitados" prometería algo no decidido. */}
        {plan.max_proveedores != null && (
          <Caracteristica>
            Hasta {fmtInt.format(plan.max_proveedores)} proveedores en la agenda
          </Caracteristica>
        )}
        <Caracteristica>
          {fmtInt.format(Number(plan.creditos_incluidos_mensual))} créditos al mes
        </Caracteristica>
        {plan.max_leads_mensuales !== null && (
          <Caracteristica>
            {fmtInt.format(plan.max_leads_mensuales)} leads mensuales
          </Caracteristica>
        )}
      </ul>

      <ul className="flex flex-col gap-1.5 border-t border-bg-700 pt-3" aria-label="Herramientas">
        {(Object.keys(COLUMNA_HERRAMIENTA) as Herramienta[]).map((h) => (
          <Caracteristica key={h} incluida={Boolean(plan[COLUMNA_HERRAMIENTA[h]])}>
            {HERRAMIENTAS_INFO[h].nombre}
          </Caracteristica>
        ))}
      </ul>

      <Boton
        variante={esActual ? "fantasma" : "primario"}
        className="mt-auto"
        onClick={onContratar}
        loading={cargando}
        disabled={!boton.habilitado || bloqueado}
        title={boton.title}
      >
        {!cargando && boton.habilitado && <ExternalLink size={13} aria-hidden />}
        {boton.texto}
      </Boton>
    </div>
  );
}

function Caracteristica({
  children,
  incluida = true,
}: {
  children: React.ReactNode;
  incluida?: boolean;
}) {
  return (
    <li className={cn("flex items-start gap-1.5 text-xs", incluida ? "text-text-400" : "text-text-600")}>
      {incluida ? (
        <Check size={12} className="mt-0.5 shrink-0 text-success" aria-hidden />
      ) : (
        <Minus size={12} className="mt-0.5 shrink-0" aria-hidden />
      )}
      {children}
      {!incluida && <span className="sr-only">(no incluido)</span>}
    </li>
  );
}
