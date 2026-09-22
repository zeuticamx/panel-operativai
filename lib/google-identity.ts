"use client";

/**
 * Carga del script de Google Identity Services para el botón "Continuar
 * con Google" de /login y /registro. A diferencia de Meta (lib/meta-oauth.ts),
 * acá no hace falta un popup a mano: el botón de Google entrega un ID
 * token (JWT) firmado directo en el callback, y ese token es justo lo que
 * POST /api/auth/google necesita para validar contra Google.
 */

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

let cargando: Promise<void> | null = null;

/** Idempotente: el script se inserta y se espera una sola vez por página. */
export function cargarGoogleIdentity(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Identity Services solo carga en el navegador"));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (cargando) return cargando;

  cargando = new Promise<void>((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existente) {
      existente.addEventListener("load", () => resolve());
      existente.addEventListener("error", () =>
        reject(new Error("No se pudo cargar Google Identity Services")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Identity Services"));
    document.head.appendChild(script);
  });

  return cargando;
}
