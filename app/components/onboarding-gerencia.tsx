"use client";

import { useApi } from "@/lib/use-api";
import { formatoFechaHora } from "@/lib/formato";
import { capitalizar } from "@/lib/herramientas-plan";
import { CANALES_ONBOARDING, etiquetaGiro, etiquetaTono } from "@/lib/onboarding";
import type { EstadoOnboarding, OnboardingGerencia } from "@/lib/types";
import { Badge, type BadgeTone } from "./badge";

const ESTADO: Record<EstadoOnboarding, { label: string; tone: BadgeTone }> = {
  completado: { label: "aplicado", tone: "success" },
  pendiente: { label: "pendiente", tone: "warning" },
  omitido: { label: "omitido", tone: "info" },
  sin_iniciar: { label: "anterior al cuestionario", tone: "neutral" },
};

function siNo(v: boolean): string {
  return v ? "sí" : "no";
}

/**
 * Lo que contestó el dueño en el cuestionario de bienvenida (solo lectura,
 * GET /gerencia/tenants/{id}/onboarding). Para entender el negocio y
 * ofrecerle el plan correcto.
 */
export function OnboardingGerenciaSeccion({ tenantId }: { tenantId: string }) {
  const { data, error } = useApi<OnboardingGerencia>(`/api/gerencia/tenants/${tenantId}/onboarding`);

  if (error) return null;
  if (!data) return null;

  const r = data.respuestas;
  const estado = ESTADO[data.estado];
  const canales = r?.canales
    .map((c) => CANALES_ONBOARDING.find((x) => x.valor === c)?.etiqueta ?? c)
    .join(", ");

  const filas: [string, string][] = r
    ? [
        ["Giro", etiquetaGiro(r.giro)],
        ["Qué ofrece", r.descripcion || "—"],
        ["Agenda citas", siNo(r.agenda_citas)],
        ["Vende por chat", siNo(r.vende_por_chat)],
        ["Visitas de campo", siNo(r.visitas_campo)],
        ["Consulta datos externos", siNo(r.consulta_sistemas)],
        ["Vendedores", String(r.num_vendedores)],
        ["Atienden citas", String(r.num_proveedores)],
        ["Canales", canales || "—"],
        ["Tono", etiquetaTono(r.tono)],
        ["Horario", r.horario || "—"],
      ]
    : [];

  return (
    <section className="flex flex-col gap-3 rounded-md border border-bg-700 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium text-text-100">Cuestionario de bienvenida</h2>
        <Badge tone={estado.tone}>{estado.label}</Badge>
        {data.plan_recomendado && <Badge tone="info">recomendado: {capitalizar(data.plan_recomendado)}</Badge>}
        {data.prueba_otorgada_en && (
          <span className="font-mono text-[11px] text-text-600">
            prueba otorgada {formatoFechaHora(data.prueba_otorgada_en)}
          </span>
        )}
      </header>

      {filas.length === 0 ? (
        <p className="text-xs text-text-400">Todavía no contestó el cuestionario.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          {filas.map(([k, v]) => (
            <div key={k} className="flex min-w-0 gap-2">
              <dt className="shrink-0 text-text-600">{k}:</dt>
              <dd className="min-w-0 break-words text-text-100">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
