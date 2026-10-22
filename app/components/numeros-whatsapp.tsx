"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Star, X } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import {
  accionesDeNumero,
  esUltimoActivo,
  mensajeErrorNumero,
  nombreNumero,
  textoPlazas,
} from "@/lib/numeros";
import { formatoFechaHora } from "@/lib/formato";
import type {
  IniciarNeuroApiConnectIn,
  IniciarNeuroApiConnectOut,
  ListaNumeros,
  ModoConexionWhatsApp,
  NumeroWhatsApp,
  PausarNumeroOut,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { ModoConexionDialog } from "./modo-conexion-whatsapp";
import { CanalIcon } from "./status";
import { Aviso, Boton, Campo, ConfirmDialog, inputClass } from "./ui";

const INTERVALO_RETORNO_MS = 3_000;
const ESPERA_RETORNO_MS = 90_000;

// ------------------------------------------------------------
// Lista (presentacional: sin red, para probarla con datos)
// ------------------------------------------------------------
export interface ListaDeNumerosProps {
  lista: ListaNumeros;
  /** member (RF-18): ve la lista y no puede cambiar nada. */
  soloLectura?: boolean;
  /** Id del número con una acción en curso. */
  ocupado?: string | null;
  onPausar?: (n: NumeroWhatsApp) => void;
  onReactivar?: (n: NumeroWhatsApp) => void;
  onDesvincular?: (n: NumeroWhatsApp) => void;
  onPrincipal?: (n: NumeroWhatsApp) => void;
  onAvisos?: (n: NumeroWhatsApp) => void;
}

/**
 * Números de WhatsApp vinculados al negocio (spec 005a, RF-1 de pantalla):
 * estado, principal, línea de avisos, plazas usadas y libres, y las acciones
 * que cada rol puede hacer. La línea de avisos de la plataforma se gestiona como
 * cualquier otra (editar, probar, pausar, desvincular), salvo que no puede ser la
 * principal ni cuenta para el cupo.
 */
export function ListaDeNumeros({
  lista,
  soloLectura = false,
  ocupado = null,
  onPausar,
  onReactivar,
  onDesvincular,
  onPrincipal,
  onAvisos,
}: ListaDeNumerosProps) {
  return (
    <div className="flex flex-col">
      <p
        data-testid="plazas"
        className="border-b border-bg-700 bg-bg-800 px-4 py-2 font-mono text-[11px] text-text-400"
      >
        {textoPlazas(lista)}
      </p>

      {lista.numeros.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-text-400">
          Todavía no hay ningún número de WhatsApp vinculado.
        </p>
      ) : (
        <ul>
          {lista.numeros.map((n, i) => {
            const acciones = accionesDeNumero(n, soloLectura, lista.puede_elegir_avisos);
            const trabajando = ocupado === n.id;
            return (
              <li
                key={n.id}
                className={cn(
                  "flex flex-wrap items-start gap-3 px-4 py-3",
                  i > 0 && "border-t border-bg-700",
                  n.estado === "pausado" && "opacity-70",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                    n.estado === "activo"
                      ? "border-success/40 bg-success-bg text-success"
                      : "border-bg-700 bg-bg-800 text-text-400",
                  )}
                >
                  <CanalIcon tipo="whatsapp" size={16} />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-text-100">{nombreNumero(n)}</span>
                    {n.estado === "activo" ? (
                      <Badge tone="success">activo</Badge>
                    ) : (
                      <Badge tone="warning">pausado</Badge>
                    )}
                    {n.es_principal && (
                      <Badge tone="info">
                        <Star size={10} aria-hidden /> principal
                      </Badge>
                    )}
                    {n.connection_mode === "coexistence" && <Badge tone="info">coexistencia</Badge>}
                    {n.es_linea_avisos && <Badge tone="info">línea de avisos de plataforma</Badge>}
                    {n.configuracion_incompleta && <Badge tone="warning">configuración incompleta</Badge>}
                    {!n.agente_activo && <Badge>agente apagado</Badge>}
                  </div>

                  <span className="font-mono text-[11px] break-all text-text-600">
                    id {n.phone_number_id}
                    {n.agent_name && <> · agente {n.agent_name}</>}
                    {n.vinculado_en && <> · vinculado {formatoFechaHora(n.vinculado_en)}</>}
                  </span>

                  {n.es_linea_avisos && (
                    <span className="text-xs text-text-400">
                      Línea de avisos de la plataforma: no cuenta para el cupo ni puede ser la principal. Puedes cambiarla a otro de tus números.
                    </span>
                  )}
                  {n.configuracion_incompleta && (
                    <span className="text-xs text-warning">
                      No responde hasta que le pongas nombre al agente e instrucciones.
                    </span>
                  )}
                </div>

                <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:justify-start">
                  {acciones.editar && (
                    <Link
                      href={`/agente?numero=${encodeURIComponent(n.id)}`}
                      aria-label={`Configurar el agente de ${nombreNumero(n)}`}
                      className="inline-flex min-h-8 cursor-pointer items-center justify-center gap-2 rounded-md px-2 text-xs font-medium text-text-400 transition-opacity hover:bg-hover hover:text-text-100"
                    >
                      <Pencil size={13} aria-hidden />
                      Configurar
                    </Link>
                  )}
                  {acciones.elegirPrincipal && (
                    <Boton variante="fantasma" onClick={() => onPrincipal?.(n)} disabled={trabajando}>
                      Hacer principal
                    </Boton>
                  )}
                  {acciones.elegirAvisos && (
                    <Boton variante="fantasma" onClick={() => onAvisos?.(n)} disabled={trabajando}>
                      Usar para avisos
                    </Boton>
                  )}
                  {acciones.pausar && (
                    <Boton variante="secundario" onClick={() => onPausar?.(n)} loading={trabajando}>
                      Pausar
                    </Boton>
                  )}
                  {acciones.reactivar && (
                    <Boton variante="secundario" onClick={() => onReactivar?.(n)} loading={trabajando}>
                      Reactivar
                    </Boton>
                  )}
                  {acciones.desvincular && (
                    <Boton
                      variante="fantasma"
                      onClick={() => onDesvincular?.(n)}
                      disabled={trabajando}
                      className="hover:text-danger"
                    >
                      Desvincular
                    </Boton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Sección completa (red + diálogos + alta)
// ------------------------------------------------------------
export function NumerosWhatsApp({ soloLectura = false }: { soloLectura?: boolean }) {
  const params = useSearchParams();
  const numeros = useApi<ListaNumeros>("/api/canales/whatsapp/numeros");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aPausar, setAPausar] = useState<NumeroWhatsApp | null>(null);
  const [aDesvincular, setADesvincular] = useState<NumeroWhatsApp | null>(null);
  const [formManual, setFormManual] = useState(false);
  const [linea, setLinea] = useState("");
  const [conectandoManual, setConectandoManual] = useState(false);
  const [conectandoNeuroApi, setConectandoNeuroApi] = useState(false);
  const [elegirModo, setElegirModo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const lista = numeros.data;
  const recargar = numeros.recargar;

  // Retorno de la NeuroAPI Connect Session: llegar acá no significa que ya
  // esté vinculado (lo decide el webhook, y suele llegar DESPUÉS que el
  // navegador). Se consulta la lista hasta ver un número nuevo o agotar la espera.
  const retorno = params.get("whatsapp_neuroapi") === "retorno";
  const [base, setBase] = useState<number | null>(null);
  const [esperaAgotada, setEsperaAgotada] = useState(false);
  const total = lista?.numeros.length ?? null;
  useEffect(() => {
    if (total !== null && base === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se fija una sola vez, al primer dato, como punto de comparación.
      setBase(total);
    }
  }, [total, base]);
  const llegoNumeroNuevo = base !== null && total !== null && total > base;
  useEffect(() => {
    if (!retorno || llegoNumeroNuevo) return;
    const intervalo = setInterval(() => void recargar(true), INTERVALO_RETORNO_MS);
    const limite = setTimeout(() => {
      clearInterval(intervalo);
      setEsperaAgotada(true);
    }, ESPERA_RETORNO_MS);
    return () => {
      clearInterval(intervalo);
      clearTimeout(limite);
    };
  }, [retorno, llegoNumeroNuevo, recargar]);

  const reiniciarMensajes = () => {
    setError(null);
    setAviso(null);
  };

  const ejecutar = async (id: string, accion: () => Promise<string>, respaldo: string) => {
    reiniciarMensajes();
    setOcupado(id);
    try {
      setAviso(await accion());
      await recargar(true);
    } catch (e) {
      setError(mensajeErrorNumero(e, respaldo));
    } finally {
      setOcupado(null);
    }
  };

  const reactivar = (n: NumeroWhatsApp) =>
    ejecutar(
      n.id,
      async () => {
        await apiFetch<NumeroWhatsApp>(`/api/canales/whatsapp/numeros/${n.id}/reactivar`, { method: "POST" });
        return `${nombreNumero(n)} reactivado.`;
      },
      "No se pudo reactivar el número.",
    );

  const usarParaAvisos = (n: NumeroWhatsApp) =>
    ejecutar(
      n.id,
      async () => {
        await apiFetch<NumeroWhatsApp>("/api/canales/whatsapp/avisos", {
          method: "PUT",
          json: { numero_id: n.id },
        });
        return `${nombreNumero(n)} es ahora la línea de avisos de la plataforma.`;
      },
      "No se pudo cambiar la línea de avisos.",
    );

  const hacerPrincipal = (n: NumeroWhatsApp) =>
    ejecutar(
      n.id,
      async () => {
        await apiFetch<NumeroWhatsApp>("/api/canales/whatsapp/principal", {
          method: "PUT",
          json: { numero_id: n.id },
        });
        return `${nombreNumero(n)} es ahora el número principal.`;
      },
      "No se pudo cambiar el número principal.",
    );

  const confirmarPausa = async () => {
    if (!aPausar) return;
    const n = aPausar;
    setConfirmando(true);
    await ejecutar(
      n.id,
      async () => {
        const r = await apiFetch<PausarNumeroOut>(`/api/canales/whatsapp/numeros/${n.id}/pausar`, {
          method: "POST",
        });
        return r.sin_numero_activo
          ? `${nombreNumero(n)} pausado. Tu negocio no responderá por WhatsApp mientras no tenga un número activo.`
          : `${nombreNumero(n)} pausado. Libera una plaza de tu plan.`;
      },
      "No se pudo pausar el número.",
    );
    setConfirmando(false);
    setAPausar(null);
  };

  const confirmarDesvinculacion = async () => {
    if (!aDesvincular) return;
    const n = aDesvincular;
    setConfirmando(true);
    await ejecutar(
      n.id,
      async () => {
        await apiFetch(`/api/canales/whatsapp/numeros/${n.id}`, { method: "DELETE" });
        return `${nombreNumero(n)} desvinculado. Sus conversaciones quedan ocultas, en solo lectura.`;
      },
      "No se pudo desvincular el número.",
    );
    setConfirmando(false);
    setADesvincular(null);
  };

  const conectarManual = async () => {
    const id = linea.trim();
    if (!id) return;
    reiniciarMensajes();
    setConectandoManual(true);
    try {
      await apiFetch<NumeroWhatsApp>("/api/canales/whatsapp/conectar", {
        method: "POST",
        json: { phone_number_id: id },
      });
      setAviso("Número vinculado. Configura su agente para que empiece a responder.");
      setFormManual(false);
      setLinea("");
      await recargar(true);
    } catch (e) {
      setError(mensajeErrorNumero(e, "No se pudo vincular el número."));
    } finally {
      setConectandoManual(false);
    }
  };

  const iniciarNeuroApi = async (modo: ModoConexionWhatsApp) => {
    reiniciarMensajes();
    setConectandoNeuroApi(true);
    try {
      const cuerpo: IniciarNeuroApiConnectIn = { connection_mode: modo };
      const datos = await apiFetch<IniciarNeuroApiConnectOut>("/api/canales/whatsapp/neuroapi/iniciar", {
        method: "POST",
        json: cuerpo,
      });
      // .assign() y no `.href`: la regla react-hooks/immutability de
      // eslint-config-next 16 prohíbe asignarle a window.location.
      window.location.assign(datos.connect_url);
    } catch (e) {
      setError(mensajeErrorNumero(e, "No se pudo iniciar la vinculación con WhatsApp."));
      setConectandoNeuroApi(false);
      setElegirModo(false);
    }
  };

  return (
    <section data-tour="canales.lista" className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-sm font-medium text-text-100">Números de WhatsApp</h2>
          <span className="font-mono text-[11px] text-text-600">
            cada número tiene su propio agente y sus propias herramientas
          </span>
        </div>
        {!soloLectura && (
          <div className="flex flex-wrap items-center gap-2">
            <Boton
              variante="primario"
              onClick={() => {
                reiniciarMensajes();
                setElegirModo(true);
              }}
              loading={conectandoNeuroApi}
              disabled={formManual}
            >
              <CanalIcon tipo="whatsapp" size={13} />
              Conectar WhatsApp
            </Boton>
            <Boton
              variante="fantasma"
              onClick={() => {
                reiniciarMensajes();
                setFormManual(true);
              }}
              disabled={formManual || conectandoNeuroApi}
            >
              Conectar manualmente
            </Boton>
          </div>
        )}
      </header>

      {numeros.error && <Aviso tipo="error">{numeros.error}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
      {retorno && !llegoNumeroNuevo && !esperaAgotada && (
        <Aviso tipo="info">Estamos terminando de vincular tu WhatsApp. Esto puede tardar unos segundos.</Aviso>
      )}
      {retorno && !llegoNumeroNuevo && esperaAgotada && (
        <Aviso tipo="error">
          No recibimos la confirmación de WhatsApp. Puede que el número no se haya vinculado (por ejemplo, por
          cupo lleno o porque ya está en uso). Recarga la lista o vuelve a intentarlo.
        </Aviso>
      )}

      <div className="overflow-hidden rounded-md border border-bg-700 bg-bg-900">
        {lista ? (
          <ListaDeNumeros
            lista={lista}
            soloLectura={soloLectura}
            ocupado={ocupado}
            onPausar={setAPausar}
            onReactivar={reactivar}
            onDesvincular={setADesvincular}
            onPrincipal={hacerPrincipal}
            onAvisos={usarParaAvisos}
          />
        ) : (
          <p className="px-4 py-6 text-center font-mono text-xs text-text-600">
            {numeros.loading ? "cargando…" : "sin datos"}
          </p>
        )}
      </div>

      {formManual && !soloLectura && (
        <div className="rounded-md border border-bg-700 bg-bg-800 p-4">
          <header className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-text-100">Vincular un número manualmente</h3>
              <p className="font-mono text-[11px] text-text-600">
                el número ya tiene que estar dado de alta con nosotros
              </p>
            </div>
            <Boton
              variante="fantasma"
              onClick={() => setFormManual(false)}
              disabled={conectandoManual}
              aria-label="Cerrar panel"
              className="min-h-8 px-2"
            >
              <X size={14} aria-hidden />
            </Boton>
          </header>
          <div className="flex flex-wrap items-end gap-2">
            <Campo
              id="linea-whatsapp"
              label="Id de línea"
              hint="el identificador que te dimos al dar de alta tu número"
              className="min-w-56 flex-1"
            >
              <input
                id="linea-whatsapp"
                value={linea}
                onChange={(e) => setLinea(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void conectarManual();
                }}
                disabled={conectandoManual}
                placeholder="p. ej. 1234567890"
                autoComplete="off"
                className={inputClass}
              />
            </Campo>
            <Boton variante="primario" onClick={conectarManual} loading={conectandoManual} disabled={!linea.trim()}>
              Vincular
            </Boton>
          </div>
        </div>
      )}

      <ModoConexionDialog
        open={elegirModo}
        onOpenChange={setElegirModo}
        coexistenciaPermitida={lista?.coexistencia_permitida ?? false}
        loading={conectandoNeuroApi}
        onConfirm={iniciarNeuroApi}
      />

      <ConfirmDialog
        open={aPausar !== null}
        onOpenChange={(o) => {
          if (!o && !confirmando) setAPausar(null);
        }}
        titulo={`¿Pausar ${aPausar ? nombreNumero(aPausar) : ""}?`}
        descripcion={
          <>
            Deja de responder y libera una plaza de tu plan. Conserva su configuración, sus herramientas y su
            historial; puedes reactivarlo si te queda plaza.
            {aPausar && lista && esUltimoActivo(lista.numeros, aPausar.id) && (
              <strong className="mt-2 block text-warning">
                Es tu último número activo: tu negocio no responderá por WhatsApp mientras no tenga un número
                activo.
              </strong>
            )}
          </>
        }
        confirmar="Pausar"
        loading={confirmando}
        onConfirm={confirmarPausa}
      />

      <ConfirmDialog
        open={aDesvincular !== null}
        onOpenChange={(o) => {
          if (!o && !confirmando) setADesvincular(null);
        }}
        titulo={`¿Desvincular ${aDesvincular ? nombreNumero(aDesvincular) : ""}?`}
        descripcion="El número deja de ser de tu negocio y libera su plaza. Sus conversaciones quedan ocultas, en solo lectura, 12 meses; nadie podrá responderlas, y si lo vinculas de nuevo no reaparecen."
        confirmar="Desvincular"
        peligro
        loading={confirmando}
        onConfirm={confirmarDesvinculacion}
      />
    </section>
  );
}
