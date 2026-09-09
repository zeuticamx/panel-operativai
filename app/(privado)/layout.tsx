"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, onAuthChange } from "@/lib/auth";
import { Sidebar } from "@/app/components/sidebar";
import { ChatWidget } from "@/app/components/chat-widget";
import { UsuarioProvider } from "@/app/components/usuario-context";

const noop = () => () => {};

/**
 * Guarda de rutas privadas. Solo revisa que exista un access_token para
 * evitar el parpadeo de contenido protegido; la validación real la hace
 * el backend en cada petición (y apiFetch manda a /login si el refresh
 * falla).
 */
export default function PrivadoLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  // false en servidor e hidratación, true una vez montado en el cliente.
  // Sin esto, el primer render (token = null) mandaría a /login siempre.
  const hidratado = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const token = useSyncExternalStore(onAuthChange, getAccessToken, () => null);

  useEffect(() => {
    if (hidratado && !token) router.replace("/login");
  }, [hidratado, token, router]);

  if (!hidratado || !token) {
    return (
      <div className="flex flex-1 items-center justify-center font-mono text-xs text-text-600">
        verificando sesión…
      </div>
    );
  }

  return (
    <UsuarioProvider>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
        <ChatWidget />
      </div>
    </UsuarioProvider>
  );
}
