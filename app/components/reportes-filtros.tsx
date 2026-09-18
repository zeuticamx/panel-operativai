"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, RefreshCw } from "lucide-react";
import { useDebounce } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import { Aviso, Boton, inputClass } from "@/app/components/ui";

export interface FiltrosReporte {
  /** "YYYY-MM-DD" */
  fechaInicio?: string;
  fechaFin?: string;
}

export interface ReportesFiltrosProps {
  filtros: FiltrosReporte;
  onFiltrosChange: (filtros: FiltrosReporte) => void;
  loading?: boolean;
  /**
   * Fuerza un refetch sin cambiar el rango. Sin esto el botón "Actualizar"
   * no tendría qué hacer — no estaba en las props del pedido, pero el botón
   * sí, y uno no funciona sin el otro.
   */
  onRefrescar?: () => void;
  /** Nombres de los query params en la URL. */
  paramInicio?: string;
  paramFin?: string;
}

function fechaLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function hoy(): string {
  return fechaLocal(new Date());
}

function restarMeses(d: Date, meses: number): Date {
  const copia = new Date(d);
  copia.setMonth(copia.getMonth() - meses);
  return copia;
}

function inicioDeMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** "2026-09-17" -> "17 sep 2026", para el texto legible del rango. */
function formatoFechaCorta(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

const PRESETS: { etiqueta: string; calcular: () => FiltrosReporte }[] = [
  {
    etiqueta: "Este mes",
    calcular: () => ({ fechaInicio: fechaLocal(inicioDeMes(new Date())), fechaFin: hoy() }),
  },
  {
    etiqueta: "Últimos 3 meses",
    calcular: () => ({ fechaInicio: fechaLocal(restarMeses(new Date(), 3)), fechaFin: hoy() }),
  },
  {
    etiqueta: "Últimos 12 meses",
    calcular: () => ({ fechaInicio: fechaLocal(restarMeses(new Date(), 12)), fechaFin: hoy() }),
  },
  { etiqueta: "Todo el tiempo", calcular: () => ({ fechaInicio: undefined, fechaFin: undefined }) },
];

/**
 * Filtro de fecha para los reportes: dos `<input type="date">` (sin
 * dependencia de calendario — es lo que ya usa el resto del portal, ver
 * `vendedores/reportes/page.tsx`), presets rápidos, debounce de 500ms y el
 * rango reflejado en la URL para que se pueda compartir/recargar la página
 * sin perder el filtro.
 *
 * Controlado: el padre es dueño de `filtros` y decide qué hacer en
 * `onFiltrosChange` (típicamente, reconstruir el query string de sus
 * `useApi`). Este componente además reescribe la URL por su cuenta —, no la
 * lee al montar: si el padre quiere arrancar desde `useSearchParams`, es
 * cosa suya, este componente no asume de dónde salió su estado inicial.
 */
export function ReportesFiltros({
  filtros,
  onFiltrosChange,
  loading = false,
  onRefrescar,
  paramInicio = "desde",
  paramFin = "hasta",
}: ReportesFiltrosProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [local, setLocal] = useState(filtros);
  // 500ms: que mover el date picker no dispare un fetch por cada click.
  const debounced = useDebounce(local, 500);

  // Si el padre cambia `filtros` desde afuera (por ejemplo, restauró un
  // valor al montar), reflejarlo acá sin esperar el debounce. Ajustado
  // durante el render (patrón de React para "resetear estado cuando cambia
  // una prop") y no en un efecto, para no meter una vuelta extra de
  // render -> efecto -> render por cada cambio.
  const [filtrosPrevios, setFiltrosPrevios] = useState(filtros);
  if (filtros.fechaInicio !== filtrosPrevios.fechaInicio || filtros.fechaFin !== filtrosPrevios.fechaFin) {
    setFiltrosPrevios(filtros);
    setLocal(filtros);
  }

  const actualizarUrl = (f: FiltrosReporte) => {
    const params = new URLSearchParams(searchParams.toString());
    if (f.fechaInicio) params.set(paramInicio, f.fechaInicio);
    else params.delete(paramInicio);
    if (f.fechaFin) params.set(paramFin, f.fechaFin);
    else params.delete(paramFin);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // Solo dispara cuando `debounced` de verdad cambió respecto al último
  // valor avisado — no un simple booleano "ya pasó el primer render".
  // Con ese booleano, el doble efecto que React Strict Mode dispara a
  // propósito en desarrollo (monta -> corre el efecto -> lo vuelve a correr)
  // lo deja mutado en la primera pasada y ya no protege la segunda, así que
  // termina avisando un "cambio" fantasma con el valor inicial. Comparar
  // contra el último valor disparado es idempotente ante esa duplicación:
  // las dos pasadas ven el mismo `debounced` y las dos lo saltan igual.
  const ultimoDisparado = useRef(debounced);
  useEffect(() => {
    if (
      debounced.fechaInicio === ultimoDisparado.current.fechaInicio &&
      debounced.fechaFin === ultimoDisparado.current.fechaFin
    ) {
      return;
    }
    ultimoDisparado.current = debounced;
    onFiltrosChange(debounced);
    actualizarUrl(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced.fechaInicio, debounced.fechaFin]);

  const rangoInvalido = !!local.fechaInicio && !!local.fechaFin && local.fechaInicio > local.fechaFin;

  const aplicarPreset = (f: FiltrosReporte) => {
    setLocal(f);
    onFiltrosChange(f);
    actualizarUrl(f);
  };

  const textoRango =
    local.fechaInicio && local.fechaFin
      ? `${formatoFechaCorta(local.fechaInicio)} – ${formatoFechaCorta(local.fechaFin)}`
      : "Todo el tiempo";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="reportes-filtros-desde">
          Desde
        </label>
        <div className="relative">
          <CalendarDays
            size={13}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-600"
            aria-hidden
          />
          <input
            id="reportes-filtros-desde"
            type="date"
            value={local.fechaInicio ?? ""}
            max={local.fechaFin || undefined}
            onChange={(e) => setLocal((f) => ({ ...f, fechaInicio: e.target.value || undefined }))}
            className={cn(inputClass, "w-[9.5rem] py-1.5 pl-8 text-xs")}
          />
        </div>

        <span className="text-xs text-text-600" aria-hidden>
          –
        </span>

        <label className="sr-only" htmlFor="reportes-filtros-hasta">
          Hasta
        </label>
        <div className="relative">
          <CalendarDays
            size={13}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-600"
            aria-hidden
          />
          <input
            id="reportes-filtros-hasta"
            type="date"
            value={local.fechaFin ?? ""}
            min={local.fechaInicio || undefined}
            max={hoy()}
            onChange={(e) => setLocal((f) => ({ ...f, fechaFin: e.target.value || undefined }))}
            className={cn(inputClass, "w-[9.5rem] py-1.5 pl-8 text-xs")}
          />
        </div>

        {onRefrescar && (
          <Boton variante="fantasma" onClick={onRefrescar} loading={loading} title="Actualizar">
            <RefreshCw size={13} aria-hidden />
            Actualizar
          </Boton>
        )}

        <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
          {PRESETS.map((p) => (
            <Boton key={p.etiqueta} variante="fantasma" onClick={() => aplicarPreset(p.calcular())}>
              {p.etiqueta}
            </Boton>
          ))}
        </div>
      </div>

      {rangoInvalido ? (
        <Aviso tipo="error">La fecha &quot;Desde&quot; tiene que ser anterior a &quot;Hasta&quot;.</Aviso>
      ) : (
        <p className="font-mono text-[11px] text-text-600">{textoRango}</p>
      )}
    </div>
  );
}
