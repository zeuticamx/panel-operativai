import { Campo, inputClass } from "@/app/components/ui";

/**
 * Un campo por cada variable {{n}} de la plantilla. Se usa donde haya que dar
 * valores reales: el envío de prueba hoy, y una futura campaña masiva con la
 * misma forma (valores del encabezado y del cuerpo).
 */
export function FormularioVariables({
  idBase,
  etiquetaEncabezado = "Variable del encabezado",
  tieneEncabezado,
  cantidadCuerpo,
  valorEncabezado,
  valoresCuerpo,
  onEncabezado,
  onCuerpo,
  deshabilitado,
}: {
  idBase: string;
  etiquetaEncabezado?: string;
  tieneEncabezado: boolean;
  cantidadCuerpo: number;
  valorEncabezado: string;
  valoresCuerpo: string[];
  onEncabezado: (v: string) => void;
  onCuerpo: (valores: string[]) => void;
  deshabilitado?: boolean;
}) {
  if (!tieneEncabezado && cantidadCuerpo === 0) {
    return <p className="text-xs text-text-600">Esta plantilla no tiene variables.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {tieneEncabezado && (
        <Campo id={`${idBase}-enc`} label={`${etiquetaEncabezado} {{1}}`}>
          <input
            id={`${idBase}-enc`}
            className={inputClass}
            value={valorEncabezado}
            disabled={deshabilitado}
            onChange={(e) => onEncabezado(e.target.value)}
          />
        </Campo>
      )}
      {Array.from({ length: cantidadCuerpo }, (_, i) => (
        <Campo key={i} id={`${idBase}-v${i + 1}`} label={`Variable {{${i + 1}}} del cuerpo`}>
          <input
            id={`${idBase}-v${i + 1}`}
            className={inputClass}
            value={valoresCuerpo[i] ?? ""}
            disabled={deshabilitado}
            onChange={(e) => {
              const nuevos = Array.from({ length: cantidadCuerpo }, (_, j) => valoresCuerpo[j] ?? "");
              nuevos[i] = e.target.value;
              onCuerpo(nuevos);
            }}
          />
        </Campo>
      ))}
    </div>
  );
}
