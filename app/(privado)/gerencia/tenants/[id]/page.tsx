"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type {
  AjusteCreditosOut,
  EntradaAuditoriaOut,
  EstadoTenantPlataforma,
  TenantGerenciaOut,
  TransaccionOut,
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
  GerenciaTabs,
  fmtCostoUsd,
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

  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const t = tenant.data;

  // ---- Acciones ---------------------------------------------------------
  const tras = async (mensaje: string) => {
    setAviso(mensaje);
    await Promise.all([tenant.recargar(true), bitacora.recargar(true)]);
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
              <span className="flex items-center gap-1 font-mono text-[11px] text-text-600">
                {t.tenant_id}
                <CopyButton text={t.tenant_id} label="Copiar UUID del negocio" />
              </span>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="tokens"
                value={fmtTokens(t.consumo.tokens_total)}
                hint={`${fmtInt.format(t.consumo.llamadas)} llamadas · ${fmtCostoUsd(t.consumo.costo_usd)}`}
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
// Bitácora
// ------------------------------------------------------------
const ACCIONES: Record<string, string> = {
  estado_tenant: "Cambio de estado",
  servicios_tenant: "Cambio de servicios",
  ajuste_creditos: "Ajuste de créditos",
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
