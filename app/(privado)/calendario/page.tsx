"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { fmtInt, ventanasDelDia } from "@/lib/formato";
import { esProveedor } from "@/lib/roles";
import type {
  DescansoOut,
  ExcepcionOut,
  HorarioSemanalOut,
  ProveedorOut,
  ReservaOut,
  ServicioOut,
} from "@/lib/types";
import { CalendarioGrid } from "@/app/components/calendario-grid";
import { useDatosEnVivo } from "@/lib/use-websocket-alertas";
import { CalendarioTabs, ModuloCalendarioApagado } from "@/app/components/modulo-calendario";
import { esGerencia, useServicios } from "@/app/components/modulo-vendedores";
import { ProveedorHorarioModal } from "@/app/components/proveedor-horario-modal";
import { ReservaDetalle } from "@/app/components/reserva-detalle";
import { ReservaForm, type ModoReservaForm } from "@/app/components/reserva-form";
import { StatCard } from "@/app/components/stat-card";
import { Aviso, Boton, Cargando, PageHeader, inputClass } from "@/app/components/ui";
import { useUsuario } from "@/app/components/usuario-context";

function fechaLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return fechaLocal(d);
}

/** "2026-01-05" -> "lunes 5 de enero" */
function fechaLegible(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Ventanas de atención de cada proveedor visible, para la fecha elegida —
 * lo que la grilla usa para deshabilitar las franjas fuera de horario
 * (historia de usuario del proveedor). `useApi` no sirve acá porque son N
 * proveedores con N pares de llamadas (horarios + excepción del día), así
 * que se resuelve a mano con un solo efecto y Promise.all.
 */
function useVentanasPorProveedor(
  base: string | null,
  proveedorIds: string[],
  fecha: string,
): Record<string, Array<[number, number]>> {
  const [datos, setDatos] = useState<Record<string, Array<[number, number]>>>({});
  const clave = proveedorIds.join(",");
  const sinProveedores = !base || proveedorIds.length === 0;

  useEffect(() => {
    if (sinProveedores || !base) return;
    let cancelado = false;

    Promise.all(
      proveedorIds.map(async (id) => {
        const [horarios, excepciones, descansos] = await Promise.all([
          apiFetch<HorarioSemanalOut[]>(`${base}/proveedores/${id}/horarios`).catch(() => []),
          apiFetch<ExcepcionOut[]>(
            `${base}/proveedores/${id}/excepciones?desde=${fecha}&hasta=${fecha}`,
          ).catch(() => [] as ExcepcionOut[]),
          apiFetch<DescansoOut[]>(`${base}/proveedores/${id}/descansos`).catch(() => [] as DescansoOut[]),
        ]);
        return [id, ventanasDelDia(fecha, horarios, excepciones[0], descansos)] as const;
      }),
    ).then((pares) => {
      if (!cancelado) setDatos(Object.fromEntries(pares));
    });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, clave, fecha]);

  // Sin proveedores no hay ventanas: se deriva en vez de vaciar el estado
  // desde el efecto (un setState síncrono ahí provoca un render en cascada).
  return sinProveedores ? SIN_VENTANAS : datos;
}

const SIN_VENTANAS: Record<string, Array<[number, number]>> = {};

export default function CalendarioPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader titulo="Calendario" sub={<CalendarioTabs />} />
          <Cargando />
        </>
      }
    >
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const { usuario } = useUsuario();
  const servicios = useServicios();
  const gerencia = esGerencia(usuario);
  // El proveedor con cuenta ve solo su columna (el backend ya le filtra
  // proveedores y reservas) y maneja su disponibilidad desde acá.
  const proveedor = esProveedor(usuario);
  const router = useRouter();
  const searchParams = useSearchParams();

  const activo = servicios.data?.calendario_activo ?? false;
  const base = activo && servicios.tenantId ? `/api/tenants/${servicios.tenantId}/calendario` : null;

  // `?fecha=&reserva=` llega del clic en una notificación de "nueva reserva"
  // (ver lib/use-websocket-alertas.ts::rutaParaAlerta) -- solo se lee al
  // montar: una vez capturada en el estado local, la URL puede limpiarse
  // sin que la fecha elegida se pierda.
  const [fecha, setFecha] = useState(() => searchParams.get("fecha") || fechaLocal(new Date()));
  const reservaBuscadaId = searchParams.get("reserva");
  const desdeIso = `${fecha}T00:00:00`;
  const hastaIso = `${fecha}T23:59:59`;
  const desdeUtc = new Date(desdeIso).toISOString();
  const hastaUtc = new Date(hastaIso).toISOString();

  const proveedores = useApi<ProveedorOut[]>(
    base ? `${base}/proveedores?activo=true` : null,
    { refrescarCada: 60_000, alVolverAlFoco: true },
  );
  const catalogo = useApi<ServicioOut[]>(base ? `${base}/servicios?activo=true` : null);
  const reservas = useApi<ReservaOut[]>(
    base ? `${base}/reservas?desde=${desdeUtc}&hasta=${hastaUtc}` : null,
    { refrescarCada: 60_000, alVolverAlFoco: true },
  );
  const ventanasPorProveedor = useVentanasPorProveedor(
    base,
    (proveedores.data ?? []).map((p) => p.id),
    fecha,
  );

  const [aviso, setAviso] = useState<string | null>(null);
  const [modoForm, setModoForm] = useState<ModoReservaForm | null>(null);
  const [reservaVista, setReservaVista] = useState<ReservaOut | null>(null);
  const [disponibilidadAbierta, setDisponibilidadAbierta] = useState(false);
  const yo = proveedor ? (proveedores.data?.[0] ?? null) : null;

  // Un aviso de reserva creada/cancelada (n8n o el propio portal en otra
  // pestaña) refresca la grilla sin que el usuario tenga que hacerlo a
  // mano. Reusa el socket que ya mantiene AlertasProvider, no abre uno
  // nuevo (ver use-websocket-alertas.ts).
  const recargarReservas = reservas.recargar;
  const recargarProveedores = proveedores.recargar;
  useDatosEnVivo(["reservas"], () => {
    void recargarReservas(true);
    void recargarProveedores(true);
  });

  // Centra el calendario en la cita de la notificación en cuanto la grilla
  // del día ya cargó (escenario 3 de la historia de notificaciones).
  useEffect(() => {
    if (!reservaBuscadaId || !reservas.data) return;
    const buscada = reservas.data.find((r) => r.id === reservaBuscadaId);
    if (buscada) {
      // Sincroniza el estado con el parámetro de la URL (sistema externo) una
      // sola vez: enseguida se limpia la URL y `reservaBuscadaId` pasa a null.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReservaVista(buscada);
      router.replace("/calendario", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaBuscadaId, reservas.data]);

  const cargandoInicial = servicios.loading && !servicios.data;
  const listaReservas = reservas.data ?? [];
  const activas = listaReservas.filter((r) => r.estado !== "cancelada");
  const confirmadas = listaReservas.filter((r) => r.estado === "confirmada");

  const abrirCrear = (proveedorId: string, horas: number, minutos: number) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    setModoForm({
      tipo: "crear",
      proveedorId,
      horaInicioLocal: `${fecha}T${pad(horas)}:${pad(minutos)}`,
    });
  };

  const alGuardar = (mensaje: string) => {
    setAviso(mensaje);
    reservas.recargar(true);
  };

  return (
    <>
      <PageHeader
        titulo="Calendario"
        sub={<CalendarioTabs />}
        acciones={
          activo &&
          (proveedor ? (
            <span data-tour="calendario.disponibilidad">
              <Boton variante="secundario" onClick={() => setDisponibilidadAbierta(true)} disabled={!yo}>
                <CalendarClock size={13} aria-hidden />
                Mi disponibilidad
              </Boton>
            </span>
          ) : (
            gerencia && (
              <span data-tour="calendario.nueva">
                <Boton
                  variante="primario"
                  onClick={() =>
                    proveedores.data?.[0] &&
                    setModoForm({
                      tipo: "crear",
                      proveedorId: proveedores.data[0].id,
                      horaInicioLocal: `${fecha}T09:00`,
                    })
                  }
                  disabled={!proveedores.data?.length}
                  title={
                    !proveedores.data?.length
                      ? "Agrega un proveedor primero"
                      : "Crear una reserva manual"
                  }
                >
                  <Plus size={13} aria-hidden />
                  Nueva reserva
                </Boton>
              </span>
            )
          ))
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          {servicios.error && <Aviso tipo="error">{servicios.error}</Aviso>}

          {cargandoInicial ? (
            <Cargando />
          ) : !activo ? (
            servicios.tenantId && (
              <ModuloCalendarioApagado
                tenantId={servicios.tenantId}
                onActivado={() => servicios.recargar()}
              />
            )
          ) : (
            <>
              {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
              {proveedores.error && <Aviso tipo="error">{proveedores.error}</Aviso>}
              {reservas.error && <Aviso tipo="error">{reservas.error}</Aviso>}

              <div data-tour="calendario.metricas" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Reservas del día"
                  value={reservas.data ? fmtInt.format(activas.length) : "—"}
                  loading={reservas.loading && !reservas.data}
                  hint="sin contar canceladas"
                />
                <StatCard
                  label="Confirmadas"
                  value={reservas.data ? fmtInt.format(confirmadas.length) : "—"}
                  tone={confirmadas.length > 0 ? "success" : "neutral"}
                  loading={reservas.loading && !reservas.data}
                  hint="pendientes de atender"
                />
                {!proveedor && (
                  <StatCard
                    label="Proveedores activos"
                    value={proveedores.data ? fmtInt.format(proveedores.data.length) : "—"}
                    loading={proveedores.loading && !proveedores.data}
                  />
                )}
                <StatCard
                  label="Servicios activos"
                  value={catalogo.data ? fmtInt.format(catalogo.data.length) : "—"}
                  loading={catalogo.loading && !catalogo.data}
                />
              </div>

              <div data-tour="calendario.fecha" className="flex flex-wrap items-center gap-2 rounded-md border border-bg-700 bg-bg-900 px-3 py-2">
                <Boton
                  variante="fantasma"
                  onClick={() => setFecha((f) => sumarDias(f, -1))}
                  aria-label="Día anterior"
                >
                  <ChevronLeft size={14} aria-hidden />
                </Boton>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => e.target.value && setFecha(e.target.value)}
                  className={`${inputClass} w-40 py-1.5 text-xs`}
                  aria-label="Elegir fecha"
                />
                <Boton
                  variante="fantasma"
                  onClick={() => setFecha((f) => sumarDias(f, 1))}
                  aria-label="Día siguiente"
                >
                  <ChevronRight size={14} aria-hidden />
                </Boton>
                <Boton variante="fantasma" onClick={() => setFecha(fechaLocal(new Date()))}>
                  Hoy
                </Boton>
                <span className="ml-1 font-mono text-[11px] text-text-600 capitalize">
                  {fechaLegible(fecha)}
                </span>
              </div>

              <CalendarioGrid
                proveedores={proveedores.data ?? []}
                reservas={listaReservas}
                ventanasPorProveedor={ventanasPorProveedor}
                onSlotClick={gerencia ? abrirCrear : undefined}
                onReservaClick={setReservaVista}
              />
            </>
          )}
        </div>
      </div>

      {base && servicios.tenantId && modoForm && (
        <ReservaForm
          open={modoForm !== null}
          onOpenChange={(o) => !o && setModoForm(null)}
          tenantId={servicios.tenantId}
          proveedores={proveedores.data ?? []}
          servicios={catalogo.data ?? []}
          modo={modoForm}
          onGuardado={alGuardar}
        />
      )}

      {servicios.tenantId && (
        <ReservaDetalle
          open={reservaVista !== null}
          onOpenChange={(o) => !o && setReservaVista(null)}
          reserva={reservaVista}
          tenantId={servicios.tenantId}
          proveedores={proveedores.data ?? []}
          servicios={catalogo.data ?? []}
          onReprogramar={(r) => {
            setReservaVista(null);
            setModoForm({ tipo: "reprogramar", reserva: r });
          }}
          onCambiado={alGuardar}
          acciones={gerencia ? "todas" : proveedor ? "propias" : "ninguna"}
        />
      )}

      {servicios.tenantId && proveedor && (
        <ProveedorHorarioModal
          open={disponibilidadAbierta}
          onOpenChange={setDisponibilidadAbierta}
          tenantId={servicios.tenantId}
          proveedor={yo}
          soloDisponibilidad
        />
      )}
    </>
  );
}
