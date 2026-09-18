"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { PreferenciaEstadoOut } from "@/lib/types";
import { formatoMonto } from "@/lib/formato";
import { Aviso, Boton, Cargando, PageHeader } from "@/app/components/ui";

/**
 * Retorno del checkout de Mercado Pago (back_urls.success / .pending).
 *
 * OJO: llegar acá NO significa que el pago esté acreditado. Esta URL es
 * pública y el usuario puede abrirla a mano; lo que confirma el cobro es el
 * webhook. Por eso la pantalla no afirma nada por su cuenta: le pregunta al
 * backend el estado real de la preferencia y muestra eso.
 *
 * Como el webhook puede tardar unos segundos más que el redirect, el estado
 * 'pendiente' es normal al principio y por eso hay un botón para reconsultar.
 */
export default function PagoExitoPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader titulo="Pago" />
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
  // Mercado Pago devuelve preference_id en la query del back_url.
  const preferenceId = params.get("preference_id");

  const pago = useApi<PreferenciaEstadoOut>(
    preferenceId ? `/api/pagos/preferencia/${encodeURIComponent(preferenceId)}` : null,
  );

  const estado = pago.data?.estado;
  const acreditado = estado === "aprobado";

  return (
    <>
      <PageHeader titulo="Pago" />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-md border border-bg-700 bg-bg-900 px-6 py-10 text-center">
          <div
            className={
              acreditado
                ? "flex h-12 w-12 items-center justify-center rounded-md border border-success/40 bg-success/10 text-success"
                : "flex h-12 w-12 items-center justify-center rounded-md border border-bg-700 bg-bg-800 text-text-400"
            }
          >
            {acreditado ? (
              <CheckCircle2 size={22} aria-hidden />
            ) : (
              <Clock size={22} aria-hidden />
            )}
          </div>

          {!preferenceId ? (
            <>
              <p className="text-sm font-medium text-text-100">Volviste del checkout</p>
              <p className="text-xs leading-relaxed text-text-400">
                No pudimos identificar el pago en esta dirección. Revisa el historial en
                la pantalla de suscripción para ver cómo quedó.
              </p>
            </>
          ) : pago.loading && !pago.data ? (
            <p className="font-mono text-xs text-text-600">consultando el pago…</p>
          ) : pago.error ? (
            <Aviso tipo="error">{pago.error}</Aviso>
          ) : acreditado ? (
            <>
              <p className="text-sm font-medium text-text-100">¡Listo, pago confirmado!</p>
              <p className="text-xs leading-relaxed text-text-400">
                Se acreditaron {formatoMonto(pago.data?.monto)} a tu cuenta. Ya puedes
                usar lo que compraste.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-text-100">Estamos confirmando tu pago</p>
              <p className="text-xs leading-relaxed text-text-400">
                Mercado Pago todavía no nos confirmó la operación. Suele tardar unos
                segundos; no hace falta pagar de nuevo.
              </p>
              <Boton variante="fantasma" onClick={() => pago.recargar()} loading={pago.loading}>
                <RefreshCw size={13} aria-hidden />
                Volver a consultar
              </Boton>
            </>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-md bg-bg-800 px-3 py-1.5 text-xs font-medium text-text-100 hover:bg-bg-700"
            >
              Ir al dashboard
            </Link>
            <Link
              href="/suscripcion"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-text-400 hover:bg-bg-800 hover:text-text-100"
            >
              Ver mi suscripción
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
