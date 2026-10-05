"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { apiFetch, mensajeDeError } from "@/lib/auth";
import { formatoFechaHora } from "@/lib/formato";
import type { PortalClienteOut } from "@/lib/types";
import { Aviso, Boton } from "@/app/components/ui";

/**
 * "Gestionar / Cancelar suscripción": abre el Customer Portal de Stripe.
 *
 * La URL la genera el backend en el momento (es de un solo uso y vence en
 * minutos), por eso se pide al hacer clic y no se guarda. Lo que se cancele
 * allá vuelve por el webhook de Stripe y aparece acá como "cancelada".
 */
export function PortalStripe({
  fechaRenovacion,
  cancelaAlVencer,
}: {
  fechaRenovacion: string | null;
  cancelaAlVencer: boolean;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abrir = async () => {
    setAbriendo(true);
    setError(null);
    try {
      const { url } = await apiFetch<PortalClienteOut>("/api/pagos/portal-cliente", {
        method: "POST",
      });
      window.location.assign(url);
    } catch (e) {
      setError(mensajeDeError(e, "No se pudo abrir el portal de Stripe."));
      setAbriendo(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border border-bg-700 bg-bg-900 p-4">
      <header>
        <h2 className="text-sm font-medium text-text-100">Gestionar suscripción</h2>
        <p className="font-mono text-[11px] text-text-600">
          cancelar el plan, cambiar la tarjeta o ver tus facturas, en el portal seguro de Stripe
        </p>
      </header>
      {fechaRenovacion && (
        <p className="text-xs leading-relaxed text-text-400">
          {cancelaAlVencer ? (
            <>
              Ya cancelaste tu plan: lo sigues usando hasta el{" "}
              <strong className="text-text-100">{formatoFechaHora(fechaRenovacion)}</strong> y no se
              vuelve a cobrar.
            </>
          ) : (
            <>
              Si cancelas, no se reembolsa lo ya pagado: conservas el plan hasta el{" "}
              <strong className="text-text-100">{formatoFechaHora(fechaRenovacion)}</strong>. Si
              además piensas borrar tu cuenta, te conviene esperar a esa fecha: al borrarla antes,
              los días pagados se pierden.
            </>
          )}
        </p>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div>
        <Boton variante="secundario" onClick={() => void abrir()} loading={abriendo}>
          <ExternalLink size={13} aria-hidden />
          Gestionar / Cancelar suscripción
        </Boton>
      </div>
    </section>
  );
}
