"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { descargarTenantsCsv } from "@/lib/exportar-tenants";
import { useApi, useDebounce } from "@/lib/use-api";
import type { EstadoTenantPlataforma, TenantGerenciaOut, TenantsGerenciaOut } from "@/lib/types";
import { fmtInt, formatoMonto, tiempoRelativo } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "@/app/components/badge";
import {
  ESTADOS_TENANT,
  ESTADO_TENANT_INFO,
  EstadoTenantBadge,
  FUENTE_TIPO_CAMBIO_INFO,
  GerenciaTabs,
  SelectorDias,
  fmtCostoUsd,
  fmtMargen,
  fmtTokens,
} from "@/app/components/gerencia";
import { Aviso, Boton, Cargando, PageHeader, inputClass, selectClass } from "@/app/components/ui";

const POR_PAGINA = 25;

const ORDENES = [
  { valor: "consumo", label: "más tokens" },
  { valor: "gasto", label: "más costo" },
  { valor: "ingreso", label: "más ingreso" },
  { valor: "margen", label: "peor margen" },
  { valor: "actividad", label: "actividad reciente" },
  { valor: "alta", label: "alta reciente" },
  { valor: "nombre", label: "nombre" },
];

export default function TenantsGerenciaPage() {
  const [dias, setDias] = useState(30);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoTenantPlataforma | "">("");
  const [orden, setOrden] = useState("consumo");
  const [pagina, setPagina] = useState(0);

  // Sin debounce, cada tecla dispararía una consulta que recorre todos los
  // negocios más su consumo agregado.
  const q = useDebounce(busqueda.trim(), 350);

  const params = new URLSearchParams({
    dias: String(dias),
    orden,
    limite: String(POR_PAGINA),
    offset: String(pagina * POR_PAGINA),
  });
  if (q) params.set("q", q);
  if (estado) params.set("estado", estado);

  const lista = useApi<TenantsGerenciaOut>(`/api/gerencia/tenants?${params}`);
  const items = lista.data?.items ?? [];
  const total = lista.data?.total ?? 0;
  const hayMas = (pagina + 1) * POR_PAGINA < total;

  // Cualquier cambio de filtro vuelve a la primera página: quedarse en la
  // página 3 de un resultado que ahora tiene 4 filas muestra una tabla
  // vacía y parece que no hay nada.
  const cambiar = <T,>(setter: (v: T) => void) => (valor: T) => {
    setter(valor);
    setPagina(0);
  };

  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);

  /**
   * Exporta TODO lo que coincide con los filtros, no solo la página a la
   * vista: se piden páginas del tamaño máximo hasta juntar el total.
   */
  const exportar = async () => {
    setExportando(true);
    setErrorExport(null);
    try {
      const todos: TenantGerenciaOut[] = [];
      const base = new URLSearchParams(params);
      base.set("limite", "100");
      for (let offset = 0; ; offset += 100) {
        base.set("offset", String(offset));
        const res = await apiFetch<TenantsGerenciaOut>(`/api/gerencia/tenants?${base}`);
        todos.push(...res.items);
        if (res.items.length < 100 || todos.length >= res.total) break;
      }
      descargarTenantsCsv(todos, dias);
    } catch (e) {
      setErrorExport(mensajeDeError(e, "No se pudo exportar."));
    } finally {
      setExportando(false);
    }
  };

  const sinTipoCambio = lista.data ? !lista.data.tipo_cambio_configurado : false;
  const fuenteInfo = lista.data
    ? FUENTE_TIPO_CAMBIO_INFO[lista.data.tipo_cambio_fuente]
    : null;

  return (
    <>
      <PageHeader
        titulo="Negocios"
        sub={lista.data ? `${fmtInt.format(total)} en total` : undefined}
        acciones={
          <>
            <GerenciaTabs />
            <SelectorDias dias={dias} onChange={cambiar(setDias)} />
          </>
        }
      />

      <div className="flex flex-col gap-3 border-b border-bg-700 px-6 py-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-600"
            aria-hidden
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => cambiar(setBusqueda)(e.target.value)}
            placeholder="Nombre del negocio, correo de un usuario o UUID"
            aria-label="Buscar negocio"
            className={cn(inputClass, "pl-8")}
          />
        </div>

        <select
          value={estado}
          onChange={(e) => cambiar(setEstado)(e.target.value as EstadoTenantPlataforma | "")}
          aria-label="Filtrar por estado"
          className={cn(selectClass, "sm:w-40")}
        >
          <option value="">todos los estados</option>
          {ESTADOS_TENANT.map((e) => (
            <option key={e} value={e}>
              {ESTADO_TENANT_INFO[e].label}
            </option>
          ))}
        </select>

        <select
          value={orden}
          onChange={(e) => cambiar(setOrden)(e.target.value)}
          aria-label="Ordenar por"
          className={cn(selectClass, "sm:w-44")}
        >
          {ORDENES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </select>

        <Boton onClick={exportar} loading={exportando} disabled={!lista.data || total === 0}>
          <Download size={12} aria-hidden />
          CSV
        </Boton>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {lista.error && <Aviso tipo="error">{lista.error}</Aviso>}
        {errorExport && <Aviso tipo="error">{errorExport}</Aviso>}
        {sinTipoCambio && orden === "margen" && fuenteInfo && (
          <Aviso tipo="info" className="mb-3">
            {fuenteInfo.detalle} Configura BANXICO_TOKEN o TIPO_CAMBIO_USD para ordenar por
            margen.
          </Aviso>
        )}
        {!lista.data && lista.loading && <Cargando />}

        {lista.data && (
          <div className={cn("flex flex-col gap-3", lista.loading && "opacity-60")}>
            <div className="overflow-x-auto rounded-md border border-bg-700">
              <table className="w-full min-w-[68rem] text-sm">
                <thead className="bg-bg-800 text-left font-mono text-[11px] text-text-600">
                  <tr>
                    <th className="px-3 py-2 font-normal">negocio</th>
                    <th
                      className="px-3 py-2 font-normal"
                      title="Owner primero; el resto del equipo por antigüedad si no hay owner"
                    >
                      correo
                    </th>
                    <th className="px-3 py-2 font-normal">estado</th>
                    <th className="px-3 py-2 font-normal">plan</th>
                    <th className="px-3 py-2 text-right font-normal">tokens</th>
                    <th className="px-3 py-2 text-right font-normal">costo</th>
                    <th
                      className="px-3 py-2 text-right font-normal"
                      title={
                        sinTipoCambio
                          ? fuenteInfo?.detalle
                          : `Suscripción prorrateada + créditos cobrados − costo de modelos (tipo de cambio: ${fuenteInfo?.label})`
                      }
                    >
                      margen
                    </th>
                    <th className="px-3 py-2 text-right font-normal">créditos</th>
                    <th className="px-3 py-2 text-right font-normal">equipo</th>
                    <th className="px-3 py-2 text-right font-normal">último mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.tenant_id} className="border-t border-bg-700 hover:bg-bg-900">
                      <td className="max-w-[16rem] px-3 py-2">
                        <Link
                          href={`/gerencia/tenants/${t.tenant_id}`}
                          className="block truncate text-text-100 hover:underline"
                        >
                          {t.nombre}
                        </Link>
                        <span className="font-mono text-[11px] text-text-600">
                          alta {t.alta ? tiempoRelativo(t.alta) : "—"}
                        </span>
                      </td>

                      <td className="max-w-[13rem] px-3 py-2">
                        {t.email ? (
                          <span
                            className="block truncate text-text-400"
                            title={t.email}
                          >
                            {t.email}
                          </span>
                        ) : (
                          <span
                            className="font-mono text-[11px] text-text-600"
                            title="Ningún usuario activo del portal en este negocio"
                          >
                            sin usuarios
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <EstadoTenantBadge estado={t.estado} motivo={t.estado_motivo} />
                          {/* Solo cuando el efectivo difiere del configurado:
                              marcar "agente off" en un negocio que además está
                              suspendido es ruido, ya lo dice el otro badge. */}
                          {!t.agente_operando && t.estado === "activo" && (
                            <Badge
                              tone="warning"
                              title={
                                t.agente_ia_activo
                                  ? "Encendido, pero bloqueado por falta de pago"
                                  : "Apagado desde la configuración del negocio"
                              }
                            >
                              agente off
                            </Badge>
                          )}
                          {t.canales_activos === 0 && (
                            <Badge tone="neutral" title="Ningún canal conectado">
                              sin canales
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2 text-text-400">
                        {t.plan ? (
                          <span className="flex flex-col">
                            <span className="text-text-100">{t.plan}</span>
                            <span className="font-mono text-[11px] text-text-600">
                              {t.estado_suscripcion} · {formatoMonto(t.precio_monthly)}
                            </span>
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-text-600">sin plan</span>
                        )}
                      </td>

                      <td
                        className="px-3 py-2 text-right tabular-nums text-text-100"
                        title={`${fmtInt.format(t.consumo.tokens_total)} tokens · ${fmtInt.format(t.consumo.llamadas)} llamadas`}
                      >
                        {fmtTokens(t.consumo.tokens_total)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-400">
                        {fmtCostoUsd(t.consumo.costo_usd)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          t.margen !== null && Number(t.margen) < 0
                            ? "text-danger"
                            : "text-text-400",
                        )}
                        title={
                          t.margen === null
                            ? fuenteInfo?.detalle
                            : `ingreso ${formatoMonto(t.ingreso_periodo)} − costo ${formatoMonto(t.costo_moneda)}`
                        }
                      >
                        {fmtMargen(t.margen, formatoMonto)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-400">
                        {formatoMonto(t.creditos_disponibles)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-400">
                        {fmtInt.format(t.usuarios_portal)}
                        <span className="text-text-600"> / </span>
                        {fmtInt.format(t.vendedores_activos)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-text-600">
                        {t.ultimo_mensaje ? tiempoRelativo(t.ultimo_mensaje) : "nunca"}
                      </td>
                    </tr>
                  ))}

                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-3 py-8 text-center font-mono text-[11px] text-text-600"
                      >
                        {q || estado
                          ? "ningún negocio coincide con el filtro"
                          : "todavía no hay negocios"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {(pagina > 0 || hayMas) && (
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-text-600">
                  {pagina * POR_PAGINA + 1}–{pagina * POR_PAGINA + items.length} de{" "}
                  {fmtInt.format(total)}
                </span>
                <div className="flex gap-2">
                  <Boton disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                    Anterior
                  </Boton>
                  <Boton disabled={!hayMas} onClick={() => setPagina((p) => p + 1)}>
                    Siguiente
                  </Boton>
                </div>
              </div>
            )}

            <p className="font-mono text-[11px] text-text-600">
              equipo = usuarios del portal / vendedores activos · tokens y costo, últimos{" "}
              {lista.data.dias} días · tipo de cambio: {fuenteInfo?.label}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
