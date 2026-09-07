"use client";

/**
 * Diálogo de OAuth de Meta abierto a mano, sin el SDK de JavaScript.
 *
 * FB.login({ response_type: "code" }) genera el code contra un redirect_uri
 * interno que controla Facebook, no el nuestro. Cuando el backend intenta
 * canjear ese code mandando NUESTRO redirect_uri, Meta lo rechaza con
 * "Error validating verification code... redirect_uri is identical".
 * Abriendo el diálogo nosotros, el redirect_uri es exactamente el mismo en
 * los dos lados del intercambio (al pedir el code y al canjearlo).
 */

export const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
export const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID ?? "";
export const META_REDIRECT_URI = process.env.NEXT_PUBLIC_META_REDIRECT_URI ?? "";

const META_VERSION = "v26.0";
const DIALOG_URL = `https://www.facebook.com/${META_VERSION}/dialog/oauth`;

/** Marca que identifica los mensajes que van del popup a esta ventana. */
export const MENSAJE_OAUTH = "operativai:meta-oauth";

/** Si el usuario deja el popup abierto, no dejamos la promesa colgada para siempre. */
const TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Permisos que se piden cuando no hay config_id de Login for Business.
 *
 * `pages_manage_metadata` es obligatorio aunque no aparezca en el flujo de
 * lectura: es el permiso que habilita POST /{page_id}/subscribed_apps, o sea
 * el paso "Activar seleccionadas", que es lo que suscribe la app a los
 * webhooks de la página. Sin él, conectar funciona pero activar falla.
 */
const SCOPES = [
  "pages_show_list",
  "pages_manage_metadata",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_messages",
  "business_management",
].join(",");

/** Lo que el popup le manda a esta ventana al volver de Facebook. */
export interface MensajeOAuth {
  tipo: typeof MENSAJE_OAUTH;
  code?: string;
  state?: string;
  error?: string;
  errorDescripcion?: string;
}

export interface ResultadoOAuth {
  code: string;
  /** El mismo redirect_uri con el que se abrió el diálogo, para el canje. */
  redirectUri: string;
}

/** Valor aleatorio que ata la respuesta al diálogo que abrimos nosotros. */
function generarState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function construirUrlDialogo(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  // Login for Business usa config_id en vez de una lista de scopes sueltos.
  if (META_CONFIG_ID) params.set("config_id", META_CONFIG_ID);
  else params.set("scope", SCOPES);
  return `${DIALOG_URL}?${params.toString()}`;
}

/**
 * Abre el diálogo de Meta en un popup y espera el `code`.
 * Resuelve null si el usuario cerró la ventana sin autorizar.
 */
export function loginConCode(): Promise<ResultadoOAuth | null> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("El diálogo de Meta solo se abre en el navegador"));
  }
  if (!META_APP_ID) {
    return Promise.reject(
      new Error("Falta NEXT_PUBLIC_META_APP_ID en la configuración del portal"),
    );
  }
  if (!META_REDIRECT_URI) {
    return Promise.reject(
      new Error("Falta NEXT_PUBLIC_META_REDIRECT_URI en la configuración del portal"),
    );
  }

  const redirectUri = META_REDIRECT_URI;
  const state = generarState();

  const popup = window.open(
    construirUrlDialogo(state, redirectUri),
    "operativai-meta-oauth",
    "width=600,height=700,menubar=no,toolbar=no,location=no,status=no",
  );

  if (!popup) {
    return Promise.reject(
      new Error(
        "El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio y vuelve a intentar.",
      ),
    );
  }

  return new Promise<ResultadoOAuth | null>((resolve, reject) => {
    let terminado = false;

    const limpiar = () => {
      terminado = true;
      window.removeEventListener("message", alRecibirMensaje);
      clearInterval(intervalo);
      clearTimeout(temporizador);
    };

    function alRecibirMensaje(evento: MessageEvent) {
      if (terminado) return;
      // Solo aceptamos mensajes de nuestra propia página de callback.
      if (evento.origin !== window.location.origin) return;

      const datos = evento.data as MensajeOAuth | null;
      if (!datos || datos.tipo !== MENSAJE_OAUTH) return;

      // Sin esta comparación, otra pestaña podría inyectar un code ajeno.
      if (datos.state !== state) return;

      limpiar();
      popup?.close();

      if (datos.error) {
        reject(new Error(datos.errorDescripcion || datos.error));
        return;
      }
      if (!datos.code) {
        reject(new Error("Meta no devolvió el código de autorización"));
        return;
      }
      resolve({ code: datos.code, redirectUri });
    }

    window.addEventListener("message", alRecibirMensaje);

    // Si el usuario cierra el popup a mano, no llega ningún mensaje.
    const intervalo = setInterval(() => {
      if (popup.closed) {
        limpiar();
        resolve(null);
      }
    }, 500);

    const temporizador = setTimeout(() => {
      limpiar();
      if (!popup.closed) popup.close();
      reject(new Error("La conexión con Meta tardó demasiado. Intenta de nuevo."));
    }, TIMEOUT_MS);
  });
}
