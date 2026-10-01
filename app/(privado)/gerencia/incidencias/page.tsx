"use client";

import { useEffect, useState } from "react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { EstadoReporte, ReporteEstadoIn, ReporteGerenciaOut } from "@/lib/types";
import { formatoFechaHora, tiempoRelativo } from "@/lib/formato";
import { Badge, type BadgeTone } from "@/app/components/badge";
import { GerenciaTabs } from "@/app/components/gerencia";
import { Aviso, Boton, Cargando, PageHeader, selectClass } from "@/app/components/ui";

const ESTADOS: { value: EstadoReporte; label: string; tone: BadgeTone }[] = [
  { value: "abierto", label: "Abierto", tone: "warning" },
  { value: "en_revision", label: "En revisión", tone: "info" },
  { value: "resuelto", label: "Resuelto", tone: "success" },
];

const infoEstado = (e: EstadoReporte) => ESTADOS.find((x) => x.value === e)!;

/** La captura vive detrás de un endpoint con token: no se puede poner en un <img src>. */
function Captura({ reporteId }: { reporteId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objeto: string | null = null;
    let cancelado = false;
    apiFetch<Blob>(`/api/gerencia/incidencias/${reporteId}/adjunto`, { respuesta: "blob" })
      .then((blob) => {
        if (cancelado) return;
        objeto = URL.createObjectURL(blob);
        setUrl(objeto);
      })
      .catch(() => !cancelado && setError(true));
    return () => {
      cancelado = true;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [reporteId]);

  if (error) return <Aviso tipo="error">No se pudo cargar la captura.</Aviso>;
  if (!url) return <Cargando texto="cargando captura…" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element -- blob: local, no hay nada que optimizar */}
      <img
        src={url}
        alt="Captura adjunta al reporte"
        className="max-h-80 rounded border border-bg-700 object-contain"
      />
    </a>
  );
}

function Detalle({
  reporte,
  onCambio,
}: {
  reporte: ReporteGerenciaOut;
  onCambio: () => void;
}) {
  const [guardando, setGuardando] = useState<EstadoReporte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const c = reporte.contexto;

  const cambiar = async (estado: EstadoReporte) => {
    setGuardando(estado);
    setError(null);
    try {
      const body: ReporteEstadoIn = { estado };
      await apiFetch(`/api/gerencia/incidencias/${reporte.id}`, { method: "PATCH", json: body });
      onCambio();
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo cambiar el estado."));
    } finally {
      setGuardando(null);
    }
  };

  const filas: [string, string | undefined][] = [
    ["Pantalla", c.ruta],
    ["Navegador", c.navegador],
    ["Sistema operativo", c.sistema_operativo],
    ["Resolución", c.pantalla && `${c.pantalla.ancho}×${c.pantalla.alto}`],
    ["Ventana", c.ventana && `${c.ventana.ancho}×${c.ventana.alto}`],
    ["Idioma", c.idioma],
    ["Zona horaria", c.zona_horaria],
  ];

  return (
    <div className="flex flex-col gap-4 border-t border-bg-700 bg-bg-950 px-3 py-4">
      <p className="text-sm whitespace-pre-wrap text-text-100">{reporte.descripcion}</p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11px]">
        {filas
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-text-600">{k}</dt>
              <dd className="min-w-0 break-words text-text-400">{v}</dd>
            </div>
          ))}
      </dl>

      {reporte.tiene_adjunto && <Captura reporteId={reporte.id} />}

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="flex flex-wrap items-center gap-2">
        {ESTADOS.filter((e) => e.value !== reporte.estado).map((e) => (
          <Boton
            key={e.value}
            variante="secundario"
            onClick={() => cambiar(e.value)}
            loading={guardando === e.value}
            disabled={guardando !== null}
            className="min-h-8"
          >
            Marcar {e.label.toLowerCase()}
          </Boton>
        ))}
        {reporte.atendido_por && reporte.atendido_en && (
          <span className="font-mono text-[11px] text-text-600">
            {reporte.atendido_por} · {formatoFechaHora(reporte.atendido_en)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Reportes de problemas que mandan los usuarios del portal. */
export default function IncidenciasPage() {
  const [estado, setEstado] = useState<EstadoReporte | "">("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const reportes = useApi<ReporteGerenciaOut[]>(
    `/api/gerencia/incidencias${estado ? `?estado=${estado}` : ""}`,
  );

  return (
    <>
      <PageHeader titulo="Reportes de problemas" acciones={<GerenciaTabs />} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex max-w-3xl flex-col gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="estado" className="sr-only">
              Estado
            </label>
            <select
              id="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoReporte | "")}
              className={`${selectClass} w-auto py-1.5 text-xs`}
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          {reportes.error && <Aviso tipo="error">{reportes.error}</Aviso>}
          {!reportes.data && reportes.loading && <Cargando />}

          {reportes.data && reportes.data.length === 0 && (
            <p className="py-12 text-center text-sm text-text-400">
              {estado ? "No hay reportes con ese estado." : "Todavía no hay reportes."}
            </p>
          )}

          {reportes.data && reportes.data.length > 0 && (
            <ul className="overflow-hidden rounded-md border border-bg-700">
              {reportes.data.map((r) => {
                const info = infoEstado(r.estado);
                const expandido = abierto === r.id;
                return (
                  <li key={r.id} className="border-b border-bg-700 last:border-0">
                    <button
                      type="button"
                      onClick={() => setAbierto(expandido ? null : r.id)}
                      aria-expanded={expandido}
                      className="flex w-full cursor-pointer flex-wrap items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-900"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-text-100">{r.resumen}</span>
                        <span className="truncate font-mono text-[11px] text-text-600">
                          {r.nombre_negocio ?? "(sin negocio)"} · {r.email} ·{" "}
                          {tiempoRelativo(r.creado_en)}
                        </span>
                      </span>
                      <Badge tone={info.tone}>{info.label}</Badge>
                    </button>
                    {expandido && <Detalle reporte={r} onCambio={() => reportes.recargar(true)} />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
