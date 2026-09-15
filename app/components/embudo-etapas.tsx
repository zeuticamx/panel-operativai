import type { MetricaEtapaOut, PipelineOut } from "@/lib/types";
import {
  ESTADOS_PIPELINE,
  formatoHoras,
  formatoMonto,
  infoEstadoPipeline,
} from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "./badge";
import { Badge } from "./badge";

const TONE_BORDE: Record<BadgeTone, string> = {
  neutral: "border-t-bg-600",
  success: "border-t-success",
  warning: "border-t-warning",
  danger: "border-t-danger",
  info: "border-t-series-1",
};

/**
 * Kanban del embudo: una columna por etapa (`ESTADOS_PIPELINE`, no lo que
 * traiga la respuesta, para que el orden sea siempre el del proceso de
 * venta), con los leads de esa etapa como cards. Columnas vacías se
 * muestran igual, en 0, en vez de desaparecer.
 */
export function EmbudoEtapas({
  leads,
  metricas,
  onSelectLead,
}: {
  leads: PipelineOut[];
  metricas: Record<string, MetricaEtapaOut>;
  onSelectLead?: (lead: PipelineOut) => void;
}) {
  const porEstado = new Map<string, PipelineOut[]>();
  for (const lead of leads) {
    const grupo = porEstado.get(lead.estado);
    if (grupo) grupo.push(lead);
    else porEstado.set(lead.estado, [lead]);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {ESTADOS_PIPELINE.map((estado) => {
        const info = infoEstadoPipeline(estado);
        const deEstaEtapa = porEstado.get(estado) ?? [];
        const horas = metricas[estado]?.horas_promedio ?? null;

        return (
          <section
            key={estado}
            className={cn(
              "flex w-64 shrink-0 flex-col rounded-md border border-t-2 border-bg-700 bg-bg-800",
              TONE_BORDE[info.tone],
            )}
          >
            <header className="flex items-center justify-between gap-2 px-3 py-2.5">
              <h3 className="truncate text-xs font-medium text-text-100">
                {info.label}
              </h3>
              <Badge tone={info.tone}>{deEstaEtapa.length}</Badge>
            </header>

            <div className="flex min-h-16 max-h-[28rem] flex-col gap-2 overflow-y-auto px-2 pb-2">
              {deEstaEtapa.length === 0 ? (
                <p className="px-1 py-3 text-center font-mono text-[11px] text-text-600">
                  sin leads
                </p>
              ) : (
                deEstaEtapa.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} onSelect={onSelectLead} />
                ))
              )}
            </div>

            <footer className="border-t border-bg-700 px-3 py-2 font-mono text-[11px] text-text-600">
              {horas !== null ? (
                <span title="Tiempo promedio en esta etapa">
                  ~{formatoHoras(horas)}
                </span>
              ) : (
                "—"
              )}
            </footer>
          </section>
        );
      })}
    </div>
  );
}

function LeadCard({
  lead,
  onSelect,
}: {
  lead: PipelineOut;
  onSelect?: (lead: PipelineOut) => void;
}) {
  const nombre =
    lead.cliente_nombre ?? lead.cliente_handle ?? "Cliente sin nombre";

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? () => onSelect(lead) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(lead);
              }
            }
          : undefined
      }
      className={cn(
        "flex flex-col gap-1 rounded-md border border-bg-700 bg-bg-900 p-2.5 transition-colors",
        onSelect &&
          "cursor-pointer hover:border-bg-600 hover:bg-bg-800 focus:bg-bg-800 focus:outline-none",
      )}
    >
      <span className="truncate text-xs text-text-100">{nombre}</span>
      <span className="truncate font-mono text-[11px] text-text-600">
        {lead.vendedor_nombre ?? (
          <span className="text-warning">sin asignar</span>
        )}
      </span>
      {lead.monto_estimado && (
        <span className="font-mono text-[11px] tabular-nums text-text-400">
          {formatoMonto(lead.monto_estimado)}
        </span>
      )}
    </div>
  );
}
