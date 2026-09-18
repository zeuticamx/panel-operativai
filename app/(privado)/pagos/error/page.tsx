"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { XCircle } from "lucide-react";
import { Cargando, PageHeader } from "@/app/components/ui";

/**
 * Retorno de un pago que no prosperó (back_urls.failure).
 *
 * No hay nada que deshacer acá: la transacción quedó como 'pendiente' o
 * 'rechazado' del lado del backend según lo que diga el webhook, y reintentar
 * es simplemente crear un pago nuevo desde la pantalla de suscripción.
 */
export default function PagoErrorPage() {
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

/** Los motivos que manda Mercado Pago, traducidos a algo accionable. */
const MOTIVOS: Record<string, string> = {
  cc_rejected_insufficient_amount: "La tarjeta no tenía fondos suficientes.",
  cc_rejected_bad_filled_card_number: "El número de tarjeta quedó mal escrito.",
  cc_rejected_bad_filled_date: "La fecha de vencimiento quedó mal escrita.",
  cc_rejected_bad_filled_security_code: "El código de seguridad no coincide.",
  cc_rejected_high_risk: "El banco rechazó la operación por seguridad.",
  cc_rejected_call_for_authorize: "Tu banco pide que autorices el cargo antes de reintentar.",
};

function Contenido() {
  const params = useSearchParams();
  const motivo = params.get("status_detail");
  const explicacion = motivo ? MOTIVOS[motivo] : null;

  return (
    <>
      <PageHeader titulo="Pago" />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-md border border-bg-700 bg-bg-900 px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-danger/40 bg-danger/10 text-danger">
            <XCircle size={22} aria-hidden />
          </div>

          <p className="text-sm font-medium text-text-100">El pago no se completó</p>
          <p className="text-xs leading-relaxed text-text-400">
            {explicacion ??
              "Mercado Pago no pudo procesar la operación. No se te cobró nada."}
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/suscripcion"
              className="rounded-md bg-bg-800 px-3 py-1.5 text-xs font-medium text-text-100 hover:bg-bg-700"
            >
              Reintentar
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-text-400 hover:bg-bg-800 hover:text-text-100"
            >
              Ir al dashboard
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
