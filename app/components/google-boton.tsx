"use client";

import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID, cargarGoogleIdentity } from "@/lib/google-identity";
import { cn } from "@/lib/utils";

/**
 * Google guarda UNA sola configuración por página: llamar a `initialize()`
 * otra vez (al volver a /login, o el doble montaje de StrictMode en
 * desarrollo) la reemplaza y dispara el aviso "initialize() is called
 * multiple times". Por eso se inicializa una sola vez y el callback que
 * registra apunta a `manejadorActivo`: siempre el del botón montado ahora.
 * `renderButton` sí se llama en cada montaje, porque dibuja dentro del
 * contenedor de esa instancia.
 */
let inicializado = false;
let manejadorActivo: ((credential: string) => void) | null = null;

/**
 * Botón "Continuar con Google". Atajo opcional a /login y /registro: no
 * reemplaza el alta con correo, entra por POST /api/auth/google con el ID
 * token que dibuja Google. Sin NEXT_PUBLIC_GOOGLE_CLIENT_ID no se dibuja
 * nada, en vez de mostrar un botón que nunca va a funcionar.
 */
export function GoogleBoton({
  onCredential,
  disabled = false,
  className,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  // Ref para no tener que reinicializar el botón de Google cada vez que
  // el padre pasa un callback nuevo (login/registro lo recrean en cada
  // render). Se actualiza en un efecto aparte, sin deps, para no escribir
  // un ref durante el render.
  const callbackRef = useRef(onCredential);
  useEffect(() => {
    callbackRef.current = onCredential;
  });

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelado = false;

    const miManejador = (credential: string) => callbackRef.current(credential);
    manejadorActivo = miManejador;

    cargarGoogleIdentity()
      .then(() => {
        if (cancelado || !window.google || !contenedorRef.current) return;
        if (!inicializado) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (resp) => manejadorActivo?.(resp.credential),
          });
          inicializado = true;
        }
        window.google.accounts.id.renderButton(contenedorRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 320,
        });
      })
      .catch(() => {
        // Sin la librería de Google, el botón simplemente no aparece: el
        // alta con correo sigue disponible igual.
      });

    return () => {
      cancelado = true;
      // Solo si sigue siendo el nuestro: al navegar, el botón nuevo ya
      // puede haberse registrado antes de que este se desmonte.
      if (manejadorActivo === miManejador) manejadorActivo = null;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div
      ref={contenedorRef}
      className={cn("flex justify-center", disabled && "pointer-events-none opacity-50", className)}
    />
  );
}
