"use client";

/**
 * WhatsApp Embedded Signup de Meta.
 *
 * A diferencia de Facebook/Instagram (lib/meta-oauth.ts, que abre el diálogo
 * de OAuth a mano para controlar el redirect_uri), este flujo sí necesita el
 * SDK de JavaScript de Meta: el waba_id/phone_number_id que el negocio eligió
 * llegan por un evento `message` del propio SDK (WA_EMBEDDED_SIGNUP), no por
 * query params de un redirect_uri.
 */

export const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
export const META_WA_CONFIG_ID = process.env.NEXT_PUBLIC_META_WA_CONFIG_ID ?? "";

const META_VERSION = "v26.0";
const SDK_URL = "https://connect.facebook.net/es_LA/sdk.js";

/** Si el usuario deja la ventana abierta, no dejamos la promesa colgada para siempre. */
const TIMEOUT_MS = 5 * 60 * 1000;

export interface ResultadoEmbeddedSignup {
  wabaId: string;
  phoneNumberId: string;
}

declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; version: string; xfbml?: boolean }) => void;
      login: (
        callback: (respuesta: unknown) => void,
        params: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let sdkListo: Promise<void> | null = null;

function cargarSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("El SDK de Meta solo se carga en el navegador"));
  }
  if (window.FB) return Promise.resolve();
  if (sdkListo) return sdkListo;

  sdkListo = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: META_APP_ID, version: META_VERSION, xfbml: false });
      resolve();
    };
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("No se pudo cargar el SDK de Meta"));
    document.body.appendChild(script);
  });
  return sdkListo;
}

/**
 * Abre el Embedded Signup y espera el evento WA_EMBEDDED_SIGNUP con el
 * waba_id/phone_number_id elegidos. Resuelve null si el negocio canceló.
 */
export async function conectarWhatsAppEmbeddedSignup(): Promise<ResultadoEmbeddedSignup | null> {
  if (!META_APP_ID) {
    throw new Error("Falta NEXT_PUBLIC_META_APP_ID en la configuración del portal");
  }
  if (!META_WA_CONFIG_ID) {
    throw new Error("Falta NEXT_PUBLIC_META_WA_CONFIG_ID en la configuración del portal");
  }

  await cargarSdk();

  return new Promise<ResultadoEmbeddedSignup | null>((resolve, reject) => {
    let terminado = false;

    const limpiar = () => {
      terminado = true;
      window.removeEventListener("message", alRecibirMensaje);
      clearTimeout(temporizador);
    };

    function alRecibirMensaje(evento: MessageEvent) {
      if (terminado) return;
      // El SDK manda este evento desde facebook.com, nunca desde nuestro origen.
      if (evento.origin !== "https://www.facebook.com" && evento.origin !== "https://web.facebook.com") {
        return;
      }

      let datos: unknown;
      try {
        datos = typeof evento.data === "string" ? JSON.parse(evento.data) : evento.data;
      } catch {
        return;
      }
      if (!datos || typeof datos !== "object") return;

      const mensaje = datos as { type?: string; event?: string; data?: Record<string, unknown> };
      if (mensaje.type !== "WA_EMBEDDED_SIGNUP") return;

      if (mensaje.event === "CANCEL") {
        limpiar();
        resolve(null);
        return;
      }

      // No se distingue por nombre de evento (Meta ha agregado variantes como
      // FINISH_ONLY_WABA): basta con que traiga los dos ids que necesitamos.
      const wabaId = mensaje.data?.waba_id;
      const phoneNumberId = mensaje.data?.phone_number_id;
      if (typeof wabaId === "string" && typeof phoneNumberId === "string") {
        limpiar();
        resolve({ wabaId, phoneNumberId });
      }
    }

    window.addEventListener("message", alRecibirMensaje);

    const temporizador = setTimeout(() => {
      limpiar();
      reject(new Error("La conexión con WhatsApp tardó demasiado. Intenta de nuevo."));
    }, TIMEOUT_MS);

    window.FB?.login(
      () => {
        // La respuesta real llega por el evento `message` de arriba; este
        // callback del SDK solo confirma que el diálogo se cerró.
      },
      {
        config_id: META_WA_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "2",
        },
      },
    );
  });
}
