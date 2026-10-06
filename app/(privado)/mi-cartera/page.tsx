"use client";

import { Briefcase, MapPin, MessageCircle, RefreshCw } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { ClienteOut, PipelineOut, VendedorOut } from "@/lib/types";
import { fmtInt, infoEstadoCliente, infoEstadoPipeline, infoPrioridad, tiempoRelativo } from "@/lib/formato";
import { Badge } from "@/app/components/badge";
import { useServicios } from "@/app/components/modulo-vendedores";
import { usePlan } from "@/app/components/plan-context";
import { Aviso, Boton, Cargando, PageHeader } from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

/**
 * El portal del vendedor: solo lo suyo, de lectura.
 *
 * Mover a un lead de etapa y registrar visitas se hace desde la app de
 * vendedores (el trabajo es en la calle). Acá el vendedor consulta su
 * cartera desde la computadora. El backend ya filtra: /vendedores/{id}/pipeline
 * responde 403 con el id de otro, y /clientes devuelve solo los suyos
 * (services/crm.acceso_crm).
 */
export default function MiCarteraPage() {
  const { usuario } = useUsuario();
  const servicios = useServicios();
  const { puedeUsar } = usePlan();
  const yo = useApi<VendedorOut>("/api/vendedores/yo");

  // Cada sección solo si el negocio la tiene: sin esto el backend respondería
  // 409 (módulo apagado) o 402 (fuera del plan) y la pantalla se llenaría de errores.
  const conEmbudo = (servicios.data?.gestion_vendedores_activo ?? false) && puedeUsar("vendedores");
  const conCampo = puedeUsar("crm_campo");

  const leads = useApi<PipelineOut[]>(
    yo.data && conEmbudo ? `/api/vendedores/${yo.data.id}/pipeline?incluir_cerrados=false` : null,
  );
  const clientes = useApi<ClienteOut[]>(yo.data && conCampo ? "/api/clientes?limite=200" : null);

  const recargar = () => {
    void yo.recargar(true);
    void leads.recargar(true);
    void clientes.recargar(true);
  };

  return (
    <>
      <PageHeader
        titulo="Mi cartera"
        sub={<span>{[yo.data?.nombre, usuario?.nombre_negocio].filter(Boolean).join(" · ")}</span>}
        acciones={
          <Boton variante="fantasma" onClick={recargar} loading={leads.loading || clientes.loading}>
            <RefreshCw size={13} aria-hidden />
            Actualizar
          </Boton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {yo.error ? (
            <Aviso tipo="error">{yo.error}</Aviso>
          ) : !yo.data ? (
            <Cargando />
          ) : (
            <>
              <Aviso tipo="info">
                Para mover a un cliente de etapa o registrar una visita, usa la app de vendedores.
              </Aviso>

              {conEmbudo && (
                <section
                  data-tour="mi-cartera.leads"
                  className="overflow-hidden rounded-md border border-bg-700 bg-bg-900"
                >
                  <header className="flex items-center gap-2 border-b border-bg-700 px-4 py-3">
                    <MessageCircle size={14} className="text-text-400" aria-hidden />
                    <div>
                      <h2 className="text-sm font-medium text-text-100">Mis leads</h2>
                      <p className="font-mono text-[11px] text-text-600">
                        clientes que escribieron por chat y te tocaron · abiertos
                      </p>
                    </div>
                  </header>
                  {leads.error ? (
                    <div className="p-4">
                      <Aviso tipo="error">{leads.error}</Aviso>
                    </div>
                  ) : !leads.data ? (
                    <p className="px-4 py-3 font-mono text-xs text-text-600">cargando…</p>
                  ) : leads.data.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-text-400">
                      No tienes leads abiertos. Te llegan solos cuando el negocio te asigna uno.
                    </p>
                  ) : (
                    <ul className="divide-y divide-bg-700">
                      {leads.data.map((l) => {
                        const estado = infoEstadoPipeline(l.estado);
                        return (
                          <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-sm text-text-100">
                                {l.cliente_nombre ?? l.cliente_handle ?? "Cliente sin nombre"}
                              </span>
                              <span className="font-mono text-[11px] text-text-600">
                                {l.cliente_nombre && l.cliente_handle ? `${l.cliente_handle} · ` : ""}
                                movido {tiempoRelativo(l.actualizado_en)}
                              </span>
                            </div>
                            <Badge tone={estado.tone}>{estado.label.toLowerCase()}</Badge>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}

              {conCampo && (
                <section
                  data-tour="mi-cartera.campo"
                  className="overflow-hidden rounded-md border border-bg-700 bg-bg-900"
                >
                  <header className="flex items-center gap-2 border-b border-bg-700 px-4 py-3">
                    <MapPin size={14} className="text-text-400" aria-hidden />
                    <div>
                      <h2 className="text-sm font-medium text-text-100">Mis clientes de campo</h2>
                      <p className="font-mono text-[11px] text-text-600">
                        {clientes.data
                          ? `${fmtInt.format(clientes.data.length)} negocios que visitas`
                          : "negocios que visitas"}
                      </p>
                    </div>
                  </header>
                  {clientes.error ? (
                    <div className="p-4">
                      <Aviso tipo="error">{clientes.error}</Aviso>
                    </div>
                  ) : !clientes.data ? (
                    <p className="px-4 py-3 font-mono text-xs text-text-600">cargando…</p>
                  ) : clientes.data.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-text-400">
                      Todavía no tienes clientes de campo asignados.
                    </p>
                  ) : (
                    <ul className="divide-y divide-bg-700">
                      {clientes.data.map((c) => {
                        const estado = infoEstadoCliente(c.estado);
                        const prioridad = infoPrioridad(c.prioridad);
                        return (
                          <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-sm text-text-100">{c.nombre_negocio}</span>
                              <span className="truncate font-mono text-[11px] text-text-600">
                                {[c.contacto_nombre, c.telefono, c.direccion].filter(Boolean).join(" · ") ||
                                  "sin datos de contacto"}
                              </span>
                            </div>
                            <div className="flex shrink-0 gap-1.5">
                              <Badge tone={prioridad.tone}>{prioridad.label.toLowerCase()}</Badge>
                              <Badge tone={estado.tone}>{estado.label.toLowerCase()}</Badge>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}

              {!conEmbudo && !conCampo && servicios.data && (
                <section className="flex flex-col items-center gap-3 rounded-md border border-dashed border-bg-700 px-6 py-10 text-center">
                  <Briefcase size={20} className="text-text-600" aria-hidden />
                  <p className="max-w-sm text-xs leading-relaxed text-text-400">
                    Por ahora el negocio no tiene activa ninguna herramienta de ventas. Cuando la
                    active, aquí vas a ver a tus clientes.
                  </p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
