"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { ConnectEstadoOut, ConnectOnboardingOut } from "@/lib/types";
import { Aviso, Boton, Cargando, PageHeader } from "@/app/components/ui";

/**
 * Retorno del Account Link de Stripe (return_url / refresh_url).
 *
 * Igual regla que /pagos/exito: llegar acá no significa que el onboarding
 * haya terminado — es una URL pública y Stripe puede mandar de vuelta sin
 * que la cuenta ya pueda cobrar (datos pendientes, o el link venció y
 * Stripe usó refresh_url). Por eso se vuelve a consultar el estado real en
 * vez de asumir nada por el query param.
 */
export default function CobrosConectarPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader titulo="Cobros" />
          <Cargando />
        </>
      }
    >
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const params = useSearchParams();
  const esRefresh = params.get("refresh") === "1";

  const estado = useApi<ConnectEstadoOut>("/api/pagos/connect/estado");
  const [reconectando, setReconectando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listo = estado.data?.charges_habilitado === true;

  // El Account Link anterior venció o Stripe lo invalidó (refresh_url):
  // hay que pedir uno nuevo, no se puede reusar el mismo.
  const reconectar = async () => {
    setError(null);
    setReconectando(true);
    try {
      const { url } = await apiFetch<ConnectOnboardingOut>("/api/pagos/connect/onboarding", {
        method: "POST",
      });
      window.location.assign(url);
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo continuar con Stripe."));
      setReconectando(false);
    }
  };

  return (
    <>
      <PageHeader titulo="Cobros" />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-md border border-bg-700 bg-bg-900 px-6 py-10 text-center">
          <div
            className={
              listo
                ? "flex h-12 w-12 items-center justify-center rounded-md border border-success/40 bg-success/10 text-success"
                : "flex h-12 w-12 items-center justify-center rounded-md border border-bg-700 bg-bg-800 text-text-400"
            }
          >
            {listo ? <CheckCircle2 size={22} aria-hidden /> : <Clock size={22} aria-hidden />}
          </div>

          {estado.loading && !estado.data ? (
            <p className="font-mono text-xs text-text-600">consultando tu cuenta de Stripe…</p>
          ) : estado.error ? (
            <Aviso tipo="error">{estado.error}</Aviso>
          ) : listo ? (
            <>
              <p className="text-sm font-medium text-text-100">¡Listo, tu cuenta ya puede cobrar!</p>
              <p className="text-xs leading-relaxed text-text-400">
                Ya puedes generar links de pago para tus clientes desde Cobros.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-text-100">
                {esRefresh ? "El enlace anterior venció" : "Todavía falta terminar el proceso"}
              </p>
              <p className="text-xs leading-relaxed text-text-400">
                Stripe necesita algunos datos más antes de poder cobrar. Retoma el proceso para
                terminarlo.
              </p>
              {error && <Aviso tipo="error">{error}</Aviso>}
              <Boton variante="primario" onClick={() => void reconectar()} loading={reconectando}>
                <RefreshCw size={13} aria-hidden />
                Continuar con Stripe
              </Boton>
            </>
          )}

          <Link
            href="/cobros"
            className="mt-2 rounded-md px-3 py-1.5 text-xs font-medium text-text-400 hover:bg-hover hover:text-text-100"
          >
            Ir a Cobros
          </Link>
        </div>
      </div>
    </>
  );
}
