import { infoEstadoPipeline } from "@/lib/formato";
import { Badge } from "./badge";

/** Etapa del embudo como badge con el tono de la etapa. */
export function EstadoLead({ estado, className }: { estado: string; className?: string }) {
  const info = infoEstadoPipeline(estado);
  return (
    <Badge tone={info.tone} className={className}>
      {info.label}
    </Badge>
  );
}
