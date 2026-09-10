"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin, RefreshCw, Search, Store } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { ClienteOut, VendedorOut } from "@/lib/types";
import {
  ESTADOS_CLIENTE,
  PRIORIDADES_CLIENTE,
  fmtInt,
  infoEstadoCliente,
  infoPrioridad,
  tiempoRelativo,
  urlMapa,
} from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "@/app/components/badge";
import { ClienteDrawer } from "@/app/components/cliente-drawer";
import { VendedoresTabs, esGerencia } from "@/app/components/modulo-vendedores";
import { StatCard } from "@/app/components/stat-card";
import {
  Aviso,
  Boton,
  Cargando,
  PageHeader,
  inputClass,
  selectClass,
} from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

const LIMITE = 500;
const SIN_VENDEDOR = "__sin__";

export default function CarteraPage() {
  // useSearchParams necesita un límite de Suspense en una página estática.
  return (
    <Suspense fallback={<Cargando />}>
      <Cartera />
    </Suspense>
  );
}

function Cartera() {
  const { usuario } = useUsuario();
  const gerencia = esGerencia(usuario);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // El CRM de campo NO depende de `gestion_vendedores_activo`: ese flag es
  // del embudo de chat. Son dos módulos distintos sobre el mismo equipo.
  const tenantId = usuario?.tenant_id ?? null;

  const clientes = useApi<ClienteOut[]>(`/api/clientes?limite=${LIMITE}`);
  const vendedores = useApi<VendedorOut[]>(
    tenantId ? `/api/tenants/${tenantId}/vendedores` : null,
  );

  // Los filtros viven en la URL, no en el estado: así gerencia puede
  // compartir "los prospectos de alta prioridad de Ana" con un enlace.
  const filtroEstado = params.get("estado") ?? "";
  const filtroPrioridad = params.get("prioridad") ?? "";
  const filtroVendedor = params.get("vendedor") ?? "";
  const buscar = params.get("q") ?? "";

  const setParam = useCallback(
    (clave: string, valor: string) => {
      const siguiente = new URLSearchParams(params.toString());
      if (valor) siguiente.set(clave, valor);
      else siguiente.delete(clave);
      const qs = siguiente.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const [seleccionado, setSeleccionado] = useState<ClienteOut | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const todos = useMemo(() => clientes.data ?? [], [clientes.data]);

  const sinVendedor = todos.filter((c) => c.vendedor_id === null).length;
  const nActivos = todos.filter((c) => c.estado === "activo").length;
  const nProspectos = todos.filter((c) => c.estado === "prospecto").length;

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return todos.filter((c) => {
      if (filtroEstado && c.estado !== filtroEstado) return false;
      if (filtroPrioridad && c.prioridad !== filtroPrioridad) return false;
      if (filtroVendedor === SIN_VENDEDOR && c.vendedor_id !== null) return false;
      if (filtroVendedor && filtroVendedor !== SIN_VENDEDOR && c.vendedor_id !== filtroVendedor)
        return false;
      if (q) {
        const texto = `${c.nombre_negocio} ${c.contacto_nombre ?? ""} ${c.telefono ?? ""} ${c.direccion ?? ""} ${c.vendedor_nombre ?? ""}`;
        if (!texto.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [todos, filtroEstado, filtroPrioridad, filtroVendedor, buscar]);

  const alCambio = (mensaje: string) => {
    setSeleccionado(null);
    setAviso(mensaje);
    clientes.recargar(true);
  };

  const hayFiltros = Boolean(filtroEstado || filtroPrioridad || filtroVendedor || buscar);

  return (
    <>
      <PageHeader
        titulo="Vendedores"
        sub={<VendedoresTabs />}
        acciones={
          <Boton
            variante="fantasma"
            onClick={() => {
              setAviso(null);
              clientes.recargar();
              vendedores.recargar(true);
            }}
            loading={clientes.loading}
            title="Actualizar"
          >
            <RefreshCw size={13} aria-hidden />
            Actualizar
          </Boton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          {clientes.error && <Aviso tipo="error">{clientes.error}</Aviso>}
          {aviso && <Aviso tipo="exito">{aviso}</Aviso>}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Clientes en cartera"
              value={clientes.data ? fmtInt.format(todos.length) : "—"}
              hint="total del negocio"
              loading={clientes.loading && !clientes.data}
            />
            <StatCard
              label="Activos"
              value={clientes.data ? fmtInt.format(nActivos) : "—"}
              tone={nActivos > 0 ? "success" : "neutral"}
              hint="ya compran"
              loading={clientes.loading && !clientes.data}
            />
            <StatCard
              label="Prospectos"
              value={clientes.data ? fmtInt.format(nProspectos) : "—"}
              hint="por convertir"
              loading={clientes.loading && !clientes.data}
            />
            <StatCard
              label="Sin vendedor"
              value={clientes.data ? fmtInt.format(sinVendedor) : "—"}
              tone={sinVendedor > 0 ? "warning" : "neutral"}
              hint={sinVendedor > 0 ? "nadie los visita" : "todos asignados"}
              loading={clientes.loading && !clientes.data}
            />
          </div>

          <section className="flex flex-col overflow-hidden rounded-md border border-bg-700 bg-bg-900">
            <header className="flex flex-wrap items-center gap-2 border-b border-bg-700 px-4 py-3">
              <div className="mr-auto">
                <h2 className="text-sm font-medium text-text-100">Cartera de campo</h2>
                <p className="font-mono text-[11px] text-text-600">
                  {clientes.data
                    ? `${fmtInt.format(filtrados.length)} de ${fmtInt.format(todos.length)}`
                    : "cargando…"}
                </p>
              </div>

              <label className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-600"
                  aria-hidden
                />
                <input
                  type="search"
                  value={buscar}
                  onChange={(e) => setParam("q", e.target.value)}
                  placeholder="Negocio, contacto, teléfono"
                  aria-label="Buscar en la cartera"
                  className={cn(inputClass, "w-56 py-1.5 pl-8 text-xs")}
                />
              </label>

              <select
                value={filtroEstado}
                onChange={(e) => setParam("estado", e.target.value)}
                aria-label="Filtrar por estado"
                className={cn(selectClass, "w-auto py-1.5 text-xs")}
              >
                <option value="">Todos los estados</option>
                {ESTADOS_CLIENTE.map((e) => (
                  <option key={e} value={e}>
                    {infoEstadoCliente(e).label}
                  </option>
                ))}
              </select>

              <select
                value={filtroPrioridad}
                onChange={(e) => setParam("prioridad", e.target.value)}
                aria-label="Filtrar por prioridad"
                className={cn(selectClass, "w-auto py-1.5 text-xs")}
              >
                <option value="">Toda prioridad</option>
                {PRIORIDADES_CLIENTE.map((p) => (
                  <option key={p} value={p}>
                    {infoPrioridad(p).label}
                  </option>
                ))}
              </select>

              <select
                value={filtroVendedor}
                onChange={(e) => setParam("vendedor", e.target.value)}
                aria-label="Filtrar por vendedor"
                className={cn(selectClass, "w-auto py-1.5 text-xs")}
              >
                <option value="">Todos los vendedores</option>
                <option value={SIN_VENDEDOR}>Sin vendedor</option>
                {(vendedores.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </header>

            {!clientes.data ? (
              <p className="p-6 text-center font-mono text-xs text-text-600">cargando…</p>
            ) : todos.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                <Store size={20} className="text-text-600" aria-hidden />
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-text-100">La cartera de campo está vacía</p>
                  <p className="mx-auto max-w-sm text-xs leading-relaxed text-text-400">
                    Aquí van los negocios que tu equipo visita en persona. Cada uno guarda su
                    ubicación y un radio de tolerancia; con eso se valida el check-in que el
                    vendedor hace desde su app.
                  </p>
                </div>
                {gerencia && (
                  <p className="font-mono text-[11px] text-text-600">
                    se dan de alta con POST /api/clientes
                  </p>
                )}
              </div>
            ) : filtrados.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <p className="font-mono text-xs text-text-600">
                  ningún cliente coincide con el filtro
                </p>
                {hayFiltros && (
                  <Boton
                    variante="secundario"
                    onClick={() => router.replace(pathname, { scroll: false })}
                  >
                    Quitar filtros
                  </Boton>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-bg-700 font-mono text-[11px] text-text-600">
                      <th className="px-4 py-2 text-left font-normal">Negocio</th>
                      <th className="px-3 py-2 text-left font-normal">Estado</th>
                      <th className="px-3 py-2 text-left font-normal">Prioridad</th>
                      <th className="px-3 py-2 text-left font-normal">Vendedor</th>
                      <th className="px-3 py-2 text-right font-normal">Geocerca</th>
                      <th className="px-4 py-2 text-right font-normal">Actualizado</th>
                    </tr>
                  </thead>
                  <tbody className={cn("transition-opacity", clientes.loading && "opacity-60")}>
                    {filtrados.map((c) => {
                      const estado = infoEstadoCliente(c.estado);
                      const prioridad = infoPrioridad(c.prioridad);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSeleccionado(c)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSeleccionado(c);
                            }
                          }}
                          className="cursor-pointer border-b border-bg-700 last:border-b-0 hover:bg-bg-800 focus:bg-bg-800 focus:outline-none"
                        >
                          <td className="px-4 py-2">
                            <div className="flex flex-col">
                              <span className="text-text-100">{c.nombre_negocio}</span>
                              {(c.contacto_nombre || c.telefono) && (
                                <span className="font-mono text-[11px] text-text-600">
                                  {[c.contacto_nombre, c.telefono].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge tone={estado.tone}>{estado.label}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Badge tone={prioridad.tone}>{prioridad.label}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            {c.vendedor_nombre ? (
                              <span className="text-text-400">{c.vendedor_nombre}</span>
                            ) : (
                              <span className="text-warning">sin asignar</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <a
                              href={urlMapa(c.latitud, c.longitud)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Abrir en Google Maps"
                              className="inline-flex items-center gap-1 font-mono text-[11px] text-text-400 underline-offset-2 hover:text-text-100 hover:underline"
                            >
                              <MapPin size={11} aria-hidden />
                              {c.radio_tolerancia_metros} m
                            </a>
                          </td>
                          <td
                            className="px-4 py-2 text-right font-mono text-[11px] text-text-600"
                            title={c.actualizado_en}
                          >
                            {tiempoRelativo(c.actualizado_en)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {seleccionado && (
        <ClienteDrawer
          key={seleccionado.id}
          cliente={seleccionado}
          vendedores={vendedores.data ?? []}
          puedeEditar={gerencia}
          onClose={() => setSeleccionado(null)}
          onCambio={alCambio}
        />
      )}
    </>
  );
}
