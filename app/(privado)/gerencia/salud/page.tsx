"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { ProblemaSaludOut, SaludOut, SeveridadSalud } from "@/lib/types";
import { formatoFechaHora, tiempoRelativo } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { GerenciaTabs } from "@/app/components/gerencia";
import { Aviso, Boton, Cargando, PageHeader } from "@/app/components/ui";

/**
 * Qué está roto ahora mismo, en toda la plataforma. Es la pantalla del
 * incidente: sin selector de fechas, porque la pregunta siempre es "ya".
 *
 * Los problemas llegan en una lista plana con `tipo`; acá se agrupan. Un
 * tipo que el frontend no conoce se muestra igual con su nombre crudo —
 * el backend puede sumar detectores sin tener que tocar esta pantalla.
 */
const TIPOS: Record<string, { titulo: string; ayuda: string }> = {
  agente_bloqueado: {
    titulo: "Agente bloqueado por pago",
    ayuda: "El dueño lo tiene encendido, pero sin plan ni créditos no contesta. Sus clientes escriben al vacío.",
  },
  consumo_anomalo: {
    titulo: "Consumo de IA anómalo",
    ayuda: "Más de lo normal en 24 h. Suele ser un loop en un workflow de n8n, no crecimiento.",
  },
  token_meta: {
    titulo: "Conexión con Meta por vencer",
    ayuda: "Al vencer, Facebook e Instagram dejan de entrar sin ningún error visible. Hay que reconectar.",
  },
  suscripcion_sin_pausar: {
    titulo: "Suscripciones vencidas sin pausar",
    ayuda: "El job de pagos no está corriendo: nadie se bloquea por impago mientras tanto.",
  },
  cobro_fallido: {
    titulo: "Cobros fallidos",
    ayuda: "La pasarela rechazó la renovación.",
  },
  pago_pendiente: {
    titulo: "Pagos trabados en pendiente",
    ayuda: "Más de una hora sin confirmar: probablemente el webhook de la pasarela no llegó.",
  },
  canal_silencioso: {
    titulo: "Canales silenciosos",
    ayuda: "Venían recibiendo mensajes y dejaron de hacerlo. Puede ser normal (fin de semana) o un canal caído.",
  },
  detector_fallido: {
    titulo: "Revisiones que fallaron",
    ayuda: "Un detector dio error. El resto de la pantalla sigue siendo válido.",
  },
};

const SEVERIDAD: Record<SeveridadSalud, { icon: typeof AlertOctagon; cls: string; label: string }> = {
  alta: { icon: AlertOctagon, cls: "text-danger", label: "alta" },
  media: { icon: AlertTriangle, cls: "text-warning", label: "media" },
  baja: { icon: Info, cls: "text-text-400", label: "baja" },
};

export default function SaludPage() {
  const salud = useApi<SaludOut>("/api/gerencia/salud");
  const [error, setError] = useState<string | null>(null);
  const [revisando, setRevisando] = useState<string | null>(null);

  const d = salud.data;

  // Agrupar conservando el orden del backend (ya viene por severidad).
  const grupos = new Map<string, ProblemaSaludOut[]>();
  for (const p of d?.problemas ?? []) {
    grupos.set(p.tipo, [...(grupos.get(p.tipo) ?? []), p]);
  }

  const revisar = async (id: string) => {
    setError(null);
    setRevisando(id);
    try {
      await apiFetch(`/api/gerencia/alertas/${id}/revisar`, { method: "PATCH" });
      await salud.recargar(true);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo marcar la alerta como revisada."));
    } finally {
      setRevisando(null);
    }
  };

  return (
    <>
      <PageHeader
        titulo="Salud"
        sub={d ? `revisado ${tiempoRelativo(d.generado_en)}` : undefined}
        acciones={
          <>
            <GerenciaTabs />
            <Boton onClick={() => salud.recargar()} loading={salud.loading && !!d}>
              <RefreshCw size={12} aria-hidden />
              Revisar
            </Boton>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {salud.error && <Aviso tipo="error">{salud.error}</Aviso>}
        {error && <Aviso tipo="error">{error}</Aviso>}
        {!d && salud.loading && <Cargando texto="revisando la plataforma…" />}

        {d && (
          <div className="flex max-w-4xl flex-col gap-6">
            {/* ---- Alertas abiertas ---- */}
            {d.alertas_abiertas.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="font-mono text-[11px] text-text-600">
                  ALERTAS ABIERTAS · {d.alertas_abiertas.length}
                </h2>
                <p className="text-xs text-text-400">
                  Las abre el job de consumo anómalo y siguen abiertas hasta que alguien las
                  marque. Mientras estén abiertas no se vuelve a avisar por correo el mismo
                  incidente.
                </p>
                <ul className="flex flex-col gap-2">
                  {d.alertas_abiertas.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-3 rounded-md border border-danger/40 bg-danger/5 px-3 py-2"
                    >
                      <AlertOctagon size={14} className="shrink-0 text-danger" aria-hidden />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm text-text-100">
                          {a.tenant_id ? (
                            <Link href={`/gerencia/tenants/${a.tenant_id}`} className="hover:underline">
                              {a.titulo}
                            </Link>
                          ) : (
                            a.titulo
                          )}
                        </span>
                        <span className="font-mono text-[11px] text-text-600">
                          abierta {tiempoRelativo(a.creada_en)}
                          {typeof a.detalle.tokens_24h === "number" &&
                            ` · ${a.detalle.tokens_24h.toLocaleString("es-MX")} tokens en 24 h`}
                        </span>
                      </div>
                      <Boton
                        onClick={() => revisar(a.id)}
                        loading={revisando === a.id}
                        disabled={revisando !== null}
                      >
                        Marcar revisada
                      </Boton>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ---- Problemas por tipo ---- */}
            {grupos.size === 0 ? (
              <section className="flex flex-col items-center gap-2 rounded-md border border-dashed border-bg-700 px-6 py-12 text-center">
                <CheckCircle2 size={22} className="text-success" aria-hidden />
                <p className="text-sm text-text-100">Nada roto ahora mismo</p>
                <p className="text-xs text-text-400">
                  Ningún detector encontró problemas en ningún negocio.
                </p>
              </section>
            ) : (
              [...grupos.entries()].map(([tipo, problemas]) => {
                const info = TIPOS[tipo] ?? { titulo: tipo, ayuda: "" };
                return (
                  <section key={tipo} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-sm font-medium text-text-100">
                        {info.titulo}{" "}
                        <span className="font-mono text-xs text-text-600">· {problemas.length}</span>
                      </h2>
                    </div>
                    {info.ayuda && <p className="text-xs text-text-400">{info.ayuda}</p>}
                    <ul className="overflow-hidden rounded-md border border-bg-700">
                      {problemas.map((p, i) => (
                        <FilaProblema key={`${p.tenant_id}-${i}`} problema={p} />
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
}

function FilaProblema({ problema: p }: { problema: ProblemaSaludOut }) {
  const sev = SEVERIDAD[p.severidad];
  const Icon = sev.icon;
  return (
    <li className="flex items-start gap-3 border-b border-bg-700 px-3 py-2 last:border-0">
      {/* Icono + etiqueta: la severidad nunca va solo por color. */}
      <Icon size={14} className={cn("mt-0.5 shrink-0", sev.cls)} aria-label={`severidad ${sev.label}`} />
      <div className="flex min-w-0 flex-1 flex-col">
        {p.tenant_id ? (
          <Link
            href={`/gerencia/tenants/${p.tenant_id}`}
            className="truncate text-sm text-text-100 hover:underline"
          >
            {p.tenant_nombre ?? p.tenant_id}
          </Link>
        ) : (
          <span className="text-sm text-text-100">plataforma</span>
        )}
        <span className="text-xs text-text-400">{p.detalle}</span>
      </div>
      {/* Fecha absoluta y no relativa: varias son futuras (el token que
          vence mañana) y tiempoRelativo solo sabe contar hacia atrás. */}
      {p.fecha && (
        <span className="shrink-0 font-mono text-[11px] text-text-600">
          {formatoFechaHora(p.fecha)}
        </span>
      )}
    </li>
  );
}
