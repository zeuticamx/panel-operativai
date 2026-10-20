import { rellenar } from "@/lib/plantillas";
import type { PlantillaBotonIn } from "@/lib/types";

/**
 * Burbuja estilo WhatsApp. Reemplaza {{n}} por los valores que haya y deja la
 * marca visible mientras falte uno. Los colores son los de la propia app de
 * WhatsApp (verde de burbuja saliente), no tokens del portal: es una réplica.
 */
export function VistaPreviaWhatsapp({
  encabezado,
  cuerpo,
  pie,
  botones = [],
  valoresEncabezado = [],
  valoresCuerpo = [],
}: {
  encabezado?: string;
  cuerpo: string;
  pie?: string;
  botones?: Pick<PlantillaBotonIn, "tipo" | "texto">[];
  valoresEncabezado?: string[];
  valoresCuerpo?: string[];
}) {
  const hora = "12:00";
  return (
    <div
      role="img"
      aria-label="Vista previa del mensaje en WhatsApp"
      className="rounded-xl bg-[#0b141a] p-3"
    >
      <div className="max-w-[320px] rounded-lg rounded-tl-none bg-[#005c4b] px-2.5 py-2 text-[13px] leading-snug text-[#e9edef] shadow">
        {encabezado?.trim() && (
          <p className="mb-1 font-semibold break-words">{rellenar(encabezado, valoresEncabezado)}</p>
        )}
        <p className="break-words whitespace-pre-wrap">
          {cuerpo.trim() ? rellenar(cuerpo, valoresCuerpo) : "Escribe el cuerpo del mensaje…"}
        </p>
        {pie?.trim() && <p className="mt-1.5 text-[11px] break-words text-[#8696a0]">{pie}</p>}
        <p className="mt-1 text-right text-[10px] text-[#8696a0]">{hora}</p>
      </div>
      {botones.filter((b) => b.texto.trim()).map((b, i) => (
        <div
          key={i}
          className="mt-1 max-w-[320px] rounded-lg bg-[#1f2c34] px-2.5 py-1.5 text-center text-[13px] font-medium text-[#53bdeb]"
        >
          {b.texto}
        </div>
      ))}
    </div>
  );
}
