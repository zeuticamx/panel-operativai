"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getAccessToken, mensajeDeError, setTokens } from "@/lib/auth";
import { etiquetaRol, inicioDeRol } from "@/lib/roles";
import type { AceptarInvitacionIn, InvitacionInfoOut, InvitacionTokenIn, TokenOut } from "@/lib/types";
import { AceptarTerminos } from "@/app/components/aceptar-terminos";
import { AuthShell } from "@/app/components/auth-shell";
import { Aviso, Boton, Campo, Cargando, inputClass } from "@/app/components/ui";

const PASSWORD_MIN = 8;

/**
 * Aceptar una invitación al equipo de un negocio (routers/equipo.py).
 *
 * El token llega en el fragmento (#t=...) y no en la query: el fragmento no
 * viaja al servidor, así que no queda en logs de acceso. Al backend se manda
 * en el body. El rol y el negocio salen de la invitación; acá el invitado
 * solo elige su contraseña.
 */
function leerToken(): string | null {
  const m = /[#&]t=([^&]+)/.exec(window.location.hash);
  return m ? decodeURIComponent(m[1]) : null;
}

function suscribirHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export default function InvitacionPage() {
  const router = useRouter();
  // undefined en servidor e hidratación; null si el enlace no trae token.
  const token = useSyncExternalStore(suscribirHash, leerToken, () => undefined);

  const [info, setInfo] = useState<InvitacionInfoOut | null>(null);
  const [errorEnlace, setErrorEnlace] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    const revisar = async () => {
      try {
        const body: InvitacionTokenIn = { token };
        const r = await apiFetch<InvitacionInfoOut>("/api/auth/invitacion/revisar", {
          method: "POST",
          json: body,
          auth: false,
        });
        if (vigente) setInfo(r);
      } catch (e) {
        if (vigente) setErrorEnlace(mensajeDeError(e, "No se pudo abrir la invitación."));
      }
    };
    void revisar();
    return () => {
      vigente = false;
    };
  }, [token]);

  const errorPassword =
    tocado && password.length > 0 && password.length < PASSWORD_MIN ? `Mínimo ${PASSWORD_MIN} caracteres` : null;
  const errorConfirmacion =
    tocado && confirmacion.length > 0 && confirmacion !== password ? "Las contraseñas no coinciden" : null;
  const listo = password.length >= PASSWORD_MIN && confirmacion === password && aceptaTerminos;

  const aceptar = async (e: FormEvent) => {
    e.preventDefault();
    setTocado(true);
    if (!token || !info || !listo || loading) return;
    setLoading(true);
    setError(null);
    try {
      const body: AceptarInvitacionIn = { token, password, acepta_terminos: true };
      const tokens = await apiFetch<TokenOut>("/api/auth/invitacion/aceptar", {
        method: "POST",
        json: body,
        auth: false,
      });
      setTokens(tokens);
      // Sin apagar `loading`: la navegación desmonta la página igual. La
      // guarda de rol del layout privado lleva al vendedor a su cartera.
      router.replace(inicioDeRol({ role: info.role }));
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo crear tu acceso."));
      setLoading(false);
    }
  };

  const pie = (
    <>
      ¿Ya tienes cuenta?{" "}
      <Link href="/login" className="font-medium text-text-100 underline-offset-2 hover:underline">
        Iniciar sesión
      </Link>
    </>
  );

  if (token === undefined || (token && !info && !errorEnlace)) {
    return (
      <AuthShell titulo="Invitación" sub="Revisando tu enlace…" pie={pie}>
        <div className="mt-8">
          <Cargando texto="revisando invitación…" />
        </div>
      </AuthShell>
    );
  }

  if (!token || errorEnlace || !info) {
    return (
      <AuthShell titulo="Invitación no válida" sub="No pudimos usar este enlace" pie={pie}>
        <div data-tour="auth.form" className="mt-8 flex flex-col gap-4">
          <Aviso tipo="error">
            {errorEnlace ??
              "El enlace está incompleto. Ábrelo directo desde el correo de invitación, sin recortarlo."}
          </Aviso>
        </div>
      </AuthShell>
    );
  }

  const rol = etiquetaRol(info.role).toLowerCase();
  return (
    <AuthShell
      titulo={`Únete a ${info.nombre_negocio}`}
      sub={
        (info.vendedor_nombre ?? info.proveedor_nombre)
          ? `Te invitaron como ${rol}, con la ficha de ${info.vendedor_nombre ?? info.proveedor_nombre}`
          : `Te invitaron como ${rol}`
      }
      pie={pie}
    >
      <form data-tour="auth.form" onSubmit={aceptar} className="mt-8 flex flex-col gap-4" noValidate>
        {getAccessToken() && (
          <Aviso tipo="info">
            Ya hay una sesión abierta en este navegador. Al crear tu acceso, entrarás con la cuenta nueva.
          </Aviso>
        )}

        <Campo id="email" label="Correo" hint="con este correo vas a iniciar sesión">
          <input id="email" type="email" value={info.email} readOnly disabled className={inputClass} />
        </Campo>

        <Campo id="password" label="Elige una contraseña" hint={`Mínimo ${PASSWORD_MIN} caracteres`} error={errorPassword}>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTocado(true)}
            autoComplete="new-password"
            autoFocus
            disabled={loading}
            placeholder="••••••••"
            minLength={PASSWORD_MIN}
            maxLength={128}
            required
            className={inputClass}
          />
        </Campo>

        <Campo id="confirmacion" label="Confirma la contraseña" error={errorConfirmacion}>
          <input
            id="confirmacion"
            type="password"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            onBlur={() => setTocado(true)}
            autoComplete="new-password"
            disabled={loading}
            placeholder="••••••••"
            maxLength={128}
            required
            className={inputClass}
          />
        </Campo>

        <AceptarTerminos checked={aceptaTerminos} onChange={setAceptaTerminos} disabled={loading} />

        {error && <Aviso tipo="error">{error}</Aviso>}

        <Boton type="submit" variante="primario" loading={loading} disabled={!listo} className="mt-2 py-2 text-sm">
          {loading ? "Creando tu acceso…" : "Crear mi acceso"}
        </Boton>
      </form>
    </AuthShell>
  );
}
