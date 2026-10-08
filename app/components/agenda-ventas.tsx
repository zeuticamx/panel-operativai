"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin, { Draggable, type DateClickArg, type DropArg } from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
  EventSourceFuncArg,
} from "@fullcalendar/core";
import { CalendarX2, ChevronLeft, ChevronRight, GripVertical, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import {
  FILTROS_INICIALES,
  TIPO_INFO,
  atrasadosFueraDeVista,
  claveItem,
  esMovible,
  fechaAlSoltar,
  fechaCorta,
  filtrarItems,
  leadsSinSeguimiento,
  nombreLead,
  rangoQuery,
  type FiltrosAgenda,
} from "@/lib/agenda";
import { infoEstadoPipeline, tiempoRelativo } from "@/lib/formato";
import type { AgendaItemOut, AgendaOut, PipelineOut, TipoPendiente, VendedorOut } from "@/lib/types";
import { useApi, useRefrescoAutomatico } from "@/lib/use-api";
import { useDatosEnVivo } from "@/lib/use-websocket-alertas";
import { cn } from "@/lib/utils";
import { AgendaDetalle } from "./agenda-detalle";
import { AgendaNuevo } from "./agenda-nuevo";
import { Badge } from "./badge";
import { Aviso, Boton, selectClass } from "./ui";
import { useUsuario } from "./usuario-context";

/**
 * Agenda de ventas: tareas del CRM de campo y seguimientos de leads del
 * embudo en un solo calendario (GET /api/agenda).
 *
 * Arrastrar un pendiente a otro día/hora lo reprograma en el acto — PUT
 * /tareas/{id} o PUT /agenda/seguimientos/{user_id} — y el aviso trae un
 * "Deshacer". Si el guardado falla, la tarjeta vuelve a su lugar.
 *
 * El carril "Por agendar" junta lo que no está a la vista y se puede soltar
 * en la grilla: lo vencido de semanas anteriores y los leads abiertos sin
 * fecha de seguimiento.
 *
 * `modo`:
 *   negocio  /vendedores/agenda — todo el equipo, con filtro por vendedor
 *   propio   /mi-cartera — el vendedor; el backend ya le filtra lo suyo
 */

type Vista = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";

const VISTAS: { id: Vista; label: string }[] = [
  { id: "dayGridMonth", label: "Mes" },
  { id: "timeGridWeek", label: "Semana" },
  { id: "timeGridDay", label: "Día" },
  { id: "listWeek", label: "Lista" },
];

const DIA_MS = 86_400_000;
/** Hasta dónde mira atrás el carril de atrasados (el backend admite 100 días). */
const DIAS_ATRASADOS = 90;

/** Lo mínimo para escribir la fecha de un pendiente, venga del calendario o del carril. */
type Movible = Pick<AgendaItemOut, "tipo" | "id" | "cliente_id" | "titulo">;

function guardarFecha(item: Movible, fecha: string | null): Promise<unknown> {
  if (item.tipo === "tarea") {
    return apiFetch(`/api/tareas/${item.id}`, { method: "PUT", json: { fecha_programada: fecha } });
  }
  return apiFetch(`/api/agenda/seguimientos/${item.cliente_id}`, { method: "PUT", json: { fecha } });
}

function aEvento(item: AgendaItemOut): EventInput {
  return {
    id: claveItem(item),
    title: item.titulo,
    start: item.fecha,
    allDay: false,
    editable: esMovible(item),
    classNames: ["agenda-ev", `agenda-ev--${item.tipo}`, `agenda-ev--${item.estado}`],
    extendedProps: { item },
  };
}

function vistaInicial(): Vista {
  // En el teléfono la grilla de mes no se lee: lista de la semana.
  return typeof window !== "undefined" && window.innerWidth < 768 ? "listWeek" : "dayGridMonth";
}

export function AgendaVentas({
  modo,
  vendedorPropioId,
  fechaInicial,
}: {
  modo: "negocio" | "propio";
  /** Solo en modo propio: su ficha, para pedir sus leads. */
  vendedorPropioId?: string;
  /** Abre la agenda en esa fecha (?fecha= desde una alerta). */
  fechaInicial?: Date | null;
}) {
  const { usuario } = useUsuario();
  const tenantId = usuario?.tenant_id ?? null;
  const esNegocio = modo === "negocio";
  const puedeReasignar = usuario?.role === "owner" || usuario?.role === "superadmin";

  const calRef = useRef<FullCalendar>(null);
  const carrilRef = useRef<HTMLDivElement>(null);

  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [titulo, setTitulo] = useState("");
  const [inicioVisible, setInicioVisible] = useState<Date | null>(null);
  const [filtros, setFiltros] = useState<FiltrosAgenda>(FILTROS_INICIALES);
  const [vendedorFiltro, setVendedorFiltro] = useState("");
  const [disponibles, setDisponibles] = useState<{ tareas: boolean; seguimientos: boolean } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<AgendaItemOut | null>(null);
  const [nuevo, setNuevo] = useState<Date | null>(null);
  // "Ahora" del carril de atrasados. Fijo entre recargas: si se recalculara
  // en cada render, la URL cambiaría siempre y useApi pediría sin parar.
  const [ancla, setAncla] = useState(() => Date.now());

  const vendedorId = esNegocio && vendedorFiltro ? vendedorFiltro : null;

  // --- Datos del carril y de los diálogos ---------------------------------
  const atrasadosPath = useMemo(
    () => `/api/agenda?${rangoQuery(new Date(ancla - DIAS_ATRASADOS * DIA_MS), new Date(ancla), vendedorId)}`,
    [ancla, vendedorId],
  );
  const atrasadosApi = useApi<AgendaOut>(atrasadosPath);

  const leadsPath = !disponibles?.seguimientos
    ? null
    : esNegocio
      ? tenantId
        ? `/api/tenants/${tenantId}/pipeline?limite=500`
        : null
      : vendedorPropioId
        ? `/api/vendedores/${vendedorPropioId}/pipeline?incluir_cerrados=false`
        : null;
  const leads = useApi<PipelineOut[]>(leadsPath);
  const vendedores = useApi<VendedorOut[]>(esNegocio && tenantId ? `/api/tenants/${tenantId}/vendedores` : null);

  const atrasados = useMemo(
    () =>
      inicioVisible && atrasadosApi.data
        ? atrasadosFueraDeVista(filtrarItems(atrasadosApi.data.items, filtros), inicioVisible)
        : [],
    [atrasadosApi.data, filtros, inicioVisible],
  );
  const leadsAbiertos = useMemo(
    () => (leads.data ?? []).filter((l) => l.estado !== "ganado" && l.estado !== "perdido"),
    [leads.data],
  );
  const sinSeguimiento = useMemo(
    () => (filtros.seguimientos ? leadsSinSeguimiento(leads.data ?? [], vendedorId) : []),
    [leads.data, vendedorId, filtros.seguimientos],
  );

  // El carril lee estas tablas desde el handler de `drop` de FullCalendar,
  // que se registra una vez: van por ref para no quedar con datos viejos.
  const porClave = useRef(new Map<string, AgendaItemOut>());
  const porLead = useRef(new Map<string, PipelineOut>());
  useEffect(() => {
    porClave.current = new Map(atrasados.map((i) => [claveItem(i), i]));
    porLead.current = new Map(sinSeguimiento.map((l) => [l.user_id, l]));
  }, [atrasados, sinSeguimiento]);

  // --- Calendario ---------------------------------------------------------
  const cargarEventos = useCallback(
    async (info: EventSourceFuncArg): Promise<EventInput[]> => {
      setCargando(true);
      try {
        const r = await apiFetch<AgendaOut>(`/api/agenda?${rangoQuery(info.start, info.end, vendedorId)}`);
        setDisponibles({ tareas: r.tareas_disponibles, seguimientos: r.seguimientos_disponibles });
        setErrorCarga(null);
        return filtrarItems(r.items, filtros).map(aEvento);
      } catch (e) {
        setErrorCarga(mensajeDeError(e, "No se pudo cargar la agenda."));
        return [];
      } finally {
        setCargando(false);
      }
    },
    [vendedorId, filtros],
  );

  const api = () => calRef.current?.getApi();

  const { recargar: recargarLeads } = leads;
  const recargarTodo = useCallback(() => {
    calRef.current?.getApi().refetchEvents();
    setAncla(() => Date.now());
    void recargarLeads(true);
  }, [recargarLeads]);

  // Red de seguridad: la agenda también cambia por acciones de otras personas.
  const recargarTodoAsync = useCallback(async () => recargarTodo(), [recargarTodo]);
  useRefrescoAutomatico(recargarTodoAsync, 60_000, true);
  useDatosEnVivo(["agenda", "cartera"], recargarTodo);

  const deshacer = useCallback(
    async (item: Movible, anterior: string | null) => {
      try {
        await guardarFecha(item, anterior);
        toast.success(anterior ? `«${item.titulo}» volvió al ${fechaCorta(anterior)}.` : "Se quitó de la agenda.");
      } catch (e) {
        toast.error(mensajeDeError(e, "No se pudo deshacer."));
      } finally {
        recargarTodo();
      }
    },
    [recargarTodo],
  );

  const mover = useCallback(
    async (item: Movible, nueva: Date, anterior: string | null, revertir?: () => void) => {
      try {
        await guardarFecha(item, nueva.toISOString());
        toast.success(`«${item.titulo}» quedó para el ${fechaCorta(nueva)}.`, {
          action: { label: "Deshacer", onClick: () => void deshacer(item, anterior) },
        });
      } catch (e) {
        revertir?.();
        toast.error(mensajeDeError(e, "No se pudo reprogramar."));
      } finally {
        recargarTodo();
      }
    },
    [deshacer, recargarTodo],
  );

  const alSoltarEvento = (info: EventDropArg) => {
    const item = info.event.extendedProps.item as AgendaItemOut;
    const nueva = info.event.start;
    if (!nueva) return info.revert();
    void mover(item, nueva, item.fecha, info.revert);
  };

  const alSoltarDelCarril = useCallback(
    (info: DropArg) => {
      const { clave, lead: leadId } = info.draggedEl.dataset;
      if (clave) {
        const item = porClave.current.get(clave);
        if (item) void mover(item, fechaAlSoltar(info.date, info.allDay, new Date(item.fecha)), item.fecha);
        return;
      }
      const lead = leadId ? porLead.current.get(leadId) : undefined;
      if (!lead) return;
      const pendiente: Movible = {
        tipo: "seguimiento",
        id: lead.id,
        cliente_id: lead.user_id,
        titulo: lead.seguimiento_nota ?? `Seguimiento a ${nombreLead(lead)}`,
      };
      // Sin fecha anterior: "Deshacer" lo vuelve a dejar sin agendar.
      void mover(pendiente, fechaAlSoltar(info.date, info.allDay, null), null);
    },
    [mover],
  );

  // El carril es una sola zona de arrastre para todas sus tarjetas
  // (itemSelector): se arma una vez y las tarjetas nuevas quedan cubiertas.
  useEffect(() => {
    const el = carrilRef.current;
    if (!el) return;
    const d = new Draggable(el, {
      itemSelector: "[data-arrastrable]",
      eventData: (tarjeta) => ({
        title: tarjeta.dataset.titulo ?? "",
        duration: "00:30",
        // FullCalendar no la agrega por su cuenta: la agrega el refetch
        // después de guardar, con los datos del backend.
        create: false,
      }),
    });
    return () => d.destroy();
  }, []);

  const hayModulos = disponibles === null || disponibles.tareas || disponibles.seguimientos;

  const contenidoEvento = (arg: EventContentArg) => {
    const item = arg.event.extendedProps.item as AgendaItemOut;
    const enMes = arg.view.type === "dayGridMonth";
    const enLista = arg.view.type.startsWith("list");
    const detalle = [item.cliente_nombre, esNegocio ? item.vendedor_nombre : null].filter(Boolean).join(" · ");
    return (
      <div className={cn("flex min-w-0 overflow-hidden leading-tight", enLista ? "items-baseline gap-2" : "flex-col")}>
        <span className="flex min-w-0 items-baseline gap-1">
          {!enLista && arg.timeText && (
            <span className="shrink-0 font-mono text-[10px] text-text-600">{arg.timeText}</span>
          )}
          <span className="agenda-ev__titulo truncate text-[11px] font-medium">{item.titulo}</span>
        </span>
        {!enMes && detalle && <span className="truncate text-[11px] text-text-400">{detalle}</span>}
      </div>
    );
  };

  const cambiarVista = (v: Vista) => {
    setVista(v);
    api()?.changeView(v);
  };

  const conmutar = (clave: keyof FiltrosAgenda) => setFiltros((f) => ({ ...f, [clave]: !f[clave] }));

  return (
    <div className="flex flex-col gap-3">
      {errorCarga && <Aviso tipo="error">{errorCarga}</Aviso>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem] 2xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section
          data-tour="agenda.calendario"
          className="flex min-w-0 flex-col overflow-hidden rounded-md border border-bg-700 bg-bg-900"
        >
          {/* Navegación y vista */}
          <div className="flex flex-wrap items-center gap-2 border-b border-bg-700 px-3 py-2">
            <div className="flex items-center gap-1">
              <Boton variante="secundario" onClick={() => api()?.today()} className="min-h-8">
                Hoy
              </Boton>
              <Boton variante="fantasma" onClick={() => api()?.prev()} aria-label="Anterior" className="min-h-8 px-2">
                <ChevronLeft size={15} aria-hidden />
              </Boton>
              <Boton variante="fantasma" onClick={() => api()?.next()} aria-label="Siguiente" className="min-h-8 px-2">
                <ChevronRight size={15} aria-hidden />
              </Boton>
            </div>
            <h2 className="mr-auto min-w-0 truncate text-sm font-semibold text-text-100 first-letter:uppercase" aria-live="polite">
              {titulo}
            </h2>
            <div role="tablist" aria-label="Vista" className="flex rounded-md border border-bg-700 p-0.5">
              {VISTAS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={vista === v.id}
                  onClick={() => cambiarVista(v.id)}
                  className={cn(
                    "cursor-pointer rounded px-2.5 py-1 text-xs",
                    vista === v.id ? "bg-bg-800 text-text-100" : "text-text-400 hover:text-text-100",
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Qué se ve */}
          <div className="flex flex-wrap items-center gap-2 border-b border-bg-700 px-3 py-2">
            {(["tarea", "seguimiento"] as const)
              .filter((t) => disponibles === null || (t === "tarea" ? disponibles.tareas : disponibles.seguimientos))
              .map((t) => (
                <FiltroTipo
                  key={t}
                  tipo={t}
                  activo={t === "tarea" ? filtros.tareas : filtros.seguimientos}
                  onClick={() => conmutar(t === "tarea" ? "tareas" : "seguimientos")}
                />
              ))}
            <button
              type="button"
              aria-pressed={filtros.completadas}
              onClick={() => conmutar("completadas")}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 text-xs",
                filtros.completadas
                  ? "border-bg-600 bg-bg-800 text-text-100"
                  : "border-bg-700 text-text-400 hover:bg-hover",
              )}
            >
              Ver completadas
            </button>

            {esNegocio && (vendedores.data?.length ?? 0) > 0 && (
              <select
                value={vendedorFiltro}
                onChange={(e) => setVendedorFiltro(e.target.value)}
                aria-label="Filtrar por vendedor"
                className={cn(selectClass, "w-auto py-1 text-xs")}
              >
                <option value="">Todo el equipo</option>
                {(vendedores.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            )}

            <span className="ml-auto flex items-center gap-1">
              <Boton
                variante="fantasma"
                onClick={recargarTodo}
                loading={cargando}
                aria-label="Actualizar"
                className="min-h-8 px-2"
              >
                {!cargando && <RefreshCw size={13} aria-hidden />}
              </Boton>
              {hayModulos && (
                <Boton variante="primario" onClick={() => setNuevo(fechaAlSoltar(new Date(), true, null))} className="min-h-8">
                  <Plus size={13} aria-hidden />
                  Agendar
                </Boton>
              )}
            </span>
          </div>

          {hayModulos ? (
            <div className="agenda-fc p-2">
              <FullCalendar
                ref={calRef}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                locale={esLocale}
                initialView={vista}
                initialDate={fechaInicial ?? undefined}
                headerToolbar={false}
                firstDay={1}
                // Mes, semana y día llenan el alto de la pantalla (con un piso
                // para que la grilla no se aplaste); la lista crece con su contenido.
                height={vista === "listWeek" ? "auto" : "max(560px, calc(100dvh - 13rem))"}
                fixedWeekCount={false}
                dayMaxEvents={4}
                allDaySlot={false}
                nowIndicator
                scrollTime="08:00:00"
                slotDuration="00:30:00"
                defaultTimedEventDuration="00:30"
                eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                eventDisplay="block"
                events={cargarEventos}
                eventContent={contenidoEvento}
                eventInteractive
                editable
                eventDurationEditable={false}
                droppable
                longPressDelay={350}
                eventClick={(info: EventClickArg) => {
                  info.jsEvent.preventDefault();
                  setSeleccionado(info.event.extendedProps.item as AgendaItemOut);
                }}
                eventDrop={alSoltarEvento}
                drop={alSoltarDelCarril}
                dateClick={(info: DateClickArg) => setNuevo(fechaAlSoltar(info.date, info.allDay, null))}
                datesSet={(arg: DatesSetArg) => {
                  setTitulo(arg.view.title);
                  setInicioVisible(arg.view.activeStart);
                }}
                noEventsContent="Nada agendado en estos días."
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <CalendarX2 size={20} className="text-text-600" aria-hidden />
              <p className="max-w-sm text-xs leading-relaxed text-text-400">
                La agenda junta las tareas de la cartera de campo y los seguimientos de los leads del
                chat. Ninguno de los dos está activo para este negocio.
              </p>
            </div>
          )}
        </section>

        <aside
          ref={carrilRef}
          data-tour="agenda.por-agendar"
          aria-label="Por agendar"
          className="flex min-w-0 flex-col gap-3 self-start rounded-md border border-bg-700 bg-bg-900 p-3"
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium text-text-100">Por agendar</h2>
            <p className="text-xs leading-relaxed text-text-400">
              Arrastra una tarjeta a un día para darle fecha. En el teléfono, mantenla presionada.
            </p>
          </div>

          <CarrilSeccion
            titulo="Atrasados"
            cantidad={atrasados.length}
            cargando={!atrasadosApi.data && !atrasadosApi.error}
            vacio="Nada vencido fuera de esta vista."
          >
            {atrasados.map((i) => (
              <li key={claveItem(i)}>
                <TarjetaCarril
                  datos={{ "data-clave": claveItem(i) }}
                  titulo={i.titulo}
                  tipo={i.tipo}
                  detalle={`venció ${tiempoRelativo(i.fecha)}`}
                  subdetalle={[i.cliente_nombre, esNegocio ? i.vendedor_nombre : null].filter(Boolean).join(" · ")}
                  urgente
                  onAbrir={() => setSeleccionado(i)}
                />
              </li>
            ))}
          </CarrilSeccion>

          {disponibles?.seguimientos && filtros.seguimientos && (
            <CarrilSeccion
              titulo="Leads sin seguimiento"
              cantidad={sinSeguimiento.length}
              cargando={!leads.data && !leads.error}
              vacio="Todos los leads abiertos tienen su próximo paso agendado."
            >
              {sinSeguimiento.map((l) => {
                const etapa = infoEstadoPipeline(l.estado);
                return (
                  <li key={l.user_id}>
                    <TarjetaCarril
                      datos={{ "data-lead": l.user_id }}
                      titulo={nombreLead(l)}
                      tipo="seguimiento"
                      detalle={
                        <Badge tone={etapa.tone} className="text-[10px]">
                          {etapa.label.toLowerCase()}
                        </Badge>
                      }
                      subdetalle={esNegocio ? (l.vendedor_nombre ?? "sin vendedor") : null}
                    />
                  </li>
                );
              })}
            </CarrilSeccion>
          )}
        </aside>
      </div>

      {seleccionado && (
        <AgendaDetalle
          key={claveItem(seleccionado)}
          item={seleccionado}
          vendedores={vendedores.data ?? []}
          puedeReasignar={esNegocio && puedeReasignar}
          onClose={() => setSeleccionado(null)}
          onCambio={(mensaje) => {
            setSeleccionado(null);
            toast.success(mensaje);
            recargarTodo();
          }}
        />
      )}

      {nuevo && disponibles && (
        <AgendaNuevo
          fecha={nuevo}
          tareasDisponibles={disponibles.tareas}
          seguimientosDisponibles={disponibles.seguimientos}
          esVendedor={!esNegocio}
          vendedores={vendedores.data ?? []}
          leads={leadsAbiertos}
          onClose={() => setNuevo(null)}
          onCreado={(mensaje) => {
            setNuevo(null);
            toast.success(mensaje);
            recargarTodo();
          }}
        />
      )}
    </div>
  );
}

function FiltroTipo({ tipo, activo, onClick }: { tipo: TipoPendiente; activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs",
        activo ? "border-bg-600 bg-bg-800 text-text-100" : "border-bg-700 text-text-600 hover:bg-hover",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-3 w-1 rounded-full",
          tipo === "tarea" ? "bg-series-1" : "bg-series-2",
          !activo && "opacity-40",
        )}
      />
      {TIPO_INFO[tipo].plural}
    </button>
  );
}

function CarrilSeccion({
  titulo,
  cantidad,
  cargando,
  vacio,
  children,
}: {
  titulo: string;
  cantidad: number;
  cargando: boolean;
  vacio: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-baseline justify-between text-xs text-text-400">
        {titulo}
        {!cargando && <span className="font-mono text-[11px] text-text-600">{cantidad}</span>}
      </h3>
      {cargando ? (
        <p className="font-mono text-[11px] text-text-600">cargando…</p>
      ) : cantidad === 0 ? (
        <p className="rounded-md border border-dashed border-bg-700 px-2.5 py-3 text-[11px] leading-relaxed text-text-600">
          {vacio}
        </p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-0.5">{children}</ul>
      )}
    </section>
  );
}

function TarjetaCarril({
  datos,
  titulo,
  tipo,
  detalle,
  subdetalle,
  urgente = false,
  onAbrir,
}: {
  datos: Record<`data-${string}`, string>;
  titulo: string;
  tipo: TipoPendiente;
  detalle: React.ReactNode;
  subdetalle: string | null;
  urgente?: boolean;
  onAbrir?: () => void;
}) {
  return (
    <div
      {...datos}
      data-arrastrable
      data-titulo={titulo}
      role={onAbrir ? "button" : undefined}
      tabIndex={onAbrir ? 0 : undefined}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (onAbrir && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onAbrir();
        }
      }}
      className={cn(
        "group flex cursor-grab items-start gap-1.5 rounded border border-l-[3px] border-bg-700 bg-bg-800 px-2 py-1.5 select-none hover:bg-hover active:cursor-grabbing",
        tipo === "tarea" ? "border-l-series-1" : "border-l-series-2",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("truncate text-xs font-medium", urgente ? "text-danger" : "text-text-100")}>
          {titulo}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-text-400">{detalle}</span>
        {subdetalle && <span className="truncate text-[11px] text-text-600">{subdetalle}</span>}
      </div>
      <GripVertical size={13} className="mt-0.5 shrink-0 text-text-600 group-hover:text-text-400" aria-hidden />
    </div>
  );
}
