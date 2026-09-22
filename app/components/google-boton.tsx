"use client";

import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID, cargarGoogleIdentity } from "@/lib/google-identity";
import { cn } from "@/lib/utils";

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

    cargarGoogleIdentity()
      .then(() => {
        if (cancelado || !window.google || !contenedorRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp) => callbackRef.current(resp.credential),
        });
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
