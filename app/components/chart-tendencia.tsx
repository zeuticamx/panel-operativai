"use client";

import { useRef, useState } from "react";
import type { TendenciaMesOut } from "@/lib/types";
import { fmtInt, formatoMes } from "@/lib/formato";

const VIEW_W = 600;
const VIEW_H = 200;
const PAD_LEFT = 30;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const PLOT_W = VIEW_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;
const PASOS_GRID = 4;

/** "2026-01" -> "ene" (con año solo en enero, para no repetirlo 12 veces). */
function etiquetaEje(periodo: string): string {
  const label = formatoMes(periodo).replace(".", "");
  return periodo.endsWith("-01") ? label : label.split(" ")[0];
}

/**
 * Tendencia mensual: dos series (nuevos vs. ganados) en una sola línea de
 * tiempo. SVG a mano y no una librería de charts — el resto del portal
 * dibuja sus gráficos con divs/SVG simple (ver ChartEmbudo, el PDF del
 * embudo), y dos polylines no justifican una dependencia nueva.
 *
 * El naranja de "ganados" queda bajo 3:1 de contraste en tema claro
 * (paleta validada con el skill de dataviz): por eso los valores van
 * siempre visibles al pasar el mouse y no solo por el color de la línea.
 */
export function ChartTendencia({ meses }: { meses: TendenciaMesOut[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const n = meses.length;
  const maxValor = Math.max(1, ...meses.flatMap((m) => [m.nuevos, m.ganados])) * 1.15;

  const xFor = (i: number) => (n <= 1 ? PAD_LEFT + PLOT_W / 2 : PAD_LEFT + (i / (n - 1)) * PLOT_W);
  const yFor = (v: number) => PAD_TOP + PLOT_H - (v / maxValor) * PLOT_H;

  const puntos = (clave: "nuevos" | "ganados") =>
    meses.map((m, i) => `${xFor(i)},${yFor(m[clave])}`).join(" ");

  const moverMouse = (e: React.MouseEvent<SVGRectElement>) => {
    if (!svgRef.current || n === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const xViewBox = ratio * VIEW_W;
    const i = Math.round(((xViewBox - PAD_LEFT) / PLOT_W) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const activo = hover !== null ? meses[hover] : null;
  const gridlines = Array.from({ length: PASOS_GRID + 1 }, (_, i) => i / PASOS_GRID);

  return (
    <div className="flex flex-col gap-2">
      {/* Leyenda: obligatoria con 2+ series, para que la identidad no dependa solo del color */}
      <div className="flex items-center gap-4 text-[11px] text-text-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-series-1" aria-hidden />
          Nuevos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-series-2" aria-hidden />
          Ganados
        </span>
        {activo && (
          <span className="ml-auto font-mono tabular-nums text-text-100">
            {formatoMes(activo.periodo)} · {fmtInt.format(activo.nuevos)} nuevos ·{" "}
            {fmtInt.format(activo.ganados)} ganados
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full"
        role="img"
        aria-label="Leads nuevos y ganados por mes, últimos 12 meses"
      >
        {gridlines.map((f) => {
          const y = PAD_TOP + f * PLOT_H;
          return (
            <g key={f}>
              <line
                x1={PAD_LEFT}
                x2={VIEW_W - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--grid)"
                strokeWidth={1}
                opacity={0.5}
              />
              <text x={PAD_LEFT - 6} y={y + 3} textAnchor="end" fontSize={8} fill="var(--text-600)">
                {fmtInt.format(Math.round(maxValor * (1 - f)))}
              </text>
            </g>
          );
        })}

        {meses.map((m, i) => (
          <text
            key={m.periodo}
            x={xFor(i)}
            y={VIEW_H - 6}
            textAnchor="middle"
            fontSize={8}
            fill="var(--text-600)"
          >
            {etiquetaEje(m.periodo)}
          </text>
        ))}

        {hover !== null && (
          <line
            x1={xFor(hover)}
            x2={xFor(hover)}
            y1={PAD_TOP}
            y2={PAD_TOP + PLOT_H}
            stroke="var(--grid)"
            strokeWidth={1}
          />
        )}

        <polyline points={puntos("nuevos")} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={puntos("ganados")} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {meses.map((m, i) => (
          <g key={m.periodo}>
            <circle cx={xFor(i)} cy={yFor(m.nuevos)} r={hover === i ? 4 : 2.5} fill="var(--series-1)" />
            <circle cx={xFor(i)} cy={yFor(m.ganados)} r={hover === i ? 4 : 2.5} fill="var(--series-2)" />
          </g>
        ))}

        {/* Área transparente que captura el mouse para el crosshair */}
        <rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onMouseMove={moverMouse}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {/* Alternativa accesible: la misma serie en tabla, para lectores de pantalla */}
      <table className="sr-only">
        <caption>Leads nuevos y ganados por mes</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Nuevos</th>
            <th>Ganados</th>
            <th>Perdidos</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.periodo}>
              <td>{formatoMes(m.periodo)}</td>
              <td>{m.nuevos}</td>
              <td>{m.ganados}</td>
              <td>{m.perdidos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
