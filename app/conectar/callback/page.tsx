"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MENSAJE_OAUTH, type MensajeOAuth } from "@/lib/meta-oauth";

const noop = () => () => {};

/**
 * Página a la que Facebook redirige el popup después del diálogo de OAuth.
 * No tiene UI real: lee el `code` de sus propios query params, se lo pasa
 * por postMessage a la ventana que abrió el popup, y se cierra sola.
 *
 * Vive fuera de (privado) a propósito: no necesita sesión, y el layout
 * privado la mandaría a /login antes de poder entregar el code.
 *
 * Los query params se leen de window.location en vez de useSearchParams()
 * para no arrastrar el Suspense que ese hook exige en el App Router.
 */
export default function MetaCallbackPage() {
  // false durante el render del servidor y la hidratación, true ya montado.
  const hidratado = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!window.opener) return;

    const params = new URLSearchParams(window.location.search);
    const payload: MensajeOAuth = {
      tipo: MENSAJE_OAUTH,
      code: params.get("code") ?? undefined,
      state: params.get("state") ?? undefined,
      error: params.get("error") ?? undefined,
      errorDescripcion:
        params.get("error_description") ?? params.get("error_reason") ?? undefined,
    };

    window.opener.postMessage(payload, window.location.origin);
    window.close();
  }, []);

  // Si no hay opener, alguien entró a esta URL a mano: no hay nada que entregar.
  const sinOpener = hidratado && !window.opener;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="max-w-xs text-center font-mono text-xs text-text-400">
        {sinOpener
          ? "Abre esta página desde el botón «Conectar con Facebook» del portal, no directamente."
          : "Conectando con Meta… ya puedes cerrar esta ventana."}
      </p>
    </div>
  );
}
