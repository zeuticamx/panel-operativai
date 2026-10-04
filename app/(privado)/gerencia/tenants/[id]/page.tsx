"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Eye, MessageSquare, Trash2 } from "lucide-react";
import { apiFetch, iniciarVerComo, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type {
  AjusteCreditosOut,
  EliminacionTenantOut,
  EliminarTenantIn,
  EntradaAuditoriaOut,
  EstadoTenantPlataforma,
  ImpersonarOut,
  OtorgarPruebaIn,
  PlanGerenciaOut,
  RevocarPruebaIn,
  TenantGerenciaOut,
  TransaccionOut,
  UnidadDuracionPrueba,
} from "@/lib/types";
import { fmtInt, formatoFechaHora, formatoMonto, tiempoRelativo } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "@/app/components/badge";
import { CopyButton } from "@/app/components/copy-button";
import { StatCard } from "@/app/components/stat-card";
import {
  ESTADOS_TENANT,
  ESTADO_TENANT_INFO,
  EstadoTenantBadge,
  FUENTE_TIPO_CAMBIO_INFO,
  GerenciaTabs,
  fmtCostoUsd,
  fmtMargen,
  fmtTokens,
} from "@/app/components/gerencia";
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Interruptor,
  PageHeader,
  inputClass,
  selectClass,
} from "@/app/components/ui";

const DIAS = 30;

export default function DetalleTenantPage() {
  const { id } = useParams<{ id: string }>();

  const tenant = useApi<TenantGerenciaOut>(`/api/gerencia/tenants/${id}?dias=${DIAS}`);
  const transacciones = useApi<TransaccionOut[]>(
    `/api/gerencia/tenants/${id}/transacciones?limite=10`,
  );
  const bitacora = useApi<EntradaAuditoriaOut[]>(
    `/api/gerencia/auditoria?tenant_id=${id}&limite=15`,
  );
  const eliminacion = useApi<EliminacionTenantOut>(`/api/gerencia/tenants/${id}/eliminacion`);

  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Nombre del negocio recién eliminado: la ficha ya no existe, se muestra
  // solo la confirmación y el camino de vuelta.
  const [eliminado, setEliminado] = useState<string | null>(null);

  const t = tenant.data;

  if (eliminado) {
    return (
      <>
        <PageHeader titulo="Negocio eliminado" acciones={<GerenciaTabs />} />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex max-w-4xl flex-col gap-4">
            <Aviso tipo="exito">
              <strong>{eliminado}</strong> se eliminó definitivamente. Queda registrado en la
              bitácora de gerencia.
            </Aviso>
            <Link
              href="/gerencia/tenants"
              className="inline-flex w-fit items-center gap-2 text-xs text-text-400 hover:text-text-100"
            >
              <ArrowLeft size={13} aria-hidden />
              Volver a negocios
            </Link>
          </div>
        </div>
      </>
    );
  }

  // ---- Acciones ---------------------------------------------------------
  const tras = async (mensaje: string) => {
    setAviso(mensaje);
    // La eliminación depende del estado y de la suscripción: se revisa de
    // nuevo después de cualquier cambio (típicamente, la baja).
    await Promise.all([
      tenant.recargar(true),
      bitacora.recargar(true),
      eliminacion.recargar(true),
    ]);
  };

  const patch = async (
    ruta: string,
    json: unknown,
    clave: string,
    exito: string,
    fallback: string,
  ) => {
    setError(null);
    setAviso(null);
    setOcupado(clave);
    try {
      await apiFetch<TenantGerenciaOut>(`/api/gerencia/tenants/${id}/${ruta}`, {
        method: "PATCH",
        json,
      });
      await tras(exito);
    } catch (e) {
      setError(mensajeDeError(e, fallback));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <>
      <PageHeader
        titulo={
          <span className="flex items-center gap-2">
            <Link
              href="/gerencia/tenants"
              className="text-text-400 hover:text-text-100"
              aria-label="Volver a negocios"
            >
              <ArrowLeft size={14} aria-hidden />
            </Link>
            {t?.nombre ?? "Negocio"}
          </span>
        }
        sub={`últimos ${DIAS} días`}
        acciones={<GerenciaTabs />}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {tenant.error && <Aviso tipo="error">{tenant.error}</Aviso>}
        {!t && tenant.loading && <Cargando />}

        {t && (
          <div className="flex max-w-4xl flex-col gap-6">
            {error && <Aviso tipo="error">{error}</Aviso>}
            {aviso && <Aviso tipo="exito">{aviso}</Aviso>}

            {/* ---- Identidad ---- */}
            <section className="flex flex-wrap items-center gap-2">
              <EstadoTenantBadge estado={t.estado} motivo={t.estado_motivo} />
              <Badge tone={t.agente_operando ? "success" : "warning"}>
                {t.agente_operando ? "agente respondiendo" : "agente detenido"}
              </Badge>
              {t.plan && <Badge tone="info">{t.plan}</Badge>}
              {pruebaVigente(t) && t.fecha_renovacion && (
                <Badge tone="warning">prueba hasta {formatoFechaHora(t.fecha_renovacion)}</Badge>
              )}
              <span className="flex items-center gap-1 font-mono text-[11px] text-text-600">
                {t.tenant_id}
                <CopyButton text={t.tenant_id} label="Copiar UUID del negocio" />
              </span>
              <Link
                href={`/gerencia/conversaciones?tenant_id=${t.tenant_id}`}
                className="ml-auto inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-bg-700 px-3 py-1.5 text-xs font-medium text-text-100 hover:bg-hover"
              >
                <MessageSquare size={13} aria-hidden />
                Ver conversaciones
              </Link>
              <VerComo tenantId={t.tenant_id} nombre={t.nombre} />
            </section>

            {t.estado !== "activo" && t.estado_motivo && (
              <Aviso tipo="info">
                <strong>{ESTADO_TENANT_INFO[t.estado].label}</strong> · {t.estado_motivo}
                {t.estado_actualizado_por && ` — ${t.estado_actualizado_por}`}
                {t.estado_actualizado_en &&
                  `, ${formatoFechaHora(t.estado_actualizado_en)}`}
              </Aviso>
            )}

            {/* ---- Números ---- */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                label="tokens"
                value={fmtTokens(t.consumo.tokens_total)}
                hint={`${fmtInt.format(t.consumo.llamadas)} llamadas · ${fmtCostoUsd(t.consumo.costo_usd)}`}
              />
              <StatCard
                label="margen del período"
                value={fmtMargen(t.margen, formatoMonto)}
                tone={
                  t.margen === null ? "neutral" : Number(t.margen) < 0 ? "danger" : "success"
                }
                hint={
                  t.margen === null
                    ? FUENTE_TIPO_CAMBIO_INFO[t.tipo_cambio_fuente].detalle
                    : `${formatoMonto(t.ingreso_periodo)} − ${formatoMonto(t.costo_moneda)} de modelos (${FUENTE_TIPO_CAMBIO_INFO[t.tipo_cambio_fuente].label})`
                }
              />
              <StatCard
                label="créditos"
                value={formatoMonto(t.creditos_disponibles)}
                tone={Number(t.creditos_disponibles) > 0 ? "success" : "neutral"}
                hint={`${formatoMonto(t.creditos_gastados)} gastados`}
              />
              <StatCard
                label="equipo"
                value={`${fmtInt.format(t.usuarios_portal)} / ${fmtInt.format(t.vendedores_activos)}`}
                hint="usuarios del portal / vendedores"
              />
              <StatCard
                label="canales"
                value={fmtInt.format(t.canales_activos)}
                tone={t.canales_activos === 0 ? "warning" : "neutral"}
                hint={
                  t.ultimo_mensaje
                    ? `último mensaje ${tiempoRelativo(t.ultimo_mensaje)}`
                    : "nunca recibió un mensaje"
                }
              />
            </div>

            {/* ---- Servicios ---- */}
            <section className="flex flex-col gap-3 rounded-md border border-bg-700 p-4">
              <h2 className="text-sm font-medium text-text-100">Servicios</h2>
              <p className="text-xs leading-relaxed text-text-400">
                Los mismos interruptores que ve el dueño en su portal. Desde aquí quedan
                registrados en la bitácora.
              </p>

              <div className="flex items-center justify-between gap-3 border-t border-bg-700 pt-3">
                <div className="flex flex-col">
                  <span className="text-sm text-text-100">Agente de IA</span>
                  <span className="font-mono text-[11px] text-text-600">
                    {t.agente_ia_activo && !t.agente_operando
                      ? "encendido, pero bloqueado por pagos o suspensión"
                      : "contesta los mensajes entrantes"}
                  </span>
                </div>
                <Interruptor
                  label="Agente de IA"
                  checked={t.agente_ia_activo}
                  disabled={ocupado !== null}
                  onChange={(v) =>
                    patch(
                      "servicios",
                      { agente_ia_activo: v },
                      "agente",
                      v ? "Agente encendido." : "Agente apagado.",
                      "No se pudo cambiar el agente.",
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-bg-700 pt-3">
                <div className="flex flex-col">
                  <span className="text-sm text-text-100">Gestión de vendedores</span>
                  <span className="font-mono text-[11px] text-text-600">
                    embudo de chat y CRM de campo
                  </span>
                </div>
                <Interruptor
                  label="Gestión de vendedores"
                  checked={t.gestion_vendedores_activo}
                  disabled={ocupado !== null}
                  onChange={(v) =>
                    patch(
                      "servicios",
                      { gestion_vendedores_activo: v },
                      "vendedores",
                      v ? "Módulo de vendedores activado." : "Módulo de vendedores apagado.",
                      "No se pudo cambiar el módulo.",
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-bg-700 pt-3">
                <div className="flex flex-col">
                  <span className="text-sm text-text-100">Calendario</span>
                  <span className="font-mono text-[11px] text-text-600">
                    el agente consulta y reserva citas; el plan solo da el derecho, este interruptor
                    lo enciende
                  </span>
                </div>
                <Interruptor
                  label="Calendario"
                  checked={t.calendario_activo}
                  disabled={ocupado !== null}
                  onChange={(v) =>
                    patch(
                      "servicios",
                      { calendario_activo: v },
                      "calendario",
                      v ? "Calendario activado." : "Calendario apagado.",
                      "No se pudo cambiar el calendario.",
                    )
                  }
                />
              </div>
            </section>

            <CambiarEstado
              actual={t.estado}
              ocupado={ocupado !== null}
              onGuardar={(estado, motivo) =>
                patch(
                  "estado",
                  { estado, motivo },
                  "estado",
                  `Negocio marcado como ${ESTADO_TENANT_INFO[estado].label}.`,
                  "No se pudo cambiar el estado.",
                )
              }
            />

            <AjustarCreditos
              tenantId={t.tenant_id}
              disponibles={t.creditos_disponibles}
              onHecho={async (saldo) => {
                await tras(`Saldo actualizado: ${formatoMonto(saldo)} créditos.`);
              }}
              onError={setError}
            />

            <PlanDePrueba
              tenant={t}
              onHecho={tras}
              onError={(e) => {
                setAviso(null);
                setError(e);
              }}
            />

            {/* ---- Cobros ---- */}
            <section className="flex flex-col gap-3">
              <h2 className="font-mono text-[11px] text-text-600">ÚLTIMOS COBROS</h2>
              <div className="overflow-hidden rounded-md border border-bg-700">
                <table className="w-full text-sm">
                  <tbody>
                    {(transacciones.data ?? []).map((tx) => (
                      <tr key={tx.id} className="border-b border-bg-700 last:border-0">
                        <td className="px-3 py-2 text-text-100">{tx.concepto ?? tx.tipo}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-100">
                          {formatoMonto(tx.monto)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge tone={tx.estado_pago === "aprobado" ? "success" : "neutral"}>
                            {tx.estado_pago}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-text-600">
                          {tiempoRelativo(tx.creado_en)}
                        </td>
                      </tr>
                    ))}
                    {transacciones.data?.length === 0 && (
                      <tr>
                        <td className="px-3 py-6 text-center font-mono text-[11px] text-text-600">
                          nunca pasó por la pasarela de pagos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ---- Bitácora ---- */}
            <section className="flex flex-col gap-3">
              <h2 className="font-mono text-[11px] text-text-600">
                QUÉ TOCÓ GERENCIA EN ESTE NEGOCIO
              </h2>
              <ul className="flex flex-col gap-2">
                {(bitacora.data ?? []).map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-col gap-1 rounded-md border border-bg-700 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-text-100">{etiquetaAccion(e.accion)}</span>
                      <span className="font-mono text-[11px] text-text-600">
                        {e.actor_email} · {formatoFechaHora(e.creado_en)}
                      </span>
                    </div>
                    <DetalleAuditoria detalle={e.detalle} />
                  </li>
                ))}
                {bitacora.data?.length === 0 && (
                  <li className="rounded-md border border-dashed border-bg-700 px-3 py-6 text-center font-mono text-[11px] text-text-600">
                    nadie de plataforma tocó nada todavía
                  </li>
                )}
              </ul>
            </section>

            <EliminarNegocio
              tenantId={t.tenant_id}
              nombre={t.nombre}
              revision={eliminacion.data}
              onEliminado={() => setEliminado(t.nombre)}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------
// Cambio de estado
// ------------------------------------------------------------
function CambiarEstado({
  actual,
  ocupado,
  onGuardar,
}: {
  actual: EstadoTenantPlataforma;
  ocupado: boolean;
  onGuardar: (estado: EstadoTenantPlataforma, motivo: string | null) => void;
}) {
  const [estado, setEstado] = useState<EstadoTenantPlataforma>(actual);
  const [motivo, setMotivo] = useState("");

  // El backend exige motivo para todo lo que no sea 'activo'; se refleja
  // acá para no gastar un viaje de red en enterarse.
  const necesitaMotivo = estado !== "activo";
  const puedeGuardar =
    (estado !== actual || motivo.trim().length > 0) &&
    (!necesitaMotivo || motivo.trim().length > 0);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    onGuardar(estado, motivo.trim() || null);
    setMotivo("");
  };

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-3 rounded-md border border-bg-700 p-4"
      noValidate
    >
      <h2 className="text-sm font-medium text-text-100">Estado del negocio</h2>
      <p className="text-xs leading-relaxed text-text-400">
        <strong className="text-text-100">Suspendido</strong> y{" "}
        <strong className="text-text-100">baja</strong> apagan el agente de verdad: n8n deja
        de responderle a sus clientes en el siguiente mensaje, tenga plan o créditos.{" "}
        <strong className="text-text-100">Prueba</strong> no bloquea nada, solo lo marca como
        piloto.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Campo id="estado" label="Estado" className="sm:w-44">
          <select
            id="estado"
            value={estado}
            disabled={ocupado}
            onChange={(e) => setEstado(e.target.value as EstadoTenantPlataforma)}
            className={selectClass}
          >
            {ESTADOS_TENANT.map((e) => (
              <option key={e} value={e}>
                {ESTADO_TENANT_INFO[e].label}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          id="motivo"
          label="Motivo"
          hint={necesitaMotivo ? "obligatorio" : "opcional"}
          className="flex-1"
        >
          <input
            id="motivo"
            type="text"
            value={motivo}
            disabled={ocupado}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Impago de 3 ciclos, piloto hasta marzo, cierre a pedido del cliente…"
            maxLength={1000}
            className={inputClass}
          />
        </Campo>

        <Boton
          type="submit"
          variante={estado === "activo" ? "primario" : "peligro"}
          loading={ocupado}
          disabled={!puedeGuardar}
        >
          Guardar estado
        </Boton>
      </div>
    </form>
  );
}

// ------------------------------------------------------------
// Ajuste manual de créditos
// ------------------------------------------------------------
function AjustarCreditos({
  tenantId,
  disponibles,
  onHecho,
  onError,
}: {
  tenantId: string;
  disponibles: string;
  onHecho: (saldo: string) => void;
  onError: (e: string) => void;
}) {
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const numero = Number(cantidad);
  const valido =
    cantidad.trim() !== "" && Number.isFinite(numero) && numero !== 0 && motivo.trim().length >= 3;
  const resultante = Number(disponibles) + (Number.isFinite(numero) ? numero : 0);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    setEnviando(true);
    try {
      const res = await apiFetch<AjusteCreditosOut>(
        `/api/gerencia/tenants/${tenantId}/creditos`,
        { method: "POST", json: { cantidad, motivo: motivo.trim() } },
      );
      setCantidad("");
      setMotivo("");
      onHecho(res.creditos_disponibles);
    } catch (err) {
      onError(mensajeDeError(err, "No se pudo ajustar el saldo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-3 rounded-md border border-bg-700 p-4"
      noValidate
    >
      <h2 className="text-sm font-medium text-text-100">Ajustar créditos</h2>
      <p className="text-xs leading-relaxed text-text-400">
        Positivo regala, negativo descuenta. Queda como asiento en el libro mayor de
        créditos del negocio, igual que una compra.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Campo id="cantidad" label="Cantidad" className="sm:w-36">
          <input
            id="cantidad"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={cantidad}
            disabled={enviando}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="250"
            className={inputClass}
          />
        </Campo>

        <Campo id="motivo-creditos" label="Motivo" hint="mínimo 3 caracteres" className="flex-1">
          <input
            id="motivo-creditos"
            type="text"
            value={motivo}
            disabled={enviando}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Cortesía por la caída del martes"
            maxLength={500}
            className={inputClass}
          />
        </Campo>

        <Boton type="submit" variante="primario" loading={enviando} disabled={!valido}>
          Aplicar
        </Boton>
      </div>

      {valido && (
        <p
          className={cn(
            "font-mono text-[11px]",
            resultante < 0 ? "text-danger" : "text-text-600",
          )}
        >
          {formatoMonto(disponibles)} → {formatoMonto(resultante)}
          {resultante < 0 && " · el backend lo rechaza: el saldo no puede quedar negativo"}
        </p>
      )}
    </form>
  );
}

// ------------------------------------------------------------
// Plan de prueba
// ------------------------------------------------------------
// Tope de services/pruebas.py: 3 meses calendario desde que se otorga.
const MESES_MAXIMO_PRUEBA = 3;

function pruebaVigente(t: TenantGerenciaOut): boolean {
  return t.origen_suscripcion === "prueba" && t.estado_suscripcion === "activa";
}

/** Mismo cálculo que sumar_meses del backend: si el mes destino es más corto, su último día. */
function sumarMeses(fecha: Date, meses: number): Date {
  const r = new Date(fecha);
  const dia = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + meses);
  const ultimo = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(dia, ultimo));
  return r;
}

/** YYYY-MM-DD en hora local, el formato de <input type="date">. */
function aInputFecha(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Cuándo vencería la prueba con lo que hay en el formulario, o null si
 * todavía no es válido. La fecha límite es el final de ese día en la hora
 * local de quien la elige; si es el último día permitido, se recorta al
 * instante exacto del tope para que el backend no la rechace por minutos.
 */
function expiracionPrevista(
  unidad: UnidadDuracionPrueba,
  cantidad: string,
  fecha: string,
  ahora: Date,
  limite: Date,
): Date | null {
  let exp: Date;
  if (unidad === "fecha") {
    if (!fecha) return null;
    exp = new Date(`${fecha}T23:59:59`);
    if (exp > limite && aInputFecha(exp) === aInputFecha(limite)) exp = limite;
  } else {
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n < 1) return null;
    const dias = unidad === "semanas" ? n * 7 : n;
    exp = new Date(ahora.getTime() + dias * 86_400_000);
  }
  if (Number.isNaN(exp.getTime()) || exp <= ahora || exp > limite) return null;
  return exp;
}

function PlanDePrueba({
  tenant,
  onHecho,
  onError,
}: {
  tenant: TenantGerenciaOut;
  onHecho: (mensaje: string) => Promise<void>;
  onError: (e: string) => void;
}) {
  const planes = useApi<PlanGerenciaOut[]>("/api/gerencia/planes");
  // Los retirados del catálogo no se ofrecen (el backend los rechaza con 409).
  const activos = (planes.data ?? []).filter((p) => p.activo);

  // Foto de "ahora" al montar: el tope y la vista previa no necesitan
  // moverse segundo a segundo, y el backend vuelve a validar al guardar.
  const [ahora] = useState(() => new Date());
  const limite = sumarMeses(ahora, MESES_MAXIMO_PRUEBA);

  const [plan, setPlan] = useState("");
  const [unidad, setUnidad] = useState<UnidadDuracionPrueba>("dias");
  const [cantidad, setCantidad] = useState("14");
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [motivoRevocar, setMotivoRevocar] = useState("");
  const [enviando, setEnviando] = useState<"otorgar" | "revocar" | null>(null);

  const planElegido = plan || activos[0]?.nombre || "";
  const expiracion = expiracionPrevista(unidad, cantidad, fecha, ahora, limite);
  const valido = Boolean(planElegido) && expiracion !== null && motivo.trim().length >= 3;

  const vigente = pruebaVigente(tenant);
  // Una prueba no pisa un plan pagado vigente: el backend responde 409.
  const pagadoVigente =
    tenant.origen_suscripcion === "pago" && tenant.estado_suscripcion === "activa";

  const otorgar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido || !expiracion) return;
    const cuerpo: OtorgarPruebaIn =
      unidad === "fecha"
        ? { plan: planElegido, unidad, fecha_expiracion: expiracion.toISOString(), motivo: motivo.trim() }
        : { plan: planElegido, unidad, cantidad: Number(cantidad), motivo: motivo.trim() };
    setEnviando("otorgar");
    try {
      await apiFetch<TenantGerenciaOut>(`/api/gerencia/tenants/${tenant.tenant_id}/prueba`, {
        method: "POST",
        json: cuerpo,
      });
      setMotivo("");
      await onHecho(
        `Prueba del plan ${planElegido} otorgada hasta ${formatoFechaHora(expiracion.toISOString())}.`,
      );
    } catch (err) {
      onError(mensajeDeError(err, "No se pudo otorgar la prueba."));
    } finally {
      setEnviando(null);
    }
  };

  const revocar = async (e: FormEvent) => {
    e.preventDefault();
    if (motivoRevocar.trim().length < 3) return;
    const cuerpo: RevocarPruebaIn = { motivo: motivoRevocar.trim() };
    setEnviando("revocar");
    try {
      await apiFetch<TenantGerenciaOut>(
        `/api/gerencia/tenants/${tenant.tenant_id}/prueba/revocar`,
        { method: "POST", json: cuerpo },
      );
      setMotivoRevocar("");
      await onHecho("Prueba revocada: el negocio queda sin plan vigente.");
    } catch (err) {
      onError(mensajeDeError(err, "No se pudo revocar la prueba."));
    } finally {
      setEnviando(null);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border border-bg-700 p-4">
      <h2 className="text-sm font-medium text-text-100">Plan de prueba</h2>
      <p className="text-xs leading-relaxed text-text-400">
        Da acceso a las herramientas de un plan del catálogo, sin cobro, por un máximo de{" "}
        {MESES_MAXIMO_PRUEBA} meses. Al vencer, el negocio queda como cualquier cuenta sin plan
        vigente. Si paga durante la prueba, su plan pagado la reemplaza.
      </p>

      {vigente && tenant.fecha_renovacion && (
        <form
          onSubmit={revocar}
          className="flex flex-col gap-3 border-t border-bg-700 pt-3 sm:flex-row sm:items-end"
          noValidate
        >
          <p className="text-xs text-text-100 sm:w-56">
            Prueba de <strong>{tenant.plan}</strong> vigente hasta{" "}
            {formatoFechaHora(tenant.fecha_renovacion)}.
          </p>
          <Campo id="motivo-revocar" label="Motivo" hint="mínimo 3 caracteres" className="flex-1">
            <input
              id="motivo-revocar"
              type="text"
              value={motivoRevocar}
              disabled={enviando !== null}
              onChange={(e) => setMotivoRevocar(e.target.value)}
              placeholder="Terminó la demo"
              maxLength={500}
              className={inputClass}
            />
          </Campo>
          <Boton
            type="submit"
            variante="peligro"
            loading={enviando === "revocar"}
            disabled={motivoRevocar.trim().length < 3 || enviando !== null}
          >
            Revocar prueba
          </Boton>
        </form>
      )}

      {pagadoVigente ? (
        <Aviso tipo="info">
          Tiene un plan pagado vigente ({tenant.plan}): una prueba no lo puede reemplazar.
        </Aviso>
      ) : (
        <form
          onSubmit={otorgar}
          className="flex flex-col gap-3 border-t border-bg-700 pt-3"
          noValidate
        >
          {planes.error && <Aviso tipo="error">{planes.error}</Aviso>}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Campo id="plan-prueba" label="Plan" className="sm:w-44">
              <select
                id="plan-prueba"
                value={planElegido}
                disabled={enviando !== null || activos.length === 0}
                onChange={(e) => setPlan(e.target.value)}
                className={selectClass}
              >
                {activos.map((p) => (
                  <option key={p.nombre} value={p.nombre}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id="unidad-prueba" label="Duración" className="sm:w-40">
              <select
                id="unidad-prueba"
                value={unidad}
                disabled={enviando !== null}
                onChange={(e) => setUnidad(e.target.value as UnidadDuracionPrueba)}
                className={selectClass}
              >
                <option value="dias">Días</option>
                <option value="semanas">Semanas</option>
                <option value="fecha">Hasta una fecha</option>
              </select>
            </Campo>

            {unidad === "fecha" ? (
              <Campo id="fecha-prueba" label="Vence el" className="sm:w-44">
                <input
                  id="fecha-prueba"
                  type="date"
                  value={fecha}
                  min={aInputFecha(ahora)}
                  max={aInputFecha(limite)}
                  disabled={enviando !== null}
                  onChange={(e) => setFecha(e.target.value)}
                  className={inputClass}
                />
              </Campo>
            ) : (
              <Campo id="cantidad-prueba" label="Cantidad" className="sm:w-28">
                <input
                  id="cantidad-prueba"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={unidad === "semanas" ? 13 : 92}
                  step={1}
                  value={cantidad}
                  disabled={enviando !== null}
                  onChange={(e) => setCantidad(e.target.value)}
                  className={inputClass}
                />
              </Campo>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Campo id="motivo-prueba" label="Motivo" hint="mínimo 3 caracteres" className="flex-1">
              <input
                id="motivo-prueba"
                type="text"
                value={motivo}
                disabled={enviando !== null}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Demo comercial acordada con el cliente"
                maxLength={500}
                className={inputClass}
              />
            </Campo>
            <Boton
              type="submit"
              variante="primario"
              loading={enviando === "otorgar"}
              disabled={!valido || enviando !== null}
            >
              {vigente ? "Reemplazar prueba" : "Otorgar prueba"}
            </Boton>
          </div>

          <p
            className={cn(
              "font-mono text-[11px]",
              expiracion ? "text-text-600" : "text-warning",
            )}
          >
            {expiracion
              ? `vence el ${formatoFechaHora(expiracion.toISOString())}`
              : `elige una duración de hasta ${MESES_MAXIMO_PRUEBA} meses (tope: ${formatoFechaHora(limite.toISOString())})`}
          </p>
        </form>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// Ver como el negocio
// ------------------------------------------------------------
/**
 * Abre el portal del negocio en esta pestaña, en solo lectura. El token va
 * a sessionStorage (ver lib/auth.ts): las otras pestañas del gerente no se
 * enteran, y al salir se vuelve a esta ficha.
 *
 * Recarga completa (`location.assign`) y no router.push: el usuario, el
 * socket de alertas y todo lo que el layout ya cargó con la identidad del
 * gerente tiene que volver a pedirse con la del negocio.
 */
function VerComo({ tenantId, nombre }: { tenantId: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < 5) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await apiFetch<ImpersonarOut>(`/api/gerencia/tenants/${tenantId}/impersonar`, {
        method: "POST",
        json: { motivo: motivo.trim() },
      });
      iniciarVerComo(res.access_token, `/gerencia/tenants/${tenantId}`);
      // Recarga completa a propósito (ver el docstring): router.push
      // conservaría el usuario y el socket cargados como el gerente.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo abrir el portal del negocio."));
      setEnviando(false);
    }
  };

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto}>
      <Dialog.Trigger asChild>
        <Boton className="ml-auto">
          <Eye size={13} aria-hidden />
          Ver como el negocio
        </Boton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
          <Dialog.Title className="text-sm font-medium text-text-100">
            Ver el portal de {nombre}
          </Dialog.Title>
          <Dialog.Description className="mt-1.5 text-xs leading-relaxed text-text-400">
            Entras como el dueño, en solo lectura: cualquier cambio se rechaza. La sesión dura
            poco, no se renueva y queda en la bitácora con el motivo.
          </Dialog.Description>
          <form onSubmit={entrar} className="mt-4 flex flex-col gap-3" noValidate>
            <Campo id="motivo-ver-como" label="Motivo" hint="mínimo 5 caracteres">
              <input
                id="motivo-ver-como"
                type="text"
                autoFocus
                value={motivo}
                disabled={enviando}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ticket #123: no ve sus conversaciones de Instagram"
                maxLength={500}
                className={inputClass}
              />
            </Campo>
            {error && <Aviso tipo="error">{error}</Aviso>}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Boton disabled={enviando}>Cancelar</Boton>
              </Dialog.Close>
              <Boton
                type="submit"
                variante="primario"
                loading={enviando}
                disabled={motivo.trim().length < 5}
              >
                Entrar en solo lectura
              </Boton>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ------------------------------------------------------------
// Eliminación definitiva
// ------------------------------------------------------------
/**
 * Solo se habilita con el negocio en 'baja' y sin suscripción vigente; la
 * regla vive en el backend (services/eliminacion_tenant.py) y acá solo se
 * lee `revision`. Aun habilitado, el diálogo pide escribir el nombre
 * exacto, y el backend lo vuelve a comparar.
 */
function EliminarNegocio({
  tenantId,
  nombre,
  revision,
  onEliminado,
}: {
  tenantId: string;
  nombre: string;
  revision: EliminacionTenantOut | null;
  onEliminado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coincide = confirmacion.trim() === nombre.trim();
  const eliminable = revision?.eliminable ?? false;
  const creditos = Number(revision?.creditos_disponibles ?? 0);

  const cambiarAbierto = (v: boolean) => {
    if (enviando) return;
    setAbierto(v);
    if (!v) {
      setConfirmacion("");
      setError(null);
    }
  };

  const eliminar = async (e: FormEvent) => {
    e.preventDefault();
    if (!coincide) return;
    setEnviando(true);
    setError(null);
    try {
      const cuerpo: EliminarTenantIn = { confirmacion };
      await apiFetch<void>(`/api/gerencia/tenants/${tenantId}/eliminar`, {
        method: "POST",
        json: cuerpo,
      });
      setAbierto(false);
      onEliminado();
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo eliminar el negocio."));
      setEnviando(false);
    }
  };

  return (
    <section
      aria-labelledby="zona-peligro"
      className="flex flex-col gap-3 rounded-md border border-danger/40 p-4"
    >
      <h2 id="zona-peligro" className="text-sm font-medium text-text-100">
        Eliminar negocio
      </h2>
      <p className="text-xs leading-relaxed text-text-400">
        Borra el negocio y todo lo suyo: usuarios del portal, conversaciones, CRM, calendario e
        historial de cobros. <strong className="text-text-100">No se puede deshacer.</strong> Solo
        se permite con el negocio en <strong className="text-text-100">Baja</strong> y sin
        suscripción vigente.
      </p>

      {revision && revision.bloqueos.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Por qué no se puede eliminar">
          {revision.bloqueos.map((b) => (
            <li key={b.codigo} className="font-mono text-[11px] text-warning">
              {b.mensaje}
            </li>
          ))}
        </ul>
      )}

      <Dialog.Root open={abierto} onOpenChange={cambiarAbierto}>
        <Dialog.Trigger asChild>
          <Boton variante="peligro" className="w-fit" disabled={!eliminable}>
            <Trash2 size={13} aria-hidden />
            Eliminar negocio
          </Boton>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-700 bg-bg-900 p-5 shadow-xl">
            <Dialog.Title className="text-sm font-medium text-text-100">
              Eliminar {nombre} definitivamente
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-xs leading-relaxed text-text-400">
              Esta acción no se puede deshacer. Se borran para siempre:
            </Dialog.Description>
            <ul className="mt-2 flex list-disc flex-col gap-0.5 pl-5 text-xs text-text-400">
              <li>{fmtInt.format(revision?.usuarios_portal ?? 0)} usuarios del portal</li>
              <li>{fmtInt.format(revision?.conversaciones ?? 0)} conversaciones</li>
              <li>{fmtInt.format(revision?.transacciones ?? 0)} registros de cobro</li>
            </ul>
            {creditos > 0 && (
              <Aviso tipo="info" className="mt-3">
                Tiene <strong>{formatoMonto(revision?.creditos_disponibles ?? "0")}</strong>{" "}
                créditos sin usar que se pierden.
              </Aviso>
            )}
            <form onSubmit={eliminar} className="mt-4 flex flex-col gap-3" noValidate>
              <Campo
                id="confirmar-eliminacion"
                label={`Escribe «${nombre}» para confirmar`}
              >
                <input
                  id="confirmar-eliminacion"
                  type="text"
                  autoFocus
                  autoComplete="off"
                  value={confirmacion}
                  disabled={enviando}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              {error && <Aviso tipo="error">{error}</Aviso>}
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Boton disabled={enviando}>Cancelar</Boton>
                </Dialog.Close>
                <Boton type="submit" variante="peligro" loading={enviando} disabled={!coincide}>
                  Eliminar definitivamente
                </Boton>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

// ------------------------------------------------------------
// Bitácora
// ------------------------------------------------------------
const ACCIONES: Record<string, string> = {
  eliminar_tenant: "Negocio eliminado",
  estado_tenant: "Cambio de estado",
  servicios_tenant: "Cambio de servicios",
  ajuste_creditos: "Ajuste de créditos",
  prueba_otorgada: "Plan de prueba otorgado",
  prueba_revocada: "Plan de prueba revocado",
  impersonacion: "Vio el portal como el negocio",
  alerta_revisada: "Alerta revisada",
};

function etiquetaAccion(accion: string): string {
  return ACCIONES[accion] ?? accion;
}

/**
 * El detalle es JSONB de forma libre (cada acción guarda lo suyo), así que
 * se pinta genérico en vez de inventar un componente por tipo de acción.
 */
function DetalleAuditoria({ detalle }: { detalle: Record<string, unknown> }) {
  const entradas = Object.entries(detalle).filter(([, v]) => v !== null && v !== undefined);
  if (entradas.length === 0) return null;

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-text-600">
      {entradas.map(([clave, valor]) => (
        <div key={clave} className="flex gap-1">
          <dt>{clave}:</dt>
          <dd className="text-text-400">
            {typeof valor === "object" ? JSON.stringify(valor) : String(valor)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
