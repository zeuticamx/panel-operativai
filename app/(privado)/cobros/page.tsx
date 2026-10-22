"use client";

import { useState, type FormEvent } from "react";
import { Copy, ExternalLink, Wallet } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type {
  CobroConnectOut,
  ConnectEstadoOut,
  ConnectOnboardingOut,
  CrearCobroConnectIn,
  EstadoCobroConnect,
} from "@/lib/types";
import { formatoFechaHora, formatoMonto } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Aviso, Boton, Campo, Cargando, PageHeader, inputClass } from "@/app/components/ui";

const ESTADO_INFO: Record<EstadoCobroConnect, { label: string; clase: string }> = {
  activo: { label: "Activo", clase: "text-text-400" },
  pagado: { label: "Pagado", clase: "text-success" },
  desactivado: { label: "Desactivado", clase: "text-text-600" },
};

/**
 * Cobros propios del negocio (Stripe Connect): conectar la cuenta y generar
 * links de pago para los propios clientes del negocio. Distinto de
 * /suscripcion, que es lo que el negocio le paga a OperativAI.
 *
 * El mismo link lo puede generar el agente de IA dentro de una conversación
 * (columna "Origen" de la tabla) — esta pantalla es solo la vía manual.
 */
export default function CobrosPage() {
  const estado = useApi<ConnectEstadoOut>("/api/pagos/connect/estado");
  const cobros = useApi<CobroConnectOut[]>("/api/pagos/connect/cobros");

  const [conectando, setConectando] = useState(false);
  const [errorConectar, setErrorConectar] = useState<string | null>(null);

  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const e = estado.data;
  const listo = e?.charges_habilitado === true;

  const conectar = async () => {
    setErrorConectar(null);
    setConectando(true);
    try {
      const { url } = await apiFetch<ConnectOnboardingOut>("/api/pagos/connect/onboarding", {
        method: "POST",
      });
      window.location.assign(url);
    } catch (err) {
      setErrorConectar(mensajeDeError(err, "No se pudo iniciar la conexión con Stripe."));
      setConectando(false);
    }
  };

  const crear = async (ev: FormEvent) => {
    ev.preventDefault();
    setErrorCrear(null);
    setCreando(true);
    try {
      const cuerpo: CrearCobroConnectIn = { descripcion, monto };
      await apiFetch<CobroConnectOut>("/api/pagos/connect/cobros", { method: "POST", json: cuerpo });
      setDescripcion("");
      setMonto("");
      await cobros.recargar();
    } catch (err) {
      setErrorCrear(mensajeDeError(err, "No se pudo generar el cobro."));
    } finally {
      setCreando(false);
    }
  };

  const copiar = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(url);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // Sin permiso de portapapeles: el link ya queda visible para copiar a mano.
    }
  };

  if (estado.loading && !e) {
    return (
      <>
        <PageHeader titulo="Cobros" />
        <Cargando />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Cobros"
        sub={
          listo ? (
            <span>cuenta de Stripe conectada</span>
          ) : (
            <span>conecta tu cuenta para empezar a cobrarle a tus clientes</span>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {!listo && (
            <section
              data-tour="cobros.conectar"
              className="flex flex-col gap-3 rounded-md border border-bg-700 bg-bg-900 p-4"
            >
              <header>
                <h2 className="text-sm font-medium text-text-100">Conectar con Stripe</h2>
                <p className="font-mono text-[11px] text-text-600">
                  cobra directo a tus clientes con links de pago — el dinero llega a tu propia cuenta
                  de Stripe, no pasa por OperativAI
                </p>
              </header>
              {e?.conectado && e.requisitos_pendientes.length > 0 && (
                <Aviso tipo="info">
                  Stripe todavía necesita algunos datos para activar los cobros. Retoma el proceso
                  para terminarlo.
                </Aviso>
              )}
              {errorConectar && <Aviso tipo="error">{errorConectar}</Aviso>}
              <div>
                <Boton variante="primario" onClick={() => void conectar()} loading={conectando}>
                  <ExternalLink size={13} aria-hidden />
                  {e?.conectado ? "Terminar de conectar" : "Conectar con Stripe"}
                </Boton>
              </div>
            </section>
          )}

          {listo && (
            <section
              data-tour="cobros.generar"
              className="flex flex-col gap-3 rounded-md border border-bg-700 bg-bg-900 p-4"
            >
              <header>
                <h2 className="text-sm font-medium text-text-100">Generar un cobro</h2>
                <p className="font-mono text-[11px] text-text-600">
                  crea un link de pago para mandarle a un cliente
                </p>
              </header>
              {errorCrear && <Aviso tipo="error">{errorCrear}</Aviso>}
              <form onSubmit={(ev) => void crear(ev)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Campo id="descripcion" label="Concepto" className="flex-1">
                  <input
                    id="descripcion"
                    className={inputClass}
                    value={descripcion}
                    onChange={(ev) => setDescripcion(ev.target.value)}
                    maxLength={255}
                    required
                    placeholder="Reparación de bomba de agua"
                  />
                </Campo>
                <Campo id="monto" label="Monto" className="sm:w-36">
                  <input
                    id="monto"
                    className={inputClass}
                    value={monto}
                    onChange={(ev) => setMonto(ev.target.value)}
                    inputMode="decimal"
                    required
                    placeholder="500.00"
                  />
                </Campo>
                <Boton type="submit" variante="primario" loading={creando}>
                  <Wallet size={13} aria-hidden />
                  Generar link
                </Boton>
              </form>
            </section>
          )}

          <section
            data-tour="cobros.historial"
            className="flex flex-col gap-3 rounded-md border border-bg-700 bg-bg-900 p-4"
          >
            <h2 className="text-sm font-medium text-text-100">Cobros generados</h2>
            {cobros.loading && !cobros.data ? (
              <Cargando />
            ) : !cobros.data?.length ? (
              <p className="font-mono text-[11px] text-text-600">todavía no generaste ningún cobro</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-bg-700 text-left text-text-600">
                      <th className="py-2 pr-3 font-normal">Concepto</th>
                      <th className="py-2 pr-3 font-normal">Monto</th>
                      <th className="py-2 pr-3 font-normal">Estado</th>
                      <th className="py-2 pr-3 font-normal">Origen</th>
                      <th className="py-2 pr-3 font-normal">Creado</th>
                      <th className="py-2 font-normal">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobros.data.map((c) => (
                      <tr key={c.id} className="border-b border-bg-800">
                        <td className="py-2 pr-3 text-text-100">{c.descripcion}</td>
                        <td className="py-2 pr-3 text-text-100">{formatoMonto(c.monto)}</td>
                        <td className={cn("py-2 pr-3", ESTADO_INFO[c.estado].clase)}>
                          {ESTADO_INFO[c.estado].label}
                        </td>
                        <td className="py-2 pr-3 text-text-400">
                          {c.generado_por_agente ? "Agente" : "Tú"}
                        </td>
                        <td className="py-2 pr-3 text-text-400">{formatoFechaHora(c.creado_en)}</td>
                        <td className="py-2">
                          {c.url_cobro && (
                            <button
                              type="button"
                              onClick={() => void copiar(c.url_cobro!)}
                              className="inline-flex items-center gap-1 text-text-400 hover:text-text-100"
                            >
                              <Copy size={12} aria-hidden />
                              {copiado === c.url_cobro ? "copiado" : "copiar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
