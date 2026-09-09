import { CheckCircle2, MapPinOff } from "lucide-react";
import { formatoDistancia } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

/**
 * Veredicto de una visita. El backend ya lo decidió y lo guardó; acá solo
 * se muestra, nunca se recalcula — si alguien mueve el pin del cliente
 * después, la visita conserva el resultado que tuvo.
 */
export function GeocercaBadge({
  dentro,
  distancia,
  className,
}: {
  dentro: boolean;
  distancia?: number;
  className?: string;
}) {
  const Icono = dentro ? CheckCircle2 : MapPinOff;
  return (
    <Badge tone={dentro ? "success" : "danger"} className={cn("gap-1", className)}>
      <Icono size={11} aria-hidden />
      {dentro ? "Validada" : "Fuera"}
      {distancia !== undefined && (
        <span className="opacity-70">· {formatoDistancia(distancia)}</span>
      )}
    </Badge>
  );
}

/**
 * Barra de distancia contra el radio del cliente.
 *
 * La escala se fija en 1.5× el radio para que "dentro" ocupe dos tercios y
 * el borde quede a la vista. Sin ese tope, una visita a 400 km aplastaría
 * la barra y no se distinguiría de uno a 200 m.
 */
export function GeocercaBarra({
  distancia,
  radio,
  className,
}: {
  distancia: number;
  radio: number;
  className?: string;
}) {
  const escala = radio * 1.5;
  const pct = Math.min(100, (distancia / escala) * 100);
  const pctRadio = (radio / escala) * 100;
  const dentro = distancia <= radio;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-sm bg-bg-700"
        role="img"
        aria-label={`${formatoDistancia(distancia)} del punto, tolerancia ${radio} m: ${
          dentro ? "dentro" : "fuera"
        } de la geocerca`}
      >
        <div
          className={cn(
            "h-full rounded-sm transition-[width] duration-300",
            dentro ? "bg-success" : "bg-danger",
          )}
          style={{ width: `${pct}%` }}
        />
        {/* Marca del radio permitido. */}
        <span
          aria-hidden
          className="absolute top-0 h-full w-px bg-text-100/60"
          style={{ left: `${pctRadio}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-text-600">
        <span className={dentro ? "text-success" : "text-danger"}>
          {formatoDistancia(distancia)}
        </span>
        <span>tolerancia {radio} m</span>
      </div>
    </div>
  );
}
